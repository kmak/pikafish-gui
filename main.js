const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let engine = null;

function getEnginePath() {
  // In development, use the local engine directory
  // In production, use the resources path
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'engine', 'pikafish');
  }
  return path.join(__dirname, 'engine', 'pikafish');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Pikafish - Xiangqi Engine'
  });

  mainWindow.loadFile('src/index.html');
}

function startEngine() {
  const enginePath = getEnginePath();

  try {
    engine = spawn(enginePath, [], {
      cwd: path.dirname(enginePath)
    });

    engine.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('engine-output', line);
        }
      });
    });

    engine.stderr.on('data', (data) => {
      console.error('Engine stderr:', data.toString());
    });

    engine.on('close', (code) => {
      console.log('Engine process exited with code:', code);
      engine = null;
    });

    engine.on('error', (err) => {
      console.error('Failed to start engine:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('engine-error', err.message);
      }
    });

    // Initialize UCI
    sendToEngine('uci');

  } catch (err) {
    console.error('Error starting engine:', err);
  }
}

function sendToEngine(command) {
  if (engine && engine.stdin.writable) {
    engine.stdin.write(command + '\n');
  }
}

// IPC handlers
ipcMain.on('engine-command', (event, command) => {
  sendToEngine(command);
});

ipcMain.handle('start-engine', async () => {
  console.log('start-engine called, engine exists:', !!engine);
  if (!engine) {
    startEngine();
    return { success: true };
  }
  // Engine already running - reinitialize UCI for renderer reload
  console.log('Sending uci command to existing engine');
  sendToEngine('uci');
  return { success: true, message: 'Engine already running' };
});

ipcMain.handle('stop-engine', async () => {
  if (engine) {
    sendToEngine('quit');
    engine.kill();
    engine = null;
  }
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();
  startEngine();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (engine) {
    sendToEngine('quit');
    engine.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (engine) {
    sendToEngine('quit');
    engine.kill();
  }
});
