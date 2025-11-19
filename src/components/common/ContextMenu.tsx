import { useState, useEffect, useRef } from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import styles from './ContextMenu.module.css'

interface ContextMenuProps {
  isOpen: boolean
  x: number
  y: number
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  itemName: string
}

export function ContextMenu({
  isOpen,
  x,
  y,
  onClose,
  onRename,
  onDelete,
  itemName,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div ref={menuRef} className={styles.contextMenu} style={{ left: x, top: y }}>
      <button
        className={styles.menuItem}
        onClick={() => {
          onRename()
          onClose()
        }}
      >
        <Edit3 size={14} />
        <span>Rename {itemName}</span>
      </button>
      <button
        className={styles.menuItem}
        onClick={() => {
          onDelete()
          onClose()
        }}
      >
        <Trash2 size={14} />
        <span>Delete {itemName}</span>
      </button>
    </div>
  )
}
