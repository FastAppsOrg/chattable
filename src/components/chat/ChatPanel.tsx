import { useEffect, useRef, useState } from 'react'
import type { ChatPanelProps } from '../../types/chat'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ChatMessage } from './ChatMessage'
import { ArrowUp } from 'lucide-react'
import '../../styles/ChatPanel.css'
import { useProjectContext } from '../../hooks/useProjectContext'

export function ChatPanel({
  projectId,
  sandboxReady = false,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const firstMessageSentRef = useRef(false)
  const { syncProjectTitle } = useProjectContext()
  const [input, setInput] = useState('')

  // Debug: Log projectId on mount and when it changes
  useEffect(() => {
    console.log('[ChatPanel] projectId:', projectId, 'type:', typeof projectId)
  }, [projectId])

  //Use AI SDK's useChat hook (@ai-sdk/react v2 API)
  const {
    messages,
    sendMessage,
    status,
    error,
  } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/projects/${projectId}/chat`,
    }),
    onFinish: async (message) => {
      console.log('[ChatPanel] Message finished:', message)

      // Sync project title after first message
      if (!firstMessageSentRef.current && projectId) {
        firstMessageSentRef.current = true
        console.log('[ChatPanel] First message sent, polling for project title...')

        // Poll for title generation (Mastra generates title asynchronously)
        const pollTitle = async (attempt = 1, maxAttempts = 20) => {
          try {
            const title = await syncProjectTitle(projectId)
            if (title) {
              console.log(`[ChatPanel] Project title synced successfully after ${attempt} attempts: "${title}"`)
              return
            }

            // Title not generated yet, retry
            if (attempt < maxAttempts) {
              console.log(`[ChatPanel] Title not ready, retrying (${attempt}/${maxAttempts})...`)
              setTimeout(() => pollTitle(attempt + 1, maxAttempts), 1000)
            } else {
              console.warn('[ChatPanel] Title generation timeout after 20s')
            }
          } catch (error) {
            console.error('[ChatPanel] Failed to sync project title:', error)
          }
        }

        // Start polling after a brief delay
        setTimeout(() => pollTitle(), 1000)
      }
    },
    onError: (error) => {
      console.error('[ChatPanel] Chat error:', error)
    },
  })

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check for initial prompt and send it automatically
  useEffect(() => {
    console.log('[ChatPanel] Initial prompt useEffect triggered:', {
      projectId,
      sandboxReady,
      messageCount: messages.length
    })

    // Only run once per project when sandbox is ready
    if (!projectId || !sandboxReady) {
      console.log('[ChatPanel] Waiting for sandbox to be ready')
      return
    }

    // Check if there are any user messages already
    const hasUserMessages = messages.some(msg => msg.role === 'user')
    if (hasUserMessages) {
      firstMessageSentRef.current = true
      console.log('[ChatPanel] User messages already exist, skipping initial prompt')
      return
    }

    const storageKey = `initial_prompt_${projectId}`
    const initialPrompt = sessionStorage.getItem(storageKey)

    console.log('[ChatPanel] Checking initial prompt:', {
      hasPrompt: !!initialPrompt,
      promptLength: initialPrompt?.length,
      hasUserMessages
    })

    if (initialPrompt && initialPrompt.trim()) {
      console.log('[ChatPanel] ✅ Sandbox ready, sending initial prompt:', initialPrompt.substring(0, 50))

      // Remove from storage
      sessionStorage.removeItem(storageKey)

      // Send using sendMessage API
      setTimeout(() => {
        sendMessage({ text: initialPrompt })
      }, 100)
    }
  }, [projectId, sandboxReady, messages, sendMessage])

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg) => {
          // Extract text from message parts (UIMessage structure)
          const textContent = msg.parts
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('');

          return (
            <ChatMessage
              key={msg.id}
              message={{
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: textContent, // Extract from parts array
                timestamp: new Date().toISOString(),
                messageType: 'chat',
              }}
              isThinking={status === 'streaming' && msg.id === messages[messages.length - 1]?.id}
            />
          );
        })}

        {error && (
          <div className="error-message">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (input.trim()) {
              sendMessage({ text: input })
              setInput('')
            }
          }}
          className="chat-input-form"
        >
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (input.trim()) {
                    sendMessage({ text: input })
                    setInput('')
                  }
                }
              }}
              placeholder={
                status === 'streaming'
                  ? 'Agent is responding...'
                  : 'Ask me to help with your code...'
              }
              disabled={status === 'streaming'}
              rows={3}
            />

            <div className="chat-input-footer">
              <div className="input-footer-left"></div>

              <div className="input-footer-right">
                <button
                  type="submit"
                  className="action-button send-button"
                  disabled={status === 'streaming' || !input || !input.trim()}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
