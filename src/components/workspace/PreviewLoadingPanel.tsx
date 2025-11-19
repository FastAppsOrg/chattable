import { useState, useEffect } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import styles from './PreviewLoadingPanel.module.css'

interface PreviewLoadingPanelProps {
  message?: string
  onComplete?: () => void
}

export function PreviewLoadingPanel({ message, onComplete }: PreviewLoadingPanelProps) {
  const [isComplete, setIsComplete] = useState(false)
  const [shouldFadeOut, setShouldFadeOut] = useState(false)

  useEffect(() => {
    // When message becomes null/undefined, setup is complete
    if (!message && !isComplete) {
      setIsComplete(true)
      // Show "Enjoy!" for 2 seconds then fade out
      const timer = setTimeout(() => {
        setShouldFadeOut(true)
        // Call onComplete after fade animation
        setTimeout(() => {
          onComplete?.()
        }, 500) // Match CSS transition duration
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [message, isComplete, onComplete])

  if (shouldFadeOut) {
    return null
  }

  return (
    <div className={`${styles.container} ${isComplete ? styles.complete : ''}`}>
      <div className={styles.content}>
        {isComplete ? (
          <>
            <CheckCircle className={styles.icon} size={48} />
            <p className={styles.message}>Enjoy! 🎉</p>
          </>
        ) : (
          <>
            <Loader2 className={styles.spinner} size={32} />
            <p className={styles.message}>{message || 'Preparing workspace...'}</p>
            <div className={styles.tips}>
              <div className={styles.tip}>
                <kbd className={styles.kbd}>⌥ Option</kbd>
                <span>Select UI elements as context</span>
              </div>
              <div className={styles.tip}>
                <kbd className={styles.kbd}>⌘ K</kbd>
                <span>Quick command palette</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
