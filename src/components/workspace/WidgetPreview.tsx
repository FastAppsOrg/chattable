import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { apiClient } from '../../utils/api'
import { API_CONFIG } from '../../config/api.config'
import type { Project } from '../../types/project'

interface WidgetPreviewProps {
  uri: string
  toolName: string
  projectId: string
  mockData?: Record<string, any>
  toolOutput?: any
  widgetHtml?: string  // HTML content from MCP resource
  onClose?: () => void
  showOutputEditor?: boolean  // Whether to show the tool output editor (default: false)
}

export function WidgetPreview({ uri, toolName, projectId, mockData = {}, toolOutput, widgetHtml, onClose, showOutputEditor = false }: WidgetPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { theme } = useTheme()
  const [isReady, setIsReady] = useState(false)
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editedOutput, setEditedOutput] = useState<string>(
    JSON.stringify(toolOutput?.structuredContent || toolOutput || {}, null, 2)
  )
  const [outputError, setOutputError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if toolOutput indicates an error
  const hasToolError = toolOutput?.isError === true

  // Update editedOutput when toolOutput changes
  useEffect(() => {
    setEditedOutput(JSON.stringify(toolOutput?.structuredContent || toolOutput || {}, null, 2))
  }, [toolOutput])

  // Store widget data and get URL
  useEffect(() => {
    if (!projectId || !uri || !toolName) {
      console.log('[WidgetPreview] Missing required data:', { projectId, uri, toolName })
      return
    }

    console.log('[WidgetPreview] Storing widget data and preparing URL...')
    setError(null)
    setWidgetUrl(null)

    const storeWidgetData = async () => {
      try {
        const toolId = `widget_${Date.now()}_${Math.random()}`

        // Extract structuredContent from toolOutput if it exists
        const widgetData = toolOutput?.structuredContent || toolOutput || null
        const metadata = toolOutput?._meta || null

        console.log('[WidgetPreview] Storing widget data:', {
          uri,
          toolName,
          toolId,
          hasToolOutput: !!widgetData,
          hasMetadata: !!metadata
        })

        const response = await apiClient.post(
          `/api/projects/${projectId}/mcp/widget/store`,
          {
            uri,
            toolInput: mockData,
            toolOutput: widgetData,
            toolResponseMetadata: metadata,
            toolId,
            toolName,
            theme: theme,
            htmlContent: widgetHtml || '',  // Send pre-fetched HTML
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to store widget data')
        }

        // Set widget URL to server-rendered endpoint (absolute URL to avoid React Router interception)
        // Use local-token for authentication
        const token = 'local-token'
        const url = `${API_CONFIG.BASE_URL}/api/projects/${projectId}/mcp/widget-content/${toolId}?token=${encodeURIComponent(token)}`
        console.log('[WidgetPreview] Widget URL ready:', url)
        setWidgetUrl(url)

      } catch (err: any) {
        console.error('[WidgetPreview] Failed to store widget data:', err)
        setError(err.message || 'Failed to prepare widget')
      }
    }

    storeWidgetData()
  }, [uri, toolName, mockData, toolOutput, theme, projectId])

  // Handle postMessage communication with iframe
  useEffect(() => {
    if (!widgetUrl) return

    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (
        !iframeRef.current ||
        event.source !== iframeRef.current.contentWindow
      ) {
        return
      }

      console.log('[WidgetPreview] Received postMessage:', event.data.type)

      switch (event.data.type) {
        case 'openai:setWidgetState':
          console.log('[WidgetPreview] Widget state saved:', event.data.state)
          break

        case 'openai:callTool':
          console.log('[WidgetPreview] Tool call requested:', event.data.toolName, event.data.params)
          // TODO: Implement tool calling if needed
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'openai:callTool:response',
              requestId: event.data.requestId,
              result: {},
            },
            '*'
          )
          break

        case 'openai:sendFollowup':
          console.log('[WidgetPreview] Followup message:', event.data.message)
          break
      }
    }

    const handleLoad = () => {
      console.log('[WidgetPreview] iframe loaded successfully')
      setIsReady(true)
      setError(null)
    }

    const handleError = (e: Event) => {
      console.error('[WidgetPreview] iframe load error:', e)
      setError('Failed to load widget')
      setIsReady(false)
    }

    window.addEventListener('message', handleMessage)
    iframeRef.current?.addEventListener('load', handleLoad)
    iframeRef.current?.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('message', handleMessage)
      iframeRef.current?.removeEventListener('load', handleLoad)
      iframeRef.current?.removeEventListener('error', handleError)
    }
  }, [widgetUrl])

  // Send theme updates to iframe
  useEffect(() => {
    if (!isReady || !iframeRef.current?.contentWindow) return

    console.log('[WidgetPreview] Sending theme update:', theme)
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'openai:set_globals',
        globals: { theme },
      },
      '*'
    )
  }, [theme, isReady])

  const handleApplyChanges = async () => {
    try {
      // Validate JSON
      const parsedOutput = JSON.parse(editedOutput)
      setOutputError(null)

      // Re-store widget data with new output
      const toolId = `widget_${Date.now()}_${Math.random()}`
      const response = await apiClient.post(
        `/api/projects/${projectId}/mcp/widget/store`,
        {
          uri,
          toolInput: mockData,
          toolOutput: parsedOutput,
          toolResponseMetadata: toolOutput?._meta || null,
          toolId,
          toolName,
          theme: theme,
          htmlContent: widgetHtml || '',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update widget data')
      }

      // Update iframe URL with local-token
      const token = 'local-token'
      const url = `${API_CONFIG.BASE_URL}/api/projects/${projectId}/mcp/widget-content/${toolId}?token=${encodeURIComponent(token)}`
      setWidgetUrl(url)
      setIsReady(false)
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setOutputError('Invalid JSON: ' + err.message)
      } else {
        setOutputError(err.message || 'Failed to apply changes')
      }
    }
  }

  // Debounced auto-apply changes (1 second delay)
  const handleOutputChange = useCallback((newValue: string) => {
    setEditedOutput(newValue)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer to auto-apply after 1 second of inactivity
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Validate JSON
        const parsedOutput = JSON.parse(newValue)
        setOutputError(null)

        // Auto-apply changes to server
        const toolId = `widget_${Date.now()}_${Math.random()}`
        const response = await apiClient.post(
          `/api/projects/${projectId}/mcp/widget/store`,
          {
            uri,
            toolInput: mockData,
            toolOutput: parsedOutput,
            toolResponseMetadata: toolOutput?._meta || null,
            toolId,
            toolName,
            theme: theme,
            htmlContent: widgetHtml || '',
          }
        )

        if (!response.ok) {
          throw new Error('Failed to update widget data')
        }

        // Update iframe URL with local-token
        const token = 'local-token'
        const url = `${API_CONFIG.BASE_URL}/api/projects/${projectId}/mcp/widget-content/${toolId}?token=${encodeURIComponent(token)}`
        setWidgetUrl(url)
        setIsReady(false)
      } catch (err: any) {
        if (err instanceof SyntaxError) {
          setOutputError('Invalid JSON: ' + err.message)
        } else {
          setOutputError(err.message || 'Failed to apply changes')
        }
      }
    }, 1000)
  }, [projectId, uri, mockData, toolOutput, toolName, theme, widgetHtml])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        backgroundColor: 'transparent', /* Background provided by parent wrapper */
        display: 'flex',
        gap: '24px',
      }}
    >
      {/* Close button at top-right corner */}
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

      {/* Right: Widget Preview */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Error message overlay */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              padding: '20px 32px',
              backgroundColor: 'rgba(220, 38, 38, 0.95)',
              color: 'white',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              maxWidth: '400px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              ⚠️ Widget Error
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {error}
            </div>
          </div>
        )}

        {/* Missing Tool Output Nudge */}
        {!hasToolError && (!toolOutput || Object.keys(toolOutput).length === 0) && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999,
              padding: '8px 16px',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
              borderRadius: '20px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              fontSize: '13px',
              fontWeight: 500,
              border: '1px solid var(--color-border-subtle)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>💡</span>
            <span>Add example JSON to see preview</span>
          </div>
        )}

        {/* iframe container or tool error display */}
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
          {hasToolError ? (
            // Tool Error Display (modern and clean)
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--color-bg-primary)',
                padding: '48px',
                gap: '24px',
              }}
            >
              {/* Error Icon */}
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                }}
              >
                ⚠️
              </div>

              {/* Error Title */}
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  textAlign: 'center',
                }}
              >
                Tool Execution Failed
              </div>

              {/* Error Message */}
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  lineHeight: '1.6',
                  maxWidth: '400px',
                }}
              >
                {toolOutput?.content?.[0]?.text || 'The tool encountered an error during execution.'}
              </div>

              {/* Error Details (if available) */}
              {toolOutput?.content && toolOutput.content.length > 1 && (
                <details
                  style={{
                    width: '100%',
                    maxWidth: '500px',
                    marginTop: '8px',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--color-text-tertiary)',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: '6px',
                      userSelect: 'none',
                    }}
                  >
                    Show error details
                  </summary>
                  <pre
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: 'var(--color-text-secondary)',
                      overflow: 'auto',
                      maxHeight: '200px',
                      lineHeight: '1.5',
                    }}
                  >
                    {JSON.stringify(toolOutput, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : widgetUrl ? (
            <>
              <iframe
                ref={iframeRef}
                src={widgetUrl}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                allow="web-share"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'var(--color-bg-secondary)', /* Match parent background */
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
              Preparing widget URL...
            </div>
          )}
        </div>
      </div>


      {/* Left: Tool Output Editor (only in Development mode) */}
      {showOutputEditor && (
        <div
          style={{
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Example Tool Output
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
              Edit JSON and click Apply to update widget. <br />
              Initial data provided by the server.
            </div>
          </div>

          {/* JSON Editor */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={editedOutput}
              onChange={(e) => handleOutputChange(e.target.value)}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: 'none',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                resize: 'none',
                outline: 'none',
              }}
              spellCheck={false}
            />
          </div>

          {/* Error message */}
          {outputError && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                borderTop: '1px solid var(--color-border-subtle)',
                color: 'var(--color-error)',
                fontSize: '11px',
              }}
            >
              {outputError}
            </div>
          )}

          {/* Apply button */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <button
              onClick={handleApplyChanges}
              style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              Apply Changes
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
