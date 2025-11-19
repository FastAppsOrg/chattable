import { useState, useEffect } from 'react'
import { Plus, Key, Copy, Trash2, Check } from 'lucide-react'
import { secretsAPI } from '../../../services/api/secrets'
import type { Secret } from '../../../services/api/secrets'
import styles from './SecretsTab.module.css'

interface SecretsTabProps {
  userId?: string
}

export function SecretsTab({ userId }: SecretsTabProps) {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSecret, setNewSecret] = useState({ name: '', value: '', type: 'env_var' })
  const [copiedSecrets, setCopiedSecrets] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      loadSecrets()
    }
  }, [userId])

  const loadSecrets = async () => {
    if (!userId) return

    try {
      setLoading(true)
      const data = await secretsAPI.list()
      setSecrets(data)
    } catch (err) {
      console.error('Failed to load secrets:', err)
      setError('Failed to load secrets')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSecret = async () => {
    if (!newSecret.name || !newSecret.value) {
      setError('Name and value are required')
      return
    }

    try {
      await secretsAPI.create({
        name: newSecret.name,
        value: newSecret.value,
        type: newSecret.type as 'github' | 'api_key' | 'env_var' | 'ssh_key' | 'other',
      })
      setNewSecret({ name: '', value: '', type: 'env_var' })
      setShowAddForm(false)
      await loadSecrets()
    } catch (err: any) {
      setError(err.message || 'Failed to create secret')
    }
  }

  const handleDeleteSecret = async (id: number, name: string) => {
    if (!confirm(`Delete secret "${name}"?`)) return

    try {
      await secretsAPI.delete(id)
      await loadSecrets()
    } catch (err: any) {
      setError(err.message || 'Failed to delete secret')
    }
  }

  const handleCopySecret = async (id: number) => {
    try {
      const { value } = await secretsAPI.getDecrypted(id)
      await navigator.clipboard.writeText(value)

      setCopiedSecrets((prev) => new Set(prev).add(id))
      setTimeout(() => {
        setCopiedSecrets((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy secret')
    }
  }

  if (!userId) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Key size={48} />
          <p>Please log in to manage secrets</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Environment Secrets</h3>
          <p className={styles.description}>
            Secrets are encrypted and injected into your workspace containers as environment
            variables
          </p>
        </div>
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          <Plus size={16} />
          Add Secret
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {showAddForm && (
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder="Secret name (e.g., API_KEY)"
            value={newSecret.name}
            onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value })}
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Secret value"
            value={newSecret.value}
            onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
            className={styles.input}
          />
          <select
            value={newSecret.type}
            onChange={(e) => setNewSecret({ ...newSecret, type: e.target.value })}
            className={styles.select}
          >
            <option value="env_var">Environment Variable</option>
            <option value="api_key">API Key</option>
            <option value="github">GitHub Token</option>
            <option value="ssh_key">SSH Key</option>
            <option value="other">Other</option>
          </select>
          <div className={styles.formActions}>
            <button className={styles.saveButton} onClick={handleAddSecret}>
              Save
            </button>
            <button
              className={styles.cancelButton}
              onClick={() => {
                setShowAddForm(false)
                setNewSecret({ name: '', value: '', type: 'env_var' })
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading secrets...</div>
      ) : secrets.length === 0 ? (
        <div className={styles.emptyState}>
          <Key size={32} />
          <p>No secrets configured</p>
          <p className={styles.hint}>Add secrets to use them in your projects.</p>
        </div>
      ) : (
        <div className={styles.secretsList}>
          {secrets.map((secret) => (
            <div key={secret.name} className={styles.secretItem}>
              <div className={styles.secretInfo}>
                <span className={styles.secretName}>{secret.name}</span>
                <div className={styles.secretRightSection}>
                  <span className={styles.secretType}>{secret.type}</span>
                  <div className={styles.secretActions}>
                    <button
                      className={styles.iconButton}
                      onClick={() => handleCopySecret(secret.id)}
                      title="Copy to clipboard"
                    >
                      {copiedSecrets.has(secret.id) ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      className={styles.iconButton}
                      onClick={() => handleDeleteSecret(secret.id, secret.name)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
