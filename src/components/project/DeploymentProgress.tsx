import { useEffect, useState } from 'react'
import styles from './DeploymentProgress.module.css'

export interface ProgressStep {
  step: 'start' | 'clone' | 'install' | 'dev-server' | 'complete' | 'error'
  message: string
  progress?: number
}

interface DeploymentProgressProps {
  projectId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

export function DeploymentProgress({ projectId, onComplete, onError }: DeploymentProgressProps) {
  const [currentStep, setCurrentStep] = useState<ProgressStep | null>(null)
  const [steps, setSteps] = useState<ProgressStep[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token') || 'local-token'
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects/${projectId}/progress?token=${token}`

    const eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressStep = JSON.parse(event.data)
        setCurrentStep(data)
        setSteps((prev) => [...prev, data])

        if (data.step === 'complete') {
          setTimeout(() => {
            eventSource.close()
            onComplete?.()
          }, 1000)
        } else if (data.step === 'error') {
          setTimeout(() => {
            eventSource.close()
            onError?.(data.message)
          }, 1000)
        }
      } catch (err) {
        console.error('[Progress] Failed to parse progress event:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('[Progress] EventSource error:', err)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [projectId, onComplete, onError])

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'start':
        return '🚀'
      case 'clone':
        return '📥'
      case 'install':
        return '📦'
      case 'dev-server':
        return '⚡'
      case 'complete':
        return '✅'
      case 'error':
        return '❌'
      default:
        return '⏳'
    }
  }

  const getStepLabel = (step: string) => {
    switch (step) {
      case 'start':
        return 'Initializing'
      case 'clone':
        return 'Cloning Repository'
      case 'install':
        return 'Installing Dependencies'
      case 'dev-server':
        return 'Starting Dev Server'
      case 'complete':
        return 'Complete'
      case 'error':
        return 'Error'
      default:
        return step
    }
  }

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressCard}>
        <h3 className={styles.title}>Setting up your project...</h3>

        <div className={styles.stepsContainer}>
          {steps.map((step, index) => (
            <div
              key={index}
              className={`${styles.stepItem} ${step.step === 'error' ? styles.error : ''} ${
                step.step === 'complete' ? styles.complete : ''
              }`}
            >
              <div className={styles.stepIcon}>{getStepIcon(step.step)}</div>
              <div className={styles.stepContent}>
                <div className={styles.stepLabel}>{getStepLabel(step.step)}</div>
                <div className={styles.stepMessage}>{step.message}</div>
              </div>
              {step.progress !== undefined && step.step !== 'complete' && step.step !== 'error' && (
                <div className={styles.stepProgress}>{step.progress}%</div>
              )}
            </div>
          ))}
        </div>

        {currentStep && currentStep.progress !== undefined && currentStep.step !== 'complete' && currentStep.step !== 'error' && (
          <div className={styles.progressBar}>
            <div className={styles.progressBarFill} style={{ width: `${currentStep.progress}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
