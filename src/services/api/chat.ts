import type { ChatMessage, FileItem, CommandItem } from '../../types/chat'
import { API_ENDPOINTS } from '../../constants/api'
import { apiClient } from '../../utils/api'

export class ChatService {
  static async fetchChatHistory(workspaceId: string): Promise<ChatMessage[]> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.projectChatHistory(workspaceId))
      if (!response.ok) {
        if (response.status === 404) {
          return [] // Return empty array if no history exists
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to load chat history: ${response.status}`)
      }

      const data = await response.json()
      return data.messages
        ? data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            messageType: msg.messageType || 'chat',
            toolInfo: msg.toolInfo,
            metadata: msg.metadata || {},
          }))
        : []
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to load chat history')
    }
  }

  static async sendMessage(workspaceId: string, message: string): Promise<void> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.projectChatWebSocket(workspaceId), {
        message,
        workspaceId,
        stream: true,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please wait a moment before sending another message.',
          )
        }
        throw new Error(errorData.detail || `Failed to send message: ${response.status}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to send message')
    }
  }

  static async fetchFiles(
    workspaceId: string,
    path?: string,
  ): Promise<{ files: FileItem[]; error: string }> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.projectFiles(workspaceId))
      if (!response.ok) {
        if (response.status === 404) {
          return { files: [], error: 'Path not found' } // Return empty array if path doesn't exist
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch files: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch files')
    }
  }

  static async fetchCommands(workspaceId: string): Promise<CommandItem[]> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.projectCommands(workspaceId))
      if (!response.ok) {
        throw new Error('Failed to fetch commands')
      }
      return response.json()
    } catch (error) {
      // Return default commands if API fails
      return [
        { name: 'help', description: 'Show available commands' },
        { name: 'clear', description: 'Clear the terminal' },
        { name: 'ls', description: 'List files in directory' },
        { name: 'cd', description: 'Change directory' },
        { name: 'git', description: 'Git commands' },
        { name: 'npm', description: 'NPM commands' },
      ]
    }
  }

  static async abortRequest(workspaceId: string): Promise<void> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.projectChatAbort(workspaceId))
      if (!response.ok && response.status !== 404) {
        console.error('Failed to abort request: Status', response.status)
      }
    } catch (error) {
      console.error('Failed to abort request:', error)
      // Don't throw - aborting is best-effort
    }
  }
}
