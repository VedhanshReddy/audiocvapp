const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const os = require('os');

let mainWindow;

// Set up logging for updates
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadFile('index.html');

  // Only enable auto-updates on Windows
  if (os.platform() === 'win32') {
    autoUpdater.checkForUpdates();
  } else {
    // On macOS, just check GitHub manually and show a prompt
    checkManualUpdatesMac();
  }
}

// Manual update prompt for macOS users
function checkManualUpdatesMac() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Check for Updates',
    message: 'To update AudioCV on macOS, please download the latest version from GitHub.',
    buttons: ['Open GitHub', 'Cancel']
  }).then(result => {
    if (result.response === 0) {
      shell.openExternal('https://github.com/VedhanshReddy/audiocvapp/releases');
    }
  });
}

// Windows auto-updater event handlers
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is downloading.'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'The update is ready. Restart the app to apply it.',
    buttons: ['Restart', 'Later']
  }).then(result => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

// App menu with platform-aware "Check for Updates"
const template = [
  {
    label: 'AudioCV',
    submenu: [
      { role: 'about' },
      {
        label: 'Check for Updates',
        click: () => {
          if (os.platform() === 'win32') {
            autoUpdater.checkForUpdates();
          } else {
            checkManualUpdatesMac();
          }
        }
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }
];
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// Handle app ready
app.whenReady().then(createWindow);

// File dialog handlers
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'flac'] }],
  });
  return result.filePaths;
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.filePaths;
});
