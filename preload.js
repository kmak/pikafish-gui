const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('engine', {
  // Send a UCI command to the engine
  send: (command) => {
    ipcRenderer.send('engine-command', command);
  },

  // Listen for engine output
  onOutput: (callback) => {
    ipcRenderer.on('engine-output', (event, data) => callback(data));
  },

  // Listen for engine errors
  onError: (callback) => {
    ipcRenderer.on('engine-error', (event, error) => callback(error));
  },

  // Start the engine
  start: () => ipcRenderer.invoke('start-engine'),

  // Stop the engine
  stop: () => ipcRenderer.invoke('stop-engine'),

  // Remove listeners (for cleanup)
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('engine-output');
    ipcRenderer.removeAllListeners('engine-error');
  }
});
