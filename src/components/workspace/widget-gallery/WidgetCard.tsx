interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, any>
  _meta?: {
    'openai/outputTemplate'?: string
  }
}

interface WidgetCardProps {
  tool: MCPTool
  selected?: boolean
  onClick?: () => void
}
export function WidgetCard({
  tool,
  selected,
  onClick,
}: {
  tool: MCPTool
  selected?: boolean
  onClick?: () => void
}) {
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
      {/* Tool Icon/Name */}
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
        {tool.name}
      </div>

      {/* Description */}
      {tool.description && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            lineHeight: '1.5',
            overflow: 'auto',
            flex: 1,
          }}
        >
          {tool.description}
        </div>
      )}

      {/* Bottom row: Schema + Widget indicator */}
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {tool.inputSchema && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {Object.keys(tool.inputSchema.properties || {}).length} parameters
          </div>
        )}
        {tool._meta?.['openai/outputTemplate'] && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {tool._meta?.['openai/outputTemplate']}
          </div>
        )}
      </div>
    </div>
  )
}
