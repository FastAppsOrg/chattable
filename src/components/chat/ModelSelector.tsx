import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import './ModelSelector.css'

export type ClaudeModel = 'sonnet' | 'opus' | 'haiku' | 'inherit' | null

interface ModelOption {
  id: ClaudeModel
  label: string
  shortLabel: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: null, label: 'Auto', shortLabel: 'A' },
  // { id: 'inherit', label: 'Inherit', shortLabel: 'I' }, // sandbox has no inherit option
  { id: 'sonnet', label: 'Sonnet', shortLabel: 'S' },
  { id: 'opus', label: 'Opus', shortLabel: 'O' },
  { id: 'haiku', label: 'Haiku', shortLabel: 'H' },
]

interface ModelSelectorProps {
  value: ClaudeModel
  onChange: (model: ClaudeModel) => void
  disabled?: boolean
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const currentModel = MODEL_OPTIONS.find(m => m.id === value) || MODEL_OPTIONS[0]

  const handleSelect = (model: ClaudeModel) => {
    onChange(model)
    setIsOpen(false)
  }

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        className="model-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={`Model: ${currentModel.label}`}
      >
        <span className="model-short">{currentModel.label}</span>
        <ChevronUp size={10}/>
      </button>

      {isOpen && (
        <div className="model-dropdown">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              className={`model-option ${model.id === value ? 'active' : ''}`}
              onClick={() => handleSelect(model.id)}
            >
              <span className="model-label">{model.label}</span>
              {model.id === value && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
