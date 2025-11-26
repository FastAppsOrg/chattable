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
