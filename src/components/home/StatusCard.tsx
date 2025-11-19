import { ReactNode } from 'react'
import { CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import styles from './StatusCard.module.css'

interface StatusCardProps {
  icon: ReactNode
  title: string
  connected: boolean
  statusText: string
  onClick: () => void
  disabled?: boolean
}

export function StatusCard({
  icon,
  title,
  connected,
  statusText,
  onClick,
  disabled = false,
}: StatusCardProps) {
  return (
    <div
      className={`${styles.statusCard} ${disabled ? styles.disabled : ''}`}
      onClick={disabled ? undefined : onClick}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={disabled ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>{icon}</div>
        <div className={styles.cardContent}>
          <h4 className={styles.cardTitle}>{title}</h4>
          <div className={styles.cardStatus}>
            {connected ? (
              <>
                <CheckCircle size={16} color="var(--color-primary)" />
                <span className={styles.statusText}>{statusText}</span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} color="var(--color-warning)" />
                <span className={styles.statusText}>{statusText}</span>
              </>
            )}
          </div>
        </div>
        {!connected && !disabled && (
          <div className={styles.nudgeIcon}>
            <ChevronRight size={20} />
          </div>
        )}
      </div>
    </div>
  )
}
