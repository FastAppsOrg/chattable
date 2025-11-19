import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Monitor, Flame, KanbanSquare, LayoutGrid, MessageSquare, Code2 } from 'lucide-react'
import './PreviewModeSelector.css'

export type PreviewMode = 'gallery' | 'sandbox' | 'code'

interface PreviewModeOption {
  id: PreviewMode
  label: string
  icon: JSX.Element
  description: string
  disabled?: boolean
}

const PREVIEW_MODES: PreviewModeOption[] = [
  {
    id: 'sandbox',
    label: 'Development',
    icon: <Flame size={16} />,
    description: 'Live widget development with HMR',
    disabled: false
  },
  {
    id: 'gallery',
    label: 'Test',
    icon: <LayoutGrid size={16} />,
    description: 'Test your application',
    disabled: false
  },
  {
    id: 'code',
    label: 'Codes',
    icon: <Code2 size={16} />,
    description: 'View widget code',
    disabled: false
  },
]

interface PreviewModeSelectorProps {
  currentMode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
  disabled?: boolean
}

export function PreviewModeSelector({ currentMode, onModeChange, disabled }: PreviewModeSelectorProps) {
  return (
    <div className="preview-mode-selector-tabs">
      {PREVIEW_MODES.map((mode) => (
        <button
          key={mode.id}
          className={`mode-tab ${mode.id === currentMode ? 'active' : ''} ${mode.disabled ? 'disabled' : ''}`}
          onClick={() => !mode.disabled && onModeChange(mode.id)}
          disabled={disabled || mode.disabled}
          title={mode.description}
        >
          <span className="mode-icon">{mode.icon}</span>
          {mode.id === currentMode && <span className="mode-label">{mode.label}</span>}
        </button>
      ))}
    </div>
  )
}
