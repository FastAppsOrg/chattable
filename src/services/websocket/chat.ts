import type { ChatMessage } from '../../types/chat'
import { API_ENDPOINTS, WS_BASE_URL } from '../../constants/api'
import { apiClient } from '../../utils/api'
import type { CompressedImage } from '../../utils/imageCompression'

export interface ChatWebSocketEvents {
  onConnect: () => void
  onDisconnect: () => void
  onMessage: (message: ChatMessage) => void
  onStream: (message: ChatMessage) => void
  onToolUse: (message: ChatMessage) => void
  onComplete: () => void
  onError: (error: string) => void
  onAborted: (message: string) => void
  onFileResults?: (files: any[], query: string) => void
  onCommandResults?: (commands: any[], query: string) => void
  onReconnected?: () => void
  onStreamingActive?: () => void
  onSandboxNotReady?: () => void // Triggered when WebSocket closes with code 4004
  onProcessingState?: (processing: boolean, message?: string) => void // For multi-tab sync
}

export class ChatWebSocketService {
  private ws: WebSocket | null = null
  private workspaceId: string
  private events: ChatWebSocketEvents
  private isConnecting: boolean = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 100 // TODO : remove this. will wait until backend is ready to reconnect. 
  private reconnectDelay: number = 1000
  private lastMessageId: string | null = null
  private isReconnection: boolean = false
  private bufferIndex: number = 0

  constructor(workspaceId: string, events: ChatWebSocketEvents) {
    this.workspaceId = workspaceId
    this.events = events
  }

  async connect(): Promise<void> {
    // Prevent duplicate connections
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING ||
      this.isConnecting
    ) {
      return
    }

    this.isConnecting = true

