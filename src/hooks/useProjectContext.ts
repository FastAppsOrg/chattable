import { createContext, useContext } from 'react'
import { CreateProjectForm, Project } from '../types/project'

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

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function useProjectContext() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider')
  }
  return context
}
