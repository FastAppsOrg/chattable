import chokidar, { FSWatcher } from 'chokidar'
import { EventEmitter } from 'events'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface FileChangeEvent {
  path: string
  type: 'change' | 'add' | 'unlink'
  timestamp: number
}

/**
 * File Watcher Service
 * Watches widget files for changes and emits events
 */
export class FileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null
  private watchPath: string

  constructor(watchPath?: string) {
    super()

    // Default to watching widgets directory
    this.watchPath = watchPath || path.join(__dirname, '../../widgets')

    console.log(`[FileWatcher] Initialized to watch: ${this.watchPath}`)
  }

  /**
   * Start watching files
   */
  start(): void {
    if (this.watcher) {
      console.log('[FileWatcher] Already watching')
      return
    }

    console.log(`[FileWatcher] Starting file watcher on: ${this.watchPath}`)

    this.watcher = chokidar.watch(this.watchPath, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file writes to finish
        pollInterval: 50,
      },
    })

    this.watcher
      .on('change', (filePath) => {
        const event: FileChangeEvent = {
          path: filePath,
          type: 'change',
          timestamp: Date.now(),
        }
        console.log(`[FileWatcher] File changed: ${filePath}`)
        this.emit('fileChanged', event)
      })
      .on('add', (filePath) => {
        const event: FileChangeEvent = {
          path: filePath,
          type: 'add',
          timestamp: Date.now(),
        }
        console.log(`[FileWatcher] File added: ${filePath}`)
        this.emit('fileChanged', event)
      })
      .on('unlink', (filePath) => {
        const event: FileChangeEvent = {
          path: filePath,
          type: 'unlink',
          timestamp: Date.now(),
        }
        console.log(`[FileWatcher] File removed: ${filePath}`)
        this.emit('fileChanged', event)
      })
      .on('error', (error) => {
        console.error('[FileWatcher] Error:', error)
        this.emit('error', error)
      })
      .on('ready', () => {
        console.log('[FileWatcher] Ready - watching for file changes')
      })
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      console.log('[FileWatcher] Stopping file watcher')
      await this.watcher.close()
      this.watcher = null
    }
  }

  /**
   * Get the path being watched
   */
  getWatchPath(): string {
    return this.watchPath
  }
}
