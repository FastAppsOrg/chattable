import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Storage operations
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('storage:delete', key),
    clear: () => ipcRenderer.invoke('storage:clear'),
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },

  // Deep link handling
  onDeepLink: (callback: (url: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('deep-link', subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('deep-link', subscription);
    };
  },

  // Environment
  env: {
    isDev: process.env.NODE_ENV === 'development',
  },
});

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electron: {
      platform: string;
      isElectron: boolean;
      storage: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
        clear: () => Promise<void>;
      };
      app: {
        getVersion: () => Promise<string>;
        quit: () => Promise<void>;
      };
      onDeepLink: (callback: (url: string) => void) => () => void;
      env: {
        isDev: boolean;
      };
    };
  }
}
