import { ReactNode, memo } from 'react'
import { Folder, MessageSquare, Monitor, Terminal } from 'lucide-react'
import type { TabId } from '../../hooks/useMobileNavigation'
import styles from './MobileTabContainer.module.css'

export interface Tab {
  id: TabId
  label: string
  icon: typeof Folder
  content: ReactNode
  badge?: number | string
}

interface MobileTabContainerProps {
  tabs: Tab[]
  activeTabId: TabId
  onTabChange: (tabId: TabId) => void
  navbar: ReactNode
  drawerOpen?: boolean
  onDrawerToggle?: () => void
  hideTabBar?: boolean
}

export const MobileTabContainer = memo(function MobileTabContainer({
  tabs,
  activeTabId,
  onTabChange,
  navbar,
  drawerOpen = false,
  onDrawerToggle,
  hideTabBar = false,
}: MobileTabContainerProps) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  // Default tab icons if not provided
  const getDefaultIcon = (tabId: TabId) => {
    switch (tabId) {
      case 'workspace':
        return Folder
      case 'chat':
        return MessageSquare
      case 'preview':
        return Monitor
      case 'terminal':
        return Terminal
      default:
        return Folder
    }
  }

  return (
    <div className={styles.container}>
      {/* Mobile Navbar */}
      {navbar && <div className={styles.navbar}>{navbar}</div>}

      {/* Tab Bar - only show if not hidden */}
      {!hideTabBar && (
        <div className={styles.tabBar}>
          {tabs.map((tab) => {
            const Icon = tab.icon || getDefaultIcon(tab.id)
            const isActive = tab.id === activeTabId
            const isProjectTab = tab.id === 'workspace'

            return (
              <button
                key={tab.id}
                className={`${styles.tab} ${isActive ? styles.active : ''}`}
                onClick={() => {
                  if (isProjectTab && onDrawerToggle) {
                    onDrawerToggle()
                  } else {
                    onTabChange(tab.id)
                  }
                }}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={styles.tabContent}>
                  <Icon size={20} className={styles.tabIcon} />
                  <span className={styles.tabLabel}>{tab.label}</span>
                  {tab.badge && <span className={styles.badge}>{tab.badge}</span>}
                </div>
                {isActive && <div className={styles.activeIndicator} />}
              </button>
            )
          })}
        </div>
      )}

      {/* Tab Content */}
      <div className={`${styles.contentArea} tab-content-area`}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.tabPanel} ${tab.id === activeTabId ? styles.visible : ''}`}
            role="tabpanel"
            aria-hidden={tab.id !== activeTabId}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
})
