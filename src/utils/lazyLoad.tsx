import { lazy, Suspense, ComponentType, ReactNode } from 'react'
import styles from './lazyLoad.module.css'

interface LazyLoadOptions {
  fallback?: ReactNode
  delay?: number
  chunkName?: string
}

/**
 * Enhanced lazy loading with preload support
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: LazyLoadOptions
) {
  const { fallback = <DefaultLoadingFallback />, delay = 200 } = options || {}

  const LazyComponent = lazy(() => {
    return new Promise<{ default: T }>((resolve) => {
      setTimeout(() => {
        importFunc().then(resolve)
      }, delay)
    })
  })

    // Add preload method
    ; (LazyComponent as any).preload = importFunc

  const WrappedComponent = (props: any) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  )

  WrappedComponent.displayName = `LazyLoad(${(LazyComponent as any).displayName || 'Component'})`

  return WrappedComponent as T & { preload: typeof importFunc }
}

/**
 * Default loading fallback component
 */
function DefaultLoadingFallback() {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}>
        <div className={styles.spinnerCircle}></div>
      </div>
      <p className={styles.loadingText}>Loading...</p>
    </div>
  )
}

/**
 * Custom loading fallback with progress
 */
export function ProgressLoadingFallback({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill}></div>
      </div>
      <p className={styles.progressText}>{message}</p>
    </div>
  )
}

/**
 * Skeleton loading fallback
 */
export function SkeletonFallback({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.skeletonContainer}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={styles.skeletonLine} />
      ))}
    </div>
  )
}

/**
 * Route-based code splitting helper
 */
export function createLazyRoute(
  path: string,
  componentPath: string,
  options?: LazyLoadOptions
) {
  const Component = lazyLoad(
    () => import(/* @vite-ignore */ componentPath),
    options
  )

  return {
    path,
    element: <Component />,
    loader: () => (Component as any).preload?.(),
  }
}

/**
 * Batch preload multiple lazy components
 */
export function preloadComponents(components: Array<{ preload?: () => Promise<any> }>) {
  return Promise.all(
    components
      .filter(comp => comp.preload)
      .map(comp => comp.preload!())
  )
}

/**
 * Intersection Observer based lazy loading
 */
export function LazyLoadOnVisible({
  children,
  fallback = <DefaultLoadingFallback />,
  rootMargin = '100px',
}: {
  children: () => Promise<{ default: ComponentType }>
  fallback?: ReactNode
  rootMargin?: string
}) {
  const Component = lazy(children)

  return (
    <IntersectionObserverWrapper rootMargin={rootMargin}>
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    </IntersectionObserverWrapper>
  )
}

import { useEffect, useRef, useState } from 'react'

function IntersectionObserverWrapper({
  children,
  rootMargin = '100px',
}: {
  children: ReactNode
  rootMargin?: string
}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin])

  return <div ref={ref}>{isVisible ? children : null}</div>
}

/**
 * Network-aware lazy loading
 */
export function NetworkAwareLazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: LazyLoadOptions & { lowDataFallback?: ComponentType }
) {
  const connection = (navigator as any).connection

  // Check for slow connection
  if (connection?.saveData || connection?.effectiveType === 'slow-2g') {
    const LowDataComponent = options?.lowDataFallback || (() => (
      <div className={styles.lowDataMessage}>
        Content loading is optimized for your connection speed
      </div>
    ))
    return LowDataComponent as T
  }

  return lazyLoad(importFunc, options)
}

/**
 * Retry lazy loading on failure
 */
export function LazyLoadWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  maxRetries = 3,
  retryDelay = 1000
) {
  const retryImport = async (retriesLeft = maxRetries): Promise<{ default: T }> => {
    try {
      return await importFunc()
    } catch (error) {
      if (retriesLeft === 0) throw error

      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return retryImport(retriesLeft - 1)
    }
  }

  return lazyLoad(retryImport)
}