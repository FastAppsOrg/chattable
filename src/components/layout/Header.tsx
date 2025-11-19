import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface HeaderProps {
  title: string
  children?: ReactNode
  onBack?: () => void
  status?: {
    connected: boolean
    connecting?: boolean
    label?: string
  }
  showSecretsButton?: boolean
}

export function Header({ title, children, onBack, status, showSecretsButton = true }: HeaderProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const getStatusText = () => {
    if (!status) return ''
    if (status.label) return status.label
    if (status.connecting) return 'Connecting...'
    return status.connected ? 'Connected' : 'Disconnected'
  }

  const getStatusClass = () => {
    if (!status) return ''
    if (status.connecting) return 'connecting'
    return status.connected ? 'connected' : 'disconnected'
  }

  return (
    <div className="header">
      {onBack && <button onClick={onBack}>← Back</button>}
      <h1>{title}</h1>
      <div className="controls">
        {status && <span className={`status ${getStatusClass()}`}>{getStatusText()}</span>}
        {/* {user && (
          <>
            <span style={{ color: '#999', fontSize: '0.9rem' }}>
              {user.email}
            </span>
            {showSecretsButton && (
              <button 
                className="btn-ghost"
                onClick={() => navigate('/secrets')}
              >
                🔐 Secrets
              </button>
            )}
            <button 
              className="btn-ghost"
              onClick={signOut}
            >
              Sign Out
            </button>
          </>
        )} */}
        {children}
      </div>
    </div>
  )
}
