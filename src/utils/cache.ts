interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  tags?: string[]
}

interface CacheOptions {
  ttl?: number
  tags?: string[]
  storage?: 'memory' | 'localStorage' | 'sessionStorage'
}

/**
 * Advanced caching system with TTL, tags, and multiple storage backends
 */
export class Cache {
  private memoryCache = new Map<string, CacheEntry<any>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(cleanupIntervalMs = 60000) {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, cleanupIntervalMs)
  }

  /**
   * Get item from cache
   */
  get<T>(key: string, storage: 'memory' | 'localStorage' | 'sessionStorage' = 'memory'): T | null {
    const entry = this.getEntry<T>(key, storage)

    if (!entry) return null

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key, storage)
      return null
    }

    return entry.data
  }

  /**
   * Set item in cache
   */
  set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): void {
    const { ttl = 3600000, tags = [], storage = 'memory' } = options // Default 1 hour TTL

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags
    }

    switch (storage) {
      case 'memory':
        this.memoryCache.set(key, entry)
        break
      case 'localStorage':
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify(entry))
        } catch (e) {
          console.error('Failed to save to localStorage:', e)
        }
        break
      case 'sessionStorage':
        try {
          sessionStorage.setItem(`cache_${key}`, JSON.stringify(entry))
        } catch (e) {
          console.error('Failed to save to sessionStorage:', e)
        }
        break
    }
  }

  /**
   * Delete item from cache
   */
  delete(key: string, storage: 'memory' | 'localStorage' | 'sessionStorage' = 'memory'): void {
    switch (storage) {
      case 'memory':
        this.memoryCache.delete(key)
        break
      case 'localStorage':
        localStorage.removeItem(`cache_${key}`)
        break
      case 'sessionStorage':
        sessionStorage.removeItem(`cache_${key}`)
        break
    }
  }

  /**
   * Clear all cache entries
   */
  clear(storage?: 'memory' | 'localStorage' | 'sessionStorage'): void {
    if (!storage || storage === 'memory') {
      this.memoryCache.clear()
    }

    if (!storage || storage === 'localStorage') {
      Object.keys(localStorage)
        .filter(key => key.startsWith('cache_'))
        .forEach(key => localStorage.removeItem(key))
    }

    if (!storage || storage === 'sessionStorage') {
      Object.keys(sessionStorage)
        .filter(key => key.startsWith('cache_'))
        .forEach(key => sessionStorage.removeItem(key))
    }
  }

  /**
   * Invalidate cache entries by tag
   */
  invalidateByTag(tag: string): void {
    // Memory cache
    this.memoryCache.forEach((entry, key) => {
      if (entry.tags?.includes(tag)) {
        this.memoryCache.delete(key)
      }
    })

    // LocalStorage
    Object.keys(localStorage)
      .filter(key => key.startsWith('cache_'))
      .forEach(key => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}')
          if (entry.tags?.includes(tag)) {
            localStorage.removeItem(key)
          }
        } catch (e) {
          // Invalid entry, remove it
          localStorage.removeItem(key)
        }
      })

    // SessionStorage
    Object.keys(sessionStorage)
      .filter(key => key.startsWith('cache_'))
      .forEach(key => {
        try {
          const entry = JSON.parse(sessionStorage.getItem(key) || '{}')
          if (entry.tags?.includes(tag)) {
            sessionStorage.removeItem(key)
          }
        } catch (e) {
          sessionStorage.removeItem(key)
        }
      })
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number
    localStorageSize: number
    sessionStorageSize: number
    totalEntries: number
  } {
    return {
      memorySize: this.memoryCache.size,
      localStorageSize: Object.keys(localStorage).filter(k => k.startsWith('cache_')).length,
      sessionStorageSize: Object.keys(sessionStorage).filter(k => k.startsWith('cache_')).length,
      totalEntries: this.memoryCache.size +
        Object.keys(localStorage).filter(k => k.startsWith('cache_')).length +
        Object.keys(sessionStorage).filter(k => k.startsWith('cache_')).length
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()

    // Memory cache cleanup
    this.memoryCache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key)
      }
    })

    // LocalStorage cleanup
    Object.keys(localStorage)
      .filter(key => key.startsWith('cache_'))
      .forEach(key => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}')
          if (this.isExpired(entry)) {
            localStorage.removeItem(key)
          }
        } catch (e) {
          localStorage.removeItem(key)
        }
      })

    // SessionStorage cleanup
    Object.keys(sessionStorage)
      .filter(key => key.startsWith('cache_'))
      .forEach(key => {
        try {
          const entry = JSON.parse(sessionStorage.getItem(key) || '{}')
          if (this.isExpired(entry)) {
            sessionStorage.removeItem(key)
          }
        } catch (e) {
          sessionStorage.removeItem(key)
        }
      })
  }

  private getEntry<T>(
    key: string,
    storage: 'memory' | 'localStorage' | 'sessionStorage'
  ): CacheEntry<T> | null {
    switch (storage) {
      case 'memory':
        return this.memoryCache.get(key) || null
      case 'localStorage':
        try {
          const item = localStorage.getItem(`cache_${key}`)
          return item ? JSON.parse(item) : null
        } catch (e) {
          return null
        }
      case 'sessionStorage':
        try {
          const item = sessionStorage.getItem(`cache_${key}`)
          return item ? JSON.parse(item) : null
        } catch (e) {
          return null
        }
    }
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Singleton cache instance
export const globalCache = new Cache()

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => any>(
  fn: T,
  options: CacheOptions & { keyGenerator?: (...args: Parameters<T>) => string } = {}
): T {
  const { keyGenerator = (...args) => JSON.stringify(args), ...cacheOptions } = options

  return ((...args: Parameters<T>) => {
    const key = `fn_${fn.name}_${keyGenerator(...args)}`
    const cached = globalCache.get(key)

    if (cached !== null) {
      return cached
    }

    const result = fn(...args)

    // Handle promises
    if (result instanceof Promise) {
      return result.then(data => {
        globalCache.set(key, data, cacheOptions)
        return data
      })
    }

    globalCache.set(key, result, cacheOptions)
    return result
  }) as T
}

/**
 * React hook for caching
 */
import { useCallback, useEffect, useRef } from 'react'

export function useCache<T>(
  key: string,
  fetcher: () => Promise<T> | T,
  options: CacheOptions = {}
): {
  data: T | null
  loading: boolean
  error: Error | null
  refresh: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const loadData = useCallback(async (forceFetch = false) => {
    // Check cache first
    if (!forceFetch) {
      const cached = globalCache.get<T>(key, options.storage)
      if (cached !== null) {
        setData(cached)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      if (isMounted.current) {
        setData(result)
        globalCache.set(key, result, options)
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [key, fetcher, options])

  useEffect(() => {
    loadData()
  }, [loadData])

  const refresh = useCallback(() => {
    loadData(true)
  }, [loadData])

  return { data, loading, error, refresh }
}

/**
 * LRU (Least Recently Used) Cache implementation
 */
export class LRUCache<T> {
  private cache = new Map<string, T>()
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: T): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

import { useState } from 'react'