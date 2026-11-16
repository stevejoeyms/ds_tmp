$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Build on Windows x64 with Node 24 and npm.' }
$runtime = & node -p 'process.platform+"/"+process.arch+"/"+process.versions.node.split(".")[0]'
if ($LASTEXITCODE -ne 0 -or $runtime -ne 'win32/x64/24') { throw 'Build requires Windows x64 Node 24.' }
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
Push-Location -LiteralPath $PSScriptRoot
try {
    & npm.cmd ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    & node node_modules/@playwright/mcp/cli.js --help
    if ($LASTEXITCODE -ne 0) { throw 'CLI help failed' }
    # Parse the target launcher with Windows PowerShell 5.1 as well as pwsh.
    & powershell.exe -NoProfile -Command '$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) "start-mcp.ps1"),[ref]$null,[ref]$e); if($e.Count){$e | Out-String | Write-Error; exit 1}'
    if ($LASTEXITCODE -ne 0) { throw 'Windows PowerShell syntax check failed' }
    $dist = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'
    if (Test-Path -LiteralPath $dist) { throw 'dist already exists. Move it aside before rebuilding.' }
    $stage = Join-Path $dist 'playwright-mcp-offline-win-x64'
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    foreach ($name in @('node_modules','package.json','package-lock.json','start-mcp.ps1','README.md','dsh-client.example.yml')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $stage -Recurse
    }
    $zip = Join-Path $dist 'playwright-mcp-offline-win-x64.zip'
    Compress-Archive -LiteralPath $stage -DestinationPath $zip -CompressionLevel Optimal
    $sum = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$zip.sha256", "$sum  playwright-mcp-offline-win-x64.zip`n", [Text.Encoding]::ASCII)
    Write-Host "Created $zip"
} finally { Pop-Location }
