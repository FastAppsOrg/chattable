import { memo, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import styles from './ProjectDrawer.module.css'

interface ProjectDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export const ProjectDrawer = memo(function ProjectDrawer({
  isOpen,
  onClose,
  children,
  title = 'Projects',
}: ProjectDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Handle focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      drawerRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isOpen])

  // Handle swipe gesture to close
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return

    let touchStartX = 0
    let touchCurrentX = 0
    let isDragging = false
    const drawer = drawerRef.current

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchCurrentX = touchStartX
      isDragging = true
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return

      touchCurrentX = e.touches[0].clientX
      const translateX = Math.min(0, touchCurrentX - touchStartX)

      // Only allow dragging to the left (closing gesture)
      if (translateX < 0) {
        drawer.style.transform = `translateX(${translateX}px)`
      }
    }

    const handleTouchEnd = () => {
      if (!isDragging) return
      isDragging = false

      const swipeDistance = touchCurrentX - touchStartX
      const threshold = -100 // Swipe left by at least 100px to close

      if (swipeDistance < threshold) {
        onClose()
      }

      drawer.style.transform = ''
    }

    drawer.addEventListener('touchstart', handleTouchStart, { passive: true })
    drawer.addEventListener('touchmove', handleTouchMove, { passive: true })
    drawer.addEventListener('touchend', handleTouchEnd)

    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart)
      drawer.removeEventListener('touchmove', handleTouchMove)
      drawer.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${isOpen ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        {/* Drawer Content */}
        <div className={styles.content}>{children}</div>
      </div>
    </>,
    document.body,
  )
})

// Utility component for drawer item
export const DrawerItem = memo(function DrawerItem({
  onClick,
  children,
  active = false,
}: {
  onClick?: () => void
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button className={`${styles.drawerItem} ${active ? styles.active : ''}`} onClick={onClick}>
      {children}
    </button>
  )
})
