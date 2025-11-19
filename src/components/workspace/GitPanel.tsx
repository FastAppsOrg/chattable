import { useState, useEffect } from 'react'
import { GitCommit, GitBranch, Clock, User } from 'lucide-react'
import type { Project } from '../../types/project'
import { apiClient } from '../../utils/api'
import './GitPanel.css'

interface GitPanelProps {
  project?: Project | null
  isExpanded: boolean
  githubUsername?: string
  onProjectUpdate?: () => void
}

interface Commit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
}

export function GitPanel({ project, isExpanded, githubUsername, onProjectUpdate }: GitPanelProps) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isExpanded || !project?.sandbox_id) return

    // TODO: Implement Git commits API with provider-agnostic architecture
    // For now, show placeholder message
    setError('Git commit history not yet available with current deployment provider')
    setLoading(false)
  }, [isExpanded, project?.sandbox_id, project?.default_branch])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`git-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Content Area - Slides down when expanded */}
      <div className="git-panel-content">
        {loading ? (
          <div className="git-panel-loading">
            <div className="loading-spinner"></div>
            <p>Loading commits...</p>
          </div>
        ) : error ? (
          <div className="git-panel-error">
            <p>{error}</p>
          </div>
        ) : commits.length === 0 ? (
          <div className="git-panel-empty">
            <GitCommit size={48} />
            <p>No commits yet</p>
          </div>
        ) : (
          <div className="git-commits-list">
            <div className="git-panel-header">
              <GitBranch size={16} />
              <span>{project?.default_branch || 'main'}</span>
              <span className="commit-count">{commits.length} commits</span>
            </div>
            {commits.map((commit) => (
              <div key={commit.sha} className="git-commit-item">
                <div className="commit-header">
                  <GitCommit size={14} />
                  <span className="commit-sha">{commit.sha.substring(0, 7)}</span>
                  <Clock size={12} />
                  <span className="commit-time">{formatDate(commit.author.date)}</span>
                </div>
                <div className="commit-message">{commit.message}</div>
                <div className="commit-author">
                  <User size={12} />
                  <span>{commit.author.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
