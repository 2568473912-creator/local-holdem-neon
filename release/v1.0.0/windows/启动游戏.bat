@echo off
setlocal
chcp 65001 >nul

set PORT=4175
set ROOT=%~dp0dist

if not exist "%ROOT%\index.html" (
  echo [错误] 未找到 dist\index.html，请确认压缩包已完整解压。
  pause
  exit /b 1
)

echo 正在启动夜局 v1.0.0 ...
echo 访问地址: http://127.0.0.1:%PORT%

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  py -3 -m http.server %PORT% --bind 127.0.0.1 --directory "%ROOT%"
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  python -m http.server %PORT% --bind 127.0.0.1 --directory "%ROOT%"
  goto :end
)

where npx >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%"
  npx --yes serve -s "%ROOT%" -l %PORT%
  goto :end
)

echo [错误] 未检测到 Python 或 Node.js。
echo 请先安装 Python 3 或 Node.js 18+ 后重试。
pause
exit /b 1

:end
endlocal
