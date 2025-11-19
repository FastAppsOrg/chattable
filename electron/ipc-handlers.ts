import { app, ipcMain } from 'electron';
import { getSecureStorage } from './secure-storage';

export function setupIPCHandlers() {
  const storage = getSecureStorage();

  // Storage operations
  ipcMain.handle('storage:get', async (_event, key: string) => {
    try {
      return storage.get(key);
    } catch (error) {
      console.error('Failed to get storage value:', error);
      return null;
    }
  });

  ipcMain.handle('storage:set', async (_event, key: string, value: unknown) => {
    try {
      storage.set(key, value);
    } catch (error) {
      console.error('Failed to set storage value:', error);
      throw error;
    }
  });

  ipcMain.handle('storage:delete', async (_event, key: string) => {
    try {
      storage.delete(key);
    } catch (error) {
      console.error('Failed to delete storage value:', error);
      throw error;
    }
  });

  ipcMain.handle('storage:clear', async () => {
    try {
      storage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  });

  // App operations
  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:quit', async () => {
    app.quit();
  });
}
