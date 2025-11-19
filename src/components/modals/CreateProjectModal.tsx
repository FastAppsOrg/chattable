import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import styles from './CreateProjectModal.module.css'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (prompt?: string) => void | Promise<void>
  loading?: boolean
}

export function CreateProjectModal({ isOpen, onClose, onCreate, loading = false }: CreateProjectModalProps) {
  const [prompt, setPrompt] = useState('')

  if (!isOpen) return null

  const handleCreate = async () => {
    await onCreate(prompt.trim() || undefined)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create New Project</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label htmlFor="initial-prompt" className={styles.label}>
              Initial Prompt
            </label>
            <textarea
              id="initial-prompt"
              className={styles.textarea}
              placeholder="Enter your initial prompt to start the conversation..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={loading}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={styles.createButton}
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
