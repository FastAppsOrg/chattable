export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export const API_ENDPOINTS = {
  // Project endpoints (Provider-agnostic - Fly.io or Freestyle)
  projects: '/api/projects',
  project: (id: string) => `/api/projects/${id}`,
  projectStatus: (id: string) => `/api/projects/${id}/status`,
  projectSyncTitle: (id: string) => `/api/projects/${id}/title`,

  // Chat endpoints
  projectChat: (projectId: string) => `/api/projects/${projectId}/chat`, // HTTP streaming endpoint
  projectChatHistory: (projectId: string) => `/api/projects/${projectId}/chat/history`,
  projectChatWebSocket: (projectId: string) => `/projects/${projectId}/chat`, // WebSocket endpoint (no /api prefix)
  projectStatusWebSocket: (projectId: string) => `/projects/${projectId}/status`, // WebSocket for status updates
  projectChatAbort: (projectId: string) => `/api/projects/${projectId}/chat/abort`,
  projectFiles: (projectId: string) => `/api/projects/${projectId}/files`,
  projectCommands: (projectId: string) => `/api/projects/${projectId}/commands`,

  // Secrets endpoints
  secrets: '/api/secrets',
  secret: (id: number) => `/api/secrets/${id}`,
  secretDecrypt: (id: number) => `/api/secrets/${id}/decrypt`,
  secretsStatus: '/api/secrets/status',

  // Auth endpoints
  authExchangeToken: '/auth/exchange-token',
  authGithubToken: (userId: string) => `/auth/github-token/${userId}`,
  authCallback: '/auth/callback',

  // GitHub endpoints
  githubRepositories: '/github/repositories',
  githubOrganizations: '/github/organizations',
  githubBranches: (owner: string, repo: string) => `/github/repos/${owner}/${repo}/branches`,

  // Mastra endpoints
  mastraChat: '/api/mastra/chat',
  mastraGenerateWidget: '/api/mastra/generate-widget',
} as const
