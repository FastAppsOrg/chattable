import { type Project } from '../../types/project'
import './PreviewPanel.css'

interface FreestylePreviewPanelProps {
  project?: Project | null
  isActive: boolean
}

export function FreestylePreviewPanel({
  project,
  isActive,
}: FreestylePreviewPanelProps) {
  // Show loading state if project is initializing
  if (!project || project.status === 'initializing') {
    return (
      <div className="preview-panel">
        <div className="preview-loading">
          <div className="loading-spinner"></div>
          <h3>Setting up your workspace...</h3>
          <p>This may take 10-30 seconds. We're cloning the repository and starting the dev server.</p>
        </div>
      </div>
    )
  }

  // Show error state if project failed
  if (project.status === 'failed') {
    return (
      <div className="preview-panel">
        <div className="preview-error">
          <h3>Failed to create workspace</h3>
          <p>Please try creating the project again.</p>
        </div>
      </div>
    )
  }

  // Show "no URL" state if ephemeral_url is not available
  if (!project.ephemeral_url) {
    return (
      <div className="preview-panel">
        <div className="preview-error">
          <h3>Dev server not available</h3>
          <p>The development server URL is not ready yet.</p>
        </div>
      </div>
    )
  }

  // Show the Freestyle ephemeral URL in an iframe
  return (
    <div className="preview-panel">
      <iframe
        src={project.ephemeral_url}
        className="preview-iframe"
        title="Freestyle Dev Server"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#fff',
        }}
      />
    </div>
  )
}
