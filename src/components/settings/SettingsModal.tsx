import { useState, useEffect } from 'react'
import { X, Key, Bot, Server, Zap, Terminal, Settings } from 'lucide-react'
import { SettingsSidebar } from './SettingsSidebar'
import { SecretsTab } from './tabs/SecretsTab'
import { AgentsTab } from './tabs/AgentsTab'
import { MCPServersTab } from './tabs/MCPServersTab'
import { AiProviderTab } from './tabs/AiProviderTab'
import { CommandsTab } from './tabs/CommandsTab'
import styles from './SettingsModal.module.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  initialTab?: TabType
  onProviderChange?: () => void
}

export type TabType = 'claude' | 'secrets' | 'agents' | 'mcp' | 'commands'

export function SettingsModal({
  isOpen,
  onClose,
  userId,
  initialTab = 'claude',
  onProviderChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [isOAuthInProgress, setIsOAuthInProgress] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    const handleEscape = (e: KeyboardEvent) => {
      // Don't close modal if OAuth is in progress
      if (e.key === 'Escape' && isOpen && !isOAuthInProgress) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, initialTab, isOAuthInProgress])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Don't close modal if OAuth is in progress
    if (e.target === e.currentTarget && !isOAuthInProgress) {
      onClose()
    }
  }

  const tabs = [
    { id: 'claude' as const, label: 'AI Provider', icon: Settings },
    { id: 'secrets' as const, label: 'Secrets', icon: Key },
    // { id: 'agents' as const, label: 'Agents', icon: Bot }, TODO : NOT YET
    // { id: 'commands' as const, label: 'Commands', icon: Terminal }, TODO : NOT YET
    // { id: 'mcp' as const, label: 'MCP Servers', icon: Server }, TODO : NOT YET
  ]

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            className={styles.closeButton}
            onClick={() => !isOAuthInProgress && onClose()}
            disabled={isOAuthInProgress}
            style={{ opacity: isOAuthInProgress ? 0.5 : 1, cursor: isOAuthInProgress ? 'not-allowed' : 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <SettingsSidebar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className={styles.tabContent}>
            {activeTab === 'claude' && (
              <AiProviderTab
                userId={userId}
                onOAuthStateChange={setIsOAuthInProgress}
                onProviderChange={onProviderChange}
              />
            )}
            {activeTab === 'secrets' && <SecretsTab userId={userId} />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'commands' && <CommandsTab userId={userId} />}
            {activeTab === 'mcp' && <MCPServersTab userId={userId} />}
          </div>
        </div>
      </div>
    </div>
  )
}
