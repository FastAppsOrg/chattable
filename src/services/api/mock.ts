/**
 * Mock API Service
 *
 * This service provides mock implementations for all API calls
 * to allow the app to run without a backend server.
 */

// Mock data
const MOCK_CHAT_HISTORY = []
const MOCK_PROJECTS = []
const MOCK_SECRETS_STATUS = {
  claude_api_key: false,
  github_token: false,
  linear_api_key: false,
  ai_provider: null
}

export class MockAPI {
  static async delay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async mockResponse<T>(data: T, delay: number = 300): Promise<Response> {
    await this.delay(delay)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  static async mockError(status: number, message: string): Promise<Response> {
    await this.delay(300)
    return new Response(JSON.stringify({ detail: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Chat API mocks
  static async fetchChatHistory(workspaceId: string) {
    console.log('[MOCK] Fetching chat history for:', workspaceId)
    return this.mockResponse({ messages: MOCK_CHAT_HISTORY })
  }

  static async sendChatMessage(workspaceId: string, message: any) {
    console.log('[MOCK] Sending chat message:', message)
    return this.mockResponse({ success: true })
  }

  // Project API mocks
  static async fetchProjects() {
    console.log('[MOCK] Fetching projects')
    return this.mockResponse(MOCK_PROJECTS)
  }

  static async createProject(data: any) {
    console.log('[MOCK] Creating project:', data)
    const newProject = {
      id: `project-${Date.now()}`,
      ...data,
      created_at: new Date().toISOString()
    }
    MOCK_PROJECTS.push(newProject)
    return this.mockResponse(newProject)
  }

  // Secrets API mocks
  static async getSecretsStatus() {
    console.log('[MOCK] Getting secrets status')
    return this.mockResponse(MOCK_SECRETS_STATUS)
  }

  static async setSecret(key: string, value: string) {
    console.log('[MOCK] Setting secret:', key)
    MOCK_SECRETS_STATUS[key as keyof typeof MOCK_SECRETS_STATUS] = true
    return this.mockResponse({ success: true })
  }

  // GitHub API mocks
  static async getGitHubUser() {
    console.log('[MOCK] Getting GitHub user')
    return this.mockResponse({
      login: 'mock-user',
      avatar_url: 'https://github.com/github.png'
    })
  }

  // Linear API mocks
  static async getLinearIssues() {
    console.log('[MOCK] Getting Linear issues')
    return this.mockResponse([])
  }

  // MCP API mocks
  static async getMCPServers() {
    console.log('[MOCK] Getting MCP servers')
    return this.mockResponse([])
  }

  // Agents API mocks
  static async getAgents() {
    console.log('[MOCK] Getting agents')
    return this.mockResponse([])
  }
}

// Enable/disable mock mode
export const MOCK_MODE = true

export default MockAPI
