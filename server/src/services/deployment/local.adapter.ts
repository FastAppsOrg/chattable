import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
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
  private runningProcesses = new Map<string, ProcessInfo>();
  public progressEmitter = new EventEmitter();

  constructor() {
    this.projectsDir = path.join(process.cwd(), '.chattable');
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
    // Use name as ID if possible, otherwise fallback to timestamp
    const safeName = name ? name.toLowerCase().replace(/[^a-z0-9-]/g, '-') : `project-${Date.now()}`;
    const projectId = safeName;
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

      // Fixed template URL as requested
      const gitUrl = 'https://github.com/Jhvictor4/apps-sdk-template';
      console.log(`[Local] Cloning ${gitUrl}...`);

      // Emit clone start event
      this.emitProgress({
        projectId: progressId,
        step: 'clone',
        message: 'Cloning repository...',
        progress: 20,
      });

      // Check if directory is empty
      const files = await execAsync('ls -A', { cwd: projectDir }).catch(() => ({ stdout: '' }));
      if (files.stdout.trim()) {
        console.log(`[Local] Directory not empty, skipping clone...`);
      } else {
        await execAsync(`git clone ${gitUrl} .`, { cwd: projectDir });

        // Patch template to use PORT environment variable and add CSP
        console.log(`[Local] Patching template for PORT and CSP...`);
        try {
          const serverIndexPath = path.join(projectDir, 'server/src/index.ts');
          let serverCode = await readFile(serverIndexPath, 'utf-8');

          // Define the port variable at the top
          const portVarDeclaration = 'const PORT = Number(process.env.PORT) || 3000;\n\n';

          // Add PORT variable before app.listen (look for "app.listen" and insert before it)
          serverCode = serverCode.replace(
            /(app\.listen\()/,
            portVarDeclaration + '$1'
          );

          // Replace app.listen(3000, with app.listen(PORT,
          serverCode = serverCode.replace(
            /app\.listen\(3000,/g,
            'app.listen(PORT,'
          );

          // Replace hardcoded port 3000 in console.log messages
          serverCode = serverCode.replace(
            /port 3000/g,
            `port \${PORT}`
          );
          serverCode = serverCode.replace(
            /localhost:3000/g,
            `localhost:\${PORT}`
          );

          // Add CSP headers - insert after express.json() middleware
          const cspMiddleware = `\n// CSP headers for security\napp.use((req, res, next) => {\n  res.setHeader(\n    'Content-Security-Policy',\n    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'"\n  );\n  next();\n});\n\n`;

          // Insert CSP middleware after app.use(express.json())
          serverCode = serverCode.replace(
            /(app\.use\(express\.json\(\)\))/,
            '$1' + cspMiddleware
          );

          await writeFile(serverIndexPath, serverCode);
          console.log(`[Local] Successfully patched template (PORT + CSP)`);
        } catch (error: any) {
          console.warn(`[Local] Could not patch template:`, error.message);
        }
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

    const devPort = await this.findAvailablePort(40000);

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
