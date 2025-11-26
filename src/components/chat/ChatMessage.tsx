import { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Loader2, Check, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import type { ChatMessageProps } from '../../types/chat'
import { getToolIcon } from '../../utils/formatters'
import { useTheme } from '../../hooks/useTheme'

// Helper to format JSON with syntax highlighting hints
function formatJsonDisplay(data: any): string {
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

// Get a brief summary for tool header
function getToolSummary(toolName: string, args: any): string {
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
    case 'WebFetch':
    case 'WebSearch':
      return args.url || args.query || ''
    case 'TodoWrite': {
      const count = args.todos?.length || 0
      return `${count} task${count !== 1 ? 's' : ''}`
    }
    default:
      if (args.description) return args.description
      return ''
  }
}

// Expandable section component (accordion style)
function ExpandableSection({
  title,
  content,
  defaultExpanded = false,
  variant = 'default'
}: {
  title: string
  content: string
  defaultExpanded?: boolean
  variant?: 'input' | 'output' | 'default'
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
}

// Helper to render a single tool invocation
function ToolInvocationDisplay({ tool }: { tool: { toolName: string; args: any; state: string; result?: any } }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const toolIcon = getToolIcon(tool.toolName)
  const isRunning = tool.state !== 'result'
  const hasResult = tool.state === 'result' && tool.result !== undefined
  const summary = getToolSummary(tool.toolName, tool.args)

  // Special handling for TodoWrite tool - always show expanded
  if (tool.toolName === 'TodoWrite' && tool.args?.todos) {
    const todos = tool.args.todos
    const todoMarkdown = todos
      .map((todo: any) => {
        const checkbox = todo.status === 'completed' ? '[x]' : '[ ]'
        const text = todo.status === 'in_progress' ? todo.activeForm : todo.content
        const statusEmoji = todo.status === 'in_progress' ? ' 🔄' : ''
        return `- ${checkbox} ${text}${statusEmoji}`
      })
      .join('\n')

    return (
      <div className={`tool-invocation ${isRunning ? 'running' : 'completed'}`}>
        <div className="tool-main-header">
          <span className="tool-icon">{toolIcon}</span>
          <span className="tool-name">{tool.toolName}</span>
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

  // Format input and output
  const inputFormatted = tool.args ? formatJsonDisplay(tool.args) : null
  const outputFormatted = hasResult ? formatJsonDisplay(tool.result) : null

  return (
    <div className={`tool-invocation ${isRunning ? 'running' : 'completed'} ${isExpanded ? 'expanded' : ''}`}>
      {/* Main clickable header */}
      <button
        className="tool-main-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="tool-icon">{toolIcon}</span>
        <span className="tool-name">{tool.toolName}</span>
        {summary && <span className="tool-summary">{summary}</span>}
        <span className="tool-header-right">
          {isRunning && <Loader2 className="tool-spinner" size={12} />}
          {!isRunning && <Check className="tool-check" size={12} />}
          <span className="tool-expand-icon">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </span>
      </button>

      {/* Expandable body with input/output */}
      {isExpanded && (
        <div className="tool-body">
          {inputFormatted && (
            <ExpandableSection
              title="Input"
              content={inputFormatted}
              defaultExpanded={true}
              variant="input"
            />
          )}
          {hasResult && outputFormatted && (
            <ExpandableSection
              title="Output"
              content={outputFormatted}
              defaultExpanded={true}
              variant="output"
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
}

// Collapsible thinking section component - unified accordion with status caption
function ThinkingSection({
  content,
  isStreaming = false,
  statusCaption
}: {
  content: string;
  isStreaming?: boolean;
  statusCaption?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasContent = content && content.length > 0
  const isLong = content.length > 300
  const displayContent = isLong && !isExpanded
    ? content.substring(0, 300) + '...'
    : content

  return (
    <div className={`message-reasoning ${isStreaming ? 'streaming' : ''}`}>
      <button
        className="reasoning-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="reasoning-icon">
          {isStreaming ? <Loader2 className="reasoning-spinner" size={14} /> : '💭'}
        </span>
        <span>Thinking</span>
        {hasContent && (
          <span className="reasoning-toggle">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </button>
      {hasContent && (
        <div className={`reasoning-content ${isExpanded ? 'expanded' : ''}`}>
          {displayContent}
        </div>
      )}
      {isLong && !isExpanded && !isStreaming && (
        <button
          className="reasoning-expand-btn"
          onClick={() => setIsExpanded(true)}
        >
          Show more
        </button>
      )}
      {/* Minimal status caption below accordion */}
      {isStreaming && statusCaption && (
        <div className="reasoning-status-caption">{statusCaption}</div>
      )}
    </div>
  )
}

// Helper to get status caption based on current activity
function getStatusCaption(toolInfo?: { toolName: string; state: string }[]): string {
  if (!toolInfo || toolInfo.length === 0) return 'Processing...'

  const runningTool = toolInfo.find(t => t.state !== 'result')
  if (runningTool) {
    const toolName = runningTool.toolName
    switch (toolName) {
      case 'Read': return 'Reading file...'
      case 'Write': return 'Writing file...'
      case 'Edit': return 'Editing file...'
      case 'Bash': return 'Running command...'
      case 'Grep': return 'Searching...'
      case 'Glob': return 'Finding files...'
      case 'WebFetch': return 'Fetching web content...'
      case 'WebSearch': return 'Searching web...'
      case 'TodoWrite': return 'Updating tasks...'
      default: return `Running ${toolName}...`
    }
  }
  return 'Processing...'
}

export const ChatMessage = memo(function ChatMessage({ message, onApplyPrompt, isPending, isThinking }: ChatMessageProps) {
  const { theme } = useTheme()

  // Legacy single tool_use message type (backward compatibility)
  if (message.messageType === 'tool_use' && message.legacyToolInfo) {
    const toolIcon = getToolIcon(message.legacyToolInfo.name)

    let inputDisplay = ''
    if (message.legacyToolInfo.input) {
      if (message.legacyToolInfo.name === 'Bash' && message.legacyToolInfo.input.command) {
        inputDisplay = message.legacyToolInfo.input.command
      } else if (typeof message.legacyToolInfo.input === 'string') {
        inputDisplay = message.legacyToolInfo.input
      } else if (message.legacyToolInfo.input.file_path) {
        inputDisplay = message.legacyToolInfo.input.file_path
      } else {
        inputDisplay = JSON.stringify(message.legacyToolInfo.input, null, 2)
      }
    }

    return (
      <div className="message tool">
        <div className="tool-icon">{toolIcon}</div>
        <div className="tool-content">
          <div className="tool-name">{message.legacyToolInfo.name}</div>
          {inputDisplay && (
            <div className="tool-input">
              <code>{inputDisplay}</code>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (message.role === 'system') {
    return (
      <div className="message system">
        <div className="system-message">{message.content}</div>
      </div>
    )
  }

  // Handle meta_agent/torch messages with special purple styling
  if (message.role === 'meta_agent' || message.role === 'torch') {
    return (
      <div className="message meta_agent">
        <div className="message-content">
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
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  // Determine the actual agent type for assistant messages
  const isAssistantTorch = message.role === 'assistant' && message.metadata?.agent === 'torch'
  const messageClass = isAssistantTorch ? 'message torch-assistant' : `message ${message.role}`

  return (
    <div className={messageClass} style={{ opacity: isPending ? 0.5 : 1 }}>
      {/* Reasoning/Thinking section - unified accordion with status caption */}
      {(message.reasoning || isThinking) && (
        <ThinkingSection
          content={message.reasoning || ''}
          isStreaming={isThinking}
          statusCaption={isThinking ? getStatusCaption(message.toolInfo) : undefined}
        />
      )}

      {/* Tool invocations */}
      {message.toolInfo && message.toolInfo.length > 0 && (
        <div className="message-tools">
          {message.toolInfo.map((tool, index) => (
            <ToolInvocationDisplay key={`${tool.toolName}-${index}`} tool={tool} />
          ))}
        </div>
      )}

      {/* Main message content */}
      <div className={isThinking ? "message-content typing" : "message-content"}>
        {message.role === 'assistant' ? (
          message.content && (
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
              {message.content}
            </ReactMarkdown>
          )
        ) : (
          // For user messages: show content and/or image placeholders
          <>
            {message.role === 'user' && message.metadata?.has_images && (
              <div style={{ marginBottom: message.content ? '8px' : '0' }}>
                {Array.from({ length: message.metadata.image_count || 1 }, (_, i) =>
                  `[Image#${i + 1}]`
                ).join(' ')}
              </div>
            )}
            {message.content}
          </>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for memo - ensure re-render when content changes during streaming
  if (prevProps.isThinking !== nextProps.isThinking) return false
  if (prevProps.isPending !== nextProps.isPending) return false
  if (prevProps.message.content !== nextProps.message.content) return false
  if (prevProps.message.reasoning !== nextProps.message.reasoning) return false
  if (prevProps.message.id !== nextProps.message.id) return false
  // Compare toolInfo length and states
  const prevTools = prevProps.message.toolInfo
  const nextTools = nextProps.message.toolInfo
  if (prevTools?.length !== nextTools?.length) return false
  if (prevTools && nextTools) {
    for (let i = 0; i < prevTools.length; i++) {
      if (prevTools[i].state !== nextTools[i].state) return false
    }
  }
  return true
})
