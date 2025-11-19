import Store from 'electron-store';

interface StorageSchema {
  // Auth tokens
  'auth.access_token': string;
  'auth.refresh_token': string;
  'auth.session': string;

  // User preferences
  'preferences.theme': 'light' | 'dark' | 'system';
  'preferences.apiUrl': string;

  // Window state
  'window.bounds': {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  'window.maximized': boolean;
}

class SecureStorage {
  private store: Store<StorageSchema>;

  constructor() {
    this.store = new Store<StorageSchema>({
      name: 'chattable-config',
      encryptionKey: 'chattable-secure-storage',
      defaults: {
        'preferences.theme': 'dark',
      },
    });
  }

  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | undefined {
    return this.store.get(key);
  }

  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
    this.store.set(key, value);
  }

  delete(key: keyof StorageSchema): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: keyof StorageSchema): boolean {
    return this.store.has(key);
  }

  // Auth helpers
  setAuthTokens(accessToken: string, refreshToken: string): void {
    this.set('auth.access_token', accessToken);
    this.set('auth.refresh_token', refreshToken);
  }

  getAuthTokens(): { accessToken?: string; refreshToken?: string } {
    return {
      accessToken: this.get('auth.access_token'),
      refreshToken: this.get('auth.refresh_token'),
    };
  }

  clearAuthTokens(): void {
    this.delete('auth.access_token');
    this.delete('auth.refresh_token');
    this.delete('auth.session');
  }
}

let secureStorage: SecureStorage | null = null;

export function getSecureStorage(): SecureStorage {
  if (!secureStorage) {
    secureStorage = new SecureStorage();
  }
  return secureStorage;
}
