import React from 'react'
import styles from './GreetingPanel.module.css'

interface GreetingPanelProps {
  githubUsername?: string
}

export const GreetingPanel: React.FC<GreetingPanelProps> = ({ githubUsername = 'there' }) => {
  const getTimeOfDay = () => {
    const hour = new Date().getHours()
    if (hour < 6) return 'Night'
    if (hour < 12) return 'Morning'
    if (hour < 18) return 'Afternoon'
    return 'Evening'
  }

  const isLoggedIn = githubUsername !== 'there'

  return (
    <div className={styles.panel}>
      <div className={styles.panelContent}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>
            {isLoggedIn ? (
              <>Good {getTimeOfDay()}, {githubUsername}</>
            ) : (
              <>Build and deploy Apps for ChatGPT</>
            )}
          </h2>
        </div>
        <div className={styles.panelBody}>
          <p className={styles.subtitle}>
            {isLoggedIn
              ? 'Build your own Apps in ChatGPT'
              : 'The fastest way to build ChatGPT apps with real-time preview and one-click deployment'}
          </p>
        </div>
      </div>
    </div>
  )
}
