import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ImageIcon } from 'lucide-react'
import type { ChatMessageProps } from '../../types/chat'
import { getToolIcon } from '../../utils/formatters'
import { useTheme } from '../../hooks/useTheme'

export const ChatMessage = memo(function ChatMessage({ message, onApplyPrompt, isPending, isThinking }: ChatMessageProps) {
  const { theme } = useTheme()
  if (message.messageType === 'tool_use' && message.toolInfo) {
    const toolIcon = getToolIcon(message.toolInfo.name)
    // console.log('message', message)

    // Special handling for TodoWrite tool
    if (message.toolInfo.name === 'TodoWrite' && message.toolInfo.input?.todos) {
      const todos = message.toolInfo.input.todos
      const todoMarkdown = todos
        .map((todo: any) => {
          const checkbox = todo.status === 'completed' ? '[x]' : '[ ]'
          const text = todo.status === 'in_progress' ? todo.activeForm : todo.content
          const statusEmoji = todo.status === 'in_progress' ? ' 🔄' : ''
          return `- ${checkbox} ${text}${statusEmoji}`
        })
        .join('\n')

      return (
        <div className="message tool">
          <div className="tool-icon">{toolIcon}</div>
          <div className="tool-content">
            <div className="tool-name">{message.toolInfo.name}</div>
            <div className="tool-input">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{todoMarkdown}</ReactMarkdown>
            </div>
          </div>
        </div>
      )
    }

    // Extract relevant input information based on tool type
    let inputDisplay = ''
    if (message.toolInfo.input) {
      if (message.toolInfo.name === 'Bash' && message.toolInfo.input.command) {
        inputDisplay = message.toolInfo.input.command
      } else if (typeof message.toolInfo.input === 'string') {
        inputDisplay = message.toolInfo.input
      } else if (message.toolInfo.input.file_path) {
        inputDisplay = message.toolInfo.input.file_path
      } else if (message.toolInfo.input.path) {
        inputDisplay = message.toolInfo.input.path
      } else if (message.toolInfo.input.pattern) {
        inputDisplay = message.toolInfo.input.pattern
      } else {
        // For other tools, try to display the most relevant field
        inputDisplay = JSON.stringify(message.toolInfo.input, null, 2)
      }
    }

    return (
      <div className="message tool">
        <div className="tool-icon">{toolIcon}</div>
        <div className="tool-content">
          <div className="tool-name">{message.toolInfo.name}</div>
          {inputDisplay && (
            <div className="tool-input">
              {message.toolInfo.input.description && (
                <>
                  <code>{message.toolInfo.input.description}</code> <br />
                </>
              )}
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
      <div className={isThinking ? "message-content typing" : "message-content"}>
        {message.role === 'assistant' ? (
          (!isThinking) && (
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
