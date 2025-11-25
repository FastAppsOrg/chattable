/**
 * Chat session metadata
 * Matches backend SessionMetadata structure
 */
export interface ChatSession {
  session_id: string
  project_id?: string  // New: sessions belong to projects
  created_at: string
  updated_at?: string
  claude_session_id?: string
  active: boolean
}

export interface ToolInvocation {
  toolName: string
  args: any
  state: 'partial-call' | 'call' | 'result'
  result?: any
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool' | 'torch' | 'meta_agent'
  content: string
  timestamp: string
  messageType?: 'chat' | 'tool_use' | 'system'
  // AI SDK v5 style tool invocations (array of tools in one message)
  toolInfo?: ToolInvocation[]
  // Reasoning/thinking content from AI
  reasoning?: string
  // Legacy single tool info (for backward compatibility)
  legacyToolInfo?: {
    name: string
    summary: string
    input?: any
  }
  torchEvaluation?: {
    score: number
    risks: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical'
      category: string
      description: string
      location?: string
    }>
    suggestions: string[]
    next_prompt: string
    summary: string
    commit_sha?: string
  }
  metadata?: {
    pending?: boolean
    has_images?: boolean
    image_count?: number
    agent?: 'claude' | 'torch'
  }
  isReplay?: boolean // Indicates if this message is replayed from history during reconnection
}

export interface ChatPanelProps {
  projectId?: string
  projectName?: string
  onBack?: () => void
  connected?: boolean
  externalInput?: string
  onExternalInputConsumed?: () => void
  selectedElements?: any[]
  onRemoveElement?: (index: number) => void
  onClearElements?: () => void
  sandboxReady?: boolean
}

export interface FileItem {
  name: string
  path: string
  is_directory: boolean
  level?: number
  children?: FileItem[]
}

export interface CommandItem {
  name: string
  description: string
  custom?: boolean
}

export interface TorchEvaluationProps {
  evaluation: ChatMessage['torchEvaluation']
  onApplyPrompt: (prompt: string) => void
}

export interface ChatMessageProps {
  message: ChatMessage
  onApplyPrompt: (prompt: string) => void
  isPending?: boolean
  isThinking?: boolean
}

export interface AutocompleteDropdownProps {
  show: boolean
  type: 'files' | 'commands' | null
  items: (FileItem | CommandItem)[]
  selectedIndex: number
  onSelect: (item: FileItem | CommandItem) => void
  onMouseEnter: (index: number) => void
}
