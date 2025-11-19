export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, any>
  _meta?: {
    'openai/outputTemplate'?: string
  }
}

export interface MCPResource {
  name: string
  uri: string
  description?: string
  mimeType?: string
  text?: string
  _meta?: Record<string, any>
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
}
