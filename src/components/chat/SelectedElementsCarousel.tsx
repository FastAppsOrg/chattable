import { X } from 'lucide-react'
import './SelectedElementsCarousel.css'

interface SelectedElement {
  selector: string
  text?: string
  tagName?: string
  react?: {
    component?: string
  }
  semantic?: {
    label?: string
  }
}

interface SelectedElementsCarouselProps {
  elements: SelectedElement[]
  onRemove: (index: number) => void
  onClear: () => void
}

export function SelectedElementsCarousel({
  elements,
  onRemove,
  onClear,
}: SelectedElementsCarouselProps) {
  if (elements.length === 0) return null

  return (
    <div className="selected-elements-carousel">
      <div className="carousel-header-inline">
        <span className="carousel-label">Visual Contexts :</span>
      </div>
      <div className="carousel-container">
        {elements.map((element, index) => {
          const displayName = element.react?.component
            ? `⚛️ ${element.react.component}`
            : element.tagName?.toLowerCase() || 'element'

          return (
            <div key={index} className="element-card">
              <span className="element-index">{index + 1}.</span>
              <span className="element-name" title={element.selector}>
                {displayName}
              </span>
              <button
                className="element-remove-btn"
                onClick={() => onRemove(index)}
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <button className="clear-all-btn" onClick={onClear} title="Clear all">
        <X size={14} />
      </button>
    </div>
  )
}
