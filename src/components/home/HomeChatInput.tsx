import { useState, useRef, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import styles from './HomeChatInput.module.css'

interface HomeChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function HomeChatInput({
  onSend,
  disabled = false,
  placeholder = "What can I help with today?",
}: HomeChatInputProps) {
  const [input, setInput] = useState('')
  const [displayPlaceholder, setDisplayPlaceholder] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Typing animation effect for placeholder
  useEffect(() => {
    if (input) {
      setDisplayPlaceholder('')
      return
    }

    // If disabled, show static placeholder
    if (disabled) {
      setDisplayPlaceholder(placeholder)
      return
    }

    let currentIndex = 0
    const typingSpeed = 80
    const deletingSpeed = 50
    const pauseTime = 2000

    const typeText = () => {
      if (currentIndex < placeholder.length) {
        setDisplayPlaceholder(placeholder.slice(0, currentIndex + 1))
        currentIndex++
        return typingSpeed
      } else {
        return pauseTime
      }
    }

    const deleteText = () => {
      if (currentIndex > 0) {
        setDisplayPlaceholder(placeholder.slice(0, currentIndex - 1))
        currentIndex--
        return deletingSpeed
      } else {
        return pauseTime
      }
    }

    let isTyping = true
    let timeoutId: NodeJS.Timeout

    const animate = () => {
      const delay = isTyping ? typeText() : deleteText()

      if (isTyping && currentIndex === placeholder.length) {
        isTyping = false
      } else if (!isTyping && currentIndex === 0) {
        isTyping = true
      }

      timeoutId = setTimeout(animate, delay)
    }

    animate()

    return () => clearTimeout(timeoutId)
  }, [placeholder, input, disabled])

  // Cursor blink animation
  useEffect(() => {
    if (input || disabled) return

    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 530)

    return () => clearInterval(cursorInterval)
  }, [input, disabled])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (!input.trim() || disabled) return

    onSend(input.trim())
    setInput('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()

      // Use e.currentTarget.value to get the actual DOM value
      // This ensures we get the value including the character just typed
      // React state might lag behind DOM when typing fast
      const currentValue = e.currentTarget.value
      if (!currentValue.trim() || disabled) return

      onSend(currentValue.trim())
      setInput('')

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  return (
    <div className={styles.chatInputWrapper}>
      {/* Chat Input */}
      <div className={styles.chatInputContainer}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={displayPlaceholder + (showCursor && !input && !disabled ? '|' : '')}
          disabled={disabled}
          className={styles.chatTextarea}
          rows={1}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className={styles.sendButton}
          aria-label="Send message"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
