import { useEffect, useRef, useState, useCallback } from 'react'

export interface ReconnectingWebSocketOptions {
  url: string
  protocols?: string | string[]
  reconnectInterval?: number
  maxReconnectInterval?: number
  reconnectDecay?: number
  maxReconnectAttempts?: number
  onOpen?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
  onError?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onReconnect?: (attempt: number) => void
  shouldReconnect?: () => boolean
}

export interface ReconnectingWebSocketState {
  readyState: number
  isReconnecting: boolean
  reconnectAttempts: number
  lastError: Event | null
}

export function useReconnectingWebSocket(options: ReconnectingWebSocketOptions) {
  const {
    url,
    protocols,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    reconnectDecay = 1.5,
    maxReconnectAttempts = Infinity,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    shouldReconnect = () => true,
  } = options

  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const forcedClose = useRef(false)

  const [state, setState] = useState<ReconnectingWebSocketState>({
    readyState: WebSocket.CONNECTING,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastError: null,
  })

  const calculateReconnectInterval = useCallback(() => {
    const interval = Math.min(
      reconnectInterval * Math.pow(reconnectDecay, reconnectAttempts.current),
      maxReconnectInterval
    )
    // Add jitter to prevent thundering herd
    return interval * (0.5 + Math.random() * 0.5)
  }, [reconnectInterval, reconnectDecay, maxReconnectInterval])

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (ws.current) {
      ws.current.onopen = null
      ws.current.onmessage = null
      ws.current.onerror = null
      ws.current.onclose = null
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close()
      }
      ws.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return
    }

    cleanup()

    try {
      ws.current = new WebSocket(url, protocols)

      ws.current.onopen = (event) => {
        console.log('WebSocket connected')
        reconnectAttempts.current = 0
        setState((prev) => ({
          ...prev,
          readyState: WebSocket.OPEN,
          isReconnecting: false,
          reconnectAttempts: 0,
        }))
        onOpen?.(event)
      }

      ws.current.onmessage = (event) => {
        onMessage?.(event)
      }

      ws.current.onerror = (event) => {
        console.error('WebSocket error:', event)
        setState((prev) => ({
          ...prev,
          lastError: event,
        }))
        onError?.(event)
      }

      ws.current.onclose = (event) => {
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`)

        setState((prev) => ({
          ...prev,
          readyState: WebSocket.CLOSED,
        }))

        onClose?.(event)

        // Attempt reconnection if not forced close
        if (!forcedClose.current && shouldReconnect() && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = calculateReconnectInterval()

          setState((prev) => ({
            ...prev,
            isReconnecting: true,
            reconnectAttempts: reconnectAttempts.current + 1,
          }))

          console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current + 1})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            onReconnect?.(reconnectAttempts.current)
            connect()
          }, delay)
        }
      }

      setState((prev) => ({
        ...prev,
        readyState: WebSocket.CONNECTING,
      }))
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setState((prev) => ({
        ...prev,
        lastError: error as Event,
        readyState: WebSocket.CLOSED,
      }))

      // Schedule reconnection on connection failure
      if (shouldReconnect() && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = calculateReconnectInterval()
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++
          connect()
        }, delay)
      }
    }
  }, [
    url,
    protocols,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    shouldReconnect,
    maxReconnectAttempts,
    calculateReconnectInterval,
    cleanup,
  ])

  const disconnect = useCallback(() => {
    forcedClose.current = true
    cleanup()
    setState((prev) => ({
      ...prev,
      readyState: WebSocket.CLOSED,
      isReconnecting: false,
    }))
  }, [cleanup])

  const send = useCallback((data: string | ArrayBuffer | Blob) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(data)
      return true
    }
    console.warn('WebSocket not connected, cannot send message')
    return false
  }, [])

  const reconnect = useCallback(() => {
    forcedClose.current = false
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    // Don't connect if URL is empty
    if (!url) {
      return
    }

    forcedClose.current = false
    connect()

    return () => {
      forcedClose.current = true
      cleanup()
    }
     
  }, [url]) // Only reconnect on URL change

  return {
    send,
    disconnect,
    reconnect,
    state,
    ws: ws.current,
  }
}