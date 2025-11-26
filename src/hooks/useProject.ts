import { useState, useEffect, useCallback } from 'react'
import type {
  Project,
  CreateProjectForm,
  ProjectUpdateForm,
  FileNode,
  SSHInfo,
  ProjectPreview,
  PortsResponse,
} from '../types/project'
import { ProjectService } from '../services/api/project'
import { projectService } from '../services/projectService'
import { useAuth } from './useAuth'

export function useProject() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await projectService.listProjects()
      setProjects(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects'
      setError(errorMessage)
      console.error('Failed to fetch projects:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProject = useCallback(async (projectId: string) => {
    try {
      setError(null)
      const project = await projectService.getProject(projectId)
      setSelectedProject(project)
      return project
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch project'
      setError(errorMessage)
      console.error('Failed to fetch project:', err)
      throw err
    }
  }, [])

  const createProject = useCallback(
    async (form: CreateProjectForm) => {
      try {
        setLoading(true)
        setError(null)
        const project = await ProjectService.createProject(form)
        await fetchProjects() // Refresh the list
        return project
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create project'
        setError(errorMessage)
        console.error('Failed to create project:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [fetchProjects],
  )

  const updateProject = useCallback(
    async (projectId: string, updates: ProjectUpdateForm) => {
      try {
        setError(null)
        const project = await ProjectService.updateProject(projectId, updates)
        await fetchProjects() // Refresh the list
        return project
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update project'
        setError(errorMessage)
        console.error('Failed to update project:', err)
        throw err
      }
    },
    [fetchProjects],
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        setError(null)
        await ProjectService.deleteProject(projectId)
        await fetchProjects() // Refresh the list
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete project'
        setError(errorMessage)
        console.error('Failed to delete project:', err)
        throw err
      }
    },
    [fetchProjects],
  )

  const createProjectWorkspace = useCallback(
    async (form: CreateProjectForm) => {
      try {
        setLoading(true)
        setError(null)
        const project = await ProjectService.createProject(form)
        await fetchProjects() // Refresh the list
        return project
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create workspace'
        setError(errorMessage)
        console.error('Failed to create workspace in project:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [fetchProjects],
  )

  const selectProject = useCallback((project: Project) => {
    setSelectedProject(project)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedProject(null)
  }, [])

  /**
   * Restart project sandbox
   */
  const restart = useCallback(async (projectId: string): Promise<{ message: string }> => {
    try {
      setError(null)
      return await ProjectService.restartProject(projectId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restart project'
      setError(errorMessage)
      console.error('Failed to restart project:', err)
      throw err
    }
  }, [])

  // Load projects on mount only if user is logged in
  useEffect(() => {
    if (user) {
      fetchProjects()
    }
  }, [fetchProjects, user])

  return {
    // State
    projects,
    setProjects,
    selectedProject,
    loading,
    error,

    // CRUD operations
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    createProjectWorkspace,
    selectProject,
    clearSelection,

    // Runtime operations
    restart,
  }
}
