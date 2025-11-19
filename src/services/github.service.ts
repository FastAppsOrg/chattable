import { apiClient } from '../utils/api'
import { API_ENDPOINTS } from '../constants/api'

export interface Repository {
  id: number
  name: string
  full_name: string
  private: boolean
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  html_url: string
  clone_url: string
  ssh_url: string
  default_branch: string
  updated_at: string
  pushed_at: string
  stargazers_count: number
  language: string | null
}

export class GitHubService {
  static async fetchRepositories(token: string): Promise<Repository[]> {
    const response = await apiClient.get(`${API_ENDPOINTS.githubRepositories}?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000, // 15 seconds timeout for GitHub API
    })

    if (!response.ok) {
      if (response.status === 404) {
        // No GitHub token stored yet
        return []
      }
      throw new Error('Failed to fetch repositories')
    }

    return response.json()
  }

  static async fetchBranches(
    token: string,
    owner: string,
    repo: string,
  ): Promise<Array<{ name: string }>> {
    const response = await apiClient.get(API_ENDPOINTS.githubBranches(owner, repo), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch branches')
    }

    return response.json()
  }
}
