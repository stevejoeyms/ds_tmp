import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadYaml, textOf, clientPatch, managedInstructions, readExisting, commitFiles, probeMcp } from './setup-core.mjs';
import { discoverPython, locateDsh, optionsFrom, discoverHarness, tokenState, checkInherited } from './setup.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const yaml = loadYaml(root);
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'offline-kit-test-'));
const cleanup = (t, dir) => t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const patch = `- insert:\n    - id: mcp-playwright\n      name: '@deepseek-ai/dsh-mcp-client'\n      config:\n        serverName: playwright\n        transport: streamable-http\n        url: http://127.0.0.1:8931/mcp\n`;

test('YAML: preserves BOM, comments, CRLF and !!js bytes, and is idempotent', () => {
  const old = '\uFEFF# user comment\r\n- id: models\r\n  config:\r\n    key: !!js process.env.KEY\r\n';
  const updated = clientPatch(old, yaml);
  assert.ok(updated.startsWith(old));
  assert.equal(clientPatch(updated, yaml), updated);
  assert.equal(yaml.parseDocument(updated).toJS().length, 2);
});
test('YAML: rejects malformed/multi-document/flow roots before writing', () => {
  for (const s of ['[bad', '- id: a\n---\n- id: b', '[]', '- id: a\n...\n'])
    assert.throws(() => clientPatch(s, yaml));
});
test('YAML: existing correct Client does not duplicate', () => assert.equal(clientPatch(patch, yaml), patch));
test('YAML: wrong URL, disabled and duplicate names are not overwritten', () => {
  for (const s of [patch.replace('8931','9999'), patch.replace('      name:', '      disabled: true\n      name:'), patch + patch])
    assert.throws(() => clientPatch(s, yaml));
});
test('YAML: inherited disabled group, cyclic aliases and Manager conflict are refused', () => {
  const disabled = '- insert:\n    - disabled: true\n      config:\n        entries:\n' + patch.split('\n').map(l => '          ' + l).join('\n');
  assert.throws(() => clientPatch(disabled, yaml));
  assert.throws(() => clientPatch('- &a\n  children:\n    - *a\n', yaml));
  assert.throws(() => clientPatch('- id: mcp\n  config:\n    servers:\n      playwright: {}\n', yaml));
});
test('Instructions: only owned block changes, no duplicates or unrelated changes', () => {
  const first = managedInstructions('# Existing user rules\nDo not deploy.\n', 'body one');
  const old = first + '\n# Other notes\nKeep me.\n';
  const updated = managedInstructions(old, 'body two');
  assert.ok(updated.startsWith('# Existing user rules\nDo not deploy.\n'));
  assert.ok(updated.endsWith('\n# Other notes\nKeep me.\n'));
  assert.equal(managedInstructions(updated, 'body two'), updated);
  assert.equal((updated.match(/DSH-OFFLINE-KIT:BEGIN/g)||[]).length,1);
});
test('Instructions: malformed markers and non-UTF8 are not rewritten', () => {
  assert.throws(() => managedInstructions('<!-- DSH-OFFLINE-KIT:BEGIN -->\n', 'body'));
  assert.throws(() => textOf(Buffer.from([0xff,0xfe,0,0])));
  assert.throws(() => textOf(Buffer.from([0xc0,0xaf])));
});
test('Transactions: verified exact backups and repeat is a no-op', t => {
  const dir=temp();cleanup(t,dir);const file=path.join(dir,'settings.yml');
  const before=Buffer.from('\uFEFF# comment\r\n- id: keep\r\n');const after=Buffer.from('new\n');fs.writeFileSync(file,before);
  const result=commitFiles([{file,before,after}]);assert.equal(result.changed.length,1);assert.ok(fs.readFileSync(result.backups[0]).equals(before));
  assert.equal(commitFiles([{file,before:after,after}]).changed.length,0);
});
test('Transactions: injected replacement failure rolls back completed files', t => {
  const dir=temp();cleanup(t,dir);const files=['a','b'].map(n=>path.join(dir,n));files.forEach(p=>fs.writeFileSync(p,'old'));
  let n=0;assert.throws(()=>commitFiles(files.map(file=>({file,before:Buffer.from('old'),after:Buffer.from('new')})),{replace:(a,b)=>{if(++n===2)throw new Error('injected');fs.renameSync(a,b);}}),/rolled back/);
  for(const p of files)assert.equal(fs.readFileSync(p,'utf8'),'old');
});
test('Transactions: concurrent edits are preserved while our first replacement rolls back', t => {
  const dir=temp();cleanup(t,dir);const files=['a','b'].map(n=>path.join(dir,n));files.forEach(p=>fs.writeFileSync(p,'old'));
  assert.throws(()=>commitFiles(files.map(file=>({file,before:Buffer.from('old'),after:Buffer.from('new')})),{replace:(a,b)=>{fs.renameSync(a,b);fs.writeFileSync(files[1],'external');}}),/Concurrent change/);
  assert.equal(fs.readFileSync(files[0],'utf8'),'old');assert.equal(fs.readFileSync(files[1],'utf8'),'external');
});
test('Python discovery: adjacent folder, spaces/Chinese, ambiguity and explicit override', t => {
  const dir=temp();cleanup(t,dir);const harness=path.join(dir,'桌面 harness');const kit=path.join(harness,'包 with space');fs.mkdirSync(kit,{recursive:true});
  const p=path.join(harness,'python-3.12.8-embed-amd64','python.exe');fs.mkdirSync(path.dirname(p));fs.writeFileSync(p,'fixture');
  assert.equal(discoverPython(kit),fs.realpathSync(p));
  const second=path.join(kit,'python-3.12.8-embed-amd64','python.exe');fs.mkdirSync(path.dirname(second));fs.writeFileSync(second,'fixture');
  assert.throws(()=>discoverPython(kit),/Several/);assert.equal(discoverPython(kit,p),fs.realpathSync(p));
});
test('Profile discovery: environment source and profile marker required', t => {
  const dir=temp();cleanup(t,dir);const profile=path.join(dir,'profiles','desktop');fs.mkdirSync(profile,{recursive:true});
  assert.throws(()=>locateDsh({dshHome:dir},{}),/confirmed/);
  fs.writeFileSync(path.join(profile,'cordis.yml'),'# loads cordis.patch.yml\n');
  assert.throws(()=>locateDsh({dshHome:dir},{}),/confirmed/);
  fs.writeFileSync(path.join(profile,'package.json'),JSON.stringify({dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}}));
  assert.equal(locateDsh({}, {DSH_HOME:dir,DSH_PROFILE_DIR:profile}).profileDir,fs.realpathSync(profile));
  assert.throws(()=>locateDsh({dshHome:dir},{DSH_PROFILE:'headless'}),/not desktop/);
});
test('CLI rejects incomplete/unknown flags without falling back to guessed values', () => {
  assert.deepEqual(optionsFrom(['--python','x','--no-start']),{noStart:true,python:'x'});
  assert.throws(()=>optionsFrom(['--python']));assert.throws(()=>optionsFrom(['--danger-full-access']));
});
test('Protocol health performs no browser calls and DELETEs its session', async t => {
  const methods=[];const server=http.createServer(async(req,res)=>{
    if(req.method==='DELETE'){methods.push('DELETE');res.end();return;}
    let body='';for await(const c of req)body+=c;const m=JSON.parse(body);methods.push(m.method);
    assert.ok(!m.method.startsWith('tools/call'));
    if(m.method==='notifications/initialized'){res.writeHead(202);res.end();return;}
    const result=m.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{tools:{}}}:{tools:['browser_tabs','browser_snapshot','browser_click'].map(name=>({name}))};
    res.setHeader('content-type','text/event-stream');res.setHeader('mcp-session-id','fixture-session');res.end('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n\n');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const result=await probeMcp('http://127.0.0.1:'+server.address().port+'/mcp');
  assert.equal(result.ready,true);assert.equal(result.browserTested,false);assert.deepEqual(methods,['initialize','notifications/initialized','tools/list','DELETE']);
});
test('Protocol health refuses a non-MCP HTTP response', async t => {
  const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end('{}');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  assert.equal((await probeMcp('http://127.0.0.1:'+server.address().port)).ready,false);
});

test('Harness executable is discovered relative to the chosen desktop folder, not a user account', t => {
 const dir=temp();cleanup(t,dir);const root=path.join(dir,'desktop harness','kit');fs.mkdirSync(root,{recursive:true});
 const exe=path.join(dir,'desktop harness','DeepSeek Harness New','DeepSeek Harness.exe');fs.mkdirSync(path.dirname(exe));fs.writeFileSync(exe,'fixture');
 assert.equal(discoverHarness(root),fs.realpathSync(exe));assert.equal(discoverHarness(root,exe),fs.realpathSync(exe));
 assert.throws(()=>discoverHarness(path.join(dir,'elsewhere')),/missing or ambiguous/);
});
test('Token diagnostic exposes only source and validity shape, never the credential; local file wins', t => {
 const dir=temp();cleanup(t,dir);const folder=path.join(dir,'PlaywrightMCP');fs.mkdirSync(folder);const file=path.join(folder,'extension-token.txt');
 const env={LOCALAPPDATA:dir,PLAYWRIGHT_MCP_EXTENSION_TOKEN:'stale-env-secret'};
 assert.equal(tokenState(env).source,'environment');fs.writeFileSync(file,'\uFEFFnew-local-secret\r\n');
 const result=tokenState(env);assert.equal(result.source,'local-file');assert.equal(result.validatedAgainstEdge,false);
 assert.ok(!JSON.stringify(result).includes('new-local-secret'));assert.ok(!JSON.stringify(result).includes('stale-env-secret'));
 fs.writeFileSync(file,'bad\ntwo lines');assert.equal(tokenState({LOCALAPPDATA:dir}).configured,false);
});

test('Inherited Client and custom profile bundles cannot receive a duplicate insertion', t => {
  const dir=temp();cleanup(t,dir);const profile=path.join(dir,'profiles','desktop');fs.mkdirSync(profile,{recursive:true});
  fs.writeFileSync(path.join(profile,'package.json'),JSON.stringify({dsh:{profile:{bundles:['custom-bundle']}}}));
  assert.throws(()=>locateDsh({dshHome:dir},{}),/Custom bundles/);
  fs.writeFileSync(path.join(dir,'cordis.patch.yml'),clientPatch('',yaml));
  assert.throws(()=>checkInherited({home:dir,profileDir:profile},yaml),/inherited playwright/);
});

test('Dynamic composition is not evaluated or silently given a second Client', () => {
  assert.throws(()=>clientPatch('- insert: !!js process.env.CLIENTS\n',yaml),/Dynamic composition/);
  assert.throws(()=>clientPatch('- insert:\n    - name: !!js process.env.CLIENT_NAME\n',yaml),/Dynamic composition/);
});
