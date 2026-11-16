import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const home = path.join(process.env.LOCALAPPDATA || '', 'PlaywrightMCP');
const key = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 20);
const statePath = path.join(home, `server-${key}.json`);
const pipe = `\\\\.\\pipe\\playwright-mcp-${key}`;
const tokenPath = path.join(home, 'extension-token.txt');
const url = 'http://127.0.0.1:8931/mcp';
const action = process.argv[2] || 'start';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function state() { try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return null; } }

async function control(command) {
  const saved = state();
  if (!saved) throw new Error('No managed background server.');
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection(pipe);
    let text = '';
    socket.setTimeout(5000, () => socket.destroy(new Error('Control request timed out.')));
    socket.on('connect', () => socket.write(JSON.stringify({ command, nonce: saved.nonce }) + '\n'));
    socket.on('data', chunk => { text += chunk; });
    socket.on('error', reject);
    socket.on('end', () => {
      try { const r = JSON.parse(text); if (r.error) reject(new Error(r.error)); else resolve(r); }
      catch (e) { reject(e); }
    });
  });
}

// Protocol health, never a browser call. No TCP/CIM process enumeration needed.
async function probe() {
  let session;
  let protocol;
  async function rpc(method, params, id) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (session) headers['Mcp-Session-Id'] = session;
    if (protocol) headers['MCP-Protocol-Version'] = protocol;
    const response = await fetch(url, { method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', method, params, ...(id === undefined ? {} : { id }) }),
      signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
    session ||= response.headers.get('mcp-session-id');
    if (id === undefined) { await response.body?.cancel(); return; }
    const text = await response.text();
    const messages = response.headers.get('content-type')?.includes('text/event-stream')
      ? text.split(/\r?\n/).filter(s => s.startsWith('data:')).map(s => JSON.parse(s.slice(5)))
      : [JSON.parse(text)];
    const message = messages.find(x => x.id === id);
    if (!message || message.error) throw new Error('MCP protocol request failed.');
    return message.result;
  }
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {},
      clientInfo: { name: 'offline-background-health', version: '1.0.0' } }, 1);
    protocol = init.protocolVersion;
    if (!protocol || !init.capabilities?.tools) throw new Error('Not an MCP tools server.');
    await rpc('notifications/initialized');
    const result = await rpc('tools/list', {}, 2);
    if (!result.tools?.some(t => t.name === 'browser_snapshot')) throw new Error('Playwright tools missing.');
    return result.tools.length;
  } finally {
    if (session) {
      await fetch(url, { method: 'DELETE', headers: { 'Mcp-Session-Id': session,
        ...(protocol ? { 'MCP-Protocol-Version': protocol } : {}) }, signal: AbortSignal.timeout(1000) }).catch(() => {});
    }
  }
}

