const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const os = require('os');
const https = require('https');

let mainWindow;

// Set up logging for updates
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.checkForUpdatesOnStart = true;

// Auto-update events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available. Downloading now...`,
    buttons: ['OK']
  });
});

autoUpdater.on('download-progress', (progress) => {
  log.info(`Download progress: ${progress.percent}%`);
  if (mainWindow) {
    mainWindow.setProgressBar(progress.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: `Version ${info.version} has been downloaded. Would you like to install it now?`,
    buttons: ['Install and Restart', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

// Check for updates every 4 hours
function setupAutoUpdates() {
  if (os.platform() === 'win32') {
    autoUpdater.checkForUpdates();
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  } else if (os.platform() === 'darwin') {
    // Check for updates on macOS
    checkGitHubRelease();
    // Check every 4 hours
    setInterval(checkGitHubRelease, 4 * 60 * 60 * 1000);
  }
}

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
  
  setupAutoUpdates();
}

// Manual update prompt for macOS users
function checkManualUpdatesMac(newVersion = '') {
  const message = newVersion ? 
      `Version ${newVersion} is available. Please download the latest version from GitHub.` :
      'To update AudioCV on macOS, please download the latest version from GitHub.';

  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: message,
    buttons: ['Open GitHub', 'Later']
  }).then(result => {
    if (result.response === 0) {
      shell.openExternal('https://github.com/VedhanshReddy/audiocvapp/releases');
    }
  });
}

// Add fetch for GitHub API
function checkGitHubRelease() {
  const options = {
    hostname: 'api.github.com',
    path: '/repos/VedhanshReddy/audiocvapp/releases/latest',
    headers: { 'User-Agent': 'AudioCV' }
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latestVersion = release.tag_name;
        const currentVersion = app.getVersion();
        
        log.info('Current version:', currentVersion);
        log.info('Latest version:', latestVersion);

        if (latestVersion > currentVersion) {
          checkManualUpdatesMac(latestVersion);
        }
      } catch (error) {
        log.error('Failed to check GitHub release:', error);
      }
    });
  }).on('error', (err) => {
    log.error('GitHub API request failed:', err);
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

// Handle error event for auto-updater
autoUpdater.on('error', (err) => {
  dialog.showMessageBox({
    type: 'error',
    title: 'Update Error',
    message: `An error occurred while checking for updates: ${err.message}`,
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

// Set the application menu
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// Handle app ready event
app.whenReady().then(createWindow);

// File dialog handlers to open files/folders
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

// Handle app quit event
app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') {
    app.quit();
  }
});

// Re-create window when app is activated (macOS specific behavior)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});