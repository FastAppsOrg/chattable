/**
 * Project interface - Freestyle.sh based
 * Matches backend ProjectResponse DTO
 */
export interface Project {
  project_id: string
  name: string
  git_url: string
  default_branch: string
  status: 'initializing' | 'active' | 'failed' | 'deleted'
  created_at: string

  // Freestyle.sh specific fields
  sandbox_id?: string // Freestyle repo ID
  ephemeral_url?: string // Dev server URL
  mcp_ephemeral_url?: string // MCP server URL

  // Future deployment fields
  deployed_url?: string
  last_deployed_at?: string
  default_workspace?: any
}

export interface CreateProjectForm {
  name: string
  git_url: string
  git_branch: string
  git_token?: string | null
}

export interface ProjectUpdateForm {
  name?: string
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  domains: string[]
  env_vars?: Record<string, string>
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  deployment_id: string
  domains?: string[]
  status: string
}

// ========== Legacy types (to be migrated) ==========

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
}

export interface SSHInfo {
  host: string
  port: number
  user: string
  password: string
  connection_string: string
  vscode_remote?: string
}

export interface ProjectPreview {
  available: boolean
  url?: string
  port?: number
  status: string
  error?: string
}

export interface PortsResponse {
  ports: PortInfo[]
  status: string
}

export interface PortInfo {
  container_port: number
  host_port?: number
  url?: string
  available: boolean
}
