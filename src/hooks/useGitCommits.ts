import { useState, useEffect } from 'react'
import { apiClient } from '../utils/api'
import { API_ENDPOINTS } from '../constants/api'

interface GitCommit {
  sha: string
  message: string
  author: string
  timestamp: string
}

export function useGitCommits(projectId: string | undefined, enabled = true) {
  const [hasCommits, setHasCommits] = useState(false)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchCommits = async () => {
      try {
        setLoading(true)
        setError(null)

        // const response = await apiClient.get(API_ENDPOINTS.projectGitCommits(projectId))
        // const response = { data: [] } // Mock empty response

        if (cancelled) return

        // if (!response.ok) {
        //   throw new Error(`Failed to fetch commits: ${response.status}`)
        // }

        // const data = await response.json()
        const commitList = [] as any[]
        setCommits(commitList)
        setHasCommits(false)
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching git commits:', err)
          setError(err instanceof Error ? err.message : 'Unknown error')
          setHasCommits(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCommits()

    // Poll every 10 seconds to detect new commits
    const interval = setInterval(fetchCommits, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [projectId, enabled])

  return {
    hasCommits,
    commits,
    loading,
    error,
  }
}
