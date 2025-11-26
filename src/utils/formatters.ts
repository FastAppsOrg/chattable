import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator'

// Generate random project names using unique-names-generator
export function generateProjectName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: '-',
    length: 3,
  })
}

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
