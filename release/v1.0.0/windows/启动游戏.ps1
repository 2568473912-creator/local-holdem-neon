$ErrorActionPreference = "Stop"
$port = 4175
$root = Join-Path $PSScriptRoot "dist"

if (-not (Test-Path (Join-Path $root "index.html"))) {
  Write-Host "[错误] 未找到 dist\index.html，请确认压缩包已完整解压。" -ForegroundColor Red
  exit 1
}

Write-Host "正在启动夜局 v1.0.0 ..." -ForegroundColor Cyan
Write-Host "访问地址: http://127.0.0.1:$port"

if (Get-Command py -ErrorAction SilentlyContinue) {
  Start-Process "http://127.0.0.1:$port" | Out-Null
  py -3 -m http.server $port --bind 127.0.0.1 --directory $root
  exit $LASTEXITCODE
}

if (Get-Command python -ErrorAction SilentlyContinue) {
  Start-Process "http://127.0.0.1:$port" | Out-Null
  python -m http.server $port --bind 127.0.0.1 --directory $root
  exit $LASTEXITCODE
}

if (Get-Command npx -ErrorAction SilentlyContinue) {
  Start-Process "http://127.0.0.1:$port" | Out-Null
  npx --yes serve -s $root -l $port
  exit $LASTEXITCODE
}

Write-Host "[错误] 未检测到 Python 或 Node.js，请先安装后重试。" -ForegroundColor Red
exit 1
