# Windows Release 1.0 使用说明

## 目录结构
- `dist/`：游戏静态文件
- `启动游戏.bat`：一键启动（推荐）
- `启动游戏.ps1`：PowerShell 启动脚本

## 启动步骤
1. 解压 `yeju-v1.0.0-windows.zip`
2. 双击 `启动游戏.bat`
3. 浏览器打开 `http://127.0.0.1:4175`

## 环境要求
脚本会按顺序尝试：
1. Python (`py` / `python`)
2. Node.js (`npx`)

建议安装 Python 3.10+ 或 Node.js 18+。

## 停止服务
在脚本启动的终端窗口按 `Ctrl + C`。
