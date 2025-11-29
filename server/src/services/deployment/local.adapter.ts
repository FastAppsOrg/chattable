import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { mkdir, rm, cp } from 'fs/promises';
import path from 'path';
import { createServer } from 'net';
import { EventEmitter } from 'events';
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
export interface ProgressEvent {
  projectId: string;
  step: 'start' | 'clone' | 'install' | 'dev-server' | 'complete' | 'error';
  message: string;
  progress?: number; // 0-100
}

export class LocalDeploymentAdapter implements IDeploymentService {
  private projectsDir: string;
  private templateDir: string;
  private runningProcesses = new Map<string, ProcessInfo>();
  public progressEmitter = new EventEmitter();

  constructor() {
    this.projectsDir = path.join(process.cwd(), '.chattable');
    this.templateDir = path.join(process.cwd(), '..', 'template');
  }

  private emitProgress(event: ProgressEvent) {
    console.log(`[Progress] ${event.projectId}: ${event.step} - ${event.message}`);
    this.progressEmitter.emit('progress', event);
  }

  /**
   * Create a new local project
   */
  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const { userId, name, dbProjectId } = options;
    // Use database project ID as folder name for easy tracking
    const projectId = dbProjectId || `project-${Date.now()}`;
    const projectDir = path.join(this.projectsDir, projectId);

    console.log(`[Local] Creating project: ${projectId}`);
    console.log(`[Local] Project directory: ${projectDir}`);
    console.log(`[Local] Database project ID: ${dbProjectId}`);

    // Use dbProjectId for progress tracking if provided, otherwise fallback to deployment projectId
    const progressId = dbProjectId || projectId;

