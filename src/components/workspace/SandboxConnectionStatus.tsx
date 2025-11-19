import { useEffect, useState, useRef, useCallback } from 'react'
import { apiClient } from '@/utils/api'
import { API_ENDPOINTS } from '@/constants/api'
import './SandboxConnectionStatus.css'

type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected'

interface SandboxConnectionStatusProps {
  projectId: string
  onStatusChange?: (status: ConnectionStatus) => void
}

export function SandboxConnectionStatus({
  projectId,
  onStatusChange,
}: SandboxConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const retryCountRef = useRef(0)
  const timeoutIdRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const isMountedRef = useRef(true)
  const lastCallTimeRef = useRef(0)
  const onStatusChangeRef = useRef(onStatusChange)

  // Update ref when callback changes (avoids dependency issues)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const checkSandboxStatus = useCallback(async () => {
    if (!isMountedRef.current) return

    // Rate limiting: prevent calls more frequent than 1 second
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTimeRef.current
    if (timeSinceLastCall < 1000) {
      console.warn('[SandboxConnectionStatus] Rate limit: skipping call too soon after previous')
      return
    }
    lastCallTimeRef.current = now

    try {
      // Call /status endpoint to check sandbox health
      const response = await apiClient.get(API_ENDPOINTS.projectStatus(projectId))

      if (!isMountedRef.current) return

      if (response.ok) {
        const data = await response.json()

        // Check if container is running
        if (data.container_status === 'running') {
          setStatus('connected')
          onStatusChangeRef.current?.('connected')
          retryCountRef.current = 0
          // Stop polling when connected - no need to keep checking
        } else if (data.container_status === 'connecting' || data.container_status === 'starting') {
          setStatus('connecting')
          onStatusChangeRef.current?.('connecting')
          // Retry after 3 seconds (reduced frequency)
          timeoutIdRef.current = setTimeout(checkSandboxStatus, 3000)
        } else if (data.container_status === 'recreating') {
          setStatus('connecting')
          onStatusChangeRef.current?.('connecting')
          // Retry after 5 seconds for recreating (longer wait)
          timeoutIdRef.current = setTimeout(checkSandboxStatus, 5000)
        } else {
          // Container not running, show as disconnected
          setStatus('disconnected')
          onStatusChangeRef.current?.('disconnected')
          // Don't keep polling if disconnected - wait longer
          timeoutIdRef.current = setTimeout(checkSandboxStatus, 10000)
        }
      } else {
        // Error response
        if (retryCountRef.current < 5) {
          setStatus('connecting')
          onStatusChangeRef.current?.('connecting')
          retryCountRef.current++
          const backoff = Math.min(10000, 3000 + retryCountRef.current * 2000)
          timeoutIdRef.current = setTimeout(checkSandboxStatus, backoff)
        } else {
          setStatus('error')
          onStatusChangeRef.current?.('error')
          console.error('[SandboxConnectionStatus] Max retries reached, stopping polling')
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return

      // Network error, retry with exponential backoff
      if (retryCountRef.current < 5) {
        setStatus('connecting')
        onStatusChangeRef.current?.('connecting')
        retryCountRef.current++
        const backoff = Math.min(10000, 3000 + retryCountRef.current * 2000)
        console.warn(`[SandboxConnectionStatus] Network error, retry ${retryCountRef.current}/5 in ${backoff}ms`)
        timeoutIdRef.current = setTimeout(checkSandboxStatus, backoff)
      } else {
        setStatus('error')
        onStatusChangeRef.current?.('error')
        console.error('[SandboxConnectionStatus] Max retries reached after network errors, stopping polling')
      }
    }
  }, [projectId])

  useEffect(() => {
    isMountedRef.current = true
    retryCountRef.current = 0
    lastCallTimeRef.current = 0

    // Start checking immediately
    checkSandboxStatus()

    return () => {
      isMountedRef.current = false
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
    }
  }, [projectId, checkSandboxStatus])

  // Status indicator styles
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4caf50' // Green
      case 'connecting':
        return '#ff9800' // Orange
      case 'error':
        return '#f44336' // Red
      case 'disconnected':
        return '#757575' // Gray
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return 'Connection Error'
      case 'disconnected':
        return 'Disconnected'
    }
  }

  const statusColor = getStatusColor()

  return (
    <div
      className="connection-badge"
      style={{
        backgroundColor: `${statusColor}20`,
        color: statusColor,
        borderColor: statusColor,
      }}
    >
      <div
        className={`connection-indicator ${status === 'connecting' ? 'pulse' : ''}`}
        style={{ background: statusColor }}
      />
      <span>{getStatusText()}</span>
    </div>
  )
}
