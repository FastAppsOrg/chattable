import { apiClient as api } from '@/utils/api'

export interface Agent {
  id: string
  user_id: string
  name: string
  description: string
  model: 'haiku' | 'sonnet' | 'opus'
  prompt?: string
  source_url?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface AgentCommand {
  name: string
  description: string
  prompt: string
  model: string
}

export const agentsAPI = {
  // List user's agents
  async list(): Promise<Agent[]> {
    try {
      const response = await api.get('/agents/')
      return response.json()
    } catch (error) {
      console.error('Failed to list agents:', error)
      throw error
    }
  },

  // Get a specific agent
  async get(id: string): Promise<Agent> {
    try {
      const response = await api.get(`/agents/${id}`)
      return response.json()
    } catch (error) {
      console.error('Failed to get agent:', error)
      throw error
    }
  },

  // Create a new agent
  async save(agent: Partial<Agent>): Promise<Agent> {
    try {
      const response = await api.post('/agents/', agent)
      return response.json()
    } catch (error) {
      console.error('Failed to save agent:', error)
      throw error
    }
  },

  // Update an existing agent
  async update(id: string, updates: Partial<Agent>): Promise<Agent> {
    try {
      const response = await api.put(`/agents/${id}`, updates)
      return response.json()
    } catch (error) {
      console.error('Failed to update agent:', error)
      throw error
    }
  },

  // Delete an agent
  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/agents/${id}`)
    } catch (error) {
      console.error('Failed to delete agent:', error)
      throw error
    }
  },

  // Fetch agents from GitHub
  async fetchFromGitHub(url: string): Promise<AgentCommand[]> {
    try {
      const response = await api.post('/agents/fetch-from-github', { url })
      return response.json()
    } catch (error) {
      console.error('Failed to fetch agents from GitHub:', error)
      throw error
    }
  },

  // Generate .md file content for container injection
  async generateCommandFile(agentId: string): Promise<{ content: string; filename: string }> {
    try {
      const response = await api.post(`/agents/generate-command-file/${agentId}`)
      return response.json()
    } catch (error) {
      console.error('Failed to generate command file:', error)
      throw error
    }
  },

  // Helper to generate command file content locally (for backward compatibility)
  generateCommandFileContent(agent: Agent): string {
    return `---
name: ${agent.name}
description: ${agent.description}
model: ${agent.model}
---

${agent.prompt || ''}
`
  },
}
