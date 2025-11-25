import { useState } from 'react'
import { RefreshCw, GitCommit, AlertCircle } from 'lucide-react'
import { apiClient } from '../../utils/api'
import { API_ENDPOINTS } from '../../constants/api'
import './GracefulRestartDropdown.css'

interface GracefulRestartDropdownProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  onSuccess?: () => void
}

export function GracefulRestartDropdown({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: GracefulRestartDropdownProps) {
  const [isRestarting, setIsRestarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleRestart = async () => {
    if (!projectId) {
      setError('No project ID provided')
      return
    }

    setIsRestarting(true)
    setError(null)

    try {
      const endpoint = API_ENDPOINTS.projectRestart(projectId)
      console.log('Calling graceful restart endpoint:', endpoint)

      // Graceful restart takes 30-60s (sandbox creation), use 2min timeout
      const response = await apiClient.post(endpoint, null, { timeout: 120000 })
      console.log('Graceful restart response status:', response.status)

      if (!response.ok) {
        let errorMessage = `Restart failed: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorMessage
          console.error('Error response:', errorData)
        } catch (parseError) {
          console.error('Could not parse error response:', parseError)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('Graceful restart success:', result)

      // Success!
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Graceful restart failed:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to restart sandbox'
      setError(errorMsg)
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <>
      {/* Backdrop for closing on outside click */}
      <div className="dropdown-backdrop" onClick={onClose} />

      {/* Dropdown content */}
      <div className="graceful-restart-dropdown" onClick={(e) => e.stopPropagation()}>
        <div className="dropdown-header">
          <div className="header-icon">
            <RefreshCw size={20} />
          </div>
          <h3>Graceful Sandbox Restart</h3>
        </div>

        <div className="dropdown-body">
          <div className="warning-banner">
            <AlertCircle size={16} />
            <span>Sandbox approaching 1-hour limit</span>
          </div>

          <div className="restart-info">
            <div className="restart-step">
              <GitCommit size={14} />
              <span><strong>Auto-commit:</strong> Save all changes</span>
            </div>
            <div className="restart-step">
              <RefreshCw size={14} />
              <span><strong>Recreate:</strong> Fresh 1-hour timer</span>
            </div>
            <div className="restart-step">
              <GitCommit size={14} />
              <span><strong>Restore:</strong> Branch & dependencies</span>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="dropdown-footer">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={isRestarting}
          >
            Cancel
          </button>
          <button
            className="btn-restart"
            onClick={handleRestart}
            disabled={isRestarting || !projectId}
          >
            {isRestarting ? (
              <>
                <RefreshCw size={14} className="spinning" />
                Restarting...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Restart
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