    try {
      // Use project endpoint if specified, otherwise use workspace endpoint (for backward compatibility)
      const endpoint = API_ENDPOINTS.projectChatWebSocket(this.workspaceId)
      const wsUrl = `${WS_BASE_URL}${endpoint}`
      console.log('[ChatWebSocket] Connecting to:', wsUrl)
      console.log('[ChatWebSocket] WS_BASE_URL:', WS_BASE_URL)
      console.log('[ChatWebSocket] endpoint:', endpoint)
      this.ws = await apiClient.createWebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('Chat WebSocket connected')
        this.isConnecting = false
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000

        // If this is a reconnection, send reconnect message with last message ID and buffer index
        if (this.isReconnection) {
          console.log('Sending reconnection request with buffer index:', this.bufferIndex)
          this.ws?.send(
            JSON.stringify({
              type: 'reconnect',
              last_message_id: this.lastMessageId,
              last_buffer_index: this.bufferIndex,
            }),
          )
        }

        this.events.onConnect()
        this.isReconnection = false
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'reconnected') {
            console.log('Reconnection successful, buffered messages:', data.buffered_count)
            // Update buffer index for next reconnection
            this.bufferIndex += data.buffered_count || 0
            if (this.events.onReconnected) {
              this.events.onReconnected()
            }
          } else if (data.type === 'streaming_active') {
            console.log('Active stream detected')
            if (this.events.onStreamingActive) {
              this.events.onStreamingActive()
            }
          } else if (data.type === 'processing_state') {
            // Multi-tab sync: broadcast processing state to all tabs
            console.log('Processing state update:', data.processing, data.message)
            if (this.events.onProcessingState) {
              this.events.onProcessingState(data.processing, data.message)
            }
          } else if (data.type === 'message') {
            // Multi-tab sync: user message broadcast
            const msg = data.message
            const chatMessage: ChatMessage = {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              messageType: msg.message_type || 'chat',
              metadata: msg.metadata, // Include metadata with agent info
            }
            this.events.onMessage(chatMessage)
          } else if (data.type === 'stream') {
            const streamMessage: ChatMessage = {
              id: data.id || Date.now().toString() + '-stream-' + Math.random(), // Use server-provided ID
              role: 'assistant',
              content: data.content,
              timestamp: new Date().toISOString(),
              messageType: 'chat',
              metadata: data.metadata, // Include metadata with agent info
              isReplay: data.is_replay,
            }
            // Track the last message ID and buffer index if not a replay
            if (!data.is_replay) {
              this.lastMessageId = streamMessage.id
              this.bufferIndex++
            }
            this.events.onStream(streamMessage)
          } else if (data.type === 'tool_use') {
            const toolId = data.tool_id || Date.now().toString() + '-tool'
            const toolMessage: ChatMessage = {
              id: toolId,
              role: 'tool',
              content: data.summary || `Using ${data.tool_name}`,
              timestamp: new Date().toISOString(),
              messageType: 'tool_use',
              toolInfo: {
                name: data.tool_name,
                summary: data.summary,
                input: data.tool_input,
              },
              isReplay: data.is_replay,
            }
            // Update buffer index if not a replay
            if (!data.is_replay) {
              this.bufferIndex++
            }
            this.events.onToolUse(toolMessage)
          } else if (data.type === 'complete') {
            // Update buffer index if not a replay
            if (!data.is_replay) {
              this.bufferIndex++
            }
            this.events.onComplete()
          } else if (data.type === 'error') {
            console.error('Chat error:', data.error)
            this.events.onError(data.error)
          } else if (data.type === 'aborted') {
            console.log('Request aborted:', data.message)
            const abortMessage: ChatMessage = {
              id: Date.now().toString() + '-abort',
              role: 'system',
              content: '⚠️ Request aborted by user',
              timestamp: new Date().toISOString(),
              messageType: 'system',
            }
            this.events.onMessage(abortMessage)
            this.events.onAborted(data.message)
          } else if (data.type === 'meta_agent') {
            const metaMessage: ChatMessage = {
              id: Date.now().toString() + '-meta-' + Math.random(),
              role: 'meta_agent',
              content: data.content,
              timestamp: new Date().toISOString(),
              messageType: 'chat',
              isReplay: data.is_replay,
            }
            // Track the last message ID if not a replay
            if (!data.is_replay) {
              this.lastMessageId = metaMessage.id
              this.bufferIndex++
            }
            this.events.onMessage(metaMessage)
          } else if (data.type === 'file_results') {
            if (this.events.onFileResults) {
              this.events.onFileResults(data.files || [], data.query || '')
            }
          } else if (data.type === 'command_results') {
            if (this.events.onCommandResults) {
              this.events.onCommandResults(data.commands || [], data.query || '')
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      this.ws.onclose = (event) => {
        console.log(`Chat WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`)
        this.isConnecting = false
        this.events.onDisconnect()

        // Code 4004: Sandbox not ready - trigger /status polling
        if (event.code === 4004) {
          console.log('Sandbox not ready, triggering status check...')
          if (this.events.onSandboxNotReady) {
            this.events.onSandboxNotReady()
          }
          // Don't auto-reconnect, let /status polling handle recreation
          return
        }

        // Only attempt reconnect if not a normal closure
        if (event.code !== 1000) {
          this.attemptReconnect()
        }
      }

      this.ws.onerror = (error) => {
        console.error('Chat WebSocket error:', error)
        this.isConnecting = false
        // Only show error if we haven't started reconnection attempts yet
        if (this.reconnectAttempts === 0) {
          this.events.onError('WebSocket connection error')
        }
      }
    } catch (error) {
      console.error('Failed to connect chat WebSocket:', error)
      this.isConnecting = false
      this.events.onError('Failed to establish WebSocket connection')
    }
  }

  private attemptReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    // Check if we should attempt reconnection
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      this.events.onError('Chat connection failed after 5 attempts. Please refresh the page.')
      return
    }

    this.reconnectAttempts++
    console.log(
      `Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`,
    )

    // Mark as reconnection
    this.isReconnection = true

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, this.reconnectDelay)

    // Exponential backoff with max delay of 30 seconds
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
  }

  disconnect(): void {
    // Clear reconnect timer to prevent auto-reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Reset reconnection state
    this.reconnectAttempts = 0
    this.reconnectDelay = 1000
    this.isConnecting = false

    if (this.ws) {
      // Use code 1000 for normal closure to prevent reconnection
      this.ws.close(1000, 'User disconnect')
      this.ws = null
    }
  }

  sendMessage(message: string, options?: {
    cto_mode?: boolean;
    agent_type?: string;
    images?: CompressedImage[];
    permission_mode?: string;
    thinking_mode?: string;
  }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'message',
          content: message,
          stream: true,
          cto_mode: options?.cto_mode || false,
          agent_type: options?.agent_type || 'claude',
          images: options?.images || [],
          permission_mode: options?.permission_mode,
          thinking_mode: options?.thinking_mode,
        }),
      )
    }
  }

  sendAbort(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send special abort message that backend expects
      this.ws.send(
        JSON.stringify({
          type: 'message',
          content: '__ABORT__',
          stream: false,
        }),
      )
    }
  }

  searchFiles(query: string, path: string = ''): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'file_search',
          query,
          path,
        }),
      )
    }
  }

  searchCommands(query: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'command_search',
          query,
        }),
      )
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
