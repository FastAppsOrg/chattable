import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ImageIcon } from 'lucide-react'
import type { ChatMessageProps } from '../../types/chat'
import { getToolIcon } from '../../utils/formatters'
import { useTheme } from '../../hooks/useTheme'

// Helper to render a single tool invocation
function ToolInvocationDisplay({ tool }: { tool: { toolName: string; args: any; state: string; result?: any } }) {
  const toolIcon = getToolIcon(tool.toolName)

  // Special handling for TodoWrite tool
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
      <div className="tool-invocation">
        <div className="tool-icon">{toolIcon}</div>
        <div className="tool-content">
          <div className="tool-name">
            {tool.toolName}
            {tool.state !== 'result' && <span className="tool-state"> (running...)</span>}
          </div>
          <div className="tool-input">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{todoMarkdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    )
  }

  // Extract relevant input information based on tool type
  let inputDisplay = ''
  const args = tool.args
  if (args) {
    if (tool.toolName === 'Bash' && args.command) {
      inputDisplay = args.command
    } else if (typeof args === 'string') {
      inputDisplay = args
    } else if (args.file_path) {
      inputDisplay = args.file_path
    } else if (args.path) {
      inputDisplay = args.path
    } else if (args.pattern) {
      inputDisplay = args.pattern
    } else {
      inputDisplay = JSON.stringify(args, null, 2)
    }
  }

  return (
    <div className="tool-invocation">
      <div className="tool-icon">{toolIcon}</div>
      <div className="tool-content">
        <div className="tool-name">
          {tool.toolName}
          {tool.state !== 'result' && <span className="tool-state"> (running...)</span>}
        </div>
        {inputDisplay && (
          <div className="tool-input">
            {args?.description && (
              <>
                <code>{args.description}</code> <br />
              </>
            )}
            <code>{inputDisplay}</code>
          </div>
        )}
      </div>
    </div>
  )
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
      {/* Reasoning/Thinking section */}
      {message.reasoning && (
        <div className="message-reasoning">
          <div className="reasoning-header">Thinking</div>
          <div className="reasoning-content">{message.reasoning}</div>
        </div>
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
          (!isThinking) && message.content && (
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
})
