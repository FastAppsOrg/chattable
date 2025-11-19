import { GitHubService, type Repository } from '../services/github.service'

export interface IGitHubRepository {
  getRepositories(token: string): Promise<Repository[]>
  getBranches(token: string, owner: string, repo: string): Promise<Array<{ name: string }>>
}

export class GitHubRepository implements IGitHubRepository {
  async getRepositories(token: string): Promise<Repository[]> {
    return GitHubService.fetchRepositories(token)
  }

  async getBranches(token: string, owner: string, repo: string): Promise<Array<{ name: string }>> {
    return GitHubService.fetchBranches(token, owner, repo)
  }
}

// Singleton instance
export const gitHubRepository = new GitHubRepository()
