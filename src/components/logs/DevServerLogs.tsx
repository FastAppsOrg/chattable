import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { API_BASE_URL } from '../../constants/api'
import '../../styles/DevServerLogs.css'

interface DevServerLogsProps {
  projectId: string
}

export function DevServerLogs({ projectId }: DevServerLogsProps) {
  const [logs, setLogs] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const { getAccessToken } = useAuth()

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Polling for log updates
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = await getAccessToken()
        if (!token) {
          console.error('No auth token available')
          return
        }

        const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/logs/dev-server`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        const data = await response.json()

        if (data.exists && data.logs) {
          setLogs(data.logs)
        } else if (data.message) {
          setLogs([data.message])
        } else if (data.error) {
          setLogs([`❌ Error: ${data.error}`])
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      }
    }

    // Initial fetch
    fetchLogs()

    // Poll every 5 seconds
    const interval = setInterval(fetchLogs, 5000)

    return () => clearInterval(interval)
  }, [projectId, getAccessToken])

  return (
    <div className="dev-server-logs">
      <div className="logs-header">
        <div className="logs-title">
          Dev Server Logs
        </div>
      </div>

      <div className="logs-content">
        {logs.length === 0 ? (
          <div className="logs-empty">
            <p>Waiting for dev server logs...</p>
            <p className="logs-hint">Logs from /tmp/dev-server.log will appear here</p>
          </div>
        ) : (
          <div className="logs-lines">
            {logs.map((line, index) => (
              <div key={index} className="log-line">
                <span className="log-index">{index + 1}</span>
                <span className="log-content">{line}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
