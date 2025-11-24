import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import type { DependencyList } from 'react'

/**
 * Debounce hook for optimizing rapid state changes
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

/**
 * Throttle hook for limiting function execution frequency
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  deps?: DependencyList
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallTime = useRef<number>(0)

  return useCallback(
    ((...args) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallTime.current

      if (timeSinceLastCall >= delay) {
        lastCallTime.current = now
        return fn(...args)
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        lastCallTime.current = Date.now()
        fn(...args)
      }, delay - timeSinceLastCall)
    }) as T,
    deps ? [delay, ...deps] : [delay]
  )
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observer.observe(element)

    return () => observer.disconnect()
  }, [elementRef, options?.root, options?.rootMargin, options?.threshold])

  return isIntersecting
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScroll<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  }, [scrollTop, itemHeight, overscan])

  const endIndex = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    return Math.min(items.length, startIndex + visibleCount + overscan * 2)
  }, [startIndex, containerHeight, itemHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex)
  }, [items, startIndex, endIndex])

  const totalHeight = items.length * itemHeight

  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex,
  }
}

/**
 * Memoized event handler creator
 */
export function useMemoizedHandler<T extends (...args: any[]) => any>(
  handler: T,
  deps: DependencyList
): T {
  const handlerRef = useRef<T>(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  return useCallback(
    ((...args) => handlerRef.current(...args)) as T,
    deps
  )
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0)
  const renderStartTime = useRef<number>(0)

  useEffect(() => {
    renderCount.current++
    const renderTime = renderStartTime.current
      ? performance.now() - renderStartTime.current
      : 0

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Performance] ${componentName} rendered ${renderCount.current} times. Last render: ${renderTime.toFixed(2)}ms`)
    }

    renderStartTime.current = performance.now()
  })

  return {
    renderCount: renderCount.current,
  }
}

/**
 * Request Animation Frame hook for smooth animations
 */
export function useAnimationFrame(callback: (deltaTime: number) => void) {
  const requestRef = useRef<number>(0)
  const previousTimeRef = useRef<number>(0)

  const animate = useCallback(
    (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current
        callback(deltaTime)
      }
      previousTimeRef.current = time
      requestRef.current = requestAnimationFrame(animate)
    },
    [callback]
  )

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate)
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [animate])
}

/**
 * Lazy load component wrapper
 */
export function lazyWithPreload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const Component = React.lazy(factory) as any
  Component.preload = factory
  return Component as T & { preload: typeof factory }
}

/**
 * Web Worker hook for heavy computations
 */
export function useWebWorker<T, R>(workerFunction: (data: T) => R) {
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    const blob = new Blob(
      [`self.onmessage = function(e) { self.postMessage((${workerFunction.toString()})(e.data)); }`],
      { type: 'application/javascript' }
    )
    const workerUrl = URL.createObjectURL(blob)
    workerRef.current = new Worker(workerUrl)

    return () => {
      workerRef.current?.terminate()
      URL.revokeObjectURL(workerUrl)
    }
  }, [])

  const runWorker = useCallback(
    (data: T): Promise<R> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'))
          return
        }

        workerRef.current.onmessage = (e) => resolve(e.data)
        workerRef.current.onerror = reject
        workerRef.current.postMessage(data)
      })
    },
    []
  )

  return runWorker
}