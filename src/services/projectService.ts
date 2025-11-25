import { apiClient } from '../utils/api'
import { API_ENDPOINTS } from '../constants/api'

export interface Project {
  project_id: string
  name: string
  user_id: string
  git_url: string
  bare_repo_path: string
  default_branch: string
  status: string
  created_at: string
  updated_at?: string
  last_accessed?: string
  metadata?: Record<string, any>
}

// Branch interfaces removed - branches feature no longer needed

export interface ProjectWithWorkspace {
  project_id: string
  name: string
  git_url: string
  default_branch: string
  status: string
  created_at: string
  default_workspace?: any // Workspace info if available
}

export interface CreateProjectRequest {
  name: string
  git_url: string
  default_branch?: string
  create_initial_branch?: boolean
  initial_branch_name?: string
}

export interface ProjectSyncStatus {
  project_id: string
  has_remote_changes: boolean
  last_sync?: string
  sync_errors?: string[]
}

class ProjectService {
  async listProjects(): Promise<any[]> {
    const response = await apiClient.get(API_ENDPOINTS.projects)

    if (!response.ok) {
      throw new Error(`Failed to list projects: ${response.statusText}`)
    }

    return response.json()
  }

  async getProject(projectId: string): Promise<any> {
    const response = await apiClient.get(API_ENDPOINTS.project(projectId))

    if (!response.ok) {
      throw new Error(`Failed to get project: ${response.statusText}`)
    }

    return response.json()
  }

  async createProject(request: CreateProjectRequest): Promise<any> {
    const response = await apiClient.post(API_ENDPOINTS.projects, request)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create project: ${error}`)
    }

    return response.json()
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<any> {
    const response = await apiClient.patch(API_ENDPOINTS.project(projectId), updates)

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteProject(projectId: string): Promise<void> {
    const response = await apiClient.delete(API_ENDPOINTS.project(projectId))

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`)
    }
  }

  // Branch methods removed - branches feature no longer needed

  async syncProject(projectId: string): Promise<ProjectSyncStatus> {
    // const response = await apiClient.post(API_ENDPOINTS.projectSync(projectId))
    throw new Error('Sync not implemented')

    // if (!response.ok) {
    //   const error = await response.text()
    //   throw new Error(error || 'Failed to sync project')
    // }

    // return await response.json()
  }
}

export const projectService = new ProjectService()
