import { useState } from 'react'
import { X, Check, AlertCircle, Link, Github, Code } from 'lucide-react'
import { ProjectService } from '../../services/api/project'
import { useToast } from '../../hooks/useToast'
import './GitIntegrationModal.css'

const GitStatus = {
  NOT_CONFIGURED: 'not_configured',  // scaffold + no git_url
  LINKED: 'linked',                  // git_url exists but not pushed
  CONNECTED: 'connected'             // git_url exists and pushed
} as const

type GitStatus = typeof GitStatus[keyof typeof GitStatus]

interface GitIntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  projectName?: string
  gitUrl?: string
  isScaffold?: boolean
  onSuccess?: () => void
  githubUsername?: string
}

export function GitIntegrationModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'my-project',
  gitUrl,
  isScaffold = false,
  onSuccess,
  githubUsername,
}: GitIntegrationModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess, showError } = useToast()

  // Auto-generate repo name from project name (not editable by user)
  const getRepoName = () => {
    if (!projectName) return 'my-project'
    // Convert to kebab-case
    return projectName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  // Determine git status
  const getGitStatus = (): GitStatus => {
    if (!gitUrl) return GitStatus.NOT_CONFIGURED  // No git_url -> not configured
    if (isScaffold) return GitStatus.LINKED  // Has git_url but scaffold -> linked (not pushed yet)
    return GitStatus.CONNECTED  // Has git_url and not scaffold -> fully connected
  }

  const gitStatus = getGitStatus()

  if (!isOpen) return null

  const handleCreateRepo = async () => {
    if (!projectId) {
      setError('Project ID not found')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const repoName = getRepoName()
      console.log('Creating GitHub repository:', {
        name: repoName,
        private: true
      })
      const result = await ProjectService.integrateGit(projectId, {
        name: repoName,
        private: true,  // Always private
        description: `AppKit project: ${projectName}`,  // Auto-generated
      })
      console.log('Repository created:', result)

      // Trigger parent to refresh (gitUrl will be updated)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create repository'
      console.error('Repository creation error:', err)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInitialPush = async () => {
    if (!projectId) {
      setError('Project ID not found')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Pushing initial commit for project:', projectId)
      const result = await ProjectService.gitPushInitial(projectId)
      console.log('Initial push result:', result)
      showSuccess(result.message)

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to push initial commit'
      console.error('Initial push error:', err)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRedirect = () => {
    console.log('handleRedirect called, gitUrl:', gitUrl)
    if (!gitUrl) {
      setError('Repository URL not found')
      return
    }
    window.open(gitUrl, '_blank')
    onClose()
  }

  // Extract repo name from URL for display
  const getRepoNameFromUrl = (url?: string) => {
    if (!url) return ''
    const match = url.match(/github\.com[/:](.+?)(?:\.git)?$/)
    return match ? match[1] : url
  }

  const handlePush = async () => {
    if (!projectId) {
      setError('Project ID not found')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Pushing to remote for project:', projectId)
      const result = await ProjectService.gitPush(projectId)
      console.log('Git push result:', result)
      showSuccess(result.message)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to push to remote'
      console.error('Git push error details:', {
        error: err,
        message: errorMsg,
        projectId,
      })
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="git-modal-overlay" onClick={onClose}>
      <div className="git-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="git-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="git-modal-body">
          {/* Header */}
          <div className="git-modal-header">
            <h2 className="git-modal-title">Git Integration</h2>
            <p className="git-modal-subtitle">
              {gitStatus === GitStatus.NOT_CONFIGURED && 'Configure and publish to GitHub'}
              {gitStatus === GitStatus.LINKED && 'Repository linked - ready to push'}
              {gitStatus === GitStatus.CONNECTED && 'Manage your repository'}
            </p>
          </div>

          {/* Status Section */}
          {gitUrl && (
            <div className="git-status-section">
              <button
                className="git-repo-info"
                onClick={() => {
                  if (gitUrl) {
                    window.open(gitUrl, '_blank')
                  }
                }}
              >
                <Github size={14} />
                <span className="git-repo-name">{getRepoNameFromUrl(gitUrl)}</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && <div className="git-modal-error">{error}</div>}

          {/* Content based on GitStatus */}
          {gitStatus === GitStatus.NOT_CONFIGURED && (
            <div className="repo-config-form">
              <div className="github-repo-preview">
                <Github size={14} />
                <span className="repo-path">{githubUsername || 'your-account'}/{getRepoName()}</span>
              </div>

              <button
                className="git-action-btn git-action-btn-primary"
                onClick={handleCreateRepo}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Repository'}
              </button>
            </div>
          )}

          {gitStatus === GitStatus.LINKED && (
            <div className="repo-config-form">
              <button
                className="github-repo-link"
                onClick={() => {
                  if (gitUrl) {
                    const githubDevUrl = gitUrl.replace('github.com', 'github.dev').replace('.git', '')
                    window.open(githubDevUrl, '_blank')
                  }
                }}
              >
                <Code size={14} />
                <span className="repo-path">Edit in VS Code</span>
              </button>

              <button
                className="git-action-btn git-action-btn-primary"
                onClick={handleInitialPush}
                disabled={isLoading}
              >
                {isLoading ? 'Pushing...' : 'Push Initial Commit'}
              </button>
            </div>
          )}

          {gitStatus === GitStatus.CONNECTED && (
            <div className="repo-config-form">
              <button
                className="github-repo-link"
                onClick={() => {
                  if (gitUrl) {
                    const githubDevUrl = gitUrl.replace('github.com', 'github.dev').replace('.git', '')
                    window.open(githubDevUrl, '_blank')
                  }
                }}
              >
                <Code size={14} />
                <span className="repo-path">Edit in VS Code</span>
              </button>

              <div className="git-actions-section">
                <button
                  className="git-action-btn git-action-btn-primary"
                  onClick={handlePush}
                  disabled={isLoading}
                >
                  {isLoading ? 'Pushing...' : 'Push Changes'}
                </button>
                <button
                  className="git-action-btn git-action-btn-secondary"
                  onClick={handleRedirect}
                  disabled={isLoading || !gitUrl}
                >
                  View on GitHub
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