    try {
      // Emit start event
      this.emitProgress({
        projectId: progressId,
        step: 'start',
        message: 'Initializing project...',
        progress: 0,
      });
      await mkdir(projectDir, { recursive: true });

      // Copy template from local template/ folder (no network required)
      console.log(`[Local] Copying template from ${this.templateDir}...`);

      // Emit copy start event
      this.emitProgress({
        projectId: progressId,
        step: 'clone',
        message: 'Copying template...',
        progress: 20,
      });

      // Check if directory is empty
      const files = await execAsync('ls -A', { cwd: projectDir }).catch(() => ({ stdout: '' }));
      if (files.stdout.trim()) {
        console.log(`[Local] Directory not empty, skipping copy...`);
      } else {
        // Copy template folder recursively (Node.js 16.7+ native)
        await cp(this.templateDir, projectDir, { recursive: true });
        console.log(`[Local] Template copied successfully`);

        // Initialize git repo for the new project
        await execAsync('git init', { cwd: projectDir });
        console.log(`[Local] Git repository initialized`);
      }

      console.log(`[Local] Installing dependencies...`);

      // Emit install start event
      this.emitProgress({
        projectId: progressId,
        step: 'install',
        message: 'Installing dependencies...',
        progress: 50,
      });
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

      const devPort = await this.findAvailablePort(40000);

      console.log(`[Local] Dev server will run on port ${devPort}`);

      // Emit dev server start event
      this.emitProgress({
        projectId: progressId,
        step: 'dev-server',
        message: 'Starting development server...',
        progress: 80,
      });

      // pnpm workspace runs from root, npm runs from project dir
      const devCwd = projectDir;
      const pkgManager = hasPnpmWorkspace ? 'pnpm' : 'npm';
      const devCommand = `PORT=${devPort} ${pkgManager} run dev`;

      console.log(`[Local] Spawning dev server: ${devCommand}`);

      const devProcess = spawn('sh', ['-c', devCommand], {
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

      // Start widget dev server if pnpm workspace (skybridge expects port 3000)
      let widgetProcess: ChildProcess | undefined;
      let widgetPort: number | undefined;

      if (hasPnpmWorkspace) {
        // Check if dev:widget script exists by looking for it in package.json scripts
        const hasWidgetScript = await execAsync(`grep -q '"dev:widget"' package.json && echo "yes"`, { cwd: projectDir })
          .then(result => result.stdout.includes('yes'))
          .catch(() => false);

        if (hasWidgetScript) {
          // Skybridge hardcodes port 3000 for development, so we must use that
          widgetPort = 3000;
          const widgetCommand = `${pkgManager} run dev:widget`;

          console.log(`[Local] Spawning widget dev server: ${widgetCommand} on port ${widgetPort}`);

          widgetProcess = spawn('sh', ['-c', widgetCommand], {
            cwd: devCwd,
            env: {
              ...process.env,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          widgetProcess.stdout?.on('data', (data) => {
            console.log(`[Local][Widget:${projectId}] ${data.toString().trim()}`);
          });

          widgetProcess.stderr?.on('data', (data) => {
            console.error(`[Local][Widget:${projectId}] ${data.toString().trim()}`);
          });

          widgetProcess.on('exit', (code) => {
            console.log(`[Local] Widget server exited with code ${code} for ${projectId}`);
          });
        }
      }

      this.runningProcesses.set(projectId, {
        devProcess,
        devPort,
        projectDir,
        widgetProcess,
        widgetPort,
      });

      console.log(`[Local] Project ${projectId} created successfully`);

      // Emit complete event
      this.emitProgress({
        projectId: progressId,
        step: 'complete',
        message: 'Project ready!',
        progress: 100,
      });

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

      // Emit error event
      this.emitProgress({
        projectId: progressId,
        step: 'error',
        message: `Error: ${error.message}`,
        progress: 0,
      });

      // Only cleanup if we created the directory and it failed immediately
      // For now, let's be safe and NOT delete potentially existing user data if it wasn't empty
      // But since we did mkdir, we might want to cleanup if it was empty.
      // Keeping it simple: don't auto-delete for now to avoid accidents in local mode.

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
   * @param projectId - The project UUID (used as folder name)
   * @param options - Optional restart options
   * @param options.savedPort - Port from DB to reuse (avoids port changes on restart)
   */
  async restartProject(projectId: string, options?: { savedPort?: number }): Promise<DeploymentProject> {
    const projectDir = path.join(this.projectsDir, projectId);

    console.log(`[Local] Restarting project: ${projectId}`);
    console.log(`[Local] Project directory: ${projectDir}`);
    console.log(`[Local] Saved port from DB: ${options?.savedPort}`);

    try {
      await execAsync('test -d .', { cwd: projectDir });
    } catch {
      throw new Error(`Project directory not found: ${projectDir}`);
    }

    const hasPnpmWorkspace = await execAsync('test -f pnpm-workspace.yaml && echo "yes" || echo "no"', { cwd: projectDir })
      .then(result => result.stdout.trim() === 'yes')
      .catch(() => false);

    // Use saved port from DB if available, otherwise find a new available port
    let devPort: number;
    if (options?.savedPort) {
      // Check if saved port is available
      const isAvailable = await this.isPortAvailable(options.savedPort);
      if (isAvailable) {
        devPort = options.savedPort;
        console.log(`[Local] Reusing saved port ${devPort}`);
      } else {
        console.log(`[Local] Saved port ${options.savedPort} is in use, finding new port...`);
        devPort = await this.findAvailablePort(40000);
      }
    } else {
      devPort = await this.findAvailablePort(40000);
    }

    console.log(`[Local] Dev server will run on port ${devPort}`);

    // pnpm workspace runs from root
    const devCwd = projectDir;
    const pkgManager = hasPnpmWorkspace ? 'pnpm' : 'npm';
    const devCommand = `PORT=${devPort} ${pkgManager} run dev`;

    const devProcess = spawn('sh', ['-c', devCommand], {
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

    // Start widget dev server if pnpm workspace (skybridge expects port 3000)
    let widgetProcess: ChildProcess | undefined;
    let widgetPort: number | undefined;

    if (hasPnpmWorkspace) {
      // Check if dev:widget script exists by looking for it in package.json scripts
      const hasWidgetScript = await execAsync(`grep -q '"dev:widget"' package.json && echo "yes"`, { cwd: projectDir })
        .then(result => result.stdout.includes('yes'))
        .catch(() => false);

      if (hasWidgetScript) {
        // Skybridge hardcodes port 3000 for development, so we must use that
        widgetPort = 3000;
        const widgetCommand = `${pkgManager} run dev:widget`;

        console.log(`[Local] Spawning widget dev server: ${widgetCommand} on port ${widgetPort}`);

        widgetProcess = spawn('sh', ['-c', widgetCommand], {
          cwd: devCwd,
          env: {
            ...process.env,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        widgetProcess.stdout?.on('data', (data) => {
          console.log(`[Local][Widget:${projectId}] ${data.toString().trim()}`);
        });

        widgetProcess.stderr?.on('data', (data) => {
          console.error(`[Local][Widget:${projectId}] ${data.toString().trim()}`);
        });

        widgetProcess.on('exit', (code) => {
          console.log(`[Local] Widget server exited with code ${code} for ${projectId}`);
        });
      }
    }

    this.runningProcesses.set(projectId, {
      devProcess,
      devPort,
      projectDir,
      widgetProcess,
      widgetPort,
    });

    // Wait for server to be actually ready before returning
    console.log(`[Local] Waiting for dev server to be ready on port ${devPort}...`);
    const isReady = await this.waitForServerReady(devPort, 30000); // 30 second timeout

    if (!isReady) {
      console.warn(`[Local] Dev server may not be fully ready yet, but process is running`);
    } else {
      console.log(`[Local] Dev server is ready on port ${devPort}`);
    }

    console.log(`[Local] Project ${projectId} restarted successfully`);

    return {
      projectId: projectId,
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
   * Wait for server to be ready by polling the health endpoint
   */
  private async waitForServerReady(port: number, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:${port}/mcp`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000), // 2 second timeout per request
        });
        // Any response (even error) means server is listening
        if (response.status) {
          return true;
        }
      } catch (error: any) {
        // Connection refused means server not ready yet, keep polling
        // Other errors might also indicate not ready
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  /**
   * Delete project and cleanup resources
   */
  async deleteProject(projectId: string): Promise<void> {
    console.log(`[Local] Deleting project: ${projectId}`);

    const processInfo = this.runningProcesses.get(projectId);

    if (processInfo) {
      // Kill dev process
      processInfo.devProcess.kill('SIGTERM');

      // Kill widget process if running
      if (processInfo.widgetProcess) {
        processInfo.widgetProcess.kill('SIGTERM');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (processInfo.devProcess.exitCode === null) {
        processInfo.devProcess.kill('SIGKILL');
      }

      if (processInfo.widgetProcess && processInfo.widgetProcess.exitCode === null) {
        processInfo.widgetProcess.kill('SIGKILL');
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
      if (processInfo.widgetProcess) {
        processInfo.widgetProcess.kill('SIGTERM');
      }
    }

    this.runningProcesses.clear();
  }
}

interface ProcessInfo {
  devProcess: ChildProcess;
  devPort: number;
  projectDir: string;
  widgetProcess?: ChildProcess;
  widgetPort?: number;
}
