export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  WS_BASE_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000',
  PREVIEW_CHECK_INTERVAL: 5000,
  PREVIEW_ERROR_BACKOFF_BASE: 5000,
  PREVIEW_ERROR_BACKOFF_MAX: 30000,
} as const

export const getApiUrl = (path: string): string => {
  return `${API_CONFIG.BASE_URL}${path}`
}

export const getWsUrl = (path: string): string => {
  return `${API_CONFIG.WS_BASE_URL}${path}`
}
