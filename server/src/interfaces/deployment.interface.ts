/**
 * Deployment Service Interface
 *
 * Interface for local project deployment and management.
 */

/**
 * MCP (Model Context Protocol) connection information
 * This is what Mastra needs to connect to the project's filesystem
 */
export interface McpConnectionInfo {
  /** MCP endpoint URL (e.g., http://localhost:8080/mcp) */
  url: string;

  /** Transport protocol */
  transport: 'sse' | 'stdio' | 'websocket';

  /** Project root directory that MCP exposes (e.g., /app, /home/user/projects/xyz) */
  rootPath: string;

  /** Optional authentication token if needed */
  authToken?: string;
}

export interface DeploymentProject {
  projectId: string;

  /** Dev server URL where the app runs */
  ephemeralUrl: string;

  /** MCP connection info for Mastra agent */
  mcp: McpConnectionInfo;

  status: 'initializing' | 'active' | 'stopped' | 'failed';

  /** Optional: Local filesystem path (for local adapter) */
  localPath?: string;
}

export interface DeploymentStatus {
  containerStatus: 'starting' | 'running' | 'disconnected' | 'error';
  ephemeralUrl: string;
  installing?: boolean;
  devRunning?: boolean;
}

export interface CreateProjectOptions {
  userId: string;
  name?: string;
  templateUrl?: string;
  gitUrl?: string;
  gitBranch?: string;
  /** Database project UUID for progress tracking */
  dbProjectId?: string;
}

export interface IDeploymentService {
  /**
   * Create a new project with dev server + MCP
   */
  createProject(options: CreateProjectOptions): Promise<DeploymentProject>;

  /**
   * Get the status of a running project
   */
  getProjectStatus(projectId: string): Promise<DeploymentStatus>;

  /**
   * Delete/destroy a project and all its resources
   */
  deleteProject(projectId: string): Promise<void>;

  /**
   * Update project (e.g., rename)
   */
  updateProject(projectId: string, updates: { name?: string }): Promise<void>;

  /**
   * Restart a project (for recovery after server restart)
   * Optional - only needed for adapters that support process recovery
   * @param projectId - The project UUID (used as folder name)
   * @param options - Optional restart options
   * @param options.savedPort - Port from DB to reuse (avoids port changes on restart)
   */
  restartProject?(projectId: string, options?: { savedPort?: number }): Promise<DeploymentProject>;
}
