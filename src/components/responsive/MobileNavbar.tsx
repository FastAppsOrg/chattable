import { memo, useState, useRef, useEffect } from 'react'
import { ChevronRight, Sun, Moon, LogOut, ChevronDown, MessageSquare, Monitor, History } from 'lucide-react'
import type { Project } from '../../types/project'
import type { TabId } from '../../hooks/useMobileNavigation'
import styles from './MobileNavbar.module.css'
import faviconLogo from '@/assets/favicon.svg'

interface MobileNavbarProps {
  project?: Project | null
  theme?: string
  user?: any
  onDrawerToggle?: () => void
  onToggleTheme?: () => void
  onLogout?: () => void
  onOpenSettings?: () => void
  activeTab?: TabId
  onTabChange?: (tabId: TabId) => void
}

export const MobileNavbar = memo(function MobileNavbar({
  project,
  theme = 'dark',
  user,
  onDrawerToggle,
  onToggleTheme,
  onLogout,
  onOpenSettings,
  activeTab,
  onTabChange,
}: MobileNavbarProps) {
  // Support both old and new prop names
  const currentProject = project
  const [showTabDropdown, setShowTabDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Tab options
  const tabs = [
    { id: 'chat' as TabId, label: 'Chat', icon: MessageSquare },
    { id: 'preview' as TabId, label: 'Preview', icon: Monitor },
    { id: 'History' as TabId, label: 'History', icon: History },
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTabDropdown(false)
      }
    }

    if (showTabDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTabDropdown])

  return (
    <div className={styles.navbar}>
      {/* Left Section - Logo Toggle */}
      <div className={styles.leftSection}>
        <button
          className={styles.logoToggleButton}
          onClick={onDrawerToggle}
          aria-label="Toggle project drawer"
        >
          <img src={faviconLogo} alt="WidgetUI" className={styles.logoImage} />
          <ChevronRight size={16} className={styles.toggleArrow} />
        </button>

        <div className={styles.brand}>
          {currentProject && (
            <>
              <span className={styles.projectName}>{currentProject.name}</span>

              {/* Tab Selector - only show when onTabChange is provided */}
              {onTabChange && activeTabData && (
                <div className={styles.tabSelector} ref={dropdownRef}>
                  <button
                    className={styles.tabSelectorButton}
                    onClick={() => setShowTabDropdown(!showTabDropdown)}
                    aria-label="Select tab"
                  >
                    <activeTabData.icon size={14} />
                    <span>{activeTabData.label}</span>
                    <ChevronDown size={14} className={`${styles.chevron} ${showTabDropdown ? styles.chevronOpen : ''}`} />
                  </button>

                  {showTabDropdown && (
                    <div className={styles.tabDropdown}>
                      {tabs.map(tab => {
                        const Icon = tab.icon
                        return (
                          <button
                            key={tab.id}
                            className={`${styles.tabOption} ${tab.id === activeTab ? styles.activeTab : ''}`}
                            onClick={() => {
                              onTabChange(tab.id)
                              setShowTabDropdown(false)
                            }}
                          >
                            <Icon size={16} />
                            <span>{tab.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className={styles.rightSection}>
        {user ? (
          <>
            <button
              className={styles.iconButton}
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button className={styles.iconButton} onClick={onLogout} aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <button
            className={styles.iconButton}
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
      </div>
    </div>
  )
})

// Compact project selector for when drawer is not available
export const ProjectSelector = memo(function ProjectSelector({
  project,
  onProjectClick, 
}: {
  project?: Project | null
  onProjectClick?: () => void
}) {
  const currentProject = project
  const handleClick = onProjectClick

  if (!currentProject) return null

  return (
    <button
      className={styles.projectSelector}
      onClick={handleClick}
      aria-label="Select project"
    >
      <span className={styles.projectSelectorName}>{currentProject.name}</span>
      <ChevronDown size={16} className={styles.chevron} />
    </button>
  )
})