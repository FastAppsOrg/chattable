import React, { Component, ErrorInfo, ReactNode, createContext, useContext } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Bug } from 'lucide-react'
import styles from './AdvancedErrorBoundary.module.css'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
  errorHistory: Array<{ error: Error; timestamp: Date; componentStack?: string }>
  isDetailsExpanded: boolean
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  isolate?: boolean
  enableRecovery?: boolean
  maxRetries?: number
}

const ErrorBoundaryContext = createContext<{
  reset: () => void
  error: Error | null
  errorInfo: ErrorInfo | null
} | null>(null)

export function useErrorBoundary() {
  const context = useContext(ErrorBoundaryContext)
  if (!context) {
    throw new Error('useErrorBoundary must be used within an ErrorBoundary')
  }
  return context
}

export class AdvancedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      errorHistory: [],
      isDetailsExpanded: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorCount: 0, // Will be incremented in componentDidCatch
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props

    // Log to external error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo)
    }

    // Update error history
    this.setState((prev) => ({
      errorCount: prev.errorCount + 1,
      errorInfo,
      errorHistory: [
        ...prev.errorHistory,
        {
          error,
          timestamp: new Date(),
          componentStack: errorInfo.componentStack || undefined,
        },
      ].slice(-10), // Keep last 10 errors
    }))

    // Call custom error handler
    onError?.(error, errorInfo)

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error')
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Implement your error tracking service integration here
    // Example: Sentry, LogRocket, etc.
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    // Send to your error tracking endpoint
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData),
    }).catch((err) => {
      console.error('Failed to log error to service:', err)
    })
  }

  private reset = () => {
    const { maxRetries = 3 } = this.props

    if (this.retryCount < maxRetries) {
      this.retryCount++
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      })
    } else {
      console.error('Maximum retry attempts reached')
    }
  }

  private toggleDetails = () => {
    this.setState((prev) => ({ isDetailsExpanded: !prev.isDetailsExpanded }))
  }

  private copyErrorToClipboard = () => {
    const { error, errorInfo } = this.state
    if (!error) return

    const errorText = `
Error: ${error.message}
Stack: ${error.stack}
Component Stack: ${errorInfo?.componentStack}
    `.trim()

    navigator.clipboard.writeText(errorText).then(
      () => alert('Error details copied to clipboard'),
      () => alert('Failed to copy error details')
    )
  }

  render() {
    const { hasError, error, errorInfo, isDetailsExpanded, errorCount } = this.state
    const { children, fallback, isolate, enableRecovery = true } = this.props

    if (hasError && error && errorInfo) {
      // Use custom fallback if provided
      if (fallback) {
        return (
          <ErrorBoundaryContext.Provider value={{ reset: this.reset, error, errorInfo }}>
            {fallback(error, errorInfo, this.reset)}
          </ErrorBoundaryContext.Provider>
        )
      }

      // Default error UI
      return (
        <div className={styles.errorBoundary} data-isolate={isolate}>
          <div className={styles.errorContainer}>
            <div className={styles.errorHeader}>
              <AlertTriangle className={styles.errorIcon} size={48} />
              <div className={styles.errorContent}>
                <h2 className={styles.errorTitle}>Something went wrong</h2>
                <p className={styles.errorMessage}>{error.message}</p>
              </div>
            </div>

            <div className={styles.errorMeta}>
              <span className={styles.errorCount}>Error #{errorCount}</span>
              {this.retryCount > 0 && (
                <span className={styles.retryCount}>Retry {this.retryCount}/{this.props.maxRetries || 3}</span>
              )}
            </div>

            <div className={styles.errorActions}>
              {enableRecovery && (
                <button onClick={this.reset} className={styles.retryButton}>
                  <RefreshCw size={16} />
                  Try Again
                </button>
              )}
              <button onClick={this.toggleDetails} className={styles.detailsButton}>
                {isDetailsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {isDetailsExpanded ? 'Hide' : 'Show'} Details
              </button>
              <button onClick={this.copyErrorToClipboard} className={styles.copyButton}>
                <Bug size={16} />
                Copy Error
              </button>
            </div>

            {isDetailsExpanded && (
              <div className={styles.errorDetails}>
                <div className={styles.errorSection}>
                  <h3>Error Stack</h3>
                  <pre className={styles.errorStack}>{error.stack}</pre>
                </div>
                <div className={styles.errorSection}>
                  <h3>Component Stack</h3>
                  <pre className={styles.componentStack}>{errorInfo.componentStack}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <ErrorBoundaryContext.Provider value={{ reset: this.reset, error, errorInfo }}>
        {children}
      </ErrorBoundaryContext.Provider>
    )
  }
}

// Async error boundary for handling Promise rejections
export function AsyncErrorBoundary({ children }: { children: ReactNode }) {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(new Error(event.reason))
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  if (error) {
    throw error
  }

  return <>{children}</>
}

// HOC for adding error boundary to components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AdvancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AdvancedErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}