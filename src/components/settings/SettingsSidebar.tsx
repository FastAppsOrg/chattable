import { LucideIcon } from 'lucide-react'
import { TabType } from './SettingsModal'
import styles from './SettingsSidebar.module.css'

interface Tab {
  id: TabType
  label: string
  icon: LucideIcon
}

interface SettingsSidebarProps {
  tabs: Tab[]
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className={styles.sidebar}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={18} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
