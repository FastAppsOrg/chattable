import { useState, useEffect, useCallback } from 'react'
import { Server, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { mcpAPI } from '../../../services/api/mcp'
import styles from './MCPServersTab.module.css'

interface MCPServer {
  id: string
  name: string
  description: string
  logo: string
  command: string
  args: string[]
  transportType?: 'stdio' | 'sse'
  sseUrl?: string
  apiKey?: string
  enabled: boolean
}

const PRESET_SERVERS: MCPServer[] = [
  {
    id: 'context7-mcp',
    name: 'Context7',
    description: 'Up-to-date documentation for any library',
    logo: 'https://upstash.com/icons/upstash-dark.svg',
    command: 'npx',
    args: ['-y', '@smithery/cli@latest', 'run', '@upstash/context7-mcp', '--key'],
    apiKey: '',
    enabled: false,
  },
  {
    id: 'linear-server',
    name: 'Linear',
    description: 'Issue tracking and project management',
    logo: 'https://linear.app/favicon.svg',
    transportType: 'sse',
    sseUrl: 'https://mcp.linear.app/sse',
    command: 'claude',
    args: ['mcp', 'add', '--transport', 'sse', 'linear-server'],
    apiKey: '',
    enabled: false,
  },
]

interface MCPServersTabProps {
  userId?: string
}

export function MCPServersTab({ userId }: MCPServersTabProps) {
  const [servers, setServers] = useState<MCPServer[]>(PRESET_SERVERS)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (userId) {
      loadServerConfig()
    }
  }, [userId])

  const loadServerConfig = async () => {
    try {
      const config = await mcpAPI.getConfig()
      if (config && config.mcpServers) {
        setServers((prev) =>
          prev.map((server) => {
            const savedConfig = config.mcpServers[server.id]
            if (savedConfig) {
              return {
                ...server,
                enabled: true,
                apiKey: savedConfig.apiKey || '',
              }
            }
            return server
          }),
        )
      }
    } catch (err) {
      console.error('Failed to load MCP config:', err)
    }
  }

  const saveConfiguration = useCallback(
    async (serversToSave?: MCPServer[]) => {
      const serversData = serversToSave || servers
      setIsSaving(true)
      try {
        const enabledServers = serversData.filter((s) => s.enabled)
        const mcpServers: Record<string, any> = {}

        enabledServers.forEach((server) => {
          if (server.id === 'context7-mcp') {
            // Context7 uses stdio transport with API key
            mcpServers[server.id] = {
              command: server.command,
              args: server.args,
              apiKey: server.apiKey, // Save API key separately for persistence
            }
          } else if (server.id === 'linear-server') {
            // Linear uses SSE transport, no API key needed
            mcpServers[server.id] = {
              transport: {
                type: 'sse',
                url: server.sseUrl,
              },
            }
          }
        })

        await mcpAPI.updateConfig({ mcpServers })
      } catch (err) {
        console.error('Failed to save MCP config:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [servers],
  )

  const toggleServer = useCallback(
    async (serverId: string) => {
      const updatedServers = servers.map((server) =>
        server.id === serverId ? { ...server, enabled: !server.enabled } : server,
      )
      setServers(updatedServers)

      // Auto-save configuration
      await saveConfiguration(updatedServers)
    },
    [servers, saveConfiguration],
  )

  const updateServerApiKey = useCallback(
    (serverId: string, apiKey: string) => {
      const updatedServers = servers.map((server) =>
        server.id === serverId ? { ...server, apiKey } : server,
      )
      setServers(updatedServers)

      // Auto-save when API key changes (with debounce)
      if (apiKey) {
        clearTimeout((window as any).mcpSaveTimeout)
        ;(window as any).mcpSaveTimeout = setTimeout(() => {
          saveConfiguration(updatedServers)
        }, 1000)
      }
    },
    [servers, saveConfiguration],
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>MCP Servers</h3>
        <p className={styles.description}>
          Model Context Protocol servers extend Claude with external tools and data sources
        </p>
      </div>

      <div className={styles.content}>
        <div className={styles.serversList}>
          {servers.map((server) => (
            <div
              key={server.id}
              className={`${styles.serverItem} ${server.enabled ? styles.enabled : ''}`}
            >
              <div className={styles.serverHeader}>
                <button
                  className={styles.expandButton}
                  onClick={() =>
                    setExpandedServer((prev) => (prev === server.id ? null : server.id))
                  }
                >
                  {expandedServer === server.id ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
                <img
                  src={server.logo}
                  alt={`${server.name} logo`}
                  className={styles.serverLogo}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove(styles.hidden)
                  }}
                />
                <Server size={32} className={`${styles.serverIcon} ${styles.hidden}`} />
                <div className={styles.serverInfo}>
                  <span className={styles.serverName}>{server.name}</span>
                  <span className={styles.serverDescription}>{server.description}</span>
                </div>
                <div className={styles.serverControls}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={() => toggleServer(server.id)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>

              {expandedServer === server.id && server.enabled && (
                <div className={styles.serverDetails}>
                  {server.id === 'context7-mcp' ? (
                    <div className={styles.envSection}>
                      <div className={styles.envHeader}>
                        <span>Configuration</span>
                      </div>
                      <div className={styles.envList}>
                        <div className={styles.envItem}>
                          <label className={styles.envLabel}>
                            Context7 API Key
                            <span className={styles.envHint}> - Get from Context7 dashboard</span>
                          </label>
                          <input
                            type="password"
                            value={server.apiKey || ''}
                            onChange={(e) => updateServerApiKey(server.id, e.target.value)}
                            placeholder="ab4b29ca-a699-4ec0-b95c-..."
                            className={styles.envInput}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.envSection}>
                      <div className={styles.envHeader}>
                        <span>Configuration</span>
                      </div>
                      <div className={styles.envList}>
                        <div className={styles.envItem}>
                          <p className={styles.configInfo}>
                            Linear MCP uses SSE transport and connects directly to Linear's servers.
                            No API key configuration needed - authentication is handled through your
                            Linear account.
                          </p>
                          <p className={styles.configInfo}>
                            <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                              Endpoint:
                            </span>{' '}
                            {server.sseUrl}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {servers.length === 0 && (
          <div className={styles.emptyState}>
            <Server size={32} />
            <p>No MCP servers configured</p>
            <p className={styles.hint}>Add servers to extend Claude's capabilities</p>
          </div>
        )}

        {isSaving && <div className={styles.savingIndicator}>Saving...</div>}
      </div>
    </div>
  )
}
