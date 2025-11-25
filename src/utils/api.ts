import { API_CONFIG } from '../config/api.config'

class ApiClient {
  private static instance: ApiClient

  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    // Use local-token for local-first mode
    return {
      Authorization: `Bearer local-token`,
      'Content-Type': 'application/json',
    }
  }

  async fetch(
    url: string,
    options: RequestInit & { timeout?: number } = {},
  ): Promise<Response> {
    // Extract timeout option (default 30000ms for better UX with slow operations)
    const { timeout = 30000, ...fetchOptions } = options

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Get auth headers
      const authHeaders = await this.getAuthHeaders()

      // Merge headers
      const headers = {
        ...authHeaders,
        ...fetchOptions.headers,
      }

      // Make the request with abort signal
      const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      })

      // Clear timeout on success
      clearTimeout(timeoutId)

      return response
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout. Please retry.')
        timeoutError.name = 'TimeoutError'
        throw timeoutError
      }

      throw error
    }
  }

  async get(url: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'GET',
    })
  }

  async post(
    url: string,
    body?: any,
    options?: RequestInit & { timeout?: number },
  ): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put(
    url: string,
    body?: any,
    options?: RequestInit & { timeout?: number },
  ): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async patch(
    url: string,
    body?: any,
    options?: RequestInit & { timeout?: number },
  ): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete(url: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'DELETE',
    })
  }

  // WebSocket connection with auth token
  async createWebSocket(url: string): Promise<WebSocket> {
    // Convert http to ws protocol
    const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://')

    // Add token as query parameter for WebSocket
    const separator = wsUrl.includes('?') ? '&' : '?'
    const authenticatedUrl = `${wsUrl}${separator}token=${encodeURIComponent('local-token')}`

    return new WebSocket(authenticatedUrl)
  }
}

export const apiClient = ApiClient.getInstance()

// Export auth token getter for AI SDK transport
export function getAuthToken(): string {
  return 'local-token'
}
