import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChatMessage } from '../types/chat'
import { ChatService } from '../services/api/chat'
import { API_ENDPOINTS } from '../constants/api'
import { apiClient } from '../utils/api'

interface UseChatOptions {
  /** Project ID for project-based chat */
  projectId?: string
}

/**
 * Chat hook that supports project-based chat
 */
export function useChat(options: UseChatOptions | string) {
  // Support both old (string) and new (object) API
  const { projectId } = typeof options === 'string'
    ? { projectId: options }
    : options

  const entityId = projectId
  const useProjectEndpoint = !!projectId

  if (!entityId) {
    throw new Error('useChat requires either projectId')
  }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageIdsRef = useRef<Set<string>>(new Set())
  const lastMessageRef = useRef<{ content: string; timestamp: number }>({
    content: '',
    timestamp: 0,
  })

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load chat history
  useEffect(() => {
    let cancelled = false

    const loadHistory = async () => {
      try {
        const endpoint = API_ENDPOINTS.projectChatHistory(entityId!)

        const response = await apiClient.get(endpoint)

        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) {
              setMessages([])
              setHistoryLoaded(true)
            }
            return
          }
          throw new Error(`Failed to load chat history: ${response.status}`)
        }

        const data = await response.json()

        if (cancelled) return // Don't update state if component unmounted

        // ascending timestamp order
        const historyMessages = (
          data.messages
          ? data.messages.map((msg: any) => ({
              id: msg.message_id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              messageType: msg.message_type || 'chat',
              toolInfo: msg.tool_info,
              metadata: msg.metadata || {},
            }))
          : []
        ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        // Preserve cached messages in the order of ascending timestamp (for StrictMode compatibility)
        setMessages((prev) => {
          const cachedMessages = prev.filter((msg) => msg.id.startsWith('cached-'))
          return [...historyMessages, ...cachedMessages]
        })
        setHistoryLoaded(true)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load chat history:', err)
          setError('Failed to load chat history')
          setHistoryLoaded(true)
        }
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [entityId, useProjectEndpoint])

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const addMessage = useCallback((message: ChatMessage) => {
    console.log('[useChat] addMessage called with:', { id: message.id, role: message.role, contentLength: message.content?.length })

    setMessages((prev) => {
      // Check if this message ID already exists (for streaming updates)
      const existingMessageIndex = prev.findIndex(m => m.id === message.id)
      console.log('[useChat] Existing message check:', { messageId: message.id, existingIndex: existingMessageIndex, totalMessages: prev.length })

      if (existingMessageIndex !== -1) {
        // Update existing message (for streaming)
        console.log('[useChat] Updating existing message at index', existingMessageIndex)
        const updated = [...prev]
        updated[existingMessageIndex] = message
        return updated
      }

      // Additional deduplication for same content within 100ms (for StrictMode)
      const now = Date.now()
      if (
        message.content === lastMessageRef.current.content &&
        now - lastMessageRef.current.timestamp < 100
      ) {
        console.log('[useChat] Duplicate content within 100ms, skipping')
        return prev
      }

      // Track this message
      console.log('[useChat] Adding new message:', message.id)
      messageIdsRef.current.add(message.id)
      lastMessageRef.current = { content: message.content, timestamp: now }

      // Original logic for adding new message
      // Optimization: If new message is newer than last message, just append
      if (prev.length === 0) {
        return [message]
      }

      const lastMessage = prev[prev.length - 1]
      const newTimestamp = new Date(message.timestamp).getTime()
      const lastTimestamp = new Date(lastMessage.timestamp).getTime()

      // Most common case: new message is newer, just append
      if (newTimestamp >= lastTimestamp) {
        return [...prev, message]
      }

      // Rare case: need to insert in order (e.g., cached messages, out-of-order delivery)
      // Binary search for insertion point
      let left = 0
      let right = prev.length
      while (left < right) {
        const mid = Math.floor((left + right) / 2)
        const midTimestamp = new Date(prev[mid].timestamp).getTime()
        if (midTimestamp < newTimestamp) {
          left = mid + 1
        } else {
          right = mid
        }
      }

      // Insert at the found position
      const newMessages = [...prev]
      newMessages.splice(left, 0, message)
      return newMessages
    })
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: Date.now().toString() + '-user',
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        messageType: 'chat',
      }

      setMessages((prev) => [...prev, userMessage])
      setLoading(true)
      setError(null)

      // Note: Actual sending happens via WebSocket, not here
      // This is just for UI state management
    },
    [],
  )

  const abortRequest = useCallback(async () => {
    try {
      if (useProjectEndpoint) {
        // Project-based abort - would need to be added to API_ENDPOINTS
        const endpoint = `/projects/${entityId}/chat/history/abort`
        const response = await apiClient.post(endpoint)
        if (!response.ok && response.status !== 404) {
          console.error('Failed to abort request: Status', response.status)
        }
      } else {
        await ChatService.abortRequest(entityId!)
      }
    } catch (err) {
      console.error('Failed to abort request:', err)
    }
  }, [entityId, useProjectEndpoint])

  const clearMessages = useCallback(() => {
    setMessages([])
    messageIdsRef.current.clear()
    lastMessageRef.current = { content: '', timestamp: 0 }
  }, [])

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    messageIdsRef.current.delete(messageId)
  }, [])

  return {
    messages,
    loading,
    error,
    historyLoaded,
    messagesEndRef,
    addMessage,
    sendMessage,
    abortRequest,
    clearMessages,
    removeMessage,
    setLoading,
    setError,
  }
}
