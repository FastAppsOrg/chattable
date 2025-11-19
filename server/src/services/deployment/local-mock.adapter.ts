import {
  IDeploymentService,
  DeploymentProject,
  DeploymentStatus,
  CreateProjectOptions,
} from '../../interfaces/deployment.interface.js';

/**
 * Local Mock Deployment Adapter
 *
 * For local development when Freestyle/Fly.io are not working.
 *
 * Behavior:
 * - User manually runs MCP server on localhost:8888 (with tools & widgets)
 * - All projects point to that same localhost:8888
 * - Project CRUD still uses real Supabase DB (no mocking)
 * - No git clone, no npm install, no process management
 *
 * This allows UI development with real DB while bypassing broken deployment services.
 */
export class LocalMockDeploymentAdapter implements IDeploymentService {
  private readonly mockUrl: string;

  constructor(mockUrl: string) {
    this.mockUrl = mockUrl;
  }

  /**
   * Create a new project (mock deployment)
   * Just returns the mock server URL - doesn't actually deploy anything
   */
  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const { userId, name } = options;
    const projectId = `mock-${userId}-${Date.now()}`;

    // Simulate deployment delay (~2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      projectId,
      ephemeralUrl: this.mockUrl,
      mcp: {
        url: `${this.mockUrl}/mcp`,
        transport: 'sse',
        rootPath: '/mock',
      },
      status: 'active',
    };
  }

  /**
   * Get project status
   * Always returns 'running' since we assume the mock server is up
   */
  async getProjectStatus(projectId: string): Promise<DeploymentStatus> {
    return {
      containerStatus: 'running',
      ephemeralUrl: this.mockUrl,
      devRunning: true,
    };
  }

  /**
   * Restart project (no-op in mock mode)
   */
  async restartProject(projectId: string): Promise<DeploymentProject> {
    return {
      projectId,
      ephemeralUrl: this.mockUrl,
      mcp: {
        url: `${this.mockUrl}/mcp`,
        transport: 'sse',
        rootPath: '/mock',
      },
      status: 'active',
    };
  }

  /**
   * Delete project (no-op in mock mode since nothing was deployed)
   */
  async deleteProject(projectId: string): Promise<void> {
    // No-op
  }

  /**
   * Update project (no-op in mock mode)
   */
  async updateProject(projectId: string, updates: { name?: string }): Promise<void> {
    // No-op
  }

  /**
   * Cleanup (no-op in mock mode)
   */
  async cleanup(): Promise<void> {
    // No-op
  }
}
