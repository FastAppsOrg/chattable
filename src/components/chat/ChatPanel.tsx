import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { ChatPanelProps } from '../../types/chat'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { useProjectContext } from '../../hooks/useProjectContext'
import { SelectedElementsCarousel } from './SelectedElementsCarousel'
import { ImagePlus, X, ArrowUp } from 'lucide-react'
import '../../styles/ChatPanel.css'
import { useToast } from '@/hooks/useToast'
import { apiClient, getAuthToken } from '@/utils/api'
import { API_ENDPOINTS, API_BASE_URL } from '@/constants/api'
import { compressImages, isValidImageFile } from '@/utils/imageCompression'
import type { CompressedImage } from '@/utils/imageCompression'

// assistant-ui imports
import { useAISDKRuntime } from '@assistant-ui/react-ai-sdk'
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  useMessagePartText,
  useMessagePartReasoning,
} from '@assistant-ui/react'

// Custom components for assistant-ui message parts
import { AssistantMessage, UserMessage } from './AssistantUIComponents'

export function ChatPanel({
  projectId,
  selectedElements = [],
  onRemoveElement,
  onClearElements,
  sandboxReady = false,
}: ChatPanelProps) {
  const currentProjectId = projectId

  // Debug: Log projectId on mount and when it changes
  useEffect(() => {
    console.log('[ChatPanel] projectId:', projectId, 'type:', typeof projectId)
  }, [projectId])

  const [inputValue, setInputValue] = useState('')
  const [textareaHeight, setTextareaHeight] = useState(80)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [compressedImagesPreview, setCompressedImagesPreview] = useState<CompressedImage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const heightDebounceTimer = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialPromptProcessedRef = useRef(false)

  const { showToast } = useToast()
  const { syncProjectTitle } = useProjectContext()
  const firstMessageSentRef = useRef(false)

  // Memoize transport to prevent recreation on every render
  // This fixes the excessive fetch requests issue
  const chatTransport = useMemo(() => {
    if (!currentProjectId) return null
    return new DefaultChatTransport({
      api: `${API_BASE_URL}${API_ENDPOINTS.projectChat(currentProjectId)}`,
      headers: async () => {
        const token = getAuthToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    })
  }, [currentProjectId])

  // AI SDK useChat hook with memoized DefaultChatTransport
  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
  } = useChat({
    transport: chatTransport!,
    onResponse: (response) => {
      console.log('[ChatPanel] Stream response:', response.status)
    },
    onStream: ({ delta, snapshot }) => {
      // Debug: Log each streaming event to verify chunks are arriving incrementally
      console.log('[ChatPanel] Stream delta:', delta)
      console.log('[ChatPanel] Stream snapshot parts:', snapshot?.parts?.length, snapshot?.parts?.slice(-1))
    },
    onFinish: (message) => {
      console.log('[ChatPanel] Stream finished:', message.id)
      // Sync project title after first message
      if (!firstMessageSentRef.current && currentProjectId) {
        firstMessageSentRef.current = true
        pollProjectTitle()
      }
    },
    onError: (err) => {
      console.error('[ChatPanel] Stream error:', err)
      showToast(`Error: ${err.message}`, 'error')
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Debug: Monitor message updates during streaming
  useEffect(() => {
    if (status === 'streaming' && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      // Log the actual structure of parts to understand what AI SDK is sending
      console.log('[ChatPanel] Last message parts:', JSON.stringify(lastMsg.parts, null, 2))
      console.log('[ChatPanel] Last message content:', lastMsg.content)
      console.log('[ChatPanel] Full last message:', lastMsg)
    }
  }, [messages, status])

  // Poll for project title generation
  const pollProjectTitle = useCallback(async () => {
    if (!currentProjectId) return

    const poll = async (attempt = 1, maxAttempts = 20) => {
      try {
        const title = await syncProjectTitle(currentProjectId)
        if (title) {
          console.log(`[ChatPanel] Project title synced: "${title}"`)
          return
        }
        if (attempt < maxAttempts) {
          setTimeout(() => poll(attempt + 1, maxAttempts), 1000)
        }
      } catch (error) {
        console.error('[ChatPanel] Failed to sync title:', error)
      }
    }

    setTimeout(() => poll(), 1000)
  }, [currentProjectId, syncProjectTitle])




  // Load chat history on mount
  useEffect(() => {
    let cancelled = false

    const loadHistory = async () => {
      if (!currentProjectId) return

      try {
        const response = await apiClient.get(API_ENDPOINTS.projectChatHistory(currentProjectId))

        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) setHistoryLoaded(true)
            return
          }
          throw new Error(`Failed to load history: ${response.status}`)
        }

        const data = await response.json()

        if (cancelled) return

        // Convert to AI SDK UIMessage format
        const historyMessages: UIMessage[] = (data.messages || [])
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map((msg: any) => ({
            id: msg.message_id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.timestamp),
            parts: [{ type: 'text' as const, text: msg.content }],
          }))

        // Check if there are user messages (to set firstMessageSentRef)
        if (historyMessages.some(m => m.role === 'user')) {
          firstMessageSentRef.current = true
        }

        setMessages(historyMessages)
        setHistoryLoaded(true)
      } catch (err) {
        if (!cancelled) {
          console.error('[ChatPanel] Failed to load history:', err)
          setHistoryLoaded(true)
        }
      }
    }

    loadHistory()

    return () => { cancelled = true }
  }, [currentProjectId, setMessages])

  // Reset textarea height on mount and cleanup debounce timer on unmount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '80px'
      setTextareaHeight(80)
    }

    return () => {
      if (heightDebounceTimer.current) {
        clearTimeout(heightDebounceTimer.current)
      }
    }
  }, [])

  // Memoize image preview URLs to prevent memory leaks
  const imagePreviewUrls = useMemo(() => {
    return selectedImages.map(image => URL.createObjectURL(image))
  }, [selectedImages])

  // Cleanup image URLs on unmount or when images change
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [imagePreviewUrls])

  // Check for initial prompt and send it automatically
  useEffect(() => {
    console.log('[ChatPanel] Initial prompt useEffect triggered:', {
      historyLoaded,
      currentProjectId,
      sandboxReady,
      initialPromptProcessed: initialPromptProcessedRef.current,
      messageCount: messages.length
    })

    // Only run once per project when history is loaded
    if (!historyLoaded || !currentProjectId || initialPromptProcessedRef.current) {
      return
    }

    // Wait for sandbox to be ready
    if (!sandboxReady) {
      console.log('[ChatPanel] ⏳ Waiting for sandbox to be ready')
      return
    }

    // Check if there are any user messages already
    const hasUserMessages = messages.some(msg => msg.role === 'user')
    if (hasUserMessages) {
      firstMessageSentRef.current = true
      return
    }

    const storageKey = `initial_prompt_${currentProjectId}`
    const initialPrompt = sessionStorage.getItem(storageKey)

    if (initialPrompt && initialPrompt.trim()) {
      initialPromptProcessedRef.current = true
      console.log('[ChatPanel] ✅ Sending initial prompt:', initialPrompt.substring(0, 50))

      // Use AI SDK sendMessage
      sendMessage({ text: initialPrompt })

      // Remove from storage after sending
      sessionStorage.removeItem(storageKey)
    }
  }, [historyLoaded, currentProjectId, messages, sandboxReady, sendMessage])

  // Memoize compressed image sizes to avoid repeated calculations
  const compressedImageSizes = useMemo(() => {
    return compressedImagesPreview.map(compressedImg => {
      if (!compressedImg) return 0
      const padding = (compressedImg.data.match(/=/g) || []).length
      return (compressedImg.data.length * 6 - padding * 8) / 8
    })
  }, [compressedImagesPreview])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value

    // Update input value immediately for responsive typing
    setInputValue(value)

    // Debounce height calculation to reduce re-renders
    const textarea = e.target
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 300)
    textarea.style.height = `${newHeight}px`

    // Debounce state update for height (visual change is immediate via DOM)
    if (heightDebounceTimer.current) {
      clearTimeout(heightDebounceTimer.current)
    }
    heightDebounceTimer.current = setTimeout(() => {
      setTextareaHeight(newHeight)
    }, 50)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validImages = files.filter(isValidImageFile)

    if (validImages.length !== files.length) {
      showToast('Some files were not valid images', 'error')
    }

    if (validImages.length === 0) return

    // Compress images immediately to show accurate size
    try {
      const compressed = await compressImages(validImages, {
        maxWidth: 1568,
        maxHeight: 1568,
        quality: 0.85,
        maxSizeMB: 0.5,
      })

      setSelectedImages(prev => [...prev, ...validImages])
      setCompressedImagesPreview(prev => [...prev, ...compressed])

      // Log compression results
      validImages.forEach((file, index) => {
        const compressedSize = compressed[index] ?
          (compressed[index].data.length * 6 - (compressed[index].data.match(/=/g) || []).length * 8) / 8 : 0
        const originalKB = (file.size / 1024).toFixed(1)
        const compressedKB = (compressedSize / 1024).toFixed(1)
        console.log(`🖼️  ${file.name}: ${originalKB} KB → ${compressedKB} KB`)
      })
    } catch (error) {
      showToast('Failed to compress images', 'error')
      console.error('Image compression error:', error)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setCompressedImagesPreview(prev => prev.filter((_, i) => i !== index))
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageFiles: File[] = []

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault() // Prevent default paste behavior when images detected

      // Compress pasted images immediately
      try {
        const compressed = await compressImages(imageFiles, {
          maxWidth: 1568,
          maxHeight: 1568,
          quality: 0.85,
          maxSizeMB: 0.5,
        })

        setSelectedImages(prev => [...prev, ...imageFiles])
        setCompressedImagesPreview(prev => [...prev, ...compressed])

        // Log compression results
        imageFiles.forEach((file, index) => {
          const compressedSize = compressed[index] ?
            (compressed[index].data.length * 6 - (compressed[index].data.match(/=/g) || []).length * 8) / 8 : 0
          const originalKB = (file.size / 1024).toFixed(1)
          const compressedKB = (compressedSize / 1024).toFixed(1)
          console.log(`🖼️  Pasted ${file.name}: ${originalKB} KB → ${compressedKB} KB`)
        })
      } catch (error) {
        showToast('Failed to compress pasted images', 'error')
        console.error('Image compression error:', error)
      }
    }
  }

  const handleSendMessage = () => {
    if ((!inputValue.trim() && selectedImages.length === 0) || isLoading) return

    // Format selected elements context with detailed info
    let messageWithContext = inputValue
    if (selectedElements && selectedElements.length > 0) {
      const elementsContext = selectedElements.map((el, idx) => {
        const parts: string[] = []

        const name = el.react?.componentName || el.tagName?.toLowerCase() || 'element'
        parts.push(`${idx + 1}. <${name}>`)
        parts.push(`   Selector: ${el.selector}`)

        if (el.text) {
          const text = el.text.length > 100 ? `${el.text.substring(0, 100)}...` : el.text
          parts.push(`   Text: "${text}"`)
        }

        if (el.semantic?.role) parts.push(`   Role: ${el.semantic.role}`)
        if (el.semantic?.ariaLabel) parts.push(`   Label: ${el.semantic.ariaLabel}`)
        if (el.attributes?.placeholder) parts.push(`   Placeholder: "${el.attributes.placeholder}"`)
        if (el.attributes?.type) parts.push(`   Type: ${el.attributes.type}`)
        if (el.attributes?.['data-testid']) parts.push(`   TestID: ${el.attributes['data-testid']}`)

        if (el.react?.componentName) {
          parts.push(`   Component: ${el.react.componentName}`)
          if (el.react.source?.fileName) {
            const file = el.react.source.fileName.split('/').pop()
            parts.push(`   Source: ${file}:${el.react.source.lineNumber}`)
          }
        }

        if (el.rect) {
          parts.push(`   Position: (${Math.round(el.rect.x)}, ${Math.round(el.rect.y)}) ${Math.round(el.rect.width)}×${Math.round(el.rect.height)}px`)
        }

        return parts.join('\n')
      }).join('\n\n')

      messageWithContext = `[Visual Contexts - ${selectedElements.length} element${selectedElements.length > 1 ? 's' : ''}]\n${elementsContext}\n\n[User Query]\n${inputValue}`
    }

    // Use AI SDK sendMessage - it handles everything
    sendMessage({ text: messageWithContext })

    // Clear input and reset UI
    setInputValue('')
    setTextareaHeight(80)
    if (inputRef.current) {
      inputRef.current.style.height = '80px'
    }

    // Clear images after sending
    setSelectedImages([])
    setCompressedImagesPreview([])

    // Flush selected elements after sending
    if (selectedElements && selectedElements.length > 0) {
      onClearElements?.()
    }
  }

  const applyTorchSuggestion = useCallback((prompt: string) => {
    setInputValue(prompt)
    inputRef.current?.focus()
  }, [])

  // Create assistant-ui runtime from AI SDK useChat
  const chat = useMemo(() => ({
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
  }), [messages, status, error, sendMessage, setMessages, stop])

  const runtime = useAISDKRuntime(chat)

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="chat-panel">
        <div className="chat-messages">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            {/* Selected Elements Carousel */}
            <SelectedElementsCarousel
              elements={selectedElements}
              onRemove={onRemoveElement || (() => { })}
              onClear={onClearElements || (() => { })}
            />

            {/* Image Preview */}
            {selectedImages.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '8px',
                flexWrap: 'wrap',
                borderBottom: '1px solid var(--border-color)',
              }}>
                {selectedImages.map((image, index) => {
                  const compressedImg = compressedImagesPreview[index]
                  const compressedSize = compressedImageSizes[index] || 0
                  const compressedKB = (compressedSize / 1024).toFixed(1)
                  const originalKB = (image.size / 1024).toFixed(1)
                  const sizeDisplay = compressedImg ? `${compressedKB} KB` : 'Compressing...'

                  return (
                    <div
                      key={index}
                      style={{
                        position: 'relative',
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <img
                        src={imagePreviewUrls[index]}
                        alt={`Attachment ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          background: compressedImg
                            ? (compressedSize > 500 * 1024 ? 'rgba(255, 100, 100, 0.85)' : 'rgba(0, 150, 0, 0.85)')
                            : 'rgba(128, 128, 128, 0.85)',
                          color: 'white',
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}
                        title={compressedImg ? `Original: ${originalKB} KB` : 'Processing...'}
                      >
                        {sizeDisplay}
                      </div>
                      <button
                        onClick={() => handleRemoveImage(index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0, 0, 0, 0.6)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'white',
                          padding: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <textarea
              ref={inputRef}
              className="chat-input"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isLoading
                  ? ''
                  : 'Ask me to help with your code... (@ for files, / for commands, paste images)'
              }
              style={{ height: `${textareaHeight}px` }}
            />

            <div className="chat-input-footer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />

              <div className="input-footer-left"></div>

              <div className="input-footer-right">
                <button
                  type="button"
                  className="action-button image-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title="Attach images"
                >
                  <ImagePlus size={16} />
                  {selectedImages.length > 0 && (
                    <span className="badge">{selectedImages.length}</span>
                  )}
                </button>

                <button
                  className="action-button send-button"
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  )
}