async function serve() {
  const nonce = crypto.randomBytes(32).toString('hex');
  let child;
  let stopping = false;
  const server = net.createServer(socket => {
    let text = '';
    socket.setTimeout(3000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', chunk => {
      text += chunk;
      if (text.length > 2048) return socket.destroy();
      if (!text.includes('\n')) return;
      socket.removeAllListeners('data');
      try {
        const request = JSON.parse(text.trim());
        if (request.nonce !== nonce) return socket.end(JSON.stringify({ error: 'Unauthorized control request.' }));
        if (request.command === 'status') return socket.end(JSON.stringify({ pid: child?.pid, url, stopping }));
        if (request.command !== 'stop') return socket.end(JSON.stringify({ error: 'Unknown command.' }));
        if (stopping) return socket.end(JSON.stringify({ error: 'Already stopping.' }));
        stopping = true;
        // Stop only the child this supervisor owns; no saved-PID killing.
        if (child?.exitCode === null) {
          child.once('exit', () => socket.end(JSON.stringify({ stopped: true })));
          child.kill();
        } else { socket.end(JSON.stringify({ stopped: true })); clean(); }
      } catch { socket.end(JSON.stringify({ error: 'Invalid control request.' })); }
    });
  });
  server.on('error', () => process.exit(1));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
  const clean = () => {
    if (state()?.nonce === nonce) { try { fs.unlinkSync(statePath); } catch {} }
    server.close();
  };
  let log;
  try {
    fs.writeFileSync(statePath, JSON.stringify({ nonce, pid: process.pid, root }), { mode: 0o600 });
    log = fs.openSync(path.join(home, `server-${key}.log`), 'a');
    child = spawn(process.execPath, [path.join(root, 'node_modules', '@playwright', 'mcp', 'cli.js'),
    '--extension', '--browser=msedge', '--background', '--port=8931', '--host=127.0.0.1'],
    { cwd: root, windowsHide: true, stdio: ['ignore', log, log],
      // DSH rc.1 compatibility: its HTTP client can miss server pings. Scope to this MCP child.
      env: { ...process.env, PLAYWRIGHT_MCP_PING_TIMEOUT_MS: '0', DEBUG: '', PWDEBUG: '' } });
  } catch (error) { clean(); throw error; }
  finally { if (log !== undefined) fs.closeSync(log); }
  child.once('error', () => { clean(); process.exitCode = 1; });
  child.once('exit', code => { clean(); if (!stopping && code) process.exitCode = 1; });
  process.once('SIGTERM', () => { stopping = true; child.kill(); });
}

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 24)
    throw new Error('Use the existing DSH Windows x64 Node 24 runtime.');
  if (!process.env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is missing.');
  fs.mkdirSync(home, { recursive: true });
  if (action === '--serve') return serve();
  if (action === 'token-file') {
    if (!fs.existsSync(tokenPath)) fs.writeFileSync(tokenPath, '', { mode: 0o600 });
    console.log(tokenPath);
    spawn('notepad.exe', [tokenPath], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const startup = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', `PlaywrightMCP-${key}.cmd`);
  if (action === 'enable-autostart') {
    if (!process.env.APPDATA || !fs.existsSync(path.dirname(startup))) throw new Error('User Startup folder unavailable.');
    fs.writeFileSync(startup, `@echo off\r\nchcp 65001 >nul\r\n"${process.execPath}" "${fileURLToPath(import.meta.url)}" start\r\n`);
    console.log('User login autostart enabled for this package. No admin or policy changes.'); return;
  }
  if (action === 'disable-autostart') {
    if (fs.existsSync(startup)) fs.unlinkSync(startup);
    console.log('User login autostart disabled for this package.'); return;
  }
  if (action === 'stop') { console.log(JSON.stringify(await control('stop'))); return; }
  if (action === 'status') {
    const own = await control('status');
    const count = await probe();
    console.log(`MCP ready: ${own.url}; ${count} tools. Browser takeover is not checked.`); return;
  }
  if (action !== 'start') throw new Error('Commands: start, status, stop, token-file, enable-autostart, disable-autostart');
  try {
    await control('status');
    console.log(`Already managed. ${await probe()} Playwright tools available.`); return;
  } catch (e) {
    // A reachable supervisor with broken MCP must not produce a duplicate server.
    try { await control('status'); throw new Error('Managed server is not ready. Run stop, then start.'); }
    catch (again) { if (again.message.includes('Managed server is not ready')) throw again; }
  }
  // Refuse to replace anything already listening, even if Get-NetTCPConnection misses it.
  await new Promise((resolve, reject) => {
    const check = net.createServer();
    check.once('error', () => reject(new Error('Port 8931 is occupied. Stop the previous foreground MCP first.')));
    check.listen(8931, '127.0.0.1', () => check.close(resolve));
  });
  const token = (process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN ||
    (fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, 'utf8').replace(/^\uFEFF/, '') : '')).trim();
  if (!token || /[\r\n\0]/.test(token)) throw new Error('Configure one valid token first with mcp.cmd token-file.');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve'], {
    detached: true, windowsHide: true, stdio: 'ignore', cwd: root,
    env: { ...process.env, PLAYWRIGHT_MCP_EXTENSION_TOKEN: token, DEBUG: '', PWDEBUG: '' }
  });
  child.on('error', () => {}); child.unref();
  let error;
  for (let n = 0; n < 40; n++) {
    try { await control('status'); const count = await probe(); console.log(`Background MCP ready: ${url}; ${count} tools. No browser call performed.`); return; }
    catch (e) { error = e; await sleep(250); }
  }
  // Authenticated shutdown only: do not leave our failed child or kill other processes.
  await control('stop').catch(() => {});
  throw new Error(`Background startup failed: ${error?.message}. Check the local PlaywrightMCP log.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
