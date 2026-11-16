[CmdletBinding()]
param(
    [string]$NodePath,
    [ValidateRange(1024,65535)][int]$Port = 8931
)
$ErrorActionPreference = 'Stop'
$cli = Join-Path $PSScriptRoot 'node_modules\@playwright\mcp\cli.js'
if (-not (Test-Path -LiteralPath $cli)) { throw 'Incomplete extraction: node_modules/@playwright/mcp/cli.js is missing.' }

# Read the existing DSH runtime; never install or modify it.
$candidates = @()
if ($NodePath) {
    $candidates = @(Get-Item -LiteralPath $NodePath -ErrorAction Stop)
} else {
    $runtimeRoot = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes'
    if (-not (Test-Path -LiteralPath $runtimeRoot)) { throw 'DSH runtimes not found. Use -NodePath with the existing DSH node.exe.' }
    $candidates = @(Get-ChildItem -LiteralPath $runtimeRoot -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue)
}
$valid = @()
foreach ($candidate in $candidates) {
    try {
        $info = & $candidate.FullName -p 'JSON.stringify({version:process.versions.node,arch:process.arch,platform:process.platform})' 2>$null
        if ($LASTEXITCODE -ne 0) { continue }
        $info = $info | ConvertFrom-Json
        if ($info.platform -eq 'win32' -and $info.arch -eq 'x64' -and ([version]$info.version).Major -eq 24) {
            $valid += [pscustomobject]@{Path=$candidate.FullName; Version=[version]$info.version}
        }
    } catch { continue }
}
$chosen = $valid | Sort-Object Version -Descending | Select-Object -First 1
if (-not $chosen) { throw 'No usable DSH Node.js 24 x64 found. Pass the existing runtime with -NodePath.' }
$node = $chosen.Path
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use. Stop the previous MCP server or choose -Port. No process was terminated."
}
$help = & $node $cli --help 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $help -notmatch '--extension' -or $help -notmatch '--port') { throw 'MCP CLI check failed.' }
Write-Host "Node $($chosen.Version): $node"
Write-Host "MCP: http://127.0.0.1:$Port/mcp"
Write-Host 'Keep this window open. Approve the Playwright Extension connection in Chrome when prompted.'
Write-Host 'Press Ctrl+C to stop. This script does not change execution policy or sandbox settings.'
Push-Location -LiteralPath $PSScriptRoot
try {
    & $node $cli --extension --browser=chrome --port=$Port --host=127.0.0.1
    if ($LASTEXITCODE -ne 0) { throw "MCP exited with code $LASTEXITCODE" }
} finally { Pop-Location }
