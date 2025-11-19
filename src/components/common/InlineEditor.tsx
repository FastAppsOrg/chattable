import { useState, useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import styles from './InlineEditor.module.css'

interface InlineEditorProps {
  initialValue: string
  onSave: (value: string) => Promise<void>
  onCancel: () => void
  placeholder?: string
}

export function InlineEditor({ initialValue, onSave, onCancel, placeholder }: InlineEditorProps) {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSave = async () => {
    if (value.trim() === '') {
      onCancel()
      return
    }

    if (value.trim() === initialValue.trim()) {
      onCancel()
      return
    }

    try {
      setLoading(true)
      await onSave(value.trim())
    } catch (error) {
      console.error('Failed to save:', error)
      // Keep editor open on error
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className={styles.inlineEditor}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder={placeholder}
        className={styles.input}
        disabled={loading}
      />
      <div className={styles.actions}>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`${styles.actionButton} ${styles.saveButton}`}
          aria-label="Save"
        >
          <Check size={12} />
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className={`${styles.actionButton} ${styles.cancelButton}`}
          aria-label="Cancel"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
