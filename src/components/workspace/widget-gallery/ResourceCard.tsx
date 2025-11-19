interface MCPResource {
  name: string
  uri: string
  description?: string
  mimeType?: string
  text?: string
}

interface ResourceCardProps {
  resource: MCPResource
  onClick?: () => void
}

export function ResourceCard({ resource, onClick }: ResourceCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: '8px',
        padding: '12px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
        e.currentTarget.style.borderColor = 'var(--color-border-default)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
      }}
    >
      {/* Resource Name */}
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
        {resource.name}
      </div>

      {/* Description */}
      {resource.description && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.4',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
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

      {/* MIME Type */}
      {resource.mimeType && (
        <div
          style={{
            marginTop: '6px',
            fontSize: '10px',
            color: 'var(--color-text-tertiary)',
            backgroundColor: 'var(--color-bg-tertiary)',
            padding: '3px 6px',
            borderRadius: '4px',
            display: 'inline-block',
          }}
        >
          {resource.mimeType}
        </div>
      )}
    </div>
  )
}
