import React, { useEffect, useState } from 'react'
import { Toast as ToastType } from '../../contexts/ToastContext'
import { useToast } from '../../hooks/useToast'

interface ToastProps {
  toast: ToastType
}

const Toast: React.FC<ToastProps> = ({ toast }) => {
  const { removeToast } = useToast()
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(
      () => {
        setIsExiting(true)
      },
      (toast.duration || 5000) - 300,
    )

    return () => clearTimeout(timer)
  }, [toast.duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      removeToast(toast.id)
    }, 300)
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      case 'info':
        return 'ℹ'
      default:
        return 'ℹ'
    }
  }

  return (
    <div className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={handleClose} aria-label="Close">
        ×
      </button>
    </div>
  )
}

export default Toast
