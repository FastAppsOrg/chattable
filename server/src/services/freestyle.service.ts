import { FreestyleSandboxes } from 'freestyle-sandboxes';
import {
  IDeploymentService,
  DeploymentProject,
  DeploymentStatus,
  CreateProjectOptions,
} from '../interfaces/deployment.interface.js';

export interface FreestyleProject {
  repoId: string;
  ephemeralUrl: string;
  mcpEphemeralUrl: string;
}

export class FreestyleService implements IDeploymentService {
  private client: FreestyleSandboxes;

  constructor(apiKey: string) {
    this.client = new FreestyleSandboxes({
      apiKey,
    });
  }

  /**
   * Create a new project with Git repo + dev server
   * Implements IDeploymentService interface
   */
  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const { userId, templateUrl } = options;

    // Create Git repository from template
    const { repoId } = await this.client.createGitRepository({
      name: `appkit-${userId}-${Date.now()}`,
      public: false,
      source: {
        url: templateUrl || 'https://github.com/freestyle-sh/freestyle-next', // Use simple Next.js template for testing
      },
      devServers: {
        preset: 'nextJs',
      },
    });

    // Request dev server for the repository
    const devServer = await this.client.requestDevServer({
      repoId,
    });

    const { ephemeralUrl, mcpEphemeralUrl } = devServer;

    return {
      projectId: repoId,
      ephemeralUrl,
      mcp: {
        url: mcpEphemeralUrl,
        transport: 'sse',
        rootPath: '/app', // Freestyle exposes /app directory
      },
      status: 'active',
    };
  }

  /**
   * Get project status
   * Implements IDeploymentService interface
   */
  async getProjectStatus(projectId: string): Promise<DeploymentStatus> {
    try {
      const devServerStatus = await this.getDevServerStatus(projectId);

      let containerStatus: 'starting' | 'running' | 'disconnected' | 'error';

      if (devServerStatus.installing || devServerStatus.installCommandRunning) {
        containerStatus = 'starting';
      } else if (devServerStatus.devRunning || devServerStatus.devCommandRunning) {
        containerStatus = 'running';
      } else {
        containerStatus = 'disconnected';
      }

      return {
        containerStatus,
        ephemeralUrl: devServerStatus.ephemeralUrl,
        installing: devServerStatus.installing,
        devRunning: devServerStatus.devRunning,
      };
    } catch (error: any) {
      throw new Error(`Failed to get Freestyle status: ${error.message}`);
    }
  }

  /**
   * Delete project
   * Implements IDeploymentService interface
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.deleteRepository(projectId);
  }

  /**
   * Update project
   * Implements IDeploymentService interface
   */
  async updateProject(projectId: string, updates: { name?: string }): Promise<void> {
    // Freestyle doesn't support repository renaming
  }

  /**
   * Get dev server status/URL
   */
  async getDevServer(repoId: string) {
    const devServer = await this.client.requestDevServer({
      repoId,
    });

    return {
      ephemeralUrl: devServer.ephemeralUrl,
      mcpEphemeralUrl: devServer.mcpEphemeralUrl,
      devCommandRunning: devServer.devCommandRunning,
      installCommandRunning: devServer.installCommandRunning,
      isNew: devServer.isNew,
    };
  }

  /**
   * Get detailed dev server status
   */
  async getDevServerStatus(repoId: string) {
    const devServer = await this.client.requestDevServer({
      repoId,
    });

    // Get real-time status
    const status = await devServer.status();

    return {
      ephemeralUrl: devServer.ephemeralUrl,
      mcpEphemeralUrl: devServer.mcpEphemeralUrl,
      devCommandRunning: devServer.devCommandRunning,
      installCommandRunning: devServer.installCommandRunning,
      installing: status.installing,
      devRunning: status.devRunning,
      isNew: devServer.isNew,
    };
  }

  /**
   * Deploy project to production
   */
  async deployProject(repoId: string, domains: string[]) {
    const result = await this.client.deployWeb(
      {
        kind: 'git',
        url: `https://git.freestyle.sh/${repoId}`,
      },
      {
        domains,
        envVars: {
          // Add any environment variables needed
        },
      }
    );

    return result;
  }

  /**
   * Get commits for a repository branch
   * Note: Not yet supported by freestyle-sandboxes SDK
   */
  async getCommits(repoId: string, branch: string = 'main', limit: number = 20) {
    return [];
  }

  /**
   * Get branches for a repository
   * Note: Not yet supported by freestyle-sandboxes SDK
   */
  async getBranches(repoId: string) {
    return [];
  }

  /**
   * Delete a Git repository
   */
  async deleteRepository(repoId: string) {
    try {
      await this.client.deleteGitRepository({
        repoId,
      });
    } catch (error: any) {
      console.error(`[Freestyle] Failed to delete repository ${repoId}:`, error);
      throw new Error(`Failed to delete Freestyle repository: ${error.message}`);
    }
  }
}
