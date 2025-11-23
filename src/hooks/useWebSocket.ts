import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage } from '../types/chat'
import { ChatWebSocketService, type ChatWebSocketEvents } from '../services/websocket/chat'
import type { CompressedImage } from '../utils/imageCompression'

export function useWebSocket(
  workspaceId: string,
  onMessage: (message: ChatMessage) => void,
  onStreamingUpdate?: (content: string) => void,
  onProcessingUpdate?: (isProcessing: boolean, activeToolIds: Set<string>) => void,
  onFileResults?: (files: any[], query: string) => void,
  onCommandResults?: (commands: any[], query: string) => void,
  onSandboxNotReady?: () => void,
  onComplete?: () => void,
) {
  const [connected, setConnected] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolIds, setActiveToolIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const wsService = useRef<ChatWebSocketService | null>(null)

  // Use refs to store the latest callbacks
  const onFileResultsRef = useRef(onFileResults)
  const onCommandResultsRef = useRef(onCommandResults)

  // Update refs when callbacks change
  useEffect(() => {
    onFileResultsRef.current = onFileResults
  }, [onFileResults])

  useEffect(() => {
    onCommandResultsRef.current = onCommandResults
  }, [onCommandResults])

  useEffect(() => {
    // Don't connect if no workspaceId
    if (!workspaceId) {
      console.log('[useWebSocket] No workspaceId provided, skipping connection')
      return
    }

    console.log('[useWebSocket] Initializing WebSocket for workspace:', workspaceId)

    // Clean up any existing connection first
    if (wsService.current) {
      wsService.current.disconnect()
      wsService.current = null
    }

    const events: ChatWebSocketEvents = {
      onConnect: () => {
        console.log('Chat WebSocket connected')
        setConnected(true)
      },
      onDisconnect: () => {
        console.log('Chat WebSocket disconnected')
        setConnected(false)
      },
      onMessage: (message: ChatMessage) => {
        onMessage(message)
      },
      onStream: (message: ChatMessage) => {
        console.log('[useWebSocket] Stream message:', message)
        onMessage(message)
        setStreamingContent('')
        onStreamingUpdate?.('')
      },
      onToolUse: (message: ChatMessage) => {
        onMessage(message)
        // Track active tool for spinner
        setActiveToolIds((prev) => new Set(prev).add(message.id))
        setIsProcessing(true)
        onProcessingUpdate?.(true, new Set([...activeToolIds, message.id]))
      },
      onComplete: () => {
        // Clear all state
        setStreamingContent('')
        setActiveToolIds(new Set())
        setIsProcessing(false)
        onStreamingUpdate?.('')
        onProcessingUpdate?.(false, new Set())
        // Notify parent component
        onComplete?.()
      },
      onError: (error: string) => {
        console.error('Chat WebSocket error:', error)
        setStreamingContent('')
        setActiveToolIds(new Set())
        setIsProcessing(false)
        onStreamingUpdate?.('')
        onProcessingUpdate?.(false, new Set())

        // Show error as system message
        const errorMessage: ChatMessage = {
          id: Date.now().toString() + '-error',
          role: 'system',
          content: `⚠️ ${error}`,
          timestamp: new Date().toISOString(),
          messageType: 'system',
        }
        onMessage(errorMessage)
      },
      onAborted: (message: string) => {
        console.log('Request aborted:', message)
        setStreamingContent('')
        setActiveToolIds(new Set())
        setIsProcessing(false)
        onStreamingUpdate?.('')
        onProcessingUpdate?.(false, new Set())
      },
      onProcessingState: (processing: boolean, message?: string) => {
        // Multi-tab sync: update processing state from broadcast
        console.log('Processing state broadcast received:', processing, message)
        setIsProcessing(processing)
        onProcessingUpdate?.(processing, activeToolIds)
      },
      onFileResults: (files, query) => {
        onFileResultsRef.current?.(files, query)
      },
      onCommandResults: (commands, query) => {
        onCommandResultsRef.current?.(commands, query)
      },
      onReconnected: () => {
        console.log('Successfully reconnected to chat session')
        // Don't show notification message to user
      },
      onStreamingActive: () => {
        console.log('Resuming active stream')
        setIsProcessing(true)
        onProcessingUpdate?.(true, activeToolIds)
        // Don't show resuming message to user
      },
      onSandboxNotReady: () => {
        console.log('Sandbox not ready, notifying parent component')
        onSandboxNotReady?.()
      },
    }

    wsService.current = new ChatWebSocketService(workspaceId, events)
    wsService.current.connect()

    return () => {
      if (wsService.current) {
        wsService.current.disconnect()
        wsService.current = null
      }
    }
  }, [workspaceId]) // Only depend on workspaceId to prevent infinite reconnections

  const sendMessage = useCallback((message: string, options?: {
    cto_mode?: boolean;
    agent_type?: string;
    images?: CompressedImage[];
    permission_mode?: string;
    thinking_mode?: string;
  }) => {
    wsService.current?.sendMessage(message, options)
  }, [])

  const sendAbort = useCallback(() => {
    wsService.current?.sendAbort()
  }, [])

  const disconnect = useCallback(() => {
    wsService.current?.disconnect()
  }, [])

  return {
    connected,
    streamingContent,
    activeToolIds,
    isProcessing,
    sendMessage,
    sendAbort,
    disconnect,
    wsService: wsService.current,
  }
}
