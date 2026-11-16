import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

export const endpoint = 'http://127.0.0.1:8931/mcp';
export const begin = '<!-- DSH-OFFLINE-KIT:BEGIN -->';
export const end = '<!-- DSH-OFFLINE-KIT:END -->';
export function loadYaml(root) {
  const at = fs.existsSync(path.join(root, 'server', 'package.json')) ? 'server' : 'offline-mcp';
  return createRequire(path.join(root, at, 'package.json'))('playwright-core/lib/utilsBundle').yaml;
}
export function textOf(bytes) {
  if (!bytes) return '';
  if (bytes.includes(0)) throw new Error('Configuration must be UTF-8, not UTF-16/binary. No changes made.');
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
export function clientPatch(text, yaml) {
  const docs = yaml.parseAllDocuments(text, { uniqueKeys: true });
  if (docs.length > 1 || docs.some(d => d.errors.length)) throw new Error('Profile YAML is invalid or has multiple documents. No changes made.');
  const doc = docs[0];
  if (doc?.contents && (!yaml.isSeq(doc.contents) || doc.contents.flow)) throw new Error('Profile patch must be a block YAML sequence. Merge the example manually.');
  if (/^\s*\.\.\.\s*(?:#.*)?$/m.test(text)) throw new Error('Explicit YAML document endings require manual merge.');
  const checkNode = (node, config = false) => {
    if (!node) return;
    if (node.tag && !['str','seq','map','null','bool','int','float','timestamp','binary','merge'].some(tag => node.tag === 'tag:yaml.org,2002:' + tag)) throw new Error('Dynamic composition requires manual integration.');
    if (yaml.isSeq(node)) { for (const item of node.items) checkNode(item, config); return; }
    if (!yaml.isMap(node)) return;
    for (const pair of node.items) {
      const key = pair.key?.value;
      const relevant = config ? ['serverName', 'servers', 'entries'].includes(key) : ['id', 'name', 'disabled', 'insert', 'children', 'config'].includes(key);
      if (relevant) checkNode(pair.value, key === 'config');
    }
  };
  checkNode(doc?.contents);
  let rows;
  try { rows = doc?.toJS({ maxAliasCount: 100 }) ?? []; }
  catch { throw new Error('Profile YAML aliases cannot be resolved safely. No changes made.'); }
  const matches = [];
  const visited = new WeakSet();
  const visit = (value, disabled = false) => {
    if (!value || typeof value !== 'object') return;
    if (visited.has(value)) throw new Error('Repeated/cyclic composition aliases need manual merge.');
    visited.add(value);
    if (Array.isArray(value)) { value.forEach(v => visit(v, disabled)); return; }
    const off = disabled || (value.disabled !== undefined && value.disabled !== false);
    if (value.id === 'mcp-playwright' || value.config?.serverName === 'playwright') matches.push({ row: value, off });
    if (value.config?.servers?.playwright) throw new Error('A Manager-based playwright entry already exists. Resolve it manually; do not create a duplicate Client.');
    // Traverse only composition children, never application data in config.
    if (value.insert) visit(value.insert, off);
    if (value.children) visit(value.children, off);
    if (value.config?.entries) visit(value.config.entries, off);
  };
  visit(rows);
  if (matches.length > 1) throw new Error('Multiple playwright entries found. Resolve duplicates manually.');
  if (matches.length) {
    const { row, off } = matches[0];
    if (off || row.name !== '@deepseek-ai/dsh-mcp-client' || row.config?.serverName !== 'playwright' || row.config?.transport !== 'streamable-http' || row.config?.url !== endpoint)
      throw new Error('Existing playwright entry conflicts or is disabled/dynamic. It was not overwritten.');
    return text;
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const addition = ['# DSH Offline Kit: official Client (DSH 0.2.2-rc.1).', '- insert:',
    '    - id: mcp-playwright', '      name: "@deepseek-ai/dsh-mcp-client"', '      config:',
    '        serverName: playwright', '        transport: streamable-http', `        url: ${endpoint}`, ''].join(eol);
  const result = text + (text && !text.endsWith('\n') ? eol : '') + addition;
  const parsed = yaml.parseDocument(result, { uniqueKeys: true });
  if (parsed.errors.length) throw new Error('Resulting profile patch failed validation.');
  return result;
}
export function managedInstructions(text, body) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const first = text.indexOf(begin), last = text.indexOf(end);
  const block = begin + eol + body.replace(/\r?\n/g, eol).trim() + eol + end;
  if (first < 0 && last < 0) return text + (text && !text.endsWith('\n') ? eol : '') + (text ? eol : '') + block + eol;
  if (first < 0 || last < first || text.indexOf(begin, first + begin.length) >= 0 || text.indexOf(end, last + end.length) >= 0)
    throw new Error('Offline Kit instruction markers are incomplete or duplicated. Repair them manually.');
  return text.slice(0, first) + block + text.slice(last + end.length);
}
export function readExisting(file) {
  if (!fs.existsSync(file)) return null;
  if (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile()) throw new Error('Refusing to replace a symlink or non-file: ' + file);
  return fs.readFileSync(file);
}
function same(a, b) { return a === null ? b === null : b !== null && a.equals(b); }
export function commitFiles(plans, { replace = fs.renameSync } = {}) {
  const changes = plans.filter(p => !same(p.before, p.after));
  const backups = [], completed = [], stages = [];
  const suffix = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  try {
    for (const p of changes) {
      if (!same(readExisting(p.file), p.before)) throw new Error('Concurrent change detected: ' + p.file);
      fs.mkdirSync(path.dirname(p.file), { recursive: true });
      if (p.before !== null) {
        const backup = p.file + '.bak-' + suffix;
        fs.writeFileSync(backup, p.before, { flag: 'wx', mode: 0o600 });
        if (!fs.readFileSync(backup).equals(p.before)) throw new Error('Backup verification failed.');
        backups.push(backup);
      }
      const temp = p.file + '.tmp-' + suffix;
      stages.push({ ...p, temp });
      fs.writeFileSync(temp, p.after, { flag: 'wx', mode: p.before === null ? 0o600 : fs.statSync(p.file).mode });
    }
    for (const p of stages) {
      if (!same(readExisting(p.file), p.before)) throw new Error('Concurrent change detected before replace: ' + p.file);
      replace(p.temp, p.file);
      completed.push(p);
    }
    return { changed: changes.map(p => p.file), backups };
  } catch (error) {
    const blocked = [];
    for (const p of completed.reverse()) {
      try {
        if (!same(readExisting(p.file), p.after)) { blocked.push(p.file); continue; }
        if (p.before === null) fs.unlinkSync(p.file);
        else {
          const restore = p.file + '.restore-' + suffix;
          fs.writeFileSync(restore, p.before, { flag: 'wx' });
          fs.renameSync(restore, p.file);
        }
      } catch { blocked.push(p.file); }
    }
    throw new Error(error.message + (blocked.length ? '\nExternal changes prevented rollback; inspect backups for: ' + blocked.join(', ') : '\nThis transaction was rolled back. Backups are retained.'));
  } finally { for (const p of stages) { try { fs.unlinkSync(p.temp); } catch {} } }
}

export async function probeMcp(url = endpoint) {
  let session, protocol;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  async function rpc(method, params, id) {
    const response = await fetch(url, { method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', method, params, ...(id === undefined ? {} : { id }) }), signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error('MCP HTTP ' + response.status);
    session ||= response.headers.get('mcp-session-id');
    if (session) headers['Mcp-Session-Id'] = session;
    if (id === undefined) { await response.body?.cancel(); return; }
    const text = await response.text();
    const messages = response.headers.get('content-type')?.includes('text/event-stream')
      ? text.split(/\r?\n/).filter(s => s.startsWith('data:')).map(s => JSON.parse(s.slice(5))) : [JSON.parse(text)];
    const message = messages.find(m => m.id === id);
    if (!message || message.error) throw new Error('MCP protocol request failed.');
    return message.result;
  }
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'offline-kit-doctor', version: '1.0.0' } }, 1);
    protocol = init.protocolVersion;
    if (!protocol || !init.capabilities?.tools) throw new Error('Endpoint does not publish MCP tools.');
    headers['MCP-Protocol-Version'] = protocol;
    await rpc('notifications/initialized');
    const result = await rpc('tools/list', {}, 2);
    for (const name of ['browser_tabs', 'browser_snapshot', 'browser_click'])
      if (!result.tools?.some(t => t.name === name)) throw new Error('Required Playwright tool missing: ' + name);
    return { ready: true, toolCount: result.tools.length, browserTested: false };
  } catch (error) { return { ready: false, error: error.message, browserTested: false }; }
  finally { if (session) await fetch(url, { method: 'DELETE', headers, signal: AbortSignal.timeout(1000) }).catch(() => {}); }
}
