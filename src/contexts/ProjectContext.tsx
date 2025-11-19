import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { projectService } from '../services/projectService'
import { ProjectService } from '../services/api/project'
import type { CreateProjectForm, Project } from '../types/project'
import { useAuth } from '../hooks/useAuth'
import { useSecretsStatus } from '../hooks/useSecretsStatus'
import { ProjectContext } from '@/hooks/useProjectContext'
import { apiClient } from '../utils/api'

interface ProjectContextType {
  projects: Project[]
  loading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  createProject: (form: CreateProjectForm) => Promise<Project>
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  syncProject: (projectId: string) => Promise<void>
  syncProjectTitle: (projectId: string) => Promise<string | null>
  checkGitHubToken: () => Promise<boolean>
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, signInWithGitHub } = useAuth()
  const { hasGitHubToken, refetch: refetchSecrets } = useSecretsStatus()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const creatingProjectRef = useRef(false)

  const fetchProjects = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      const projectList = await projectService.listProjects()
      // Sort projects by created_at in descending order (latest first)
      const sortedProjects = projectList.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })
      setProjects(sortedProjects)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      console.error('Failed to fetch projects:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  const checkGitHubToken = useCallback(async (): Promise<boolean> => {
    // Refetch to get latest status
    const status = await refetchSecrets()
    if (!status?.has_github_token) {
      // Automatically trigger re-authentication
      await signInWithGitHub()
      return false
    }
    return true
  }, [refetchSecrets, signInWithGitHub])

  const createProject = useCallback(
    async (form: CreateProjectForm) => {
      // Critical: Prevent duplicate project creation
      if (creatingProjectRef.current) {
        console.error('Project creation already in progress, blocking duplicate call')
        throw new Error('Project creation already in progress')
      }

      // No longer require GitHub token - Freestyle handles repos internally

      creatingProjectRef.current = true
      setLoading(true)
      setError(null)
      try {
        // Create project (returns immediately with status="initializing")
        const initialProject = await ProjectService.createProject(form)
        console.log('Project created:', initialProject.project_id)

        // Add to projects list immediately (with initializing status)
        setProjects((prev) => [initialProject, ...prev])

        // Return initial project immediately for navigation
        // Background polling will happen in ProjectContent
        return initialProject
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create project'
        setError(errorMessage)
        console.error('Failed to create project:', err)
        throw err
      } finally {
        setLoading(false)
        // Reset the flag after a short delay to prevent race conditions
        setTimeout(() => {
          creatingProjectRef.current = false
        }, 1000)
      }
    },
    [checkGitHubToken],
  )

  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      setError(null)
      try {
        await projectService.updateProject(projectId, updates)
        await fetchProjects()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update project'
        setError(errorMessage)
        console.error('Failed to update project:', err)
        throw err
      }
    },
    [fetchProjects],
  )

  const syncProjectTitle = useCallback(
    async (projectId: string) => {
      try {
        const response = await apiClient.get(`/api/projects/${projectId}/title`)
        if (response.ok) {
          const { title } = await response.json()
          console.log('[ProjectContext] Synced thread title:', title)
          await fetchProjects()
          return title
        }
      } catch (err) {
        console.error('[ProjectContext] Failed to sync thread title:', err)
      }
      return null
    },
    [fetchProjects],
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      setError(null)
      try {
        await projectService.deleteProject(projectId)
        await fetchProjects()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete project'
        setError(errorMessage)
        console.error('Failed to delete project:', err)
        throw err
      }
    },
    [fetchProjects],
  )

  const syncProject = useCallback(
    async (projectId: string) => {
      try {
        await projectService.syncProject(projectId)
        await fetchProjects()
      } catch (err) {
        console.error('Failed to sync project:', err)
        throw err
      }
    },
    [fetchProjects],
  )

  // Fetch projects when auth is ready and user is logged in
  useEffect(() => {
    // Wait for auth to finish loading before fetching projects
    if (authLoading) return

    if (user) {
      fetchProjects()
    } else {
      setProjects([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  const value = useMemo<ProjectContextType>(
    () => ({
      projects,
      loading,
      error,
      fetchProjects,
      createProject,
      updateProject,
      deleteProject,
      syncProject,
      syncProjectTitle,
      checkGitHubToken,
    }),
    [projects, loading, error, fetchProjects, createProject, updateProject, deleteProject, syncProject, syncProjectTitle, checkGitHubToken],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
