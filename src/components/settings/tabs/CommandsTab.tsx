import { useState, useEffect, useCallback } from 'react'
import { Terminal, ChevronDown, ChevronRight, Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { useToast } from '../../../hooks/useToast'
import { agentsAPI } from '../../../services/api/agents'
import type { Agent } from '../../../services/api/agents'
import styles from './CommandsTab.module.css'

interface CommandsTabProps {
  userId?: string
}

export function CommandsTab({ userId }: CommandsTabProps) {
  const { showError } = useToast()
  const [commands, setCommands] = useState<Agent[]>([])
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [editingCommand, setEditingCommand] = useState<string | null>(null)
  const [newCommand, setNewCommand] = useState<Partial<Agent> | null>(null)

  useEffect(() => {
    if (userId) {
      loadCommands()
    } else {
      // No userId, just show empty state
      setIsLoading(false)
      setCommands([])
    }
  }, [userId])

  const loadCommands = async () => {
    try {
      setIsLoading(true)
      const response = await agentsAPI.list()
      // Commands are just agents/commands from the same table
      setCommands(response)
    } catch (err: any) {
      console.error('Failed to load commands:', err)
      // Check if it's a 404 (API not implemented yet)
      if (err?.response?.status === 404) {
        console.log('Commands API not available yet, using empty list')
      }
      setCommands([])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCommand = useCallback(
    async (commandId: string) => {
      const command = commands.find((c) => c.id === commandId)
      if (!command) return

      // Optimistic update
      const updatedCommands = commands.map((cmd) =>
        cmd.id === commandId ? { ...cmd, enabled: !cmd.enabled } : cmd,
      )
      setCommands(updatedCommands)

      try {
        await agentsAPI.update(commandId, { enabled: !command.enabled })
      } catch (err) {
        console.error('Failed to toggle command:', err)
        // Revert on error
        setCommands(commands)
        showError('Failed to toggle command. Please try again.')
      }
    },
    [commands],
  )

  const saveCommand = async (command: Agent | Partial<Agent>) => {
    setIsSaving(true)
    try {
      if ('id' in command && command.id) {
        // Update existing command
        const updatedCommand = await agentsAPI.update(command.id, command)
        setCommands((prev) => prev.map((c) => (c.id === command.id ? updatedCommand : c)))
      } else {
        // Create new command
        const createdCommand = await agentsAPI.save({
          ...command,
          model: command.model || 'sonnet',
          enabled: true,
        })
        setCommands((prev) => [...prev, createdCommand])
      }
      setEditingCommand(null)
      setNewCommand(null)
    } catch (err: any) {
      console.error('Failed to save command:', err)
      // Check specific error cases
      if (err?.response?.status === 404) {
        showError('Commands feature is not available yet. Please try again later.')
      } else if (err?.response?.status === 400) {
        showError('Invalid command data. Please check your input.')
      } else {
        showError('Failed to save command. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const deleteCommand = async (commandId: string) => {
    if (!confirm('Delete this command?')) return

    try {
      await agentsAPI.delete(commandId)
      setCommands((prev) => prev.filter((c) => c.id !== commandId))
    } catch (err: any) {
      console.error('Failed to delete command:', err)
      if (err?.response?.status === 404) {
        showError('Commands feature is not available yet.')
      } else {
        showError('Failed to delete command. Please try again.')
      }
    }
  }

  const startAddCommand = () => {
    setNewCommand({
      name: '',
      description: '',
      model: 'sonnet',
      prompt: '',
    })
    setEditingCommand('new')
    setExpandedCommand('new')
  }

  const cancelEdit = () => {
    setEditingCommand(null)
    setNewCommand(null)
    if (expandedCommand === 'new') {
      setExpandedCommand(null)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading commands...</div>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Terminal size={32} />
          <p>Please sign in to manage commands</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Claude Commands</h3>
          <p className={styles.description}>
            Custom commands that extend Claude's capabilities in your workspace
          </p>
        </div>
        <button className={styles.addButton} onClick={startAddCommand}>
          <Plus size={16} />
          Add Command
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.commandsList}>
          {newCommand && editingCommand === 'new' && (
            <div className={`${styles.commandItem} ${styles.editing}`}>
              <div className={styles.commandHeader}>
                <Terminal size={20} className={styles.commandIcon} />
                <div className={styles.commandInfo}>
                  <input
                    type="text"
                    value={newCommand.name || ''}
                    onChange={(e) => setNewCommand({ ...newCommand, name: e.target.value })}
                    placeholder="Command name"
                    className={styles.nameInput}
                    autoFocus
                  />
                  {/* <input
                    type="text"
                    value={newCommand.description || ''}
                    onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
                    placeholder="Description"
                    className={styles.descriptionInput}
                  /> */}
                </div>
                <div className={styles.commandControls}>
                  <button
                    className={styles.saveButton}
                    onClick={() => saveCommand(newCommand)}
                    disabled={!newCommand.name || isSaving}
                  >
                    <Check size={16} />
                  </button>
                  <button className={styles.cancelButton} onClick={cancelEdit}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.commandDetails}>
                <div className={styles.promptSection}>
                  {/* <label className={styles.label}>Model</label>
                  <select
                    value={newCommand.model || 'sonnet'}
                    onChange={(e) => setNewCommand({ ...newCommand, model: e.target.value as any })}
                    className={styles.modelSelect}
                  >
                    <option value="haiku">Haiku (Fast)</option>
                    <option value="sonnet">Sonnet (Balanced)</option>
                    <option value="opus">Opus (Powerful)</option>
                  </select>

                  <label className={styles.label}>Prompt</label> */}
                  <textarea
                    value={newCommand.prompt || ''}
                    onChange={(e) => setNewCommand({ ...newCommand, prompt: e.target.value })}
                    placeholder="Enter the command prompt..."
                    className={styles.promptTextarea}
                    rows={6}
                  />
                </div>
              </div>
            </div>
          )}

          {commands.map((command) => (
            <div
              key={command.id}
              className={`${styles.commandItem} ${command.enabled ? styles.enabled : ''}`}
            >
              <div className={styles.commandHeader}>
                <button
                  className={styles.expandButton}
                  onClick={() =>
                    setExpandedCommand((prev) => (prev === command.id ? null : command.id))
                  }
                >
                  {expandedCommand === command.id ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                <Terminal size={20} className={styles.commandIcon} />
                <div className={styles.commandInfo}>
                  {editingCommand === command.id ? (
                    <>
                      <input
                        type="text"
                        value={command.name}
                        onChange={(e) =>
                          setCommands((prev) =>
                            prev.map((c) =>
                              c.id === command.id ? { ...c, name: e.target.value } : c,
                            ),
                          )
                        }
                        className={styles.nameInput}
                      />
                      {/* <input
                        type="text"
                        value={command.description || ''}
                        onChange={(e) => setCommands(prev =>
                          prev.map(c => c.id === command.id ? { ...c, description: e.target.value } : c)
                        )}
                        className={styles.descriptionInput}
                      /> */}
                    </>
                  ) : (
                    <>
                      <span className={styles.commandName}>{command.name}</span>
                      <span className={styles.commandDescription}>{command.description}</span>
                    </>
                  )}
                </div>
                <div className={styles.commandControls}>
                  {editingCommand === command.id ? (
                    <>
                      <button
                        className={styles.saveButton}
                        onClick={() => saveCommand(command)}
                        disabled={isSaving}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className={styles.cancelButton}
                        onClick={() => {
                          setEditingCommand(null)
                          loadCommands() // Reload to revert changes
                        }}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.editButton}
                        onClick={() => setEditingCommand(command.id)}
                        title="Edit command"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => deleteCommand(command.id)}
                        title="Delete command"
                      >
                        <Trash2 size={16} />
                      </button>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={command.enabled}
                          onChange={() => toggleCommand(command.id)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {expandedCommand === command.id && editingCommand === command.id && (
                <div className={styles.commandDetails}>
                  <div className={styles.promptSection}>
                    <label className={styles.label}>Model</label>
                    <select
                      value={command.model}
                      onChange={(e) =>
                        setCommands((prev) =>
                          prev.map((c) =>
                            c.id === command.id ? { ...c, model: e.target.value as any } : c,
                          ),
                        )
                      }
                      className={styles.modelSelect}
                    >
                      <option value="haiku">Haiku (Fast)</option>
                      <option value="sonnet">Sonnet (Balanced)</option>
                      <option value="opus">Opus (Powerful)</option>
                    </select>

                    <label className={styles.label}>Prompt</label>
                    <textarea
                      value={command.prompt || ''}
                      onChange={(e) =>
                        setCommands((prev) =>
                          prev.map((c) =>
                            c.id === command.id ? { ...c, prompt: e.target.value } : c,
                          ),
                        )
                      }
                      className={styles.promptTextarea}
                      rows={6}
                    />
                  </div>
                </div>
              )}

              {expandedCommand === command.id && editingCommand !== command.id && (
                <div className={styles.commandDetails}>
                  <div className={styles.promptSection}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Model:</span>
                      <span className={styles.infoValue}>{command.model}</span>
                    </div>
                    {command.prompt && (
                      <div className={styles.promptPreview}>
                        <span className={styles.infoLabel}>Prompt:</span>
                        <pre className={styles.promptText}>{command.prompt}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {commands.length === 0 && !newCommand && (
          <div className={styles.emptyState}>
            <Terminal size={32} />
            <p>No commands configured</p>
            <p className={styles.hint}>Add commands to extend Claude's capabilities</p>
          </div>
        )}

        {isSaving && <div className={styles.savingIndicator}>Saving...</div>}
      </div>
    </div>
  )
}
