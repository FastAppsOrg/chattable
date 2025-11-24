import type {
  Project,
  CreateProjectForm,
  ProjectUpdateForm,
  DeploymentConfig,
  DeploymentResult,
  FileNode,
  SSHInfo,
  ProjectPreview,
  PortsResponse,
} from '../../types/project'
import { API_ENDPOINTS } from '../../constants/api'
import { apiClient } from '../../utils/api'

export class ProjectService {
  static async fetchProjects(): Promise<Project[]> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.projects)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch projects: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch projects')
    }
  }

  static async fetchProject(projectId: string): Promise<Project> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.project(projectId))
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch project: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch project')
    }
  }

  static async createProject(form: CreateProjectForm): Promise<Project> {
    try {
      // Use Freestyle API for project creation
      const body: any = {
        name: form.name,
        gitUrl: form.git_url,
        gitBranch: form.git_branch,
        templateUrl: form.git_url || 'https://github.com/alpic-ai/apps-sdk-template', // Default to Apps SDK template
      }

      // Project creation can take 10-30 seconds (git clone + dev server startup)
      const response = await apiClient.post(API_ENDPOINTS.projects, body, { timeout: 60000 })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 400) {
          throw new Error(errorData.detail || 'Invalid project configuration')
        }
        if (response.status === 403) {
          throw new Error('Project limit reached or permission denied')
        }
        throw new Error(errorData.detail || `Failed to create project: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to create project')
    }
  }

  /**
   * Wait for project sandbox to be ready
   * Polls project status until sandbox_id is available and status is "active"
   */
  static async waitForProjectReady(
    projectId: string,
    options?: {
      maxAttempts?: number
      pollInterval?: number
      onProgress?: (status: string, attempt: number) => void
    },
  ): Promise<Project> {
    const maxAttempts = options?.maxAttempts || 60 // 60 attempts = 2 minutes max
    const pollInterval = options?.pollInterval || 2000 // 2 seconds
    const onProgress = options?.onProgress

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const project = await this.fetchProject(projectId)

        // Report progress
        if (onProgress) {
          onProgress(project.status, attempt)
        }

        // Check if project is ready
        if (project.status === 'active' && project.sandbox_id) {
          return project
        }

        // Check if project failed
        if (project.status === 'failed') {
          throw new Error('Project sandbox creation failed. Please try creating the project again.')
        }

        // Wait before next poll
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
        }
      } catch (error) {
        // If it's a 404, project might have been deleted
        if (error instanceof Error && error.message.includes('not found')) {
          throw new Error('Project not found. It may have been deleted.')
        }
        // For other errors, continue polling
        if (attempt === maxAttempts) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      }
    }

    throw new Error(
      'Project sandbox is still initializing. This is taking longer than expected. ' +
      'Please refresh the page in a moment to check if it completed.',
    )
  }

  static async updateProject(projectId: string, updates: ProjectUpdateForm): Promise<Project> {
    try {
      const response = await apiClient.patch(API_ENDPOINTS.project(projectId), updates)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to update project: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to update project')
    }
  }

  static async deleteProject(projectId: string): Promise<void> {
    try {
      const response = await apiClient.delete(API_ENDPOINTS.project(projectId))

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found')
        }
        if (response.status === 403) {
          throw new Error('Permission denied to delete project')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to delete project: ${response.status}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to delete project')
    }
  }

  // ==================== Freestyle Operations (REMOVED) ====================
  // These operations are no longer supported after migrating to provider-agnostic architecture
  // Dev server URLs are now returned directly in project creation response

  // ==================== Legacy Operations (to be removed) ====================

  /** @deprecated Use Freestyle MCP instead */
  static async fetchProjectFiles(
    projectId: string,
    path?: string,
    recursive?: boolean,
    query?: string,
  ): Promise<FileNode[]> {
    const params = new URLSearchParams()
    if (path) params.append('path', path)
    if (recursive !== undefined) params.append('recursive', String(recursive))
    if (query) params.append('query', query)

    const url = `${API_ENDPOINTS.projectFiles(projectId)}?${params.toString()}`
    const response = await apiClient.get(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.status}`)
    }

    return response.json()
  }

  /** @deprecated Freestyle uses ephemeral URLs, no SSH */
  static async fetchProjectSSHInfo(projectId: string): Promise<SSHInfo> {
    const response = await apiClient.get(`/api/projects/${projectId}/ssh-info`)
    if (!response.ok) {
      throw new Error(`Failed to fetch SSH info: ${response.status}`)
    }
    return response.json()
  }

  /**
   * Restart a project (recovery after server restart)
   * Only works for local projects
   */
  static async restartProject(projectId: string): Promise<{
    success: boolean
    message: string
    ephemeral_url: string
    mcp_ephemeral_url: string
  }> {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/restart`, {})
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to restart project: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to restart project')
    }
  }

  /** @deprecated Freestyle provides ephemeral_url directly */
  static async fetchProjectPreview(projectId: string): Promise<ProjectPreview> {
    const response = await apiClient.get(`/api/projects/${projectId}/preview`)
    if (!response.ok) {
      throw new Error(`Failed to fetch preview: ${response.status}`)
    }
    return response.json()
  }

  /** @deprecated Freestyle auto-starts dev servers */
  static async startProjectPreview(
    projectId: string,
    command?: string,
  ): Promise<{ status: string; message: string }> {
    const body = command ? { command } : {}
    // const response = await apiClient.post(API_ENDPOINTS.projectPreviewStart(projectId), body)
    throw new Error('Preview start not implemented')
    // if (!response.ok) {
    //   throw new Error(`Failed to start preview: ${response.status}`)
    // }
    // return await response.json()
  }

  /** @deprecated */
  static async stopProjectPreview(
    projectId: string,
  ): Promise<{ status: string; message: string }> {
    const response = await apiClient.post(`/api/projects/${projectId}/preview/stop`, {})
    if (!response.ok) {
      throw new Error(`Failed to stop preview: ${response.status}`)
    }
    return response.json()
  }

  /** @deprecated */
  static async fetchProjectPorts(projectId: string): Promise<PortsResponse> {
    const response = await apiClient.get(`/api/projects/${projectId}/ports`)
    if (!response.ok) {
      throw new Error(`Failed to fetch ports: ${response.status}`)
    }
    return response.json()
  }

  /** @deprecated Use Freestyle Git API */
  static async integrateGit(
    projectId: string,
    config: {
      name: string
      private: boolean
      description?: string
      owner?: string
      ownerType?: 'user' | 'org'
    }
  ): Promise<{ success: boolean; repository_url: string; message: string }> {
    const response = await apiClient.post(`/api/projects/${projectId}/git/integrate`, config)
    if (!response.ok) {
      throw new Error(`Failed to integrate git: ${response.status}`)
    }
    return response.json()
  }

  /** @deprecated Use Freestyle Git API */
  static async gitPushInitial(projectId: string): Promise<{
    success: boolean
    message: string
    output: string
  }> {
    const response = await apiClient.post(`/api/projects/${projectId}/git/push/initial`)
    if (!response.ok) {
      throw new Error(`Failed to push initial commit: ${response.status}`)
    }
    return response.json()
  }

  /** @deprecated Use Freestyle Git API */
  static async fetchGitCommits(
    projectId: string,
    limit?: number
  ): Promise<Array<{
    oid: string
    message: string
    author: string
    timestamp: number
  }>> {
    const params = new URLSearchParams()
    if (limit) params.append('limit', String(limit))

    // const url = `${API_ENDPOINTS.projectGitCommits(projectId)}?${params.toString()}`
    // const url = '' // Mock empty url
    // const response = await apiClient.get(url)
    // if (!response.ok) {
    //   throw new Error(`Failed to fetch commits: ${response.status}`)
    // }
    // return await response.json()
    return []
  }

  /** @deprecated Use Freestyle Git API */
  static async gitPush(projectId: string): Promise<{
    success: boolean
    message: string
    output: string
  }> {
    const response = await apiClient.post(`/api/projects/${projectId}/git/push`)
    if (!response.ok) {
      throw new Error(`Failed to push commits: ${response.status}`)
    }
    return response.json()
  }

  // ==================== MCP Operations ====================

  /**
   * Fetch MCP tools for a project
   */
  static async fetchMCPTools(projectId: string): Promise<{
    tools: Array<{
      name: string
      description?: string
      inputSchema?: Record<string, any>
    }>
    mcp_url: string
  }> {
    try {
      const response = await apiClient.get(`/api/projects/${projectId}/mcp/tools`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch MCP tools: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch MCP tools')
    }
  }

  /**
   * Fetch MCP resources for a project
   */
  static async fetchMCPResources(projectId: string): Promise<{
    resources: Array<{
      name: string
      uri: string
      description?: string
      mimeType?: string
    }>
    mcp_url: string
  }> {
    try {
      const response = await apiClient.get(`/api/projects/${projectId}/mcp/resources`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch MCP resources: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch MCP resources')
    }
  }

  /**
   * Call an MCP tool with given parameters
   */
  static async callMCPTool(projectId: string, toolName: string, params: Record<string, any>): Promise<any> {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/mcp/tools/${toolName}/call`, params)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to call tool ${toolName}: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Network error: Unable to call tool ${toolName}`)
    }
  }

  /**
   * Read an MCP resource by URI
   */
  static async readMCPResource(projectId: string, uri: string): Promise<any> {
    try {
      const response = await apiClient.post(`/api/projects/${projectId}/mcp/resources/read`, { uri })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to read resource: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to read resource')
    }
  }

  /**
   * Fetch widget bindings for a project
   */
  static async fetchWidgetBindings(projectId: string): Promise<{
    widgets: Array<{
      toolName: string
      widgetPath: string
      componentName: string
    }>
    message?: string
  }> {
    try {
      const response = await apiClient.get(`/api/projects/${projectId}/mcp/widgets`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch widget bindings: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch widget bindings')
    }
  }

  /**
   * Get file tree structure (IDE-like)
   */
  static async fetchFileTree(projectId: string, dirPath?: string): Promise<{
    tree: Array<{
      name: string
      path: string
      type: 'file' | 'directory'
      size: number
      modified: string
    }>
  }> {
    try {
      const params = dirPath ? new URLSearchParams({ path: dirPath }) : ''
      const response = await apiClient.get(`/api/projects/${projectId}/files/tree${params ? '?' + params : ''}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch file tree: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to fetch file tree')
    }
  }

  /**
   * Read a file from the project
   */
  static async readProjectFile(projectId: string, filePath: string): Promise<{
    path: string
    content: string
  }> {
    try {
      const params = new URLSearchParams({ path: filePath })
      const response = await apiClient.get(`/api/projects/${projectId}/files?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to read file: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error: Unable to read file')
    }
  }
}
