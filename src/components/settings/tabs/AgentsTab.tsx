import { useState, useEffect } from 'react'
import { Check, Plus, Trash2, ExternalLink } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import { agentsAPI } from '../../../services/api/agents'
import type { Agent } from '../../../services/api/agents'
import styles from './AgentsTab.module.css'

export function AgentsTab() {
  const { user } = useAuth()
  const { showError } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [agentContent, setAgentContent] = useState('')
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadAgents()
    }
  }, [user])

  const loadAgents = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const data = await agentsAPI.list()
      setAgents(data)
    } catch (error) {
      console.error('Failed to load agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseAgentContent = (content: string) => {
    // Parse the .md format:
    // ---
    // name: Agent Name
    // description: Description
    // model: opus
    // ---
    // [prompt content]

    const parts = content.split('---').filter((p) => p.trim())
    if (parts.length < 2) {
      throw new Error('Invalid format. Expected frontmatter with --- delimiters')
    }

    const frontmatter = parts[0].trim()
    const prompt = parts.slice(1).join('---').trim()

    const metadata: any = {}
    frontmatter.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length) {
        metadata[key.trim()] = valueParts.join(':').trim()
      }
    })

    if (!metadata.name) {
      throw new Error('Agent name is required')
    }

    return {
      name: metadata.name,
      description: metadata.description || '',
      model: (metadata.model || 'sonnet') as 'haiku' | 'sonnet' | 'opus',
      prompt,
    }
  }

  const handleAddAgent = async () => {
    if (!user?.id || !agentContent.trim()) return

    try {
      setParsing(true)
      const parsed = parseAgentContent(agentContent)

      // Check if agent with same name exists
      if (agents.some((a) => a.name === parsed.name)) {
        showError(`Agent "${parsed.name}" already exists`)
        return
      }

      const newAgent = await agentsAPI.save({
        name: parsed.name,
        description: parsed.description,
        model: parsed.model,
        prompt: parsed.prompt,
        enabled: true,
      })

      setAgents((prev) => [...prev, newAgent])
      setAgentContent('')
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to add agent:', error)
      showError(error instanceof Error ? error.message : 'Failed to add agent')
    } finally {
      setParsing(false)
    }
  }

  const toggleAgent = async (agent: Agent) => {
    try {
      await agentsAPI.update(agent.id, { enabled: !agent.enabled })
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, enabled: !agent.enabled } : a)),
      )
    } catch (error) {
      console.error('Failed to toggle agent:', error)
    }
  }

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent?')) return

    try {
      await agentsAPI.delete(id)
      setAgents((prev) => prev.filter((a) => a.id !== id))
    } catch (error) {
      console.error('Failed to delete agent:', error)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Agent Commands</h3>
        <p className={styles.description}>
          Add Claude agent commands (.md format) •{' '}
          <a
            href="https://github.com/wshobson/agents"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Browse examples here
          </a>
        </p>
        <p className={styles.description}>Open sourced from @wshobson</p>
      </div>

      <div className={styles.content}>
        {showAddForm ? (
          <div className={styles.editor}>
            <textarea
              className={styles.textarea}
              placeholder={`---
name: agent-name
description: Brief description
model: opus
---

Agent prompt content here...`}
              value={agentContent}
              onChange={(e) => setAgentContent(e.target.value)}
              rows={8}
              autoFocus
            />
            <div className={styles.editorActions}>
              <button
                className={styles.textButton}
                onClick={() => {
                  setShowAddForm(false)
                  setAgentContent('')
                }}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleAddAgent}
                disabled={!agentContent.trim() || parsing}
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.newButton} onClick={() => setShowAddForm(true)}>
            <Plus size={14} />
            New agent
          </button>
        )}

        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.list}>
            {agents.length === 0 ? (
              <div className={styles.empty}>No agents configured</div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className={styles.row}>
                  <div className={styles.rowContent} onClick={() => toggleAgent(agent)}>
                    <input
                      type="checkbox"
                      checked={agent.enabled}
                      onChange={() => {}}
                      className={styles.check}
                    />
                    <span className={styles.name}>{agent.name}</span>
                    <span className={styles.badge}>{agent.model}</span>
                  </div>
                  <button
                    className={styles.remove}
                    onClick={() => deleteAgent(agent.id)}
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className={styles.note}>~/.claude/commands/*.md</div>
    </div>
  )
}
