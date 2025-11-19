import { Router, Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { FileWatcherService, FileChangeEvent } from '../services/file-watcher.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Global file watcher instance
let fileWatcher: FileWatcherService | null = null

export function createDevRoutes() {
  const router = Router()

  // Initialize file watcher on first use
  if (!fileWatcher) {
    fileWatcher = new FileWatcherService()
    fileWatcher.start()
  }

  /**
   * GET /api/dev/widget-source/:widgetName
   * Fetch widget TypeScript source code for browser compilation
   */
  router.get('/widget-source/:widgetName', async (req, res) => {
    try {
      const { widgetName } = req.params

      // Security: Only allow alphanumeric widget names
      if (!/^[a-zA-Z0-9_-]+$/.test(widgetName)) {
        return res.status(400).json({ error: 'Invalid widget name' })
      }

      const widgetPath = path.join(__dirname, '../../widgets', `${widgetName}.tsx`)

      try {
        const sourceCode = await fs.readFile(widgetPath, 'utf-8')

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.send(sourceCode)
      } catch (readError: any) {
        if (readError.code === 'ENOENT') {
          // File not found - return a sample widget

          const sampleWidget = `import React from 'react'

interface ${widgetName.charAt(0).toUpperCase() + widgetName.slice(1)}Props {
  name?: string
}

export default function ${widgetName.charAt(0).toUpperCase() + widgetName.slice(1)}({ name = 'World' }: ${widgetName.charAt(0).toUpperCase() + widgetName.slice(1)}Props) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#667eea', marginBottom: '16px' }}>
        🎨 ${widgetName.charAt(0).toUpperCase() + widgetName.slice(1)} Widget
      </h1>
      <p style={{ color: '#666', fontSize: '18px' }}>
        Hello, {name}!
      </p>
      <p style={{ color: '#999', fontSize: '14px', marginTop: '24px' }}>
        This is a sample widget. Edit the code to see changes in real-time.
      </p>
    </div>
  )
}
`

          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.send(sampleWidget)
        } else {
          throw readError
        }
      }
    } catch (error: any) {
      console.error('[Dev] Error loading widget source:', error)
      res.status(500).json({
        error: 'Failed to load widget source',
        message: error.message,
      })
    }
  })

  /**
   * GET /api/dev/watch
   * Server-Sent Events endpoint for file change notifications
   */
  router.get('/watch', (req: Request, res: Response) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)

    // Listen for file changes
    const onFileChanged = (event: FileChangeEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    if (fileWatcher) {
      fileWatcher.on('fileChanged', onFileChanged)
    }

    // Handle client disconnect
    req.on('close', () => {
      if (fileWatcher) {
        fileWatcher.off('fileChanged', onFileChanged)
      }
      res.end()
    })
  })

  /**
   * GET /api/dev/widget-list
   * List all available widgets
   */
  router.get('/widget-list', async (req, res) => {
    try {
      const widgetsPath = path.join(__dirname, '../../widgets')

      try {
        const files = await fs.readdir(widgetsPath)
        const widgets = files
          .filter((file) => file.endsWith('.tsx'))
          .map((file) => file.replace('.tsx', ''))

        res.json({ widgets })
      } catch (readError: any) {
        if (readError.code === 'ENOENT') {
          // Widgets directory doesn't exist - return sample list
          res.json({ widgets: ['pokemon', 'weather', 'counter'] })
        } else {
          throw readError
        }
      }
    } catch (error: any) {
      console.error('[Dev] Error listing widgets:', error)
      res.status(500).json({
        error: 'Failed to list widgets',
        message: error.message,
      })
    }
  })

  return router
}
