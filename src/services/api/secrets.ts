import { apiClient } from '../../utils/api'
import { API_ENDPOINTS } from '../../constants/api'

export interface Secret {
  id: number
  name: string
  type: 'github' | 'api_key' | 'env_var' | 'ssh_key' | 'other'
  created_at: string
  updated_at: string
}

export interface SecretCreate {
  name: string
  value: string
  type: 'github' | 'api_key' | 'env_var' | 'ssh_key' | 'other'
}

export interface SecretUpdate {
  value: string
}

class SecretsAPI {
  async list(): Promise<Secret[]> {
    const response = await apiClient.get(API_ENDPOINTS.secrets)

    if (!response.ok) {
      throw new Error('Failed to fetch secrets')
    }

    return response.json()
  }

  async create(secret: SecretCreate): Promise<Secret> {
    const response = await apiClient.post(API_ENDPOINTS.secrets, secret)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to create secret')
    }

    return response.json()
  }

  async update(id: number, update: SecretUpdate): Promise<Secret> {
    const response = await apiClient.put(API_ENDPOINTS.secret(id), update)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to update secret')
    }

    return response.json()
  }

  async delete(id: number): Promise<void> {
    const response = await apiClient.delete(API_ENDPOINTS.secret(id))

    if (!response.ok) {
      throw new Error('Failed to delete secret')
    }
  }

  async getDecrypted(id: number): Promise<{ value: string }> {
    const response = await apiClient.get(API_ENDPOINTS.secretDecrypt(id))

    if (!response.ok) {
      throw new Error('Failed to decrypt secret')
    }

    return response.json()
  }
}

export const secretsAPI = new SecretsAPI()
