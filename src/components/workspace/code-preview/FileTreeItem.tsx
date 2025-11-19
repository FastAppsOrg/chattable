import type { FileTreeNode } from '../types'

interface FileTreeItemProps {
  node: FileTreeNode
  selectedFile: string | null
  expandedDirs: Set<string>
  dirContents: Map<string, FileTreeNode[]>
  onToggleDirectory: (path: string) => void
  onSelectFile: (path: string) => void
  depth: number
  colors: any
}

export function FileTreeItem({
  node,
  selectedFile,
  expandedDirs,
  dirContents,
  onToggleDirectory,
  onSelectFile,
  depth,
  colors,
}: FileTreeItemProps) {
  const isDirectory = node.type === 'directory'
  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedFile === node.path
  const children = dirContents.get(node.path) || []

  const handleClick = () => {
    if (isDirectory) {
      onToggleDirectory(node.path)
    } else {
      onSelectFile(node.path)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          paddingRight: '8px',
          paddingTop: '6px',
          paddingBottom: '6px',
          backgroundColor: isSelected ? colors.selectedBg : 'transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          color: isSelected ? colors.text : colors.textSecondary,
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = colors.hoverBg
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        {isDirectory && (
          <span style={{ fontSize: '10px', opacity: 0.7, width: '12px' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        <span>{isDirectory ? '📁' : '📄'}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>

      {/* Render children if expanded */}
      {isDirectory && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              dirContents={dirContents}
              onToggleDirectory={onToggleDirectory}
              onSelectFile={onSelectFile}
              depth={depth + 1}
              colors={colors}
            />
          ))}
        </div>
      )}
    </div>
  )
}
