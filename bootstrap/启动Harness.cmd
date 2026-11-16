@echo off
setlocal
chcp 65001 >nul
set "KIT_HOME=%DSH_HOME%"
if not defined KIT_HOME set "KIT_HOME=%USERPROFILE%\.dsh"
set "KIT_NODE=%DSH_NODE_EXE%"
if not defined KIT_NODE set "KIT_NODE=%KIT_HOME%\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%KIT_NODE%" (
  echo DSH Node not found. Set DSH_NODE_EXE to its existing full path.
  exit /b 1
)
"%KIT_NODE%" "%~dp0setup.mjs" launch --interactive %*
set "KIT_RESULT=%ERRORLEVEL%"
echo.
echo Launcher returned code %KIT_RESULT%. Read the messages above.
pause
exit /b %KIT_RESULT%
