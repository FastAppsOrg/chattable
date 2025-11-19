import { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { Project } from '../../../types/project'
import { ProjectService } from '../../../services/api/project'
import { useTheme } from '../../../hooks/useTheme'
import type { MCPTool, FileTreeNode } from '../types'
import { FileTreeItem } from './FileTreeItem'
import { BrowserCompiledWidgetPreview } from '../BrowserCompiledWidgetPreview'

interface CodePreviewTabProps {
  project: Project
  tools: MCPTool[]
}

export function CodePreviewTab({ project }: CodePreviewTabProps) {
  const { theme } = useTheme()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [editorContent, setEditorContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [dirContents, setDirContents] = useState<Map<string, FileTreeNode[]>>(new Map())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const editorRef = useRef<any>(null)

  // Theme-aware colors
  const colors = {
    background: theme === 'dark' ? '#212121' : '#FFFFFF',
    sidebarBg: theme === 'dark' ? '#1a1a1a' : '#F5F5F5',
    border: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)',
    headerBg: theme === 'dark' ? '#1e1e1e' : '#FAFAFA',
    text: theme === 'dark' ? '#FFFFFF' : '#000000',
    textSecondary: theme === 'dark' ? '#AFAFAF' : '#666666',
    textTertiary: theme === 'dark' ? '#8F8F8F' : '#999999',
    hoverBg: theme === 'dark' ? '#252525' : '#E8E8E8',
    selectedBg: theme === 'dark' ? '#414141' : '#E0E0E0',
    skeletonBg: theme === 'dark' ? '#303030' : '#E0E0E0',
    skeletonContainer: theme === 'dark' ? '#1a1a1a' : '#F0F0F0',
    errorText: theme === 'dark' ? '#FF8583' : '#D32F2F',
    buttonBg: theme === 'dark' ? '#0E639C' : '#1976D2',
    buttonBgHover: theme === 'dark' ? '#1177BB' : '#1565C0',
    buttonDisabledBg: theme === 'dark' ? '#2d2d2d' : '#E0E0E0',
    buttonDisabledText: theme === 'dark' ? '#8F8F8F' : '#999999',
    modifiedBadgeBg: theme === 'dark' ? 'rgba(255, 140, 0, 0.1)' : 'rgba(255, 140, 0, 0.15)',
    modifiedBadgeText: theme === 'dark' ? '#FF8C00' : '#E65100',
  }

  // Fetch file tree on mount
  useEffect(() => {
    const fetchTree = async () => {
      try {
        setTreeLoading(true)
        const result = await ProjectService.fetchFileTree(project.project_id)
        setFileTree(result.tree || [])
      } catch (err) {
        console.error('Failed to fetch file tree:', err)
      } finally {
        setTreeLoading(false)
      }
    }

    fetchTree()
  }, [project.project_id])

  const toggleDirectory = async (dirPath: string) => {
    const newExpanded = new Set(expandedDirs)

    if (newExpanded.has(dirPath)) {
      // Collapse directory
      newExpanded.delete(dirPath)
      setExpandedDirs(newExpanded)
    } else {
      // Expand directory - fetch contents if not already loaded
      newExpanded.add(dirPath)
      setExpandedDirs(newExpanded)

      if (!dirContents.has(dirPath)) {
        try {
          const result = await ProjectService.fetchFileTree(project.project_id, dirPath)
          const newDirContents = new Map(dirContents)
          newDirContents.set(dirPath, result.tree || [])
          setDirContents(newDirContents)
        } catch (err) {
          console.error('Failed to fetch directory contents:', err)
        }
      }
    }
  }

  const loadFile = async (filePath: string) => {
    // Check for unsaved changes
    if (hasUnsavedChanges && selectedFile) {
      const confirmSwitch = window.confirm(
        `You have unsaved changes in ${selectedFile}. Do you want to discard them?`
      )
      if (!confirmSwitch) {
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      const result = await ProjectService.readProjectFile(project.project_id, filePath)
      setFileContent(result.content)
      setEditorContent(result.content)
      setSelectedFile(filePath)
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Failed to load file:', err)
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  const saveFile = async () => {
    if (!selectedFile) return

    try {
      setSaving(true)
      // TODO: Implement file write API
      // For now, we'll use MCP fs_write_file tool
      console.log('Saving file:', selectedFile, 'with content:', editorContent)

      // Update the original content to match editor
      setFileContent(editorContent)
      setHasUnsavedChanges(false)

      // Show success message
      alert('File saved successfully! (Note: Save functionality needs MCP write tool implementation)')
    } catch (err) {
      console.error('Failed to save file:', err)
      alert('Failed to save file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value)
      setHasUnsavedChanges(value !== fileContent)
    }
  }

  // Detect language from file extension
  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'py': 'python',
      'yml': 'yaml',
      'yaml': 'yaml',
    }
    return languageMap[ext || ''] || 'plaintext'
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left sidebar: File tree */}
      <div
        style={{
          width: '280px',
          borderRight: `1px solid ${colors.border}`,
          padding: '16px',
          overflow: 'auto',
          backgroundColor: colors.sidebarBg,
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: colors.textSecondary,
            marginBottom: '12px',
            fontWeight: 600,
          }}
        >
          📁 Project Files
        </div>

        {treeLoading ? (
          <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '16px' }}>
            Loading file tree...
          </div>
        ) : fileTree.length === 0 ? (
          <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '16px' }}>
            No files found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                selectedFile={selectedFile}
                expandedDirs={expandedDirs}
                dirContents={dirContents}
                onToggleDirectory={toggleDirectory}
                onSelectFile={loadFile}
                depth={0}
                colors={colors}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right side: Code viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.headerBg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '14px', color: colors.text, fontWeight: 600 }}>
              {selectedFile || 'Select a file to preview'}
            </div>
            {hasUnsavedChanges && (
              <div
                style={{
                  fontSize: '12px',
                  color: colors.modifiedBadgeText,
                  backgroundColor: colors.modifiedBadgeBg,
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
              >
                Modified
              </div>
            )}
          </div>
          {selectedFile && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Preview button - only show for .tsx files */}
              {selectedFile.endsWith('.tsx') && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: showPreview ? colors.buttonBgHover : colors.buttonBg,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.buttonBgHover
                  }}
                  onMouseLeave={(e) => {
                    if (!showPreview) {
                      e.currentTarget.style.backgroundColor = colors.buttonBg
                    }
                  }}
                >
                  {showPreview ? '👁️ Hide Preview' : '▶️ Preview Widget'}
                </button>
              )}

              {/* Save button */}
              <button
                onClick={saveFile}
                disabled={!hasUnsavedChanges || saving}
                style={{
                  padding: '8px 16px',
                  backgroundColor: hasUnsavedChanges ? colors.buttonBg : colors.buttonDisabledBg,
                  color: hasUnsavedChanges ? '#FFFFFF' : colors.buttonDisabledText,
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (hasUnsavedChanges) {
                    e.currentTarget.style.backgroundColor = colors.buttonBgHover
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasUnsavedChanges) {
                    e.currentTarget.style.backgroundColor = colors.buttonBg
                  }
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '24px' }}>
              <div style={{ padding: '16px', backgroundColor: colors.skeletonContainer, borderRadius: '8px' }}>
                {/* Code skeleton */}
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: '16px',
                      backgroundColor: colors.skeletonBg,
                      borderRadius: '4px',
                      marginBottom: '8px',
                      width: `${Math.random() * 40 + 60}%`,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
                <div
                  style={{
                    textAlign: 'center',
                    color: colors.textSecondary,
                    fontSize: '14px',
                    marginTop: '24px',
                  }}
                >
                  Loading file from MCP server...
                </div>
              </div>
            </div>
          ) : error ? (
            <div style={{ padding: '24px' }}>
              {/* Code skeleton with error overlay */}
              <div style={{ padding: '16px', backgroundColor: colors.skeletonContainer, borderRadius: '8px', opacity: 0.3 }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: '16px',
                      backgroundColor: colors.skeletonBg,
                      borderRadius: '4px',
                      marginBottom: '8px',
                      width: `${Math.random() * 40 + 60}%`,
                    }}
                  />
                ))}
              </div>
              {/* Error message */}
              <div style={{ color: colors.errorText, textAlign: 'center', marginTop: '40px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>Failed to load file</div>
                <div style={{ fontSize: '14px' }}>{error}</div>
              </div>
            </div>
          ) : selectedFile ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                height="100%"
                language={getLanguageFromPath(selectedFile)}
                value={editorContent}
                onChange={handleEditorChange}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                }}
                onMount={(editor) => {
                  editorRef.current = editor
                  // Focus editor
                  editor.focus()
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: colors.background,
                color: colors.textTertiary,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                Select a file from the sidebar to view and edit its code
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Browser-compiled widget preview overlay */}
      {showPreview && editorContent && selectedFile?.endsWith('.tsx') && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{
              width: '90%',
              height: '90%',
              maxWidth: '1200px',
              maxHeight: '900px',
              backgroundColor: colors.background,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <BrowserCompiledWidgetPreview
              widgetSourceCode={editorContent}
              toolName={selectedFile.split('/').pop()?.replace('.tsx', '') || 'widget'}
              mockData={{}}
              onClose={() => setShowPreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
