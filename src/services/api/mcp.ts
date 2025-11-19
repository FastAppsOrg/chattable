import { apiClient as api } from '@/utils/api'

export interface MCPConfig {
  mcpServers: Record<
    string,
    {
      command?: string
      args?: string[]
      apiKey?: string
      transport?: {
        type: string
        url?: string
      }
    }
  >
}

export const mcpAPI = {
  async getConfig(): Promise<MCPConfig | null> {
    try {
      const response = await api.get('/mcp/config')
      return response.json()
    } catch (error) {
      console.error('Failed to get MCP config:', error)
      return null
    }
  },

  async updateConfig(config: MCPConfig): Promise<void> {
    await api.post('/mcp/config', config)
  },

  async updateClaudeJson(config: MCPConfig): Promise<void> {
    await api.post('/mcp/update-claude-json', config)
  },
}
