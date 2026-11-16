import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { loadYaml, textOf, clientPatch, managedInstructions, readExisting, commitFiles, probeMcp, endpoint } from './setup-core.mjs';

export function optionsFrom(args) {
  const out = { noStart: false };
  const names = { '--python': 'python', '--dsh-home': 'dshHome', '--profile-dir': 'profileDir', '--harness-exe': 'harnessExe' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-start') out.noStart = true;
    else if (args[i] === '--interactive') out.interactive = true;
    else if (names[args[i]] && args[i + 1] && !args[i + 1].startsWith('--')) out[names[args[i]]] = args[++i];
    else throw new Error('Unknown or incomplete setup option. Use --python PATH, --dsh-home PATH, --profile-dir PATH, --no-start.');
  }
  return out;
}
export function discoverPython(root, explicit) {
  if (explicit) {
    if (!path.isAbsolute(explicit) || !fs.existsSync(explicit)) throw new Error('The explicit Python executable must be an existing absolute path.');
    return fs.realpathSync(explicit);
  }
  const found = new Set();
  let at = root;
  for (let n = 0; n < 4; n++) {
    const candidate = path.join(at, 'python-3.12.8-embed-amd64', 'python.exe');
    if (fs.existsSync(candidate)) found.add(fs.realpathSync(candidate));
    const next = path.dirname(at);
    if (next === at) break;
    at = next;
  }
  if (found.size !== 1) throw new Error(found.size ? 'Several offline Python installations found. Use --python with the intended one.' : 'Offline Python not found nearby. Put the kit under your harness folder, or use --python with its absolute python.exe path.');
  return [...found][0];
}
export function discoverHarness(root, explicit, required = true) {
  if (explicit) {
    if (!path.isAbsolute(explicit) || !fs.existsSync(explicit) || !fs.statSync(explicit).isFile()) throw new Error('Specify the existing absolute Harness executable path.');
    return fs.realpathSync(explicit);
  }
  const found = new Set(); let at = root;
  for (let n = 0; n < 4; n++) {
    const p = path.join(at, 'DeepSeek Harness New', 'DeepSeek Harness.exe');
    if (fs.existsSync(p) && fs.statSync(p).isFile()) found.add(fs.realpathSync(p));
    const parent = path.dirname(at); if (parent === at) break; at = parent;
  }
  if (found.size > 1 || (required && !found.size)) throw new Error('Harness executable is missing or ambiguous. Place DeepSeek Harness New beside the Python folder, or use --harness-exe.');
  return [...found][0] || null;
}
export function tokenState(env = process.env) {
  const file = env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'PlaywrightMCP', 'extension-token.txt') : null;
  let value = '';
  try { if (file && fs.existsSync(file)) value = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim(); } catch { throw new Error('Local token file cannot be read. Check its access locally.'); }
  const valid = v => Boolean(v) && !/[\r\n\0]/.test(v);
  const fromFile = valid(value);
  const fromEnv = valid((env.PLAYWRIGHT_MCP_EXTENSION_TOKEN || '').trim());
  return { configured: fromFile || fromEnv, source: fromFile ? 'local-file' : fromEnv ? 'environment' : 'missing-or-invalid',
    file, environmentAlsoPresent: Boolean(env.PLAYWRIGHT_MCP_EXTENSION_TOKEN), validatedAgainstEdge: false };
}
const pythonProbe = String.raw`import sys,json,struct,importlib.util,importlib.metadata,os
pairs={'numpy':'numpy','pandas':'pandas','openpyxl':'openpyxl','lxml':'lxml','docx':'python-docx','matplotlib':'matplotlib','PIL':'pillow','pptx':'python-pptx','pypdf':'pypdf','pdfplumber':'pdfplumber','reportlab':'reportlab','jieba':'jieba','snownlp':'snownlp','bs4':'beautifulsoup4','requests':'requests','xlrd':'xlrd','pyxlsb':'pyxlsb','xlsxwriter':'xlsxwriter','seaborn':'seaborn','fontTools':'fonttools','fitz':'PyMuPDF','pymupdf':'PyMuPDF'}
modules={}
for module,dist in pairs.items():
 try: available=importlib.util.find_spec(module) is not None
 except Exception: available=False
 try: version=importlib.metadata.version(dist)
 except importlib.metadata.PackageNotFoundError: version=None
 modules[module]={'discoverable':available,'metadataVersion':version}
print(json.dumps({'executable':sys.executable,'version':list(sys.version_info[:3]),'bits':struct.calcsize('P')*8,'cwd':os.getcwd(),'utf8':sys.flags.utf8_mode,'modules':modules},ensure_ascii=True))`;
export function inspectPython(executable) {
  const p = spawnSync(executable, ['-B', '-X', 'utf8', '-c', pythonProbe], { encoding: 'utf8', timeout: 30000, windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }, maxBuffer: 1024 * 1024 });
  if (p.error || p.status !== 0) throw new Error('Offline Python could not execute its probe. Check the existing Python environment; no files were changed.');
  let info;
  try { info = JSON.parse(p.stdout.trim()); } catch { throw new Error('Python returned an invalid environment probe.'); }
  if (info.version[0] !== 3 || info.version[1] !== 12 || info.bits !== 64) throw new Error('This kit expects the supplied Python 3.12 x64 environment.');
  delete info.cwd; // caller cwd belongs to each execution, not a permanently cached setting.
  return info;
}
export function locateDsh(opts, env = process.env) {
  const homeValue = opts.dshHome || env.DSH_HOME || path.join(env.USERPROFILE || '', '.dsh');
  if (!path.isAbsolute(homeValue) || !fs.existsSync(homeValue)) throw new Error('DSH home not found. Specify --dsh-home explicitly.');
  const home = fs.realpathSync(homeValue);
  const selected = opts.profileDir || env.DSH_PROFILE_DIR;
  if (env.DSH_PROFILE && env.DSH_PROFILE !== 'desktop' && !opts.profileDir) throw new Error('Active DSH profile is not desktop. Specify the intended --profile-dir instead of guessing.');
  const profile = selected || path.join(home, 'profiles', 'desktop');
  const expected = path.join(home, 'profiles', 'desktop');
  if (!path.isAbsolute(profile) || !fs.existsSync(path.join(profile, 'package.json'))) throw new Error('Desktop profile was not confirmed by package.json. Open Harness once to initialize it, then quit it and retry.');
  const realProfile = fs.realpathSync(profile);
  if (realProfile !== fs.realpathSync(expected)) throw new Error('Desktop uses DSH_HOME/profiles/desktop. A different --profile-dir cannot be launched by this kit.');
  const manifest = JSON.parse(textOf(fs.readFileSync(path.join(realProfile, 'package.json'))));
  const bundles = manifest.dsh?.profile?.bundles;
  const standard = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];
  if (!Array.isArray(bundles) || JSON.stringify(bundles) !== JSON.stringify(standard)) throw new Error('Only the official base + web-app Desktop profile is supported automatically. Custom bundles need manual integration to avoid duplicate Clients.');
  return { home, profileDir: realProfile, profileSource: 'official Desktop package.json manifest; rc.1 loader applies its cordis.patch.yml',
    detectedVersion: env.DSH_CLIENT_VERSION || null, supportedClientSchema: 'DSH 0.2.2-rc.1' };
}
export function checkInherited(dsh, yaml) {
  // Never execute dynamic Cordis expressions or unpack/rewrite the application.
  const files = [path.join(dsh.home, 'cordis.patch.yml')];
  for (const name of ['dsh-base', 'dsh-web-app']) {
    const dir = path.join(dsh.profileDir, 'node_modules', '@deepseek-ai', name);
    if (!fs.existsSync(dir)) continue; // Standard installed bundles reside in the official application archive.
    const manifest = JSON.parse(textOf(fs.readFileSync(path.join(dir, 'package.json'))));
    const patch = manifest.dsh?.bundle?.patch;
    const patches = Array.isArray(patch) ? patch : [patch];
    if (!patches.length || patches.some(p => typeof p !== 'string')) throw new Error('Local bundle composition cannot be confirmed. Merge the Client manually.');
    for (const p of patches) {
      const absolute = path.resolve(dir, p);
      if (!absolute.startsWith(path.resolve(dir) + path.sep)) throw new Error('Bundle patch outside package requires manual integration.');
      files.push(absolute);
    }
  }
  for (const file of files) {
    const bytes = readExisting(file);
    if (!bytes) continue;
    const text = textOf(bytes);
    if (clientPatch(text, yaml) === text) throw new Error('An inherited playwright Client already exists: ' + file + '. Resolve or reuse it manually; no duplicate was inserted.');
  }
}

