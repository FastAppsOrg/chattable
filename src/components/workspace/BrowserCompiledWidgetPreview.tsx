import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import * as esbuild from 'esbuild-wasm'

interface BrowserCompiledWidgetPreviewProps {
  widgetSourceCode: string
  toolName: string
  mockData?: Record<string, any>
  onClose?: () => void
}

export function BrowserCompiledWidgetPreview({
  widgetSourceCode,
  toolName,
  mockData = {},
  onClose,
}: BrowserCompiledWidgetPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { theme } = useTheme()
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [esbuildInitialized, setEsbuildInitialized] = useState(false)
  const [compiledHtml, setCompiledHtml] = useState<string>('')

  // Initialize esbuild-wasm once
  useEffect(() => {
    const initEsbuild = async () => {
      try {
        await esbuild.initialize({
          wasmURL: 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.20.0/esbuild.wasm',
        })
        console.log('[BrowserCompiledWidget] esbuild initialized')
        setEsbuildInitialized(true)
      } catch (err: any) {
        console.error('[BrowserCompiledWidget] Failed to initialize esbuild:', err)
        setError(`Failed to initialize compiler: ${err.message}`)
      }
    }

    initEsbuild()
  }, [])

  // Compile widget source code when it changes
  useEffect(() => {
    if (!esbuildInitialized || !widgetSourceCode) return

    const compileWidget = async () => {
      try {
        setCompiling(true)
        setError(null)

        console.log('[BrowserCompiledWidget] Compiling widget...')
        const startTime = performance.now()

        // Transform TypeScript/JSX to JavaScript
        const result = await esbuild.transform(widgetSourceCode, {
          loader: 'tsx',
          jsx: 'automatic',
          jsxImportSource: 'react',
          target: 'es2020',
          format: 'esm',
        })

        const compileTime = Math.round(performance.now() - startTime)
        console.log(`[BrowserCompiledWidget] Compiled in ${compileTime}ms`)

        // Create HTML document with compiled code
        const html = createWidgetHtml(result.code, toolName, mockData, theme)
        setCompiledHtml(html)
        setIsReady(false) // Reset ready state for new compilation

      } catch (err: any) {
        console.error('[BrowserCompiledWidget] Compilation failed:', err)
        setError(`Compilation failed: ${err.message}`)
      } finally {
        setCompiling(false)
      }
    }

    compileWidget()
  }, [widgetSourceCode, esbuildInitialized, toolName, mockData, theme])

  // Handle iframe load
  useEffect(() => {
    if (!compiledHtml) return

    const handleLoad = () => {
      console.log('[BrowserCompiledWidget] iframe loaded successfully')
      setIsReady(true)
    }

    const handleError = (e: Event) => {
      console.error('[BrowserCompiledWidget] iframe load error:', e)
      setError('Failed to load widget')
    }

    const iframe = iframeRef.current
    iframe?.addEventListener('load', handleLoad)
    iframe?.addEventListener('error', handleError)

    return () => {
      iframe?.removeEventListener('load', handleLoad)
      iframe?.removeEventListener('error', handleError)
    }
  }, [compiledHtml])

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        backgroundColor: 'var(--color-bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1001,
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            fontSize: '20px',
            color: 'var(--color-text-secondary)',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
        >
          ✕
        </button>
      )}

      {/* Compilation status indicator */}
      {compiling && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 1001,
            padding: '6px 12px',
            backgroundColor: '#f59e0b',
            color: 'white',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          Compiling...
        </div>
      )}

      {/* Error message overlay */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            padding: '16px 24px',
            backgroundColor: 'var(--color-bg-error)',
            color: 'var(--color-text-error)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            maxWidth: '400px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* iframe container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '600px',
          maxHeight: '800px',
          position: 'relative',
          display: 'flex',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        {compiledHtml ? (
          <>
            <iframe
              ref={iframeRef}
              srcDoc={compiledHtml}
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: 'var(--color-bg-primary)',
              }}
              title={`Widget: ${toolName}`}
            />

            {/* Loading overlay */}
            {!isReady && !error && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-tertiary)',
                  fontSize: '14px',
                  zIndex: 1000,
                }}
              >
                Loading widget...
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: '14px',
            }}
          >
            {esbuildInitialized ? 'Waiting for code...' : 'Initializing compiler...'}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Create HTML document with compiled widget code
 */
function createWidgetHtml(
  compiledJs: string,
  toolName: string,
  mockData: Record<string, any>,
  theme: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Widget: ${toolName}</title>

  <!-- Import Map for React -->
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react/": "https://esm.sh/react@18.3.1/",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/": "https://esm.sh/react-dom@18.3.1/"
    }
  }
  </script>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      width: 100vw;
      height: 100vh;
      overflow: auto;
    }

    #root {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="module">
    // Compiled widget code
    const widgetModuleCode = ${JSON.stringify(compiledJs)};

    // Create blob URL for dynamic import
    const blob = new Blob([widgetModuleCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    // Import and render widget
    (async () => {
      try {
        const React = await import('react');
        const ReactDOM = await import('react-dom/client');
        const widgetModule = await import(url);

        // Clean up blob URL
        URL.revokeObjectURL(url);

        // Get widget component (default export)
        const WidgetComponent = widgetModule.default;

        if (!WidgetComponent) {
          throw new Error('Widget must have a default export');
        }

        // Render widget with mock data
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(WidgetComponent, ${JSON.stringify(mockData)}));

        console.log('[Widget] Rendered successfully');
      } catch (error) {
        console.error('[Widget] Render error:', error);

        // Safe error display using DOM methods
        const rootEl = document.getElementById('root');
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = 'padding: 40px; text-align: center; color: #ef4444;';

        const errorTitle = document.createElement('h2');
        errorTitle.textContent = 'Widget Render Error';

        const errorMessage = document.createElement('p');
        errorMessage.style.cssText = 'margin-top: 16px; font-size: 14px;';
        errorMessage.textContent = error.message;

        errorContainer.appendChild(errorTitle);
        errorContainer.appendChild(errorMessage);
        rootEl.appendChild(errorContainer);
      }
    })();
  </script>
</body>
</html>`
}
