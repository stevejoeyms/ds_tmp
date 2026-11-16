$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path $env:RUNNER_TEMP ('offline-kit-fixture-' + [guid]::NewGuid().ToString('N'))
$harness = Join-Path $fixtureRoot 'Desktop 模拟 harness & space'
$kit = Join-Path $harness 'playwright kit 中文'
$work = Join-Path $fixtureRoot 'work dir 中文'
$dshHome = Join-Path $fixtureRoot 'dsh home'
$profile = Join-Path $dshHome 'profiles\desktop'
New-Item -ItemType Directory -Path $kit,$work,$profile -Force | Out-Null
$pythonRoot = Get-ChildItem -LiteralPath (Join-Path $env:RUNNER_TOOL_CACHE 'Python') -Directory | Where-Object { $_.Name -like '3.12.*' } | Sort-Object Name -Descending | Select-Object -First 1
if (-not $pythonRoot) { throw 'Hosted Windows Python 3.12 is required for this integration check.' }
$pythonDir = Join-Path $pythonRoot.FullName 'x64'
if (-not (Test-Path (Join-Path $pythonDir 'python.exe'))) { throw 'Hosted Python x64 executable missing.' }
New-Item -ItemType Junction -Path (Join-Path $harness 'python-3.12.8-embed-amd64') -Target $pythonDir | Out-Null
New-Item -ItemType Junction -Path (Join-Path $kit 'server') -Target (Join-Path $repoRoot 'offline-mcp') | Out-Null
foreach ($name in @('setup.mjs','setup-core.mjs','tools.cmd')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $kit
}
$profileFile = Join-Path $profile 'cordis.patch.yml'
$agents = Join-Path $dshHome 'AGENTS.md'
[IO.File]::WriteAllText((Join-Path $profile 'package.json'), '{"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]}}}')
$originalPatch = "# preserve me`r`n- id: original`r`n  config:`r`n    keep: !!js process.env.ORIGINAL_KEEP`r`n"
[IO.File]::WriteAllText($profileFile, $originalPatch, [Text.UTF8Encoding]::new($true))
[IO.File]::WriteAllText($agents, "# Existing rules`nKeep these user instructions.`n", [Text.UTF8Encoding]::new($false))
$originalBytes = [IO.File]::ReadAllBytes($profileFile)
$appDir = Join-Path $harness 'DeepSeek Harness New'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
$exe = Join-Path $appDir 'DeepSeek Harness.exe'
$marker = Join-Path $fixtureRoot 'harness-started.txt'
$csharp = Join-Path $fixtureRoot 'HarnessFixture.cs'
[IO.File]::WriteAllText($csharp, 'using System;using System.IO;class App { static void Main() { File.WriteAllText(Environment.GetEnvironmentVariable("KIT_TEST_MARKER"),Environment.GetEnvironmentVariable("DSH_HOME")); } }')
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo "/out:$exe" $csharp
if ($LASTEXITCODE -ne 0) { throw 'Cannot build the harmless Harness startup fixture.' }
$names = @('DSH_HOME','DSH_PROFILE_DIR','DSH_PROFILE','DSH_CLIENT_VERSION','DSH_NODE_EXE','PLAYWRIGHT_MCP_EXTENSION_TOKEN','KIT_TEST_MARKER')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$started = $false
try {
    $env:KIT_TEST_MARKER = $marker
    $env:DSH_HOME = $dshHome
    $env:DSH_PROFILE_DIR = $profile
    $env:DSH_PROFILE = 'desktop'
    $env:DSH_CLIENT_VERSION = '0.2.2-rc.1'
    $env:DSH_NODE_EXE = (Get-Command node).Source
    $env:PLAYWRIGHT_MCP_EXTENSION_TOKEN = 'ci-placeholder-not-a-real-browser-token'
    & node (Join-Path $kit 'setup.mjs') setup --no-start
    if ($LASTEXITCODE -ne 0) { throw 'Portable setup failed.' }
    & node (Join-Path $kit 'setup.mjs') launch --no-start
    if ($LASTEXITCODE -eq 0 -or (Test-Path -LiteralPath $marker)) { throw 'Harness was opened before MCP readiness.' }
    $patched = [IO.File]::ReadAllBytes($profileFile)
    if ([Convert]::ToBase64String($patched[0..($originalBytes.Length-1)]) -ne [Convert]::ToBase64String($originalBytes)) { throw 'Original YAML bytes changed.' }
    $backup = Get-ChildItem -LiteralPath $profile -Filter 'cordis.patch.yml.bak-*' | Select-Object -First 1
    if (-not $backup -or [Convert]::ToBase64String([IO.File]::ReadAllBytes($backup.FullName)) -ne [Convert]::ToBase64String($originalBytes)) { throw 'Original backup mismatch.' }
    $tracked = @($profileFile,$agents,(Join-Path $kit '.local\environment.json'),(Join-Path $kit 'ENVIRONMENT.md'))
    $hashes = @($tracked | ForEach-Object { (Get-FileHash -LiteralPath $_).Hash })
    & node (Join-Path $kit 'setup.mjs') setup --no-start
    if ($LASTEXITCODE -ne 0) { throw 'Repeated setup failed.' }
    for ($i=0; $i -lt $tracked.Count; $i++) {
        if ((Get-FileHash -LiteralPath $tracked[$i]).Hash -ne $hashes[$i]) { throw 'Repeated setup was not idempotent.' }
    }
    $info = Get-Content -LiteralPath (Join-Path $kit '.local\environment.json') -Raw | ConvertFrom-Json
    if ($info.python.version[0] -ne 3 -or $info.python.version[1] -ne 12 -or $info.python.bits -ne 64) { throw 'Actual Python probe was not recorded.' }
    $script = Join-Path $work 'echo args.py'
    [IO.File]::WriteAllText($script, 'import sys,json,os;print(json.dumps({"args":sys.argv[1:],"cwd":os.getcwd(),"utf8":sys.flags.utf8_mode},ensure_ascii=False))')
    $cmdText = "@echo off`r`nchcp 65001 >nul`r`ncall `"$(Join-Path $kit 'tools.cmd')`" python `"$script`" `"中文 & value`"`r`nexit /b %ERRORLEVEL%`r`n"
    [IO.File]::WriteAllText((Join-Path $work 'invoke.cmd'), $cmdText, [Text.UTF8Encoding]::new($false))
    Push-Location -LiteralPath $work
    try {
        $json = & cmd.exe /d /c invoke.cmd
        if ($LASTEXITCODE -ne 0) { throw 'CMD Python entry failed.' }
    } finally { Pop-Location }
    $echoed = ($json -join "`n") | ConvertFrom-Json
    if ($echoed.args[0] -ne '中文 & value' -or $echoed.cwd -ne $work -or $echoed.utf8 -ne 1) { throw 'Python arguments, UTF-8 or caller cwd changed.' }
    # Native child exit codes must reach the caller.
    Push-Location -LiteralPath $kit
    try {
        & cmd.exe /d /c 'tools.cmd python -c "import sys;sys.exit(7)"'
        if ($LASTEXITCODE -ne 7) { throw 'Python exit code was swallowed.' }
        & cmd.exe /d /c 'tools.cmd mcp start'
        if ($LASTEXITCODE -ne 0) { throw 'Background start via unified entry failed.' }
        $started = $true
        $reuse = & node (Join-Path $kit 'setup.mjs') setup
        if ($LASTEXITCODE -ne 0 -or ($reuse -join "`n") -notmatch 'Existing MCP reused') { throw 'Setup failed to reuse the already running MCP.' }
        & node (Join-Path $kit 'setup.mjs') launch --no-start
        if ($LASTEXITCODE -ne 0) { throw 'Harness launch after readiness failed.' }
        for ($i=0; $i -lt 50 -and -not (Test-Path -LiteralPath $marker); $i++) { Start-Sleep -Milliseconds 100 }
        if (-not (Test-Path -LiteralPath $marker)) { throw 'The fixture executable was not launched.' }
        if ([IO.File]::ReadAllText($marker) -ne $dshHome) { throw 'Harness received a different home from the configured one.' }
        & cmd.exe /d /c 'tools.cmd doctor'
        if ($LASTEXITCODE -ne 0) { throw 'Unified doctor failed.' }
        & cmd.exe /d /c 'tools.cmd mcp stop'
        if ($LASTEXITCODE -ne 0) { throw 'Managed stop failed.' }
        $started = $false
    } finally { Pop-Location }
    Write-Host 'PASS: Windows setup, exact backup, idempotency, UTF-8 Python/cwd/arguments/exit code, MCP reuse, doctor and readiness-before-Harness launch. Simulated DSH profile; no browser call.'
} finally {
    if ($started) { & node (Join-Path $kit 'server\background.mjs') stop }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
    # Runner temporary fixture remains as diagnostic evidence; never include it in packages.
}