function commandText(root) { return `& '${path.join(root, 'tools.cmd').replaceAll("'", "''")}'`; }
export function buildInstructions(root, info) {
  const cmd = commandText(root);
  return `## DSH offline Python and Playwright (local machine)\n` +
    `Only for offline Python/data work or browser/UI tasks. Existing workspace/user instructions remain applicable.\n` +
    `Kit: ${JSON.stringify(root)}\nEnvironment facts: ${JSON.stringify(path.join(root, '.local', 'environment.json'))}\n` +
    `PowerShell commands (use the quoted full path, not PATH python):\n` +
    `- Python: ${cmd} python <script.py> [args]; -c is also supported. UTF-8 is enabled and caller cwd is preserved.\n` +
    `- Doctor: ${cmd} doctor\n` +
    `- User host launcher: ${cmd} launch; it waits for MCP before requesting Harness startup, never installs login autostart.\n` +
    `- MCP status: ${cmd} mcp status. MCP is ${endpoint}; prefer existing mcp__playwright__* native tools, not Python drivers.\n` +
    `Python executable detected: ${JSON.stringify(info.python.executable)}. Available module names/metadata are in environment.json; discoverable is not an import smoke-test.\n` +
    `No pip/npm/npx installation or network dependency repair. Report missing libraries; do not assume PyMuPDF or optional packages exist.\n` +
    `Before browser tasks read ${JSON.stringify(path.join(root, 'best-practices', 'MODEL-INSTRUCTIONS.md'))}; recipes and pitfalls are beside it.\n` +
    `Do not start Server/Edge from the model sandbox or change policy. Host-side startup is ${cmd} mcp start; user handles first Extension install, local token and SSO.\n` +
    `After setup restart DSH/new session; native tool visibility and real calls are the acceptance, not this file's existence. Do not echo credentials or upload local environment/config files.\n`;
}
export function environmentMarkdown(info) {
  return `# 本机离线环境（初始化器实际探测，勿上传公开仓库）\n\n` +
    `工具包：${info.kitRoot}\n\nPython：${info.python.executable}\n\n版本：${info.python.version.join('.')} / ${info.python.bits}位；UTF-8执行。\n\n` +
    `DSH profile：${info.dsh.profileDir}\n\nDSH版本实测来源：${info.dsh.detectedVersion || '未知；不能把支持的配置schema版本当成安装版本'}\n\n` +
    `在PowerShell中执行：\n\n\`\`\`powershell\n${commandText(info.kitRoot)} python your_script.py\n${commandText(info.kitRoot)} doctor\n${commandText(info.kitRoot)} mcp status\n\`\`\`\n\n` +
    `Python保留每次调用的工作目录，不自动cd到工具包。库的可发现性和metadata版本见.local/environment.json；需要的库仍以真实import及功能执行为准。不改py.cmd、._pth、site-packages、PATH或注册表。缺库不联网安装。\n\n` +
    `MCP地址：${endpoint}。模型优先用原生mcp__playwright__工具，工具未出现则按初始化说明重启DSH/新建会话并检查加载错误。\n\n` +
    `这份文件不包含Token。手册：best-practices/README.md；首次入口：00-先读我-Playwright入口.md。移动工具包或Python后重新初始化，更新本机绝对路径。\n`;
}
function localInfo(root) {
  const info = JSON.parse(fs.readFileSync(path.join(root, '.local', 'environment.json'), 'utf8'));
  if (info.schemaVersion !== 1 || path.resolve(info.kitRoot) !== root) throw new Error('Kit moved or local metadata is invalid. Run setup again.');
  if (!fs.existsSync(info.python?.executable)) throw new Error('Recorded Python is missing. Run setup again.');
  return info;
}
function mcpCommand(root, args) {
  const allowed = ['start', 'status', 'stop', 'token-file'];
  if (args.length !== 1 || !allowed.includes(args[0])) throw new Error('Use mcp start|status|stop|token-file.');
  const env = { ...process.env };
  if (tokenState().source === 'local-file') delete env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;
  const p = spawnSync(process.execPath, [path.join(root, 'server', 'background.mjs'), args[0]], { cwd: root, stdio: 'inherit', windowsHide: true, env });
  return p.error ? 1 : p.status ?? 1;
}
export async function initialize(root, opts) {
  const dsh = locateDsh(opts);
  checkInherited(dsh, loadYaml(root));
  const python = inspectPython(discoverPython(root, opts.python || process.env.DSH_OFFLINE_PYTHON));
  const pythonHome = path.dirname(python.executable);
  const pythonRoot = path.dirname(pythonHome);
  const info = { schemaVersion: 1, kitRoot: root, nodeExecutable: process.execPath, python,
    harnessExecutable: discoverHarness(root, opts.harnessExe || process.env.DSH_OFFLINE_EXE, false),
    pythonLauncher: fs.existsSync(path.join(pythonRoot, 'py.cmd')) ? path.join(pythonRoot, 'py.cmd') : null,
    wheelsDirectory: fs.existsSync(path.join(pythonRoot, 'wheels')) ? path.join(pythonRoot, 'wheels') : null,
    dsh, mcp: { endpoint, mode: 'extension', browser: 'msedge' } };
  const profileFile = path.join(dsh.profileDir, 'cordis.patch.yml');
  const instructionsFile = path.join(dsh.home, 'AGENTS.md');
  const profileBefore = readExisting(profileFile), instructionsBefore = readExisting(instructionsFile);
  const targets = [
    { file: profileFile, before: profileBefore, after: Buffer.from(clientPatch(textOf(profileBefore), loadYaml(root))) },
    { file: instructionsFile, before: instructionsBefore, after: Buffer.from(managedInstructions(textOf(instructionsBefore), buildInstructions(root, info))) },
    { file: path.join(root, '.local', 'environment.json'), before: readExisting(path.join(root, '.local', 'environment.json')), after: Buffer.from(JSON.stringify(info, null, 2) + '\n') },
    { file: path.join(root, 'ENVIRONMENT.md'), before: readExisting(path.join(root, 'ENVIRONMENT.md')), after: Buffer.from(environmentMarkdown(info)) }
  ];
  const lock = path.join(dsh.home, '.offline-kit-setup.lock');
  const nonce = crypto.randomUUID();
  try { fs.writeFileSync(lock, nonce, { flag: 'wx', mode: 0o600 }); }
  catch { throw new Error('Another setup or an unfinished setup lock exists. Inspect ' + lock + ' before retrying.'); }
  let written;
  try { written = commitFiles(targets); }
  finally { try { if (fs.readFileSync(lock, 'utf8') === nonce) fs.unlinkSync(lock); } catch {} }
  console.log(`Setup files ready. ${written.changed.length} files changed; ${written.backups.length} verified byte backups.`);
  console.log('Local facts: ' + path.join(root, 'ENVIRONMENT.md'));
  console.log('Restart DSH and open a new session. AGENTS loading/native browser calls still need real verification.');
  if (opts.noStart) { console.log('Server start skipped (--no-start). Browser connection not tested.'); return info; }
  const status = await probeMcp();
  if (status.ready) { console.log(`Existing MCP reused: ${status.toolCount} tools. No browser call or server restart.`); return info; }
  const hasToken = () => tokenState().configured;
  if (!hasToken() && opts.interactive && process.stdin.isTTY) {
    console.log('First-time token setup: copy the token VALUE from your Edge Playwright Extension into the local Notepad file. Save it; do not paste it into this terminal.');
    if (mcpCommand(root, ['token-file']) !== 0) throw new Error('Configuration is saved, but the local token editor could not open.');
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try { await prompt.question('After saving the local token file, press Enter to continue (Ctrl+C to stop): '); }
    finally { prompt.close(); }
  }
  if (!hasToken()) {
    console.log('Configuration saved; MCP is NOT ready. First-time local token setup is still required.');
    console.log('Run tools.cmd mcp token-file, paste the value from your Edge extension, save, then tools.cmd mcp start.');
    console.log('User Extension installation and SSO are not automated.');
    process.exitCode = 2;
    return info;
  }
  if (mcpCommand(root, ['start']) !== 0) throw new Error('Configuration is saved, but background MCP did not start. Check the local error; do not duplicate or bypass sandbox.');
  console.log('Background MCP ready. Actual Edge takeover is not yet tested.');
  return info;
}
export async function main(args = process.argv.slice(2)) {
  const root = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
  if (process.platform !== 'win32' || process.arch !== 'x64' || process.versions.node.split('.')[0] !== '24') throw new Error('Use existing DSH Windows x64 Node 24.');
  const action = args[0] || 'setup';
  if (action === 'setup') return initialize(root, optionsFrom(args.slice(1)));
  if (action === 'launch') {
    const opts = optionsFrom(args.slice(1));
    const exe = discoverHarness(root, opts.harnessExe || process.env.DSH_OFFLINE_EXE);
    const info = await initialize(root, { ...opts, harnessExe: exe });
    const status = await probeMcp();
    if (!status.ready) throw new Error('Harness was NOT opened: MCP is not protocol-ready. Resolve the local token/startup message first.');
    await new Promise((resolve, reject) => {
      const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore', windowsHide: false, env: { ...process.env, DSH_HOME: info.dsh.home, DSH_PROFILE: 'desktop', DSH_PROFILE_DIR: info.dsh.profileDir } });
      child.once('error', () => reject(new Error('MCP is ready but the Harness executable could not start.')));
      child.once('spawn', () => { child.unref(); resolve(); });
    });
    console.log('MCP protocol ready. Harness startup requested. No login autostart was installed.');
    console.log('If Harness was already running with an exhausted Client, reload that Client or restart Harness normally; no process was force-closed.');
    return;
  }
  if (action === 'token') {
    if (!process.stdin.isTTY) throw new Error('Run tools.cmd token in a normal user CMD. Token values must not be supplied as command-line arguments.');
    if (mcpCommand(root, ['token-file']) !== 0) throw new Error('Local token editor could not open.');
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try { await prompt.question('Paste only the Edge Extension token into the local file, save, then press Enter here: '); }
    finally { prompt.close(); }
    if (tokenState().source !== 'local-file') throw new Error('Local token is still missing or invalid. Server was not restarted.');
    const stopped = spawnSync(process.execPath, [path.join(root, 'server', 'background.mjs'), 'stop'], { encoding: 'utf8', windowsHide: true });
    if (stopped.status !== 0 && (await probeMcp()).ready) {
      console.log('Token saved locally. Existing Server is not owned by this kit path; stop it in its original host window, then use this launcher. It was not killed.');
      process.exitCode = 2; return;
    }
    process.exitCode = mcpCommand(root, ['start']);
    console.log('Actual token/profile validity is confirmed only by the next real browser connection, not tools/list.');
    return;
  }
  if (action === 'python') {
    const info = localInfo(root);
    const p = spawnSync(info.python.executable, ['-X', 'utf8', ...args.slice(1)], { stdio: 'inherit',
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
    if (p.error) throw new Error('The recorded Python could not start. Run doctor/setup.');
    process.exitCode = p.status ?? 1; return;
  }
  if (action === 'mcp') {
    if (args[1] === 'status' && args.length === 2) {
      const status = await probeMcp(); console.log(JSON.stringify(status)); if (!status.ready) process.exitCode = 1; return;
    }
    process.exitCode = mcpCommand(root, args.slice(1)); return;
  }
  if (action === 'doctor') {
    const info = localInfo(root);
    const python = inspectPython(info.python.executable);
    const status = await probeMcp();
    const token = tokenState();
    const instructions = textOf(readExisting(path.join(info.dsh.home, 'AGENTS.md')));
    const indexed = instructions.includes('<!-- DSH-OFFLINE-KIT:BEGIN -->') && instructions.includes(JSON.stringify(root));
    console.log(JSON.stringify({ python, mcp: status, token, instructionIndexPresent: indexed,
      modelContextLoaded: 'NOT TESTED: verify in a fresh DSH session', browserTakeover: 'NOT TESTED' }, null, 2));
    if (!status.ready || !indexed) process.exitCode = 1; return;
  }
  throw new Error('Commands: launch, setup, python <args>, mcp <action>, token, doctor.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
