import { useState, useEffect, useRef, useCallback } from 'react'
import type { CreateProjectForm } from '../../types/project'
import { GreetingPanel } from '../workspace/GreetingPanel'
import { HomeChatInput } from './HomeChatInput'
import { LoginModal } from '../auth/LoginModal'
import { apiClient } from '../../utils/api'
import styles from './HomePanel.module.css'
import { useAuth } from '@/hooks/useAuth'
import { API_ENDPOINTS } from '../../constants/api'
import { generateProjectName } from '../../utils/nameGenerator'

interface HomePanelProps {
  onCreate: (form: CreateProjectForm, initialPrompt?: string) => Promise<void>
  loading: boolean
  githubUsername?: string
  onOpenSettings?: (tab?: 'claude' | 'secrets' | 'agents' | 'mcp' | 'commands') => void
  onRefreshProvider?: (callback: () => void) => void
}

export function HomePanel({
  onCreate,
  loading,
  githubUsername,
  onOpenSettings,
  onRefreshProvider,
}: HomePanelProps) {
  const { user } = useAuth()
  const [activeProvider, setActiveProvider] = useState<'claude' | 'openai' | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const isCreatingRef = useRef(false)

  const checkActiveProvider = useCallback(async () => {
    try {
      const response = await apiClient.get(`${API_ENDPOINTS.secrets}/status`)
      if (response.ok) {
        const status = await response.json()
        // Use ai_provider from backend response
        if (status.ai_provider === 'claude') {
          setActiveProvider('claude')
        } else if (status.ai_provider === 'openai') {
          setActiveProvider('openai')
        } else {
          setActiveProvider(null)
        }
      }
    } catch (error) {
      console.error('Failed to check active provider:', error)
    }
  }, [])

  // Refresh all status cards
  const refreshAllStatus = useCallback(async () => {
    await checkActiveProvider()
  }, [checkActiveProvider])

  useEffect(() => {
    // Reset creation flag when component mounts (user returns to home)
    isCreatingRef.current = false
    checkActiveProvider()

    // Register refresh callback for all status cards
    onRefreshProvider?.(refreshAllStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChatMessage = async (message: string) => {
    // Show login modal if user is not authenticated
    if (!user) {
      setShowLoginModal(true)
      return
    }

    // Always create a new quick start project with the user's message
    await handleQuickStart(message)
  }

  const handleQuickStart = async (initialMessage?: string) => {
    // Critical: Prevent double submission with ref-based guard
    if (loading || isCreatingRef.current) {
      console.warn('Project creation already in progress, ignoring duplicate call')
      return
    }

    try {
      // Set creation flag BEFORE any async operations
      isCreatingRef.current = true

      // Generate a random project name
      const randomName = generateProjectName()

      const form: CreateProjectForm = {
        name: randomName,
        git_url: '',
        git_branch: 'main',
      }

      await onCreate(form, initialMessage)
      // Don't reset form here - user is being navigated away
      // isCreatingRef will be reset when component unmounts or returns to this page
    } catch (error) {
      // Error is handled by parent component
      // Reset flag on error
      isCreatingRef.current = false
    }
  }

  return (
    <>
      <div className={styles.panel}>
        <GreetingPanel githubUsername={githubUsername} />

        {/* Chat Input Area */}
        <div className={styles.panelFooter}>
          <HomeChatInput
            onSend={handleChatMessage}
            disabled={loading}
          />
        </div>

        <div className={styles.panelContent}>
          {/* Status Cards removed - user profile now in sidebar */}
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}
