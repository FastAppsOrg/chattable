import { useCallback, useEffect, useRef } from 'react'
import { useReconnectingWebSocket } from './useReconnectingWebSocket'
import { WS_BASE_URL, API_ENDPOINTS } from '../constants/api'

export interface ProjectStatus {
  container_status: string
  preview_status: string
  preview_url: string | null
  preview_port: number | null
  dev_running: boolean
  message?: string
  sandbox_state?: string | null
  setup_progress?: string | null
  is_ready?: boolean
  timestamp: number
}

export interface UseProjectStatusWebSocketOptions {
  projectId: string | null
  accessToken: string | null
  enabled?: boolean
  onStatusUpdate?: (status: ProjectStatus) => void
  onError?: (error: Event) => void
}

/**
 * Hook for receiving real-time project status updates via WebSocket
 *
 * Connects to backend WebSocket endpoint that sends status updates every 5 seconds
 */
export function useProjectStatusWebSocket({
  projectId,
  accessToken,
  enabled = true,
  onStatusUpdate,
  onError,
}: UseProjectStatusWebSocketOptions) {
  const lastStatusRef = useRef<ProjectStatus | null>(null)

  // Build WebSocket URL
  const wsUrl = projectId && accessToken && enabled
    ? `${WS_BASE_URL}${API_ENDPOINTS.projectStatusWebSocket(projectId)}?access_token=${encodeURIComponent(accessToken)}`
    : ''

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      // Handle progress-only messages (from _broadcast_setup_progress)
      if ('setup_progress' in data && Object.keys(data).length === 1) {
        // Update only setup_progress field
        if (lastStatusRef.current) {
          const updatedStatus = { ...lastStatusRef.current, setup_progress: data.setup_progress }
          lastStatusRef.current = updatedStatus
          onStatusUpdate?.(updatedStatus)
        }
        return
      }

      // Handle full status messages
      const status: ProjectStatus = data
      lastStatusRef.current = status
      onStatusUpdate?.(status)
    } catch (error) {
      console.error('Failed to parse project status message:', error)
    }
  }, [onStatusUpdate])

  const { state, disconnect } = useReconnectingWebSocket({
    url: wsUrl,
    reconnectInterval: 2000,
    maxReconnectInterval: 10000,
    reconnectDecay: 1.5,
    maxReconnectAttempts: 10,
    onMessage: handleMessage,
    onError: (error) => {
      console.error('Project status WebSocket error:', error)
      onError?.(error)
    },
    onOpen: () => {
      console.log(`Project status WebSocket connected for project ${projectId}`)
    },
    onClose: (event) => {
      console.log(`Project status WebSocket closed: ${event.code} ${event.reason}`)
    },
    shouldReconnect: () => enabled,
  })

  // Cleanup on unmount or when disabled
  useEffect(() => {
    if (!enabled) {
      disconnect()
    }
  }, [enabled, disconnect])

  return {
    lastStatus: lastStatusRef.current,
    isConnected: state.readyState === WebSocket.OPEN,
    isReconnecting: state.isReconnecting,
    reconnectAttempts: state.reconnectAttempts,
    disconnect,
  }
}
