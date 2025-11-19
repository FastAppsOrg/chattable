import { API_ENDPOINTS } from '../../constants/api'
import { apiClient } from '../../utils/api'

export interface GitHubOrganization {
  login: string
  id: number
  avatar_url: string
  description: string
}

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  name: string
  email?: string
}

export class GitHubService {
  /**
   * Get user's GitHub organizations
   */
  static async fetchOrganizations(): Promise<GitHubOrganization[]> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.githubOrganizations)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch organizations: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch organizations')
    }
  }

  /**
   * Get authenticated user info (for personal account option)
   */
  static async fetchCurrentUser(): Promise<GitHubUser> {
    try {
      // Use GitHub API directly
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch user')
    }
  }
}
