import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { ChatPanelProps } from '../../types/chat'
import { useChat } from '../../hooks/useChat'
import { useProjectContext } from '../../hooks/useProjectContext'
import type { ChatMessage as ChatMessageType } from '../../types/chat'
import { ChatMessage } from './ChatMessage'
import { SelectedElementsCarousel } from './SelectedElementsCarousel'
import { ArrowLeft, Settings, Key, FolderOpen, LogOut, ImagePlus, X, ArrowUp, SendHorizontal } from 'lucide-react'
import '../../styles/ChatPanel.css'
import { useToast } from '@/hooks/useToast'
import { apiClient } from '@/utils/api'
import { API_ENDPOINTS } from '@/constants/api'
import { compressImages, isValidImageFile } from '@/utils/imageCompression'
import type { CompressedImage } from '@/utils/imageCompression'

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
  const [input, setInput] = useState('')
  const [textareaHeight, setTextareaHeight] = useState(80)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [compressedImagesPreview, setCompressedImagesPreview] = useState<CompressedImage[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const heightDebounceTimer = useRef<NodeJS.Timeout | null>(null)
  const isSendingRef = useRef(false)
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null)
  const initialPromptProcessedRef = useRef(false)

  // No longer need to handle externalInput - elements shown in carousel only

  const { showToast } = useToast()
  const { syncProjectTitle } = useProjectContext()
  const firstMessageSentRef = useRef(false)
  const {
    messages,
    loading,
    historyLoaded,
    messagesEndRef,
    addMessage,
    removeMessage,
    setLoading,
    // setError - not used in this implementation
  } = useChat(currentProjectId!)




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
      console.log('[ChatPanel] Early return - conditions not met')
      return
    }

    // CRITICAL: Wait for sandbox to be ready before sending
    if (!sandboxReady) {
      console.log('[ChatPanel] ⏳ Waiting for sandbox to be ready before sending initial prompt')
      return
    }

    // Check if there are any user messages already (not just assistant welcome message)
    const hasUserMessages = messages.some(msg => msg.role === 'user')
    if (hasUserMessages) {
      // Mark that first message was already sent (from history)
      firstMessageSentRef.current = true
      console.log('[ChatPanel] User messages already exist, skipping initial prompt')
    }

    const storageKey = `initial_prompt_${currentProjectId}`
    const initialPrompt = sessionStorage.getItem(storageKey)

    console.log('[ChatPanel] Checking initial prompt:', {
      hasPrompt: !!initialPrompt,
      promptLength: initialPrompt?.length,
      hasUserMessages
    })

    if (initialPrompt && initialPrompt.trim()) {
      if (hasUserMessages) {
        return
      }

      // Mark as processed to prevent re-runs (StrictMode protection)
      initialPromptProcessedRef.current = true

      // DON'T remove from storage yet - will be removed after successful send
      // This prevents StrictMode double-mount from losing the prompt

      console.log('[ChatPanel] ✅ Sandbox ready, sending initial prompt:', initialPrompt.substring(0, 50))
      // Process initial prompt immediately
      sendInitialPrompt(initialPrompt, storageKey)
    }

    // Cleanup: Reset sending ref on unmount to handle React StrictMode
    return () => {
      isSendingRef.current = false
    }
  }, [historyLoaded, currentProjectId, messages, sandboxReady])

  // Send initial prompt - bypasses input state and button logic
  const sendInitialPrompt = async (prompt: string, storageKey?: string) => {
    // Prevent double-send
    if (isSendingRef.current) {
      console.log('[ChatPanel] sendInitialPrompt blocked - already sending')
      return
    }
    isSendingRef.current = true
    console.log('[ChatPanel] sendInitialPrompt starting with prompt:', prompt)

    // 1. Add user message immediately to UI
    const userMessage: ChatMessageType = {
      id: `user-msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      messageType: 'chat',
    }
    console.log('[ChatPanel] Adding user message to UI:', userMessage.id)
    addMessage(userMessage)

    // 2. Add thinking message
    const assistantId = `assistant-${Date.now()}`
    const thinkingMessage: ChatMessageType = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      messageType: 'chat',
    }
    addMessage(thinkingMessage)
    setThinkingMessageId(assistantId)
    setLoading(true)

    // 3. Send to API via HTTP streaming with retry logic
    const MAX_RETRIES = 5
    const RETRY_DELAY = 2000

    const sendWithRetry = async (attempt = 1): Promise<Response> => {
      try {
        const response = await apiClient.post(
          API_ENDPOINTS.projectChat(currentProjectId!),
          { message: prompt, images: [] }
        )

        if (response.status === 503 && attempt <= MAX_RETRIES) {
          console.log(`[ChatPanel] Server busy (503), retrying in ${RETRY_DELAY}ms... (Attempt ${attempt}/${MAX_RETRIES})`)
          // Update thinking message to show status
          const statusMessage = `Initializing agent... (${attempt}/${MAX_RETRIES})`
          addMessage({
            ...thinkingMessage,
            content: statusMessage,
          })

          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return sendWithRetry(attempt + 1)
        }

        return response
      } catch (error) {
        if (attempt <= MAX_RETRIES) {
          console.log(`[ChatPanel] Network error, retrying... (Attempt ${attempt}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return sendWithRetry(attempt + 1)
        }
        throw error
      }
    }

    try {
      const response = await sendWithRetry()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is empty')
      }

      // Reset thinking message content before streaming
      addMessage({ ...thinkingMessage, content: '' })

      // 4. Read streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''
      let lastUpdateTime = 0
      const UPDATE_INTERVAL = 50

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          setThinkingMessageId(null)
          if (accumulatedText) {
            const finalMessage: ChatMessageType = {
              ...thinkingMessage,
              content: accumulatedText,
            }
            addMessage(finalMessage)
          }
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        accumulatedText += chunk

        // Throttle UI updates
        const now = Date.now()
        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
          const updatedMessage: ChatMessageType = {
            ...thinkingMessage,
            content: accumulatedText,
          }
          addMessage(updatedMessage)
          lastUpdateTime = now
        }
      }

      setLoading(false)
      isSendingRef.current = false
      console.log('[ChatPanel] sendInitialPrompt completed successfully')

      // Remove from storage only after successful send
      if (storageKey) {
        sessionStorage.removeItem(storageKey)
        console.log('[ChatPanel] Removed initial prompt from storage after successful send')
      }

      // Sync project title after first message
      if (!firstMessageSentRef.current && currentProjectId) {
        firstMessageSentRef.current = true
        console.log('[ChatPanel] First message sent, polling for project title...')

        // Poll for title generation (Mastra generates title asynchronously)
        const pollTitle = async (attempt = 1, maxAttempts = 20) => {
          try {
            const title = await syncProjectTitle(currentProjectId)
            if (title) {
              console.log(`[ChatPanel] Project title synced successfully after ${attempt} attempts: "${title}"`)
              return
            }

            // Title not generated yet, retry
            if (attempt < maxAttempts) {
              console.log(`[ChatPanel] Title not ready, retrying (${attempt}/${maxAttempts})...`)
              setTimeout(() => pollTitle(attempt + 1, maxAttempts), 1000) // Check every 1s
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
    } catch (error) {
      console.error('[ChatPanel] Failed to send initial prompt:', error)
      setThinkingMessageId(null)
      setLoading(false)
      isSendingRef.current = false

      // On error, keep the prompt in storage so user can retry
      // Don't remove storageKey here

      showToast('Failed to send message', 'error')
    }
  }

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
    setInput(value)

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

  const handleSendMessage = async () => {
    if ((!input.trim() && selectedImages.length === 0) || loading) return

    // Prevent double-send (React StrictMode protection)
    if (isSendingRef.current) {
      console.warn('Message send already in progress, blocking duplicate')
      return
    }
    isSendingRef.current = true

    // Format selected elements context with detailed info
    let messageWithContext = input
    if (selectedElements && selectedElements.length > 0) {
      const elementsContext = selectedElements.map((el, idx) => {
        const parts: string[] = []

        // Element identification
        const name = el.react?.componentName || el.tagName?.toLowerCase() || 'element'
        parts.push(`${idx + 1}. <${name}>`)

        // Selector
        parts.push(`   Selector: ${el.selector}`)

        // Text content
        if (el.text) {
          const text = el.text.length > 100 ? `${el.text.substring(0, 100)}...` : el.text
          parts.push(`   Text: "${text}"`)
        }

        // Semantic info
        if (el.semantic?.role) parts.push(`   Role: ${el.semantic.role}`)
        if (el.semantic?.ariaLabel) parts.push(`   Label: ${el.semantic.ariaLabel}`)

        // Important attributes
        if (el.attributes?.placeholder) parts.push(`   Placeholder: "${el.attributes.placeholder}"`)
        if (el.attributes?.type) parts.push(`   Type: ${el.attributes.type}`)
        if (el.attributes?.['data-testid']) parts.push(`   TestID: ${el.attributes['data-testid']}`)

        // React component info
        if (el.react?.componentName) {
          parts.push(`   Component: ${el.react.componentName}`)
          if (el.react.source?.fileName) {
            const file = el.react.source.fileName.split('/').pop()
            parts.push(`   Source: ${file}:${el.react.source.lineNumber}`)
          }
        }

        // Position info (for layout context)
        if (el.rect) {
          parts.push(`   Position: (${Math.round(el.rect.x)}, ${Math.round(el.rect.y)}) ${Math.round(el.rect.width)}×${Math.round(el.rect.height)}px`)
        }

        return parts.join('\n')
      }).join('\n\n')

      messageWithContext = `[Visual Contexts - ${selectedElements.length} element${selectedElements.length > 1 ? 's' : ''}]\n${elementsContext}\n\n[User Query]\n${input}`
    }

    // Use pre-compressed images
    const compressedImages = compressedImagesPreview

    // Validate compressed images
    if (compressedImages.length > 0) {
      const totalSize = compressedImages.reduce((acc, img) => {
        const padding = (img.data.match(/=/g) || []).length
        return acc + (img.data.length * 6 - padding * 8) / 8
      }, 0)

      const totalKB = (totalSize / 1024).toFixed(1)
      console.log(`📤 Sending ${compressedImages.length} image(s): ${totalKB} KB total`)

      if (totalSize > 500 * 1024) {
        showToast(`Warning: Total image size is ${totalKB} KB (target: 500 KB)`, 'warning')
      }
    }

    // Add user message immediately to UI (optimistic update)
    const userMessage: ChatMessageType = {
      id: `user-msg-${Date.now()}`,
      role: 'user',
      content: input, // Use original input, not messageWithContext
      timestamp: new Date().toISOString(),
      messageType: 'chat',
    }
    addMessage(userMessage)

    // Clear input and reset UI immediately after adding user message
    console.log('[ChatPanel] Clearing input after send, current value:', input)
    setInput('')
    setTextareaHeight(80)
    if (inputRef.current) {
      inputRef.current.style.height = '80px'
      console.log('[ChatPanel] Input ref value after clear:', inputRef.current.value)
    }

    // Clear images after sending
    setSelectedImages([])
    setCompressedImagesPreview([])

    // Flush selected elements after sending
    if (selectedElements && selectedElements.length > 0) {
      onClearElements?.()
    }

    // Add "Thinking..." message before starting request
    const messageId = `assistant-${Date.now()}`
    const thinkingMessage: ChatMessageType = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      messageType: 'chat',
    }
    addMessage(thinkingMessage)
    setThinkingMessageId(messageId)

    // Send via HTTP streaming
    try {
      // Use apiClient which handles auth, token refresh, and retries
      const response = await apiClient.post(
        API_ENDPOINTS.projectChat(currentProjectId!),
        {
          message: messageWithContext,
          images: compressedImages,
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is empty')
      }

      // Read streaming response (simple text streaming)
      console.log('[ChatPanel] Starting to read stream...')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''
      let chunkCount = 0
      let lastUpdateTime = 0
      const UPDATE_INTERVAL = 50 // Update UI every 50ms for smooth streaming

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[ChatPanel] Stream done, total chunks:', chunkCount)

          // Clear thinking state
          setThinkingMessageId(null)

          // Final update to ensure all content is shown
          if (accumulatedText) {
            const streamMessage: ChatMessageType = {
              id: messageId,
              role: 'assistant',
              content: accumulatedText,
              timestamp: new Date().toISOString(),
              messageType: 'chat',
            }
            addMessage(streamMessage)
          }

          // Sync project title after first message completes
          if (!firstMessageSentRef.current && currentProjectId) {
            firstMessageSentRef.current = true
            console.log('[ChatPanel] First message completed, polling for project title...')

            // Poll for title generation (Mastra generates title asynchronously)
            const pollTitle = async (attempt = 1, maxAttempts = 20) => {
              try {
                const title = await syncProjectTitle(currentProjectId)
                if (title) {
                  console.log(`[ChatPanel] Project title synced successfully after ${attempt} attempts: "${title}"`)
                  return
                }

                // Title not generated yet, retry
                if (attempt < maxAttempts) {
                  console.log(`[ChatPanel] Title not ready, retrying (${attempt}/${maxAttempts})...`)
                  setTimeout(() => pollTitle(attempt + 1, maxAttempts), 500) // Check every 500ms
                } else {
                  console.warn('[ChatPanel] Title generation timeout after 10s')
                }
              } catch (error) {
                console.error('[ChatPanel] Failed to sync project title:', error)
              }
            }

            // Start polling after a brief delay to let Mastra start processing
            setTimeout(() => pollTitle(), 500)
          }

          break
        }

        chunkCount++
        const chunk = decoder.decode(value, { stream: true })
        console.log('[ChatPanel] Chunk #' + chunkCount + ':', chunk.substring(0, 50))
        accumulatedText += chunk

        // On first chunk, clear thinking state
        if (chunkCount === 1) {
          setThinkingMessageId(null)
        }

        // Throttle UI updates for better performance
        const now = Date.now()
        if (now - lastUpdateTime >= UPDATE_INTERVAL || chunkCount === 1) {
          lastUpdateTime = now

          // Update UI with streaming content using addMessage (handles updates automatically)
          const streamMessage: ChatMessageType = {
            id: messageId,
            role: 'assistant',
            content: accumulatedText,
            timestamp: new Date().toISOString(),
            messageType: 'chat',
          }

          console.log('[ChatPanel] Updating UI with', accumulatedText.length, 'chars')
          // addMessage will update existing message if ID matches
          addMessage(streamMessage)
        }
      }

      console.log('[ChatPanel] Streaming completed, final text length:', accumulatedText.length)

      // Sync project title from Mastra Memory after first message
      if (!firstMessageSentRef.current && currentProjectId) {
        firstMessageSentRef.current = true
        console.log('[ChatPanel] First message completed, syncing thread title...')
        setTimeout(async () => {
          try {
            const title = await syncProjectTitle(currentProjectId)
            if (title) {
              console.log('[ChatPanel] Project title synced:', title)
            }
          } catch (error) {
            console.error('[ChatPanel] Failed to sync project title:', error)
          }
        }, 2000) // Wait 2 seconds for Mastra to generate title
      }
    } catch (error: any) {
      console.error('[ChatPanel] Streaming error:', error)
      showToast(`Failed to send message: ${error.message}`, 'error')
      // Clear thinking state on error
      setThinkingMessageId(null)
      // Remove the thinking message if there was an error
      removeMessage(messageId)
    } finally {
      // Reset sending guard after completion
      setTimeout(() => {
        isSendingRef.current = false
      }, 100)
    }
  }

  const applyTorchSuggestion = useCallback((prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }, [])

  // Removed unused functions - handleLogout and handleNavigate
  // These were not being used in the component

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onApplyPrompt={applyTorchSuggestion}
            isPending={msg.metadata?.pending}
            isThinking={msg.id === thinkingMessageId}
          />
        ))}

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
                // Use memoized values
                const compressedImg = compressedImagesPreview[index]
                const compressedSize = compressedImageSizes[index] || 0

                const compressedKB = (compressedSize / 1024).toFixed(1)
                const originalKB = (image.size / 1024).toFixed(1)

                // Show compressed size if available, otherwise show "Compressing..."
                const sizeDisplay = compressedImg
                  ? `${compressedKB} KB`
                  : 'Compressing...'

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
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {/* Compressed size badge */}
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
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              loading
                ? 'Queue more tasks to be executed (@ for files, / for commands)'
                : 'Ask me to help with your code... (@ for files, / for commands, paste images)'
            }
            style={{
              height: `${textareaHeight}px`,
            }}
          />

          <div className="chat-input-footer">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />

            {/* Left side: Empty for now */}
            <div className="input-footer-left"></div>

            {/* Right side: Image and Send buttons */}
            <div className="input-footer-right">
              <button
                type="button"
                className="action-button image-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
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
                disabled={loading || !input.trim()}
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
