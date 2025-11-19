import { useEffect, useState, useRef, useCallback } from 'react'
import { apiClient } from '../utils/api'
import { API_ENDPOINTS, WS_BASE_URL } from '../constants/api'
import type { Project } from '../types/project'
import { useAuth } from './useAuth'

export interface ContainerHealth {
  container_status: 'running' | 'stopped' | 'not_found' | 'starting' | 'recreating' | 'connecting'
  preview_status: 'running' | 'stopped' | 'not_running' | 'error'
  preview_url: string | null
  preview_port: number | null
  dev_running: boolean
  last_check: number
  error: string | null
  message?: string | null
  retry_count?: number
  setup_progress?: string | null
  sandbox_state?: string | null
  is_ready?: boolean // Whether sandbox is ready for API calls
}

interface UseContainerHealthOptions {
  checkInterval?: number // milliseconds
  enabled?: boolean
  autoRestart?: boolean
  onStatusChange?: (status: ContainerHealth) => void
  /** Project for project-based health checks */
  project?: Project | null
}

/**
 * Container health hook that supports both project-based health checks
 */
export function useContainerHealth(
  options: UseContainerHealthOptions | null,
) {
  // Support both old and new API
  const {
    checkInterval = 5000,
    enabled = true,
    autoRestart = true,
    onStatusChange,
    project
  } = options === null || 'project_id' in (options as any)
    ? { project: options as Project | null }
    : (options as UseContainerHealthOptions)

  const entity = project
  const entityId = entity ? (entity as Project).project_id : null
  const { getAccessToken } = useAuth()
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Get access token
  useEffect(() => {
    getAccessToken().then(setAccessToken)
  }, [getAccessToken])

  const [health, setHealth] = useState<ContainerHealth>({
    container_status: 'not_found',
    preview_status: 'not_running',
    preview_url: null,
    preview_port: null,
    dev_running: false,
    last_check: 0,
    error: null,
  })

  const [isChecking, setIsChecking] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const lastEntityId = useRef<string | null>(null)
  const entityRef = useRef<Project | null>(entity)
  const onStatusChangeRef = useRef(onStatusChange)
  const restartContainerRef = useRef<(() => Promise<boolean>) | null>(null)
  const startPreviewRef = useRef<(() => Promise<boolean>) | null>(null)
  const connectWebSocketRef = useRef<(() => void) | null>(null)
  const MAX_RECONNECT_DELAY = 30000 // Max 30 seconds

  // Update entity ref
  useEffect(() => {
    entityRef.current = entity
  }, [entity])

  // Update refs when they change
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const restartContainer = useCallback(async () => {
    const entity = entityRef.current
    if (!entity || isRestarting) {
      return false
    }

    const projectId = (entity as Project).project_id

    setIsRestarting(true)
    console.log(`Auto-restarting container for project ${projectId}`)

    try {
      const endpoint = API_ENDPOINTS.projectRestart(projectId)

      const response = await apiClient.post(endpoint)

      if (!response.ok) {
        throw new Error(`Restart failed: ${response.status}`)
      }

      await response.json()

      // Wait a bit for container to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Check health again after restart
      // Note: checkHealth will be defined after this function
      // await checkHealth()

      console.log('Container restarted successfully')
      return true
    } catch (error) {
      console.error('Failed to restart container:', error)
      setHealth((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Restart failed',
      }))
      return false
    } finally {
      setIsRestarting(false)
    }
  }, [isRestarting])

  // Update ref
  useEffect(() => {
    restartContainerRef.current = restartContainer
  }, [restartContainer])

  const startPreview = useCallback(async () => {
    const entity = entityRef.current
    if (!entity) {
      return false
    }

    const projectId = (entity as Project).project_id

    console.log(`Auto-starting preview for project ${projectId}`)

    try {
      const endpoint = API_ENDPOINTS.projectPreviewStart(projectId)

      const response = await apiClient.post(endpoint)

      if (!response.ok) {
        throw new Error(`Preview start failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'success' || data.status === 'already_running') {
        console.log('Preview started successfully')

        // Wait for preview to be ready
        await new Promise((resolve) => setTimeout(resolve, 3000))

        // Check health again will be done in the main checkHealth
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to start preview:', error)
      return false
    }
  }, [])

  // Update ref
  useEffect(() => {
    startPreviewRef.current = startPreview
  }, [startPreview])

  // Helper function to update health with diff check
  const updateHealth = useCallback((data: any) => {
    const newHealth: ContainerHealth = {
      container_status: data.container_status || 'not_found',
      preview_status: data.preview_status || 'not_running',
      preview_url: data.preview_url || null,
      preview_port: data.preview_port || null,
      dev_running: data.dev_running || false,
      last_check: Date.now(),
      error: data.error || null,
      message: data.message || null,
      retry_count: reconnectAttemptsRef.current,
      sandbox_state: data.sandbox_state || null,
      setup_progress: data.setup_progress || null,
      is_ready: data.is_ready ?? true,
    }

    console.log(`[useContainerHealth] WebSocket message received:`, {
      container_status: data.container_status,
      preview_status: data.preview_status,
      preview_url: data.preview_url,
      dev_running: data.dev_running,
    })

    // Only update if meaningful fields changed (prevent iframe reload)
    setHealth((prev) => {
      const hasChanged =
        prev.container_status !== newHealth.container_status ||
        prev.preview_status !== newHealth.preview_status ||
        prev.preview_url !== newHealth.preview_url ||
        prev.preview_port !== newHealth.preview_port ||
        prev.dev_running !== newHealth.dev_running ||
        prev.error !== newHealth.error ||
        prev.message !== newHealth.message ||
        prev.setup_progress !== newHealth.setup_progress ||
        prev.sandbox_state !== newHealth.sandbox_state ||
        prev.is_ready !== newHealth.is_ready

      if (hasChanged) {
        console.log(`[useContainerHealth] Health changed, updating state:`, {
          container_status: `${prev.container_status} → ${newHealth.container_status}`,
          preview_status: `${prev.preview_status} → ${newHealth.preview_status}`,
          preview_url: `${prev.preview_url} → ${newHealth.preview_url}`,
          dev_running: `${prev.dev_running} → ${newHealth.dev_running}`,
        })
        return newHealth
      } else {
        console.log(`[useContainerHealth] No meaningful changes, skipping update`)
        return prev
      }
    })

    onStatusChangeRef.current?.(newHealth)

    // Auto-restart container if needed
    if (autoRestart && newHealth.container_status === 'stopped' && data.has_volume) {
      restartContainerRef.current?.()
    }

    // Auto-start preview if container is running but preview is not
    if (
      newHealth.container_status === 'running' &&
      newHealth.preview_status === 'not_running' &&
      data.has_package_json
    ) {
      startPreviewRef.current?.()
    }
  }, [autoRestart])

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    const entity = entityRef.current

    if (!entity || !enabled || !accessToken) {
      return
    }

    const projectId = (entity as Project).project_id

    // Close existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    try {
      const wsUrl = `${WS_BASE_URL}${API_ENDPOINTS.projectStatusWebSocket(projectId)}?access_token=${encodeURIComponent(accessToken)}`
      console.log(`[useContainerHealth] Connecting WebSocket for project ${projectId}...`)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log(`[useContainerHealth] WebSocket connected for project ${projectId}`)
        reconnectAttemptsRef.current = 0 // Reset on successful connection
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle progress-only messages
          if ('setup_progress' in data && Object.keys(data).length === 1) {
            setHealth((prev) => ({ ...prev, setup_progress: data.setup_progress }))
            return
          }

          // Handle full status messages
          updateHealth(data)
        } catch (error) {
          console.error('[useContainerHealth] Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[useContainerHealth] WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log(`[useContainerHealth] WebSocket closed for project ${projectId}`)
        wsRef.current = null

        // Auto-reconnect with exponential backoff
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), MAX_RECONNECT_DELAY)
          reconnectAttemptsRef.current += 1

          console.log(`[useContainerHealth] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`)

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocketRef.current?.()
          }, delay)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[useContainerHealth] Failed to create WebSocket connection:', error)
    }
  }, [enabled, accessToken, updateHealth])

  // Update ref
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket
  }, [connectWebSocket])

  // Start/stop WebSocket connection based on entity and options
  useEffect(() => {
    if (!entityId || !enabled || !accessToken) {
      // Clean up WebSocket
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      return
    }

    // Check if entity changed
    if (entityId !== lastEntityId.current) {
      console.log(`[useContainerHealth] Starting WebSocket monitoring for project ${entityId}`)
      lastEntityId.current = entityId
      reconnectAttemptsRef.current = 0 // Reset retry count for new entity
    }

    // Connect to WebSocket
    connectWebSocketRef.current?.()

    return () => {
      // Cleanup on unmount or entity change
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [entityId, enabled, accessToken])

  // Manual trigger functions
  const refresh = useCallback(() => {
    console.log('[useContainerHealth] Manual refresh - reconnecting WebSocket...')
    // Close and reconnect WebSocket to force refresh
    if (wsRef.current) {
      wsRef.current.close()
    }
    connectWebSocketRef.current?.()
  }, [])

  const restart = useCallback(() => {
    return restartContainer()
  }, [restartContainer])

  return {
    health,
    isChecking,
    isRestarting,
    refresh,
    restart,
    startPreview,
  }
}