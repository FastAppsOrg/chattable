import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { createServer } from 'net';
import {
  IDeploymentService,
  DeploymentProject,
  DeploymentStatus,
  CreateProjectOptions,
} from '../../interfaces/deployment.interface.js';

const execAsync = promisify(execCallback);

/**
 * Local Deployment Adapter
 *
 * Runs projects locally on the development machine.
 *
 * Features:
 * - Instant startup
 * - Zero cost
 * - Direct filesystem access
 * - Works offline
 */
export class LocalDeploymentAdapter implements IDeploymentService {
  private projectsDir: string;
  private runningProcesses = new Map<string, ProcessInfo>();

  constructor() {
    this.projectsDir = path.join(os.homedir(), '.appkit-local-projects');
  }

  /**
   * Create a new local project
   */
  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const { userId, templateUrl, name } = options;
    const projectId = `local-${userId}-${Date.now()}`;
    const projectDir = path.join(this.projectsDir, projectId);

    console.log(`[Local] Creating project: ${projectId}`);
    console.log(`[Local] Project directory: ${projectDir}`);

    try {
      await mkdir(projectDir, { recursive: true });

      const gitUrl = templateUrl || 'https://github.com/alpic-ai/apps-sdk-template';
      console.log(`[Local] Cloning ${gitUrl}...`);
      await execAsync(`git clone ${gitUrl} .`, { cwd: projectDir });

      console.log(`[Local] Installing dependencies...`);
      const hasPnpmWorkspace = await execAsync('test -f pnpm-workspace.yaml && echo "yes" || echo "no"', { cwd: projectDir })
        .then(result => result.stdout.trim() === 'yes')
        .catch(() => false);

      const hasPackageLock = await execAsync('test -f package-lock.json && echo "yes" || echo "no"', { cwd: projectDir })
        .then(result => result.stdout.trim() === 'yes')
        .catch(() => false);

      if (hasPnpmWorkspace) {
        console.log(`[Local] Detected pnpm workspace, installing with pnpm...`);
        await execAsync('pnpm install', { cwd: projectDir });
      } else if (hasPackageLock) {
        console.log(`[Local] Detected package-lock.json, installing with npm...`);
        await execAsync('npm install', { cwd: projectDir });
      } else {
        console.log(`[Local] Installing with npm (default)...`);
        await execAsync('npm install', { cwd: projectDir });
      }

      const devPort = await this.findAvailablePort(3000);

      console.log(`[Local] Dev server will run on port ${devPort}`);

      let devCwd = projectDir;
      const hasServerDir = await execAsync('test -d server && echo "yes" || echo "no"', { cwd: projectDir })
        .then(result => result.stdout.trim() === 'yes')
        .catch(() => false);

      if (hasServerDir && hasPnpmWorkspace) {
        devCwd = path.join(projectDir, 'server');
        console.log(`[Local] Detected monorepo, running dev server from ./server`);
      }

      const devProcess = spawn(hasPnpmWorkspace ? 'pnpm' : 'npm', ['run', 'dev'], {
        cwd: devCwd,
        env: {
          ...process.env,
          PORT: devPort.toString(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      devProcess.stdout?.on('data', (data) => {
        console.log(`[Local][Dev:${projectId}] ${data.toString().trim()}`);
      });

      devProcess.stderr?.on('data', (data) => {
        console.error(`[Local][Dev:${projectId}] ${data.toString().trim()}`);
      });

      devProcess.on('exit', (code) => {
        console.log(`[Local] Dev server exited with code ${code} for ${projectId}`);
        this.runningProcesses.delete(projectId);
      });

      this.runningProcesses.set(projectId, {
        devProcess,
        devPort,
        projectDir,
      });

      console.log(`[Local] Project ${projectId} created successfully`);

      return {
        projectId,
        ephemeralUrl: `http://localhost:${devPort}`,
        mcp: {
          url: `http://localhost:${devPort}/mcp`,
          transport: 'sse',
          rootPath: projectDir,
        },
        status: 'active',
        localPath: projectDir,
      };
    } catch (error: any) {
      console.error(`[Local] Failed to create project:`, error);

      try {
        await rm(projectDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(`[Local] Cleanup failed:`, cleanupError);
      }

      throw new Error(`Failed to create local project: ${error.message}`);
    }
  }

  /**
   * Get project status
   */
  async getProjectStatus(projectId: string): Promise<DeploymentStatus> {
    const processInfo = this.runningProcesses.get(projectId);

    if (!processInfo) {
      return {
        containerStatus: 'disconnected',
        ephemeralUrl: '',
      };
    }

    const isDevRunning = processInfo.devProcess.exitCode === null;

    return {
      containerStatus: isDevRunning ? 'running' : 'disconnected',
      ephemeralUrl: `http://localhost:${processInfo.devPort}`,
      devRunning: isDevRunning,
    };
  }

  /**
   * Restart a project's processes
   */
  async restartProject(projectId: string): Promise<DeploymentProject> {
    const projectDir = path.join(this.projectsDir, projectId);

    console.log(`[Local] Restarting project: ${projectId}`);
    console.log(`[Local] Project directory: ${projectDir}`);

    try {
      await execAsync('test -d .', { cwd: projectDir });
    } catch {
      throw new Error(`Project directory not found: ${projectDir}`);
    }

    const hasPnpmWorkspace = await execAsync('test -f pnpm-workspace.yaml && echo "yes" || echo "no"', { cwd: projectDir })
      .then(result => result.stdout.trim() === 'yes')
      .catch(() => false);

    const devPort = await this.findAvailablePort(3000);

    console.log(`[Local] Dev server will run on port ${devPort}`);

    let devCwd = projectDir;
    const hasServerDir = await execAsync('test -d server && echo "yes" || echo "no"', { cwd: projectDir })
      .then(result => result.stdout.trim() === 'yes')
      .catch(() => false);

    if (hasServerDir && hasPnpmWorkspace) {
      devCwd = path.join(projectDir, 'server');
      console.log(`[Local] Detected monorepo, running dev server from ./server`);
    }

    const devProcess = spawn(hasPnpmWorkspace ? 'pnpm' : 'npm', ['run', 'dev'], {
      cwd: devCwd,
      env: {
        ...process.env,
        PORT: devPort.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    devProcess.stdout?.on('data', (data) => {
      console.log(`[Local][Dev:${projectId}] ${data.toString().trim()}`);
    });

    devProcess.stderr?.on('data', (data) => {
      console.error(`[Local][Dev:${projectId}] ${data.toString().trim()}`);
    });

    devProcess.on('exit', (code) => {
      console.log(`[Local] Dev server exited with code ${code} for ${projectId}`);
      this.runningProcesses.delete(projectId);
    });

    this.runningProcesses.set(projectId, {
      devProcess,
      devPort,
      projectDir,
    });

    console.log(`[Local] Project ${projectId} restarted successfully`);

    return {
      projectId,
      ephemeralUrl: `http://localhost:${devPort}`,
      mcp: {
        url: `http://localhost:${devPort}/mcp`,
        transport: 'sse',
        rootPath: projectDir,
      },
      status: 'active',
      localPath: projectDir,
    };
  }

  /**
   * Delete project and cleanup resources
   */
  async deleteProject(projectId: string): Promise<void> {
    console.log(`[Local] Deleting project: ${projectId}`);

    const processInfo = this.runningProcesses.get(projectId);

    if (processInfo) {
      processInfo.devProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (processInfo.devProcess.exitCode === null) {
        processInfo.devProcess.kill('SIGKILL');
      }

      this.runningProcesses.delete(projectId);

      try {
        await rm(processInfo.projectDir, { recursive: true, force: true });
        console.log(`[Local] Project directory deleted: ${processInfo.projectDir}`);
      } catch (error: any) {
        console.error(`[Local] Failed to delete project directory:`, error);
        throw new Error(`Failed to delete project directory: ${error.message}`);
      }
    }

    console.log(`[Local] Project ${projectId} deleted successfully`);
  }

  /**
   * Update project
   */
  async updateProject(projectId: string, updates: { name?: string }): Promise<void> {
    console.log(`[Local] Update project ${projectId}:`, updates);
  }

  /**
   * Find an available port starting from the given port
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;

    while (port < startPort + 100) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      port++;
    }

    throw new Error(`No available ports found in range ${startPort}-${startPort + 100}`);
  }

  /**
   * Check if a port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * Cleanup all running processes
   */
  async cleanup(): Promise<void> {
    console.log(`[Local] Cleaning up ${this.runningProcesses.size} running projects...`);

    for (const [projectId, processInfo] of this.runningProcesses.entries()) {
      processInfo.devProcess.kill('SIGTERM');
    }

    this.runningProcesses.clear();
  }
}

interface ProcessInfo {
  devProcess: ChildProcess;
  devPort: number;
  projectDir: string;
}
