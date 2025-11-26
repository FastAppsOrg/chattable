/**
 * assistant-ui Custom Components
 *
 * These components integrate with assistant-ui primitives to render
 * messages with our existing styling while leveraging assistant-ui's
 * streaming and state management.
 */
import { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Loader2, Check, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { MessagePrimitive } from '@assistant-ui/react'
import type {
  TextMessagePartProps,
  ReasoningMessagePartProps,
  ToolCallMessagePartProps,
} from '@assistant-ui/react'
import { getToolIcon } from '../../utils/formatters'

// =============================================================================
// Helper: Smart JSON Formatter
// =============================================================================
/**
 * Intelligently formats JSON data for display, handling:
 * - Nested JSON strings (parses and formats them)
 * - Escaped characters (\n, \t, etc.)
 * - Deep nesting
 */
function formatToolData(data: any): string {
  if (data === null || data === undefined) return 'null'
  
  // If it's already a string, check if it's JSON
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // Not JSON, return as-is
      return data
    }
  }

  // Handle objects/arrays - check for nested JSON strings
  const processValue = (value: any): any => {
    if (typeof value === 'string') {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(value)
        // If successful and it's an object/array, return parsed version
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      } catch {
        // Not JSON, return original
      }
    } else if (Array.isArray(value)) {
      return value.map(processValue)
    } else if (typeof value === 'object' && value !== null) {
      const processed: any = {}
      for (const [k, v] of Object.entries(value)) {
        processed[k] = processValue(v)
      }
      return processed
    }
    return value
  }

  try {
    const processed = processValue(data)
    return JSON.stringify(processed, null, 2)
  } catch {
    return String(data)
  }
}

