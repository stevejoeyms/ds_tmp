@echo off
setlocal
set "MCP_NODE=%DSH_NODE_EXE%"
if not defined MCP_NODE set "MCP_NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%MCP_NODE%" (
  echo DSH node.exe not found. Set DSH_NODE_EXE to the existing runtime path.
  exit /b 1
)
"%MCP_NODE%" "%~dp0background.mjs" %*
exit /b %ERRORLEVEL%
