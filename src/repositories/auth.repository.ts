import { AuthService } from '../services/auth.service'

export interface IAuthRepository {
  exchangeToken(supabaseToken: string): Promise<{ access_token: string }>
  getGitHubToken(userId: string): Promise<{ provider_token: string | null }>
  saveCallback(userId: string, code: string, state: string): Promise<void>
}

export class AuthRepository implements IAuthRepository {
  async exchangeToken(supabaseToken: string): Promise<{ access_token: string }> {
    return AuthService.exchangeToken(supabaseToken)
  }

  async getGitHubToken(userId: string): Promise<{ provider_token: string | null }> {
    return AuthService.getGitHubToken(userId)
  }

  async saveCallback(userId: string, code: string, state: string): Promise<void> {
    return AuthService.saveCallback(userId, code, state)
  }
}

// Singleton instance
export const authRepository = new AuthRepository()
