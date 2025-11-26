export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const API_ENDPOINTS = {
  // Project endpoints
  projects: '/api/projects',
  project: (id: string) => `/api/projects/${id}`,
  projectStatus: (id: string) => `/api/projects/${id}/status`,
  projectSyncTitle: (id: string) => `/api/projects/${id}/title`,
  projectRestart: (id: string) => `/api/projects/${id}/restart`,

  // Chat endpoints (HTTP streaming via AI SDK)
  projectChat: (projectId: string) => `/api/projects/${projectId}/chat`,
  projectChatHistory: (projectId: string) => `/api/projects/${projectId}/chat/history`,

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
} as const
