import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  IDeploymentService,
  DeploymentProject,
  DeploymentStatus,
  CreateProjectOptions,
} from '../../interfaces/deployment.interface';

const execFileAsync = promisify(execFile);

export class FlyioDeploymentAdapter implements IDeploymentService {
  private flyToken: string;

  constructor(flyToken: string) {
    this.flyToken = flyToken;
  }

  private async runFlyCommand(args: string[], cwd: string): Promise<string> {
    const env = {
      ...process.env,
      FLY_API_TOKEN: this.flyToken,
    };

    try {
      const { stdout, stderr } = await execFileAsync('fly', args, {
        cwd,
        env,
        timeout: 120000, // 2 minutes timeout
      });

      if (stderr) {
        console.error('[Fly.io] stderr:', stderr);
      }

      return stdout;
    } catch (error: any) {
      console.error('[Fly.io] Command failed:', error);
      throw new Error(`Fly.io command failed: ${error.message}`);
    }
  }

  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const { userId, templateUrl, name } = options;
    const appName = `appkit-${userId}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const projectDir = `/tmp/flyio-${appName}`;

    try {
      // 0. Create project directory
      await mkdir(projectDir, { recursive: true });

      // 1. Create Dockerfile
      await this.createDockerfile(projectDir, templateUrl);

      // 2. Create fly.toml
      await this.createFlyToml(projectDir, appName);

      // 3. Create Fly app
      await this.runFlyCommand(['apps', 'create', appName], projectDir);

      // 4. Create volume for persistent filesystem
      await this.runFlyCommand(
        ['volumes', 'create', 'app_data', '--region', 'nrt', '--size', '1', '-a', appName, '--yes'],
        projectDir
      );

      // 5. Deploy
      const output = await this.runFlyCommand(['deploy', '--ha=false'], projectDir);

      return {
        projectId: appName,
        ephemeralUrl: `https://${appName}.fly.dev`,
        mcp: {
          url: `https://${appName}.fly.dev:8080/sse`,
          transport: 'sse',
          rootPath: '/app', // Fly.io exposes /app directory via volume mount
        },
        status: 'active',
      };
    } catch (error: any) {
      console.error('[Fly.io] Failed to create project:', error);

      // Cleanup on failure
      try {
        await this.runFlyCommand(['apps', 'destroy', appName, '--yes'], projectDir);
      } catch (cleanupError) {
        console.error('[Fly.io] Cleanup failed:', cleanupError);
      }

      throw new Error(`Failed to create Fly.io project: ${error.message}`);
    }
  }

  async getProjectStatus(projectId: string): Promise<DeploymentStatus> {
    try {
      const output = await this.runFlyCommand(['status', '-a', projectId], process.cwd());

      const isRunning = output.includes('running');
      const isStopped = output.includes('stopped');

      let containerStatus: 'starting' | 'running' | 'disconnected' | 'error';

      if (isRunning) {
        containerStatus = 'running';
      } else if (isStopped) {
        containerStatus = 'disconnected';
      } else {
        containerStatus = 'starting';
      }

      return {
        containerStatus,
        ephemeralUrl: `https://${projectId}.fly.dev`,
        devRunning: isRunning,
      };
    } catch (error: any) {
      console.error('[Fly.io] Failed to get status:', error);
      return {
        containerStatus: 'error',
        ephemeralUrl: `https://${projectId}.fly.dev`,
      };
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.runFlyCommand(['apps', 'destroy', projectId, '--yes'], process.cwd());
    } catch (error: any) {
      console.error('[Fly.io] Failed to delete:', error);
      throw new Error(`Failed to delete Fly.io app: ${error.message}`);
    }
  }

  async updateProject(projectId: string, updates: { name?: string }): Promise<void> {
    // Fly.io doesn't support app renaming directly
    // We would need to create a new app and migrate
  }

  private async createDockerfile(dir: string, templateUrl?: string): Promise<void> {
    const url = templateUrl || 'https://github.com/alpic-ai/apps-sdk-template';

    const dockerfile = `FROM node:20-alpine

# Install flyctl for MCP
COPY --from=flyio/flyctl /flyctl /usr/bin/flyctl

WORKDIR /app

# Install git
RUN apk add --no-cache git

# Clone template
RUN git clone ${url} /app

# Install dependencies
RUN npm install

# Install MCP filesystem server
RUN npm install -g @modelcontextprotocol/server-filesystem

# Expose ports
EXPOSE 3000 8080

# Start both servers
CMD flyctl mcp wrap -- npx -y @modelcontextprotocol/server-filesystem /app & \\
    cd /app && npm run dev
`;

    await writeFile(path.join(dir, 'Dockerfile'), dockerfile);
  }

  private async createFlyToml(dir: string, appName: string): Promise<void> {
    const toml = `app = "${appName}"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 8080

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1

[mounts]
  source = "app_data"
  destination = "/app"
`;

    await writeFile(path.join(dir, 'fly.toml'), toml);
  }
}
