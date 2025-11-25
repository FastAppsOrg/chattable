import { useState, useEffect, useRef, useCallback } from 'react'
import type { Project } from '../../types/project'
import { ProjectService } from '../../services/api/project'
import { WidgetResourceCard } from './development/WidgetResourceCard'
import { WidgetPreview } from './WidgetPreview'
import { WidgetCardSkeleton, WidgetPreviewSkeleton } from '../common/Skeleton'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface DevelopmentTabProps {
  project: Project
}

interface WidgetResource {
  uri: string
  mimeType?: string
  name?: string
  description?: string
  text?: string
  _meta?: Record<string, any>
}

export function DevelopmentTab({ project }: DevelopmentTabProps) {
  const [resources, setResources] = useState<WidgetResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedResource, setSelectedResource] = useState<WidgetResource | null>(null)
  const [widgetHtml, setWidgetHtml] = useState<string>('')
  const [loadingWidget, setLoadingWidget] = useState(false)
  const [isLayer2Collapsed, setIsLayer2Collapsed] = useState(false)
  const [editedOutput, setEditedOutput] = useState<string>('')
  const [outputError, setOutputError] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isLayer2Focused, setIsLayer2Focused] = useState(false)

  // Layer 1: Fetch MCP resources (widgets)
  useEffect(() => {
    if (!project?.project_id) return

    const fetchResources = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch resources from MCP server
        const result = await ProjectService.fetchMCPResources(project.project_id)
        console.log('[DevelopmentTab] MCP resources:', result)

        // Filter only widget resources (HTML with skybridge)
        const widgetResources = (result.resources || []).filter(
          (r: WidgetResource) =>
            r.mimeType === 'text/html+skybridge' || r.uri.startsWith('ui://widgets/')
        )

        setResources(widgetResources)

        // Debug: Check for exampleOutput in resources
        widgetResources.forEach((r: WidgetResource) => {
          if (r._meta?.exampleOutput) {
            console.log(`[DevelopmentTab] ✅ Found exampleOutput in ${r.uri}:`, r._meta.exampleOutput)
          }
        })

        // Auto-select first widget
        if (widgetResources.length > 0 && !selectedResource) {
          setSelectedResource(widgetResources[0])
        }
      } catch (err) {
        console.error('[DevelopmentTab] Failed to fetch resources:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch widgets')
      } finally {
        setLoading(false)
      }
    }

    fetchResources()
  }, [project?.project_id])

  // Layer 2: Load widget HTML when resource is selected
  useEffect(() => {
    if (!selectedResource) {
      setWidgetHtml('')
      return
    }

    const loadWidgetHtml = async () => {
      try {
        setLoadingWidget(true)
        console.log('[DevelopmentTab] Loading widget HTML for:', selectedResource.uri)

        // Read resource content from MCP
        const result = await ProjectService.readMCPResource(
          project.project_id,
          selectedResource.uri
        )
        console.log('[DevelopmentTab] MCP resource result:', result)

        // Extract HTML content
        const htmlContent = result.contents?.[0]?.text || selectedResource.text || ''
        console.log('[DevelopmentTab] Widget HTML loaded, length:', htmlContent.length)

        setWidgetHtml(htmlContent)

        if (!htmlContent) {
          console.warn('[DevelopmentTab] Widget HTML is empty for:', selectedResource.uri)
        }
      } catch (err) {
        console.error('[DevelopmentTab] Failed to load widget HTML:', err)
        setWidgetHtml('')
        setError(err instanceof Error ? err.message : 'Failed to load widget')
      } finally {
        setLoadingWidget(false)
      }
    }

    loadWidgetHtml()
  }, [selectedResource, project.project_id])

  // Initialize editedOutput when resource changes
  useEffect(() => {
    if (selectedResource?._meta?.exampleOutput) {
      setEditedOutput(JSON.stringify(selectedResource._meta.exampleOutput, null, 2))
    } else {
      setEditedOutput('{}')
    }
    setOutputError(null)
  }, [selectedResource])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Debounced auto-apply function
  const handleOutputChange = useCallback((newValue: string) => {
    setEditedOutput(newValue)
    setOutputError(null)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer to auto-apply after 1 second of inactivity
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Validate JSON
        const parsed = JSON.parse(newValue)

        // Update the resource's exampleOutput
        if (selectedResource) {
          const updatedResource = {
            ...selectedResource,
            _meta: {
              ...selectedResource._meta,
              exampleOutput: parsed,
            },
          }
          setSelectedResource(updatedResource)

          // Trigger widget reload
          setWidgetHtml('')
          setTimeout(() => {
            const loadWidgetHtml = async () => {
              try {
                setLoadingWidget(true)
                const result = await ProjectService.readMCPResource(
                  project.project_id,
                  selectedResource.uri
                )
                const htmlContent = result.contents?.[0]?.text || ''
                setWidgetHtml(htmlContent)
              } catch (err) {
                console.error('[DevelopmentTab] Failed to reload widget:', err)
              } finally {
                setLoadingWidget(false)
              }
            }
            loadWidgetHtml()
          }, 100)
        }
      } catch (err: any) {
        if (err instanceof SyntaxError) {
          setOutputError('Invalid JSON: ' + err.message)
        } else {
          setOutputError(err.message || 'Failed to apply changes')
        }
      }
    }, 1000) // 1 second debounce
  }, [project.project_id, selectedResource])

  // Loading state
  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header skeleton */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ width: '150px', height: '20px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: '4px' }} />
        </div>

        {/* Widget cards skeleton */}
        <div
          style={{
            flex: '0 0 240px',
            overflow: 'hidden',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              height: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '16px 24px',
              display: 'flex',
              gap: '12px',
            }}
          >
            <WidgetCardSkeleton count={3} />
          </div>
        </div>

        {/* Preview area placeholder */}
        <div style={{ flex: '1', padding: '24px' }}>
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: '14px',
            }}
          >
            Select a widget to preview
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-error)',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          Failed to load widgets
        </div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-tertiary)' }}>{error}</div>
      </div>
    )
  }

  // No widgets found
  if (resources.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-text-tertiary)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          No widgets found
        </div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-tertiary)' }}>
          Create widget resources in your MCP server
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Layer 1: Widget Resources Header (Toggle for Layer 2) */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsLayer2Collapsed(!isLayer2Collapsed)}
      >
        <span>Widgets Preview ({resources.length})</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
          {isLayer2Collapsed ? '▼' : '▲'}
        </span>
      </div>

      {/* Layer 2: Horizontal Scrolling Widget Cards (Collapsible) */}
      {!isLayer2Collapsed && (
        <div
          style={{
            // Expand when focused (card clicked), shrink when Layer 3 active, expand when resource selected but no widget yet
            flex: isLayer2Focused ? '0 0 400px' : (widgetHtml ? '0 0 240px' : (selectedResource ? '0 0 400px' : '0 0 240px')),
            overflow: 'hidden',
            borderBottom: '1px solid var(--color-border-subtle)',
            transition: 'flex 0.3s',
          }}
        >
          <div
            style={{
              height: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '16px 24px',
              display: 'flex',
              gap: '12px',
            }}
          >
            {resources.map((resource, index) => {
              const isSelected = selectedResource?.uri === resource.uri
              return (
                <div key={index} style={{ flex: isSelected ? '0 0 500px' : '0 0 220px', transition: 'flex 0.3s', height: '100%' }}>
                  {isSelected ? (
                    // Expanded: Unified card wrapper containing [Card | Info]
                    <div
                      onClick={() => setIsLayer2Focused(true)}
                      style={{
                        height: '100%',
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '2px solid var(--color-primary)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        gap: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Left: Original Card Content (without wrapper) */}
                      <div
                        style={{
                          flex: '0 0 196px', // 220px - 24px padding
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'auto',
                        }}
                      >
                        {/* Widget Name */}
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            marginBottom: '6px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🎨 {resource.name || resource.uri.split('/').pop()?.replace('.html', '') || 'widget'}
                        </div>

                        {/* Description */}
                        {resource.description && (
                          <div
                            style={{
                              fontSize: '13px',
                              color: 'var(--color-text-secondary)',
                              lineHeight: '1.5',
                              overflow: 'auto',
                              flex: 1,
                              marginBottom: '6px',
                            }}
                          >
                            {resource.description}
                          </div>
                        )}

                        {/* URI */}
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {resource.uri}
                        </div>

                        {/* MIME Type badge */}
                        {resource.mimeType && (
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '10px',
                              color: 'var(--color-primary)',
                              backgroundColor: 'var(--color-bg-primary)',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              alignSelf: 'flex-start',
                            }}
                          >
                            {resource.mimeType}
                          </div>
                        )}
                      </div>

                      {/* Divider */}
                      <div style={{ width: '1px', backgroundColor: 'var(--color-border-subtle)' }} />

                      {/* Right: Example Tool Output (JSON Editor) */}
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                          Example Tool Output
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                          Edit JSON to customize widget preview
                        </div>

                        {/* JSON Editor */}
                        <textarea
                          value={editedOutput}
                          onChange={(e) => handleOutputChange(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border-subtle)',
                            borderRadius: '6px',
                            color: 'var(--color-text-primary)',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            lineHeight: '1.5',
                            resize: 'none',
                            outline: 'none',
                          }}
                          spellCheck={false}
                        />

                        {/* Error message */}
                        {outputError && (
                          <div
                            style={{
                              padding: '8px',
                              backgroundColor: 'rgba(220, 38, 38, 0.1)',
                              border: '1px solid rgba(220, 38, 38, 0.3)',
                              borderRadius: '6px',
                              color: 'var(--color-error)',
                              fontSize: '10px',
                              marginTop: '8px',
                            }}
                          >
                            {outputError}
                          </div>
                        )}

                        {/* Apply button (manual trigger, bypasses debounce) */}
                        <button
                          onClick={() => {
                            // Clear debounce timer
                            if (debounceTimerRef.current) {
                              clearTimeout(debounceTimerRef.current)
                            }
                            // Manually trigger the apply logic immediately
                            handleOutputChange(editedOutput)
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 14px',
                            backgroundColor: 'var(--color-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginTop: '10px',
                          }}
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal card
                    <WidgetResourceCard
                      resource={resource}
                      selected={false}
                      onClick={() => {
                        setSelectedResource(resource)
                        setIsLayer2Focused(true) // Focus Layer 2 when card clicked
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Layer 3: Widget Preview */}
      {selectedResource && (
        <div
          style={{ flex: '1', overflow: 'hidden', padding: '24px' }}
          onClick={() => setIsLayer2Focused(false)}
        >
          <div
            style={{
              height: '100%',
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden',
            }}
          >
            {loadingWidget ? (
              <WidgetPreviewSkeleton />
            ) : widgetHtml ? (
              <WidgetPreview
                uri={selectedResource.uri}
                toolName={
                  selectedResource.uri.split('/').pop()?.replace('.html', '') ||
                  selectedResource.name ||
                  'widget'
                }
                projectId={project.project_id}
                mockData={{}}
                toolOutput={selectedResource._meta?.exampleOutput || {}}
                widgetHtml={widgetHtml}
                onClose={() => setSelectedResource(null)}
                showOutputEditor={false}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Widget HTML not available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
