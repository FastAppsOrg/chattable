import styles from './CodeDiff.module.css'

interface CodeDiffProps {
  beforeCode: string
  afterCode: string
}

export function CodeDiff({ beforeCode, afterCode }: CodeDiffProps) {
  return (
    <div className={styles.container}>
      <div className={styles.sideBySide}>
        {/* Before Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.headerLabel}>Before</span>
            <span className={styles.badge}>Messy</span>
          </div>
          <pre className={styles.code}>
            <code>{beforeCode}</code>
          </pre>
        </div>

        {/* After Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.headerLabel}>After</span>
            <span className={`${styles.badge} ${styles.clean}`}>Clean</span>
          </div>
          <pre className={styles.code}>
            <code>{afterCode}</code>
          </pre>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>-3</span>
          <span className={styles.statLabel}>unused imports</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>-12</span>
          <span className={styles.statLabel}>lines of code</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>+5</span>
          <span className={styles.statLabel}>type annotations</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>0</span>
          <span className={styles.statLabel}>lint errors</span>
        </div>
      </div>
    </div>
  )
}
