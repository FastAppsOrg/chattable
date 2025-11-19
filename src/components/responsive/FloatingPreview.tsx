import { useState, useRef, useEffect, memo, ReactNode } from 'react'
import { X, Maximize2, Minimize2, Move } from 'lucide-react'
import styles from './FloatingPreview.module.css'

interface FloatingPreviewProps {
  children: ReactNode
  onClose: () => void
  title?: string
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

export const FloatingPreview = memo(function FloatingPreview({
  children,
  onClose,
  title = 'Preview',
  defaultWidth = 400,
  defaultHeight = 300,
  minWidth = 250,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 600,
}: FloatingPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 })

  // Initialize position to bottom-right corner
  useEffect(() => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    setPosition({
      x: viewportWidth - defaultWidth - 20,
      y: viewportHeight - defaultHeight - 20,
    })
  }, [defaultWidth, defaultHeight])

  // Handle dragging (mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.controls}`)) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  // Handle dragging (touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.controls}`)) return
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x))
      const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragStart.y))
      setPosition({ x: newX, y: newY })
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y
      const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX))
      const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY))
      setSize({ width: newWidth, height: newHeight })
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0]
      const newX = Math.max(0, Math.min(window.innerWidth - size.width, touch.clientX - dragStart.x))
      const newY = Math.max(0, Math.min(window.innerHeight - size.height, touch.clientY - dragStart.y))
      setPosition({ x: newX, y: newY })
    } else if (isResizing) {
      const touch = e.touches[0]
      const deltaX = touch.clientX - resizeStart.x
      const deltaY = touch.clientY - resizeStart.y
      const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX))
      const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY))
      setSize({ width: newWidth, height: newHeight })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  // Handle resize (mouse)
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      width: size.width,
      height: size.height,
      x: e.clientX,
      y: e.clientY,
    })
  }

  // Handle resize (touch)
  const handleResizeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.touches[0]
    setIsResizing(true)
    setResizeStart({
      width: size.width,
      height: size.height,
      x: touch.clientX,
      y: touch.clientY,
    })
  }

  // Toggle minimize/maximize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      // Mouse events
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      // Touch events
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart])

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isMinimized ? styles.minimized : ''} ${
        isDragging ? styles.dragging : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? 'auto' : `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
      }}
    >
      {/* Header */}
      <div
        className={styles.header}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className={styles.title}>
          <Move size={14} className={styles.dragIcon} />
          <span>{title}</span>
        </div>
        <div className={styles.controls}>
          <button
            className={styles.controlButton}
            onClick={toggleMinimize}
            aria-label={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button className={styles.controlButton} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className={styles.content}>
          {children}
        </div>
      )}

      {/* Resize handle */}
      {!isMinimized && (
        <div
          className={styles.resizeHandle}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeTouchStart}
        >
          <div className={styles.resizeIcon} />
        </div>
      )}
    </div>
  )
})