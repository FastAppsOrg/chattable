// Helper function to get tool icon based on tool name
export function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✍️',
    Edit: '✏️',
    MultiEdit: '📝',
    Bash: '💻',
    Grep: '🔍',
    Glob: '📁',
    LS: '📋',
    WebFetch: '🌐',
    WebSearch: '🔎',
    TodoWrite: '✅',
    NotebookEdit: '📓',
    ExitPlanMode: '🎯',
    Task: '🤖',
  }
  return icons[toolName] || '🔧'
}

// Helper function to get severity color for torch evaluation risks
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#ff4444'
    case 'high':
      return '#ff8800'
    case 'medium':
      return '#ffbb33'
    case 'low':
      return '#00C851'
    default:
      return '#666'
  }
}
