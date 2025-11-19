import { apiClient } from '../utils/api'
import { API_ENDPOINTS } from '../constants/api'

export class AuthService {
  static async exchangeToken(supabaseToken: string): Promise<{ access_token: string }> {
    const response = await apiClient.post(
      API_ENDPOINTS.authExchangeToken,
      {},
      {
        headers: {
          Authorization: `Bearer ${supabaseToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error('Failed to exchange token')
    }

    return response.json()
  }

  static async getGitHubToken(userId: string): Promise<{ provider_token: string | null }> {
    const response = await apiClient.get(API_ENDPOINTS.authGithubToken(userId))

    if (!response.ok) {
      throw new Error('Failed to fetch GitHub token')
    }

    return response.json()
  }

  static async saveCallback(userId: string, code: string, state: string): Promise<void> {
    const response = await apiClient.post(API_ENDPOINTS.authCallback, { user_id: userId, code, state })

    if (!response.ok) {
      throw new Error('Failed to save callback')
    }
  }
}
