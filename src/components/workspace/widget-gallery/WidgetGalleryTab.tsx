import { useState } from 'react'
import type { Project } from '../../../types/project'
import { ProjectService } from '../../../services/api/project'
import type { MCPTool, MCPResource } from '../types'
import { WidgetCard } from './WidgetCard'
import { WidgetPreview } from '../WidgetPreview'
import { ToolCardSkeleton } from '../../common/Skeleton'

interface WidgetGalleryTabProps {
  project: Project
  tools: MCPTool[]
  resources: MCPResource[]
  loading: boolean
  error: string | null
  selectedTool: MCPTool | null
  onSelectTool: (tool: MCPTool | null) => void
  selectedResource: MCPResource | null
  onSelectResource: (resource: MCPResource | null) => void
  toolOutput: any
  setToolOutput: (output: any) => void
  toolInputValues: Record<string, any>
  setToolInputValues: (values: Record<string, any>) => void
  widgetHtml: string
  loadingWidget: boolean
  widgetError: string | null
}

export function WidgetGalleryTab({
  project,
  tools,
  resources,
  loading,
  error,
  selectedTool,
  onSelectTool,
  selectedResource,
  onSelectResource,
  toolOutput,
  setToolOutput,
  toolInputValues,
  setToolInputValues,
  widgetHtml,
  loadingWidget,
  widgetError,
}: WidgetGalleryTabProps) {
  const [testingTool, setTestingTool] = useState(false)
  const [toolCallError, setToolCallError] = useState<string | null>(null)
  const [isLayer2Collapsed, setIsLayer2Collapsed] = useState(false)
  const [isLayer2Focused, setIsLayer2Focused] = useState(false)

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
          <div style={{ width: '100px', height: '20px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: '4px' }} />
        </div>

        {/* Tool cards skeleton */}
        <div
          style={{
            flex: '0 0 360px',
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
            <ToolCardSkeleton count={3} />
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
            Select a tool to test
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-error)' }}>
          Failed to load tools
        </div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-tertiary)' }}>{error}</div>
      </div>
    )
  }

  // Defensive: Ensure tools and resources are always arrays
  const toolsArray = Array.isArray(tools) ? tools : []
  const resourcesArray = Array.isArray(resources) ? resources : []

  if (toolsArray.length === 0 && resourcesArray.length === 0) {
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
          No tools or widgets yet
        </div>
        <div style={{ fontSize: '14px', color: 'var(--color-text-tertiary)' }}>
          Create your first tool or widget using the chat panel
        </div>
      </div>
    )
  }

  const selectedItem = selectedTool || selectedResource

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Layer 1: Tools Header (Toggle for Layer 2) */}
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
        <span>Tools ({toolsArray.length})</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
          {isLayer2Collapsed ? '▼' : '▲'}
        </span>
      </div>

      {/* Layer 2: Horizontal Scrolling Cards (Collapsible) */}
      {!isLayer2Collapsed && (
        <div
          style={{
            // Expand when focused (card clicked), shrink when Layer 3 active, expand when tool selected but no output yet
            flex: isLayer2Focused ? '0 0 400px' : (toolOutput ? '0 0 240px' : (selectedTool ? '0 0 400px' : '0 0 240px')),
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
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
            className="hide-scrollbar"
          >
            {toolsArray.map((tool, index) => {
              const isSelected = selectedTool?.name === tool.name
              return (
                <div key={index} style={{ flex: isSelected ? '0 0 500px' : '0 0 220px', transition: 'flex 0.3s', height: '100%' }}>
                  {isSelected ? (
                    // Expanded: Unified card wrapper containing [Card | Form]
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
                        {/* Tool Name */}
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
                          {tool.name}
                        </div>

                        {/* Description */}
                        {tool.description && (
                          <div
                            style={{
                              fontSize: '13px',
                              color: 'var(--color-text-secondary)',
                              lineHeight: '1.5',
                              overflow: 'auto',
                              flex: 1,
                            }}
                          >
                            {tool.description}
                          </div>
                        )}

                        {/* Bottom row: Schema + Widget indicator */}
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {tool.inputSchema && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--color-text-tertiary)',
                              }}
                            >
                              {Object.keys(tool.inputSchema.properties || {}).length} parameters
                            </div>
                          )}
                          {tool._meta?.['openai/outputTemplate'] && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--color-text-tertiary)',
                              }}
                            >
                              {tool._meta?.['openai/outputTemplate']}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Divider */}
                      <div style={{ width: '1px', backgroundColor: 'var(--color-border-subtle)' }} />
                      
                      {/* Right: Test Form */}
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'auto',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                          Test Parameters
                        </div>

                        {tool.inputSchema?.properties ? (
                          <>
                            {Object.entries(tool.inputSchema.properties).map(([key, schema]: [string, any]) => (
                              <div key={key} style={{ marginBottom: '10px' }}>
                                <label
                                  style={{
                                    display: 'block',
                                    fontSize: '12px',
                                    color: 'var(--color-text-secondary)',
                                    marginBottom: '4px',
                                  }}
                                >
                                  {key}
                                  {tool.inputSchema?.required?.includes(key) && (
                                    <span style={{ color: 'var(--color-error)', marginLeft: '4px' }}>*</span>
                                  )}
                                </label>
                                {schema.description && (
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                                    {schema.description}
                                  </div>
                                )}
                                <input
                                  type="text"
                                  value={toolInputValues[key] || ''}
                                  onChange={(e) => setToolInputValues({ ...toolInputValues, [key]: e.target.value })}
                                  placeholder={schema.type === 'string' ? `Enter ${key}...` : `${schema.type}`}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border-subtle)',
                                    borderRadius: '6px',
                                    color: 'var(--color-text-primary)',
                                    fontSize: '12px',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ))}

                            {/* Test button */}
                            {(() => {
                              const requiredFields = tool.inputSchema?.required || []
                              const allRequiredFilled = requiredFields.every(field => {
                                const value = toolInputValues[field]
                                return value !== undefined && value !== null && String(value).trim() !== ''
                              })
                              const isDisabled = testingTool || !allRequiredFilled

                              return (
                                <>
                                  {toolCallError && (
                                    <div
                                      style={{
                                        padding: '10px',
                                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                        border: '1px solid rgba(220, 38, 38, 0.3)',
                                        borderRadius: '6px',
                                        color: 'var(--color-error)',
                                        fontSize: '11px',
                                        marginBottom: '10px',
                                      }}
                                    >
                                      Error: {toolCallError}
                                    </div>
                                  )}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        setTestingTool(true)
                                        setToolOutput(null)
                                        setToolCallError(null)
                                        const result = await ProjectService.callMCPTool(project.project_id, tool.name, toolInputValues)
                                        console.log('[WidgetGalleryTab] Tool call result:', result)
                                        setToolOutput(result)
                                      } catch (err: any) {
                                        console.error('[WidgetGalleryTab] Failed to call tool:', err)
                                        setToolCallError(err instanceof Error ? err.message : 'Unknown error occurred')
                                      } finally {
                                        setTestingTool(false)
                                      }
                                    }}
                                    disabled={isDisabled}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      backgroundColor: 'var(--color-primary)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                                      opacity: isDisabled ? 0.6 : 1,
                                      marginTop: 'auto',
                                    }}
                                  >
                                    {testingTool ? 'Testing...' : 'Test Tool'}
                                  </button>
                                </>
                              )
                            })()}
                          </>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                            No Test Parameters
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Normal card
                    <WidgetCard
                      tool={tool}
                      selected={false}
                      onClick={() => {
                        onSelectResource(null)
                        onSelectTool(tool)
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

      {/* Layer 3: Selected Resource Preview */}
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
            <WidgetPreview
              uri={selectedResource.uri}
              toolName={selectedResource.name || 'resource'}
              projectId={project.project_id}
              mockData={{ name: 'Pikachu' }}
              toolOutput={{ name: 'Pikachu', id: 25, sprites: { front_default: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png' } }}
              onClose={() => onSelectResource(null)}
              showOutputEditor={false}
            />
          </div>
        </div>
      )}

      {/* Layer 3: iframe Preview Only (for tools with widgets) */}
      {selectedTool && toolOutput && selectedTool._meta?.['openai/outputTemplate'] && widgetHtml && !loadingWidget && !widgetError && (
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
            <WidgetPreview
              uri={selectedTool._meta['openai/outputTemplate']}
              toolName={selectedTool.name}
              projectId={project.project_id}
              mockData={toolInputValues}
              toolOutput={toolOutput}
              widgetHtml={widgetHtml}
              onClose={() => {
                setToolOutput(null)
              }}
              showOutputEditor={false}
            />
          </div>
        </div>
      )}

      {/* Layer 3: Tool output without widget (JSON display only) */}
      {selectedTool && toolOutput && !selectedTool._meta?.['openai/outputTemplate'] && (
        <div 
          style={{ flex: '1', overflow: 'hidden', padding: '24px' }}
          onClick={() => setIsLayer2Focused(false)}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '12px 12px 0 0',
              padding: '24px',
              overflow: 'auto',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '16px' }}>
              Tool Output
            </div>
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-bg-primary)',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: 'var(--color-text-secondary)',
                overflow: 'auto',
              }}
            >
              <pre style={{ margin: 0 }}>{JSON.stringify(toolOutput, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Layer 3: Loading/Error states */}
      {selectedTool && toolOutput && selectedTool._meta?.['openai/outputTemplate'] && loadingWidget && (
        <div 
          style={{ flex: '1', overflow: 'hidden', padding: '24px' }}
          onClick={() => setIsLayer2Focused(false)}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Loading widget...
          </div>
        </div>
      )}

      {selectedTool && toolOutput && selectedTool._meta?.['openai/outputTemplate'] && !loadingWidget && widgetError && (
        <div 
          style={{ flex: '1', overflow: 'hidden', padding: '24px' }}
          onClick={() => setIsLayer2Focused(false)}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              padding: '24px',
            }}
          >
            <div
              style={{
                padding: '16px 24px',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '8px',
                color: 'var(--color-error)',
                maxWidth: '400px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Widget Error</div>
              <div style={{ fontSize: '14px' }}>{widgetError}</div>
            </div>
          </div>
        </div>
      )}

      {selectedTool && toolOutput && selectedTool._meta?.['openai/outputTemplate'] && !loadingWidget && !widgetHtml && !widgetError && (
        <div 
          style={{ flex: '1', overflow: 'hidden', padding: '24px' }}
          onClick={() => setIsLayer2Focused(false)}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Widget HTML not available
          </div>
        </div>
      )}

    </div>
  )
}
