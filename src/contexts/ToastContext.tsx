import React, { createContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  showWarning: (message: string) => void
  showInfo: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastProviderProps {
  children: ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 5000) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      const newToast: Toast = { id, type, message, duration }

      setToasts((prevToasts) => [...prevToasts, newToast])

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, duration)
      }
    },
    [removeToast],
  )

  const showError = useCallback(
    (message: string) => {
      showToast(message, 'error', 7000)
    },
    [showToast],
  )

  const showSuccess = useCallback(
    (message: string) => {
      showToast(message, 'success', 3000)
    },
    [showToast],
  )

  const showWarning = useCallback(
    (message: string) => {
      showToast(message, 'warning', 5000)
    },
    [showToast],
  )

  const showInfo = useCallback(
    (message: string) => {
      showToast(message, 'info', 4000)
    },
    [showToast],
  )

  // Listen for global toast events (e.g., from api.ts)
  React.useEffect(() => {
    const handleShowToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string; type: ToastType }>
      const { message, type } = customEvent.detail
      showToast(message, type)
    }

    window.addEventListener('show-toast', handleShowToast)
    return () => window.removeEventListener('show-toast', handleShowToast)
  }, [showToast])

  const value = useMemo(
    () => ({
      toasts,
      showToast,
      removeToast,
      showError,
      showSuccess,
      showWarning,
      showInfo,
    }),
    [toasts, showToast, removeToast, showError, showSuccess, showWarning, showInfo],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export default ToastContext