// =============================================================================
// Expandable Section Component
// =============================================================================
const ExpandableSection = memo(function ExpandableSection({
  title,
  content,
  variant = 'default',
  defaultExpanded = true
}: {
  title: string
  content: string
  variant?: 'input' | 'output' | 'default'
  defaultExpanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { theme } = useTheme()

  if (!content) return null

  const variantClass = variant === 'input' ? 'input' : variant === 'output' ? 'output' : ''

  return (
    <div className={`tool-expandable-section ${variantClass}`}>
      <button
        className="tool-expandable-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="tool-expandable-title">{title}</span>
        {!isExpanded && (
          <span className="tool-expandable-preview">
            {content.substring(0, 50)}{content.length > 50 ? '...' : ''}
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="tool-expandable-content">
          <SyntaxHighlighter
            language="json"
            style={theme === 'light' ? oneLight : vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '12px',
              background: 'transparent',
              fontSize: '13px',
              lineHeight: '1.5',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'var(--font-mono)',
              }
            }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Reasoning Component - Shows AI thinking process with auto-collapse
// =============================================================================
export const ReasoningPart = memo(function ReasoningPart(props: ReasoningMessagePartProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const status = props.status
  const isStreaming = status.type === 'running'
  
  // Extract reasoning from props - assistant-ui may structure this differently
  const reasoning = (props as any).reasoning || (props as any).part?.reasoning || ''

  if (!reasoning && !isStreaming) return null

  return (
    <div className={`message-reasoning ${isStreaming ? 'streaming' : ''}`}>
      <button
        className="reasoning-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="reasoning-icon">
          {isStreaming ? <Loader2 className="reasoning-spinner" size={14} /> : <Brain size={14} />}
        </span>
        <span>{isStreaming ? 'Thinking...' : 'Thought process'}</span>
        {reasoning && (
          <span className="reasoning-toggle">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </button>
      {reasoning && (
        <div className={`reasoning-content ${isExpanded ? 'expanded' : ''}`}>
          {reasoning}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Text Part - Renders markdown content with syntax highlighting
// =============================================================================
export const TextPart = memo(function TextPart({ text, status }: TextMessagePartProps) {
  const { theme } = useTheme()
  const isStreaming = status.type === 'running'

  if (!text) return null

  return (
    <div className={isStreaming ? "message-content typing" : "message-content"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={theme === 'light' ? oneLight : vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

// =============================================================================
// Tool Invocation Part - Shows tool calls with expandable details
// =============================================================================
export const ToolPart = memo(function ToolPart({
  toolName,
  args,
  result,
  status,
}: ToolCallMessagePartProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const toolIcon = getToolIcon(toolName)
  const isRunning = status.type === 'running' || status.type === 'incomplete'

  // Get summary for tool header
  const getSummary = () => {
    if (!args) return ''
    switch (toolName) {
      case 'Bash':
        return args.command?.substring(0, 60) + (args.command?.length > 60 ? '...' : '') || ''
      case 'Read':
      case 'Write':
      case 'Edit':
        return args.file_path?.split('/').pop() || args.file_path || ''
      case 'Grep':
        return `"${args.pattern}" ${args.path ? `in ${args.path.split('/').pop()}` : ''}`
      case 'Glob':
        return args.pattern || ''
      default:
        return args.description || ''
    }
  }

  // Special handling for TodoWrite
  if (toolName === 'TodoWrite' && args?.todos) {
    const todoMarkdown = args.todos
      .map((todo: any) => {
        const checkbox = todo.status === 'completed' ? '[x]' : '[ ]'
        const text = todo.status === 'in_progress' ? todo.activeForm : todo.content
        const statusEmoji = todo.status === 'in_progress' ? ' ...' : ''
        return `- ${checkbox} ${text}${statusEmoji}`
      })
      .join('\n')

    return (
      <div className={`tool-invocation ${isRunning ? 'running' : 'completed'}`}>
        <div className="tool-main-header">
          <span className="tool-icon">{toolIcon}</span>
          <span className="tool-name">{toolName}</span>
          {isRunning && <Loader2 className="tool-spinner" size={12} />}
          {!isRunning && <Check className="tool-check" size={12} />}
        </div>
        <div className="tool-body">
          <div className="tool-todo-list">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{todoMarkdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    )
  }

  const summary = getSummary()
  const inputFormatted = args ? formatToolData(args) : null
  const outputFormatted = result ? formatToolData(result) : null

  return (
    <div className={`tool-invocation ${isRunning ? 'running' : 'completed'} ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="tool-main-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="tool-icon">{toolIcon}</span>
        <span className="tool-name">{toolName}</span>
        {summary && <span className="tool-summary">{summary}</span>}
        <span className="tool-header-right">
          {isRunning && <Loader2 className="tool-spinner" size={12} />}
          {!isRunning && <Check className="tool-check" size={12} />}
          <span className="tool-expand-icon">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="tool-body">
          {inputFormatted && (
            <ExpandableSection
              title="Input"
              content={inputFormatted}
              variant="input"
              defaultExpanded={true}
            />
          )}
          {outputFormatted && (
            <ExpandableSection
              title="Output"
              content={outputFormatted}
              variant="output"
              defaultExpanded={true}
            />
          )}
          {isRunning && (
            <div className="tool-running-indicator">
              <Loader2 className="tool-spinner" size={14} />
              <span>Running...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Assistant Message - Combines reasoning, tools, and text
// =============================================================================
export const AssistantMessage = memo(function AssistantMessage() {
  return (
    <div className="message assistant">
      <MessagePrimitive.Parts
        components={{
          Reasoning: ReasoningPart,
          Text: TextPart,
          tools: {
            Fallback: ToolPart,
          },
        }}
      />
    </div>
  )
})

// =============================================================================
// User Message - Simple text display
// =============================================================================
const UserTextPart = memo(function UserTextPart({ text }: TextMessagePartProps) {
  return <div className="message-content">{text}</div>
})

export const UserMessage = memo(function UserMessage() {
  return (
    <div className="message user">
      <MessagePrimitive.Parts
        components={{
          Text: UserTextPart,
        }}
      />
    </div>
  )
})
