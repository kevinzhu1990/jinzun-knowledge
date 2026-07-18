const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const APP_URL = 'https://jinzun-knowledge.vercel.app/?source=windows-app';
const ALLOWED_ORIGINS = new Set([
  'https://jinzun-knowledge.vercel.app',
  'https://kevinzhu1990.github.io',
]);

app.setAppUserModelId('com.jinzun.knowledge');

function isAllowedUrl(rawUrl) {
  try {
    return ALLOWED_ORIGINS.has(new URL(rawUrl).origin);
  } catch {
    return false;
  }
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#eef7fa',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    title: '金尊知识库',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) window.loadURL(url);
    else shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  window.webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || validatedUrl.startsWith('file:')) return;
    window.loadFile(path.join(__dirname, 'offline.html'));
  });

  window.once('ready-to-show', () => window.show());
  await window.webContents.session.clearCache();
  await window.loadURL(`${APP_URL}&launch=${Date.now()}`);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
