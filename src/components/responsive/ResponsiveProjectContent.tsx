import { ReactNode, memo, useState, useCallback } from 'react'
import { MessageSquare, Monitor, History, Maximize2, PictureInPicture } from 'lucide-react'
import { useResponsive } from '../../hooks/useResponsive'
import { useMobileNavigation, type TabId } from '../../hooks/useMobileNavigation'
import { MobileTabContainer } from './MobileTabContainer'
import { FloatingPreview } from './FloatingPreview'
import { ChatPanel } from '../chat/ChatPanel'
import { FreestylePreviewPanel } from '../workspace/FreestylePreviewPanel'
import type { Project } from '../../types/project'
import styles from './ResponsiveProjectContent.module.css'

interface ResponsiveProjectContentProps {
  project: Project | null
  selectedElementInput?: string
  selectedElements?: any[]
  onBack?: () => void
  onElementSelected?: (elementInfo: any) => void
  onExternalInputConsumed?: () => void
  onRemoveElement?: (index: number) => void
  onClearElements?: () => void
  desktopContent: ReactNode // Original desktop content from ProjectContent
}

export const ResponsiveProjectContent = memo(function ResponsiveProjectContent({
  project,
  selectedElementInput,
  selectedElements = [],
  onBack,
  onElementSelected,
  onExternalInputConsumed,
  onRemoveElement,
  onClearElements,
  desktopContent,
}: ResponsiveProjectContentProps) {
  const { isMobile } = useResponsive()
  const { activeTab, switchToTab } = useMobileNavigation({ defaultTab: 'chat' })
  const [floatingTab, setFloatingTab] = useState<TabId | null>(null)

  const handlePreviewConnect = () => {
    // Preview connected logic
  }

  // Desktop view - use original content
  if (!isMobile) {
    return <>{desktopContent}</>
  }

  // Mobile view - tab-based interface
  if (!project) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#666',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div>No project selected</div>
      </div>
    )
  }

  // Prepare tabs content (excluding project tab which is handled by drawer)
  const tabs = [
    {
      id: 'chat' as TabId,
      label: 'Chat',
      icon: MessageSquare,
      content: (
        <ChatPanel
          projectId={project.project_id}
          projectName={project.name}
          onBack={onBack}
          externalInput={selectedElementInput}
          onExternalInputConsumed={onExternalInputConsumed}
          selectedElements={selectedElements}
          onRemoveElement={onRemoveElement}
          onClearElements={onClearElements}
        />
      ),
    },
    {
      id: 'preview' as TabId,
      label: 'Preview',
      icon: Monitor,
      content: (
        <FreestylePreviewPanel
          project={project}
          isActive={activeTab === 'preview'}
        />
      ),
    },
    {
      id: 'history' as TabId,
      label: 'History',
      icon: History,
      content: (
        <div className="history-section" style={{ padding: '20px', color: '#999' }}>
          History coming soon...
        </div>
      ),
    },
  ]

  return (
    <div className={styles.container}>
      {/* Compact Tab Navigation Bar */}
      <div className={styles.tabNavBar}>
        {/* Tab buttons */}
        <div className={styles.tabButtonsContainer}>
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => switchToTab(tab.id)}
                className={`${styles.tabButton} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={14} className={styles.tabIcon} />
                <span className={styles.tabLabel}>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Float button - show for current tab */}
        <button
          onClick={() => {
            const otherTabs = tabs.filter(t => t.id !== activeTab)
            if (otherTabs.length > 0) {
              setFloatingTab(floatingTab === activeTab ? null : activeTab)
              if (floatingTab !== activeTab) {
                switchToTab(otherTabs[0].id)
              }
            }
          }}
          className={`${styles.floatButton} ${floatingTab === activeTab ? styles.floating : ''}`}
          aria-label={`Float ${activeTab}`}
          aria-pressed={floatingTab === activeTab}
        >
          <PictureInPicture size={14} />
          <span>Float</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.contentArea}>
        <MobileTabContainer
          tabs={tabs}
          activeTabId={activeTab}
          onTabChange={switchToTab}
          navbar={null}
          hideTabBar={true}
        />
      </div>

      {/* Floating Window for any tab */}
      {floatingTab && (
        <FloatingPreview
          onClose={() => setFloatingTab(null)}
          title={tabs.find(t => t.id === floatingTab)?.label || 'Window'}
          defaultWidth={Math.min(400, window.innerWidth - 40)}
          defaultHeight={Math.min(400, window.innerHeight - 100)}
          minWidth={250}
          minHeight={200}
          maxWidth={Math.min(800, window.innerWidth - 20)}
          maxHeight={Math.min(600, window.innerHeight - 60)}
        >
          {/* Render the floating tab's content */}
          {tabs.find(t => t.id === floatingTab)?.content}
        </FloatingPreview>
      )}
    </div>
  )
})
