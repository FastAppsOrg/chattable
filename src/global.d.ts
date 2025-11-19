// Global type definitions for the application

// Electron API types exposed via preload script
declare global {
  interface Window {
    electron?: {
      platform: string
      isElectron: boolean
      storage: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
        clear: () => Promise<void>
      }
      app: {
        getVersion: () => Promise<string>
        quit: () => Promise<void>
      }
      onDeepLink: (callback: (url: string) => void) => () => void
      env: {
        isDev: boolean
      }
    }
  }
}

export {}

