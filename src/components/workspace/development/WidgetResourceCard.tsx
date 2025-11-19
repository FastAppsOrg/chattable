interface WidgetResource {
  uri: string
  mimeType?: string
  name?: string
  description?: string
}

interface WidgetResourceCardProps {
  resource: WidgetResource
  selected?: boolean
  onClick?: () => void
}

export function WidgetResourceCard({ resource, selected, onClick }: WidgetResourceCardProps) {
  // Extract widget name from URI (e.g., "ui://widgets/pokemon.html" -> "pokemon")
  const widgetName = resource.uri.split('/').pop()?.replace('.html', '') || resource.name || 'widget'

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: selected ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
        border: selected
          ? '2px solid var(--color-primary)'
          : '1px solid var(--color-border-subtle)',
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '180px',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
          e.currentTarget.style.borderColor = 'var(--color-border-default)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
          e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
        }
      }}
    >
      {/* Widget Icon/Name */}
      <div
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        🎨 {widgetName}
      </div>

      {/* Description */}
      {resource.description && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.5',
            overflow: 'auto',
            flex: 1,
            marginBottom: '6px',
          }}
        >
          {resource.description}
        </div>
      )}

      {/* URI */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {resource.uri}
      </div>

      {/* MIME Type badge */}
      {resource.mimeType && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '10px',
            color: 'var(--color-primary)',
            backgroundColor: 'var(--color-bg-primary)',
            padding: '3px 6px',
            borderRadius: '4px',
            display: 'inline-block',
            alignSelf: 'flex-start',
          }}
        >
          {resource.mimeType}
        </div>
      )}
    </div>
  )
}
