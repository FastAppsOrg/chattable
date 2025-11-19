import { app } from 'electron';
import { getMainWindow } from './main';

const PROTOCOL = 'chattable';

export function setupDeepLinking() {
  // Set as default protocol handler
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  // Handle deep link on Windows/Linux
  const args = process.argv;
  const deepLinkUrl = args.find((arg) => arg.startsWith(`${PROTOCOL}://`));

  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl);
  }
}

export function handleDeepLink(url: string) {
  const mainWindow = getMainWindow();

  if (!mainWindow) {
    console.warn('Main window not ready for deep link:', url);
    return;
  }

  // Send to renderer process
  mainWindow.webContents.send('deep-link', url);

  // Focus window
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

export function parseDeepLink(url: string): { path: string; params: URLSearchParams } | null {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== `${PROTOCOL}:`) {
      return null;
    }

    const path = parsedUrl.pathname;
    const params = parsedUrl.searchParams;

    return { path, params };
  } catch (error) {
    console.error('Failed to parse deep link:', error);
    return null;
  }
}
