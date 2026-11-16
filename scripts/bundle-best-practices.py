"""Build a docs-only update over the verified Windows unified runtime; builder-side only."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, zipfile

parser = argparse.ArgumentParser()
parser.add_argument('base_zip', type=Path)
parser.add_argument('output_dir', type=Path)
parser.add_argument('--source-commit', required=True)
a = parser.parse_args()
r = Path(__file__).resolve().parent.parent
expected = '10b86812a6a01fefd860fccff7873493d65c3e0d165d27b86a8f592c8ae6eeb2'
base_hash = hashlib.sha256(a.base_zip.read_bytes()).hexdigest()
if base_hash != expected:
    raise SystemExit('Base ZIP SHA256 differs from the verified background release.')
prefix = 'playwright-edge-dsh-offline-win-x64/'
files = {}
with zipfile.ZipFile(a.base_zip) as z:
    if z.testzip() is not None:
        raise SystemExit('Base ZIP is corrupt.')
    for info in z.infolist():
        if info.is_dir():
            continue
        name = info.filename.replace('\\', '/')
        if not name.startswith(prefix) or '..' in PurePosixPath(name).parts:
            raise SystemExit('Unexpected archive path.')
        files[name[len(prefix):]] = z.read(info)
original = files.copy()
for p in sorted((r / 'best-practices').iterdir()):
    if p.is_file():
        files['best-practices/' + p.name] = p.read_bytes()
guide = (r / 'Playwright-MCP-快速开始.md').read_bytes()
files['Harness配置说明.md'] = guide
files['server/README.md'] = (r / 'offline-mcp/README.md').read_bytes()
intro = '''# Edge + DSH 统一包：最佳实践 MVP

已经接通的电脑：只需读取 best-practices，不必重启、重装或再次注册。

给 Harness 一句话：
> 先读本包 best-practices/MODEL-INSTRUCTIONS.md，按当前真实工具schema执行；不会的动作查TOOL-RECIPES.md，不凭旧记忆猜参数。目标、环境、授权与预期由我提供。

- best-practices/README.md：MVP用法与功能测试判定。
- best-practices/MODEL-INSTRUCTIONS.md：给模型的短指令，不会自动安装为系统规则。
- best-practices/TOOL-RECIPES.md：常用调用和iframe/组件配方。
- best-practices/PITFALLS.md：常见错误与处理。
- best-practices/tool-catalog-0.0.85.json：实际导出的25工具schema，按需查询。
- best-practices/SOURCES.md：固定版本官方依据和实际验证范围。

新电脑部署：先看下面说明，再按Harness配置说明.md接入DSH0.2.2-rc.1官方Client。
快捷入口：configure-token.cmd、start-background.cmd、status.cmd、stop-background.cmd；可选enable-autostart.cmd。
扩展放在extension/，Server及完整依赖放在server/。不需npm或独立Node。

本次仅增加最佳实践并更正rc.1注册说明，保留上一版全部运行代码和依赖。

---

'''
files['README.md'] = intro.encode() + guide
source = json.loads(files['SOURCE.json'])
source['practices_source_commit'] = a.source_commit
source['base_unified_zip_sha256'] = base_hash
source['practices_validation'] = '25 actual tools, 18 positive schema examples, 7 rejected negative cases, 3 JS syntax checks; no browser calls.'
files['SOURCE.json'] = (json.dumps(source, ensure_ascii=False, indent=2) + '\n').encode()
files['SHA256SUMS'] = ''.join(hashlib.sha256(v).hexdigest() + '  ' + k + '\n'
                                for k, v in sorted(files.items()) if k != 'SHA256SUMS').encode()
# All code, dependencies and extension files must remain byte-for-byte unchanged.
changed = {k for k, v in original.items() if files.get(k) != v}
allowed = {'README.md', 'Harness配置说明.md', 'server/README.md', 'SOURCE.json', 'SHA256SUMS'}
if changed - allowed:
    raise SystemExit('Unexpected runtime mutation: ' + repr(changed - allowed))
a.output_dir.mkdir(parents=True, exist_ok=True)
out = a.output_dir / 'playwright-edge-dsh-offline-win-x64.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(prefix + name, (2026, 11, 16, 8, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, data)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    for name, data in files.items():
        assert z.read(prefix + name) == data, name
    for line in files['SHA256SUMS'].decode().splitlines():
        digest, name = line.split('  ', 1)
        assert hashlib.sha256(z.read(prefix + name)).hexdigest() == digest
sha = hashlib.sha256(out.read_bytes()).hexdigest()
Path(str(out) + '.sha256').write_text(sha + '  ' + out.name + '\n')
print(f'PASS: {len(files)} files; {len(original) - len(changed)} original files unchanged; ZIP and full manifest verified.')
print(f'{out.stat().st_size} bytes; SHA256 {sha}')
