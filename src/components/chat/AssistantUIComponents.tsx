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
// Reasoning Component - Shows AI thinking process with auto-collapse
// =============================================================================
export const ReasoningPart = memo(function ReasoningPart({
  reasoning,
  status,
}: ReasoningMessagePartProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isStreaming = status === 'streaming'

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
  const isStreaming = status === 'streaming'

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
  const isRunning = status === 'streaming' || status === 'requires-action'

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
  const inputFormatted = args ? JSON.stringify(args, null, 2) : null
  const outputFormatted = result ? JSON.stringify(result, null, 2) : null

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
            <div className="tool-expandable-section input">
              <div className="tool-expandable-title">Input</div>
              <div className="tool-expandable-content">
                <pre><code>{inputFormatted}</code></pre>
              </div>
            </div>
          )}
          {outputFormatted && (
            <div className="tool-expandable-section output">
              <div className="tool-expandable-title">Output</div>
              <div className="tool-expandable-content">
                <pre><code>{outputFormatted}</code></pre>
              </div>
            </div>
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
