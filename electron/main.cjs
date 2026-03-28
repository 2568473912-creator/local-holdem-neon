const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function resolveIndexHtmlPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'dist', 'index.html');
  }
  return path.join(__dirname, '..', 'dist', 'index.html');
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: '#071322',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  });

  const indexHtmlPath = resolveIndexHtmlPath();

  if (!fs.existsSync(indexHtmlPath)) {
    const escapedPath = indexHtmlPath.replace(/\\/g, '/');
    mainWindow.loadURL(
      `data:text/html;charset=UTF-8,${encodeURIComponent(`<h2 style="font-family:Segoe UI;color:#fff;background:#091523;padding:24px">未找到打包资源：${escapedPath}<br/>请先执行 npm run build</h2>`)}`,
    );
  } else {
    mainWindow.loadFile(indexHtmlPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  app.setName('夜局');
  Menu.setApplicationMenu(null);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
