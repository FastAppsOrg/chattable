import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../utils/api'
import { API_ENDPOINTS } from '../constants/api'
import { useAuth } from './useAuth'

interface SecretsStatus {
  has_anthropic_api_key: boolean
  has_github_token: boolean
  configured_secrets: number
}

export function useSecretsStatus() {
  const { user } = useAuth()
  const [status, setStatus] = useState<SecretsStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    if (!user) {
      setStatus(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.get(API_ENDPOINTS.secretsStatus)

      if (!response.ok) {
        throw new Error('Failed to fetch secrets status')
      }

      const data = await response.json()
      setStatus(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check secrets status'
      setError(errorMessage)
      console.error('Failed to check secrets status:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [user])

  // Check status when user changes
  useEffect(() => {
    if (user) {
      checkStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const hasGitHubToken = status?.has_github_token ?? false
  const hasAnthropicKey = status?.has_anthropic_api_key ?? false

  return {
    status,
    hasGitHubToken,
    hasAnthropicKey,
    loading,
    error,
    refetch: checkStatus,
  }
}
