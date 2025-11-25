import { useState, useEffect } from 'react'
import type { Project } from '../../types/project'
import { ProjectService } from '../../services/api/project'
import type { PreviewMode } from './PreviewModeSelector'
import type { MCPTool, MCPResource } from './types'
import { WidgetGalleryTab } from './widget-gallery/WidgetGalleryTab'
import { DevelopmentTab } from './DevelopmentTab'
import { CodePreviewTab } from './code-preview/CodePreviewTab'

interface WidgetBuilderPanelProps {
  project: Project
  isActive: boolean
  mode: PreviewMode
}

export function WidgetBuilderPanel({ project, isActive, mode }: WidgetBuilderPanelProps) {
  const [tools, setTools] = useState<MCPTool[]>([])
  const [resources, setResources] = useState<MCPResource[]>([])
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null)
  const [selectedResource, setSelectedResource] = useState<MCPResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolOutput, setToolOutput] = useState<any>(null)
  const [toolInputValues, setToolInputValues] = useState<Record<string, any>>({})
  const [widgetHtml, setWidgetHtml] = useState<string>('')
  const [loadingWidget, setLoadingWidget] = useState(false)
  const [widgetError, setWidgetError] = useState<string | null>(null)

  // Fetch MCP tools and resources when panel becomes active, mode changes, or project becomes ready
  useEffect(() => {
    if (!isActive || !project?.project_id) return

    // Only fetch when project is active (MCP server should be ready)
    if (project.status !== 'active') {
      console.log('[WidgetBuilderPanel] Waiting for project to become active, current status:', project.status)
      return
    }

    // Capture project_id at the start to avoid race conditions
    const projectId = project.project_id

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Retry helper with exponential backoff
        const retryFetch = async <T,>(
          fetchFn: () => Promise<T>,
          maxRetries: number = 3,
          delayMs: number = 1000
        ): Promise<T> => {
          let lastError: any
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await fetchFn()
            } catch (error) {
              lastError = error
              if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
              }
            }
          }
          throw lastError
        }

        // Fetch both tools and resources in parallel with retry
        const [toolsResponse, resourcesResponse] = await Promise.all([
          retryFetch(() => ProjectService.fetchMCPTools(projectId)).catch(() => ({
            tools: [],
          })),
          retryFetch(() => ProjectService.fetchMCPResources(projectId)).catch(() => ({
            resources: [],
          })),
        ])

        setTools(toolsResponse.tools || [])
        setResources(resourcesResponse.resources || [])
        console.log('[WidgetBuilderPanel] Fetched tools:', toolsResponse.tools?.length || 0)
      } catch (err) {
        console.error('Failed to fetch MCP data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [project.project_id, project.status, isActive, mode])

  // Load widget HTML when tool with widget is selected
  useEffect(() => {
    if (!selectedTool?._meta?.['openai/outputTemplate']) {
      setWidgetHtml('')
      setWidgetError(null)
      return
    }

    const widgetUri = selectedTool._meta['openai/outputTemplate']
    console.log('[WidgetBuilderPanel] Loading widget HTML for:', widgetUri)

    const loadWidgetHtml = async () => {
      try {
        setLoadingWidget(true)
        setWidgetError(null)
        console.log('[WidgetBuilderPanel] Fetching widget HTML...')

        // Load widget HTML from MCP resource
        const result = await ProjectService.readMCPResource(project.project_id, widgetUri)
        console.log('[WidgetBuilderPanel] MCP resource result:', result)

        // Extract HTML content from result
        const htmlContent = result.contents?.[0]?.text || ''
        console.log('[WidgetBuilderPanel] Widget HTML loaded, length:', htmlContent.length)
        console.log('[WidgetBuilderPanel] Widget HTML FULL:', htmlContent)

        setWidgetHtml(htmlContent)

        if (!htmlContent) {
          console.warn('[WidgetBuilderPanel] Widget HTML is empty for:', widgetUri)
          setWidgetError('Widget HTML is empty')
        }
      } catch (err) {
        console.error('[WidgetBuilderPanel] Failed to load widget HTML:', err)
        setWidgetHtml('')
        setWidgetError(err instanceof Error ? err.message : 'Failed to load widget HTML')
      } finally {
        setLoadingWidget(false)
        console.log('[WidgetBuilderPanel] Loading complete')
      }
    }

    loadWidgetHtml()
  }, [selectedTool, resources])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      {/* Content based on mode */}
      {mode === 'gallery' && (
        <WidgetGalleryTab
          project={project}
          tools={tools}
          resources={resources}
          loading={loading}
          error={error}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          selectedResource={selectedResource}
          onSelectResource={setSelectedResource}
          toolOutput={toolOutput}
          setToolOutput={setToolOutput}
          toolInputValues={toolInputValues}
          setToolInputValues={setToolInputValues}
          widgetHtml={widgetHtml}
          loadingWidget={loadingWidget}
          widgetError={widgetError}
        />
      )}
      {mode === 'sandbox' && <DevelopmentTab project={project} />}
      {mode === 'code' && <CodePreviewTab project={project} tools={tools} />}
    </div>
  )
}
