import { Router, Request, Response } from 'express';
import { IDeploymentService } from '../interfaces/deployment.interface.js';
import { DatabaseService } from '../db/db.service.js';
import { MCPService } from '../services/mcp.service.js';
import { MemoryService } from '../services/memory.service.js';

export function createProjectsRoutes(
  deploymentService: IDeploymentService,
  dbService: DatabaseService,
  mcpService: MCPService
) {
  const router = Router();

  /**
   * POST /api/projects
   * Create a new project
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, gitUrl, gitBranch, templateUrl } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const projectName = name || 'Untitled Project';
      const deploymentId = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Create DB project record immediately with status='initializing'
      const dbProject = await dbService.createProject({
        userId: user.id,
        deploymentId,
        name: projectName,
        gitUrl: gitUrl || templateUrl,
        gitBranch: gitBranch || 'main',
        ephemeralUrl: null,
        mcpEphemeralUrl: null,
        status: 'initializing',
      });

      // Return immediately to frontend
      res.json({
        project_id: dbProject.id,
        name: dbProject.name,
        git_url: dbProject.gitUrl,
        default_branch: dbProject.gitBranch,
        status: 'initializing',
        created_at: dbProject.createdAt,
        deployment_id: dbProject.deploymentId,
        ephemeral_url: null,
        mcp_ephemeral_url: null,
      });

      // Create Mastra Memory thread immediately
      try {
        const memory = await MemoryService.getMemory();
        await memory.createThread({
          threadId: dbProject.id,
          resourceId: user.id,
        });
        console.log(`[Projects] Created Mastra thread for project ${dbProject.id}`);
      } catch (error: any) {
        console.error(`[Projects] Failed to create Mastra thread:`, error);
      }

      // Start async deployment in background (don't await)
      deploymentService.createProject({
        userId: user.id,
        name: projectName,
        templateUrl: templateUrl || gitUrl,
        gitUrl,
        gitBranch: gitBranch || 'main',
        dbProjectId: dbProject.id, // Pass database UUID for progress tracking
      }).then(async (deployment) => {
        // Update DB with deployment info - pass userId as second parameter!
        await dbService.updateProject(dbProject.id, user.id, {
          ephemeralUrl: deployment.ephemeralUrl,
          mcpEphemeralUrl: deployment.mcp.url,
          status: deployment.status,
        });
        console.log(`[Projects] Background deployment completed for ${dbProject.id}`);
      }).catch((error) => {
        console.error(`[Projects] Background deployment failed for ${dbProject.id}:`, error);
        // Update status to error - pass userId as second parameter!
        dbService.updateProject(dbProject.id, user.id, {
          status: 'error',
        }).catch(console.error);
      });

    } catch (error: any) {
      console.error('[Projects] Failed to create project:', error);
      res.status(500).json({
        error: 'Failed to create project',
        message: error.message,
        details: error.stack,
      });
    }
  });

  /**
   * GET /api/projects
   * Get all projects for authenticated user
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const projects = await dbService.getProjects(user.id);

      const transformedProjects = projects.map((p: any) => ({
        project_id: p.id,
        name: p.name,
        git_url: p.gitUrl,
        default_branch: p.gitBranch,
        status: p.status,
        created_at: p.createdAt,
        deployment_id: p.deploymentId,
        ephemeral_url: p.ephemeralUrl,
        mcp_ephemeral_url: p.mcpEphemeralUrl,
      }));

      res.json(transformedProjects);
    } catch (error: any) {
      console.error('[Projects] Failed to get projects:', error);
      res.status(500).json({
        error: 'Failed to get projects',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/projects/:id
   * Get a single project
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({
        project_id: project.id,
        name: project.name,
        git_url: project.gitUrl,
        default_branch: project.gitBranch,
        status: project.status,
        created_at: project.createdAt,
        deployment_id: project.deploymentId,
        ephemeral_url: project.ephemeralUrl,
        mcp_ephemeral_url: project.mcpEphemeralUrl,
      });
    } catch (error: any) {
      console.error('[Projects] Failed to get project:', error);
      res.status(404).json({
        error: 'Project not found',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/projects/:projectId/title
   * Get auto-generated thread title from Mastra Memory
   */
  router.get('/:projectId/title', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const user = (req as any).user;

      console.log(`[Projects] GET /:projectId/title called for project ${projectId}, user ${user?.id}`);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(projectId, user.id);

      if (!project) {
        console.log(`[Projects] Project ${projectId} not found`);
        return res.status(404).json({ error: 'Project not found' });
      }

      console.log(`[Projects] Fetching title from Mastra Memory for thread ${projectId}, resource ${user.id}`);
      const { MemoryService } = await import('../services/memory.service.js');
      const title = await MemoryService.getThreadTitle(projectId, user.id);

      if (!title) {
        console.log(`[Projects] Thread title not generated yet for project ${projectId}`);
        return res.status(404).json({ error: 'Thread title not generated yet' });
      }

      console.log(`[Projects] Got title from Mastra: "${title}", updating project name...`);
      // Update project name with the thread title
      await dbService.updateProject(projectId, user.id, { name: title });

      console.log(`[Projects] Project name updated successfully to "${title}"`);
      return res.json({ title });
    } catch (error: any) {
      console.error('[Projects] Error fetching thread title:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch thread title' });
    }
  });

  /**
   * GET /api/projects/:id/status
   * Get project connection status
   */
  router.get('/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      let containerStatus: 'starting' | 'running' | 'disconnected' | 'error';

      if (project.status === 'initializing') {
        containerStatus = 'starting';
      } else if (project.status === 'failed') {
        containerStatus = 'error';
      } else if (project.status === 'active' && project.deploymentId) {
        try {
          const status = await deploymentService.getProjectStatus(project.deploymentId);
          containerStatus = status.containerStatus;
        } catch (error: any) {
          console.error('[Projects] Failed to get deployment status:', error.message);
          containerStatus = 'error';
        }
      } else {
        containerStatus = 'disconnected';
      }

      res.json({
        container_status: containerStatus,
        ephemeral_url: project.ephemeralUrl,
      });
    } catch (error: any) {
      console.error('[Projects] Failed to get project status:', error);
      res.status(404).json({
        error: 'Project not found',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/projects/:id/progress
   * Stream project creation progress via Server-Sent Events (SSE)
   */
  router.get('/:id/progress', async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial comment to establish connection
    res.write(': connected\n\n');

    // Listen for progress events for this project
    const progressListener = (event: any) => {
      if (event.projectId === id) {
        const data = JSON.stringify(event);
        res.write(`data: ${data}\n\n`);

        // Close connection on complete or error
        if (event.step === 'complete' || event.step === 'error') {
          setTimeout(() => {
            res.end();
          }, 500);
        }
      }
    };

    deploymentService.progressEmitter.on('progress', progressListener);

    // Cleanup on client disconnect
    req.on('close', () => {
      deploymentService.progressEmitter.off('progress', progressListener);
      res.end();
    });
  });

  /**
   * POST /api/projects/:id/restart
   * Restart a project (for recovery after server restart)
   */
  router.post('/:id/restart', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.deploymentId) {
        return res.status(400).json({
          error: 'Cannot restart project',
          message: 'Project has no deployment ID',
        });
      }

      if (!deploymentService.restartProject) {
        return res.status(400).json({
          error: 'Restart not supported',
          message: 'This deployment adapter does not support project restart',
        });
      }

      const deployment = await deploymentService.restartProject(project.deploymentId);

      await dbService.updateProject(id, user.id, {
        ephemeralUrl: deployment.ephemeralUrl,
        mcpEphemeralUrl: deployment.mcp.url,
      });

      res.json({
        success: true,
        message: 'Project restarted successfully',
        ephemeral_url: deployment.ephemeralUrl,
        mcp_ephemeral_url: deployment.mcp.url,
      });
    } catch (error: any) {
      console.error('[Projects] Failed to restart project:', error);
      res.status(500).json({
        error: 'Failed to restart project',
        message: error.message,
      });
    }
  });

  /**
   * PATCH /api/projects/:id
   * Update a project
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;

      const updatedProject = await dbService.updateProject(id, user.id, updates);

      if (!updatedProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (name && updatedProject.deploymentId) {
        try {
          await deploymentService.updateProject(updatedProject.deploymentId, { name });
        } catch (error: any) {
          console.error('[Projects] Failed to update deployment name:', error);
        }
      }

      res.json({
        project_id: updatedProject.id,
        name: updatedProject.name,
        description: updatedProject.description,
        git_url: updatedProject.gitUrl,
        default_branch: updatedProject.gitBranch,
        status: updatedProject.status,
        created_at: updatedProject.createdAt,
        deployment_id: updatedProject.deploymentId,
        ephemeral_url: updatedProject.ephemeralUrl,
        mcp_ephemeral_url: updatedProject.mcpEphemeralUrl,
      });
    } catch (error: any) {
      console.error('[Projects] Failed to update project:', error);
      res.status(404).json({
        error: 'Failed to update project',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/projects/:id
   * Delete a project
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.deploymentId) {
        try {
          await deploymentService.deleteProject(project.deploymentId);
        } catch (error: any) {
          console.error('[Projects] Failed to delete deployment (continuing):', error.message);
        }
      }

      await mcpService.closeClient(project.deploymentId);
      await dbService.deleteProject(id, user.id);

      res.json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error: any) {
      console.error('[Projects] Failed to delete project:', error);
      res.status(404).json({
        error: 'Failed to delete project',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/projects/:id/mcp/tools
   * Get MCP tools for a project
   */
  router.get('/:id/mcp/tools', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({
          error: 'MCP not available',
          message: 'This project does not have an MCP server configured',
        });
      }

      const tools = await mcpService.getTools(project.mcpEphemeralUrl);

      res.json({
        tools,
        mcp_url: project.mcpEphemeralUrl,
      });
    } catch (error: any) {
      console.error('[Projects] Failed to get MCP tools:', error);
      res.status(500).json({
        error: 'Failed to get MCP tools',
        message: error.message,
        details: error.stack,
      });
    }
  });

  /**
   * GET /api/projects/:id/mcp/resources
   * Get MCP resources for a project
   */
  router.get('/:id/mcp/resources', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({
          error: 'Project does not have an MCP server URL',
        });
      }

      const resources = await mcpService.getResources(project.mcpEphemeralUrl);

      res.json({
        resources,
        mcp_url: project.mcpEphemeralUrl,
      });
    } catch (error: any) {
      console.error('[Projects] Failed to get MCP resources:', error);
      res.status(500).json({
        error: 'Failed to get MCP resources',
        message: error.message,
        details: error.stack,
      });
    }
  });

  /**
   * POST /api/projects/:id/mcp/resources/read
   * Read an MCP resource by URI
   */
  router.post('/:id/mcp/resources/read', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { uri } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!uri) {
        return res.status(400).json({ error: 'Resource URI is required' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({
          error: 'MCP not available',
          message: 'This project does not have an MCP server configured',
        });
      }


      const result = await mcpService.readResource(project.mcpEphemeralUrl, uri);

      res.json(result);
    } catch (error: any) {
      console.error(`[Projects] Failed to read resource:`, error);
      res.status(500).json({
        error: 'Failed to read resource',
        message: error.message,
        details: error.stack,
      });
    }
  });

  /**
   * POST /api/projects/:id/mcp/tools/:toolName/call
   * Call an MCP tool with given parameters
   */
  router.post('/:id/mcp/tools/:toolName/call', async (req: Request, res: Response) => {
    const { id, toolName } = req.params;
    const params = req.body;

    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({
          error: 'MCP not available',
          message: 'This project does not have an MCP server configured',
        });
      }

      const result = await mcpService.callTool(project.mcpEphemeralUrl, toolName, params);

      res.json(result);
    } catch (error: any) {
      console.error(`[Projects] Failed to call tool ${toolName}:`, error);
      res.status(500).json({
        error: `Failed to call tool ${toolName}`,
        message: error.message,
        details: error.stack,
      });
    }
  });

  /**
   * GET /api/projects/:id/mcp/widgets
   * Get widget bindings for a project (reads widget-config.json via MCP)
   */
  router.get('/:id/mcp/widgets', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({
          error: 'MCP not available',
          message: 'This project does not have an MCP server configured',
        });
      }

      const client = await mcpService.getClient(project.mcpEphemeralUrl);

      try {
        const configPath = 'widget-config.json';
        res.json({
          widgets: [],
          message: 'Widget config reading not yet implemented',
        });
      } catch (error: any) {
        res.json({
          widgets: [],
        });
      }
    } catch (error: any) {
      console.error('[Projects] Failed to get widget bindings:', error);
      res.status(500).json({
        error: 'Failed to get widget bindings',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/projects/:id/files/tree
   * Get file tree structure (IDE-like file explorer)
   */
  router.get('/:id/files/tree', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { path: dirPath = '' } = req.query;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const isLocal = project.deploymentId?.startsWith('local-');

      if (!isLocal) {
        return res.status(400).json({
          error: 'Not supported',
          message: 'File tree is only available for local projects',
        });
      }

      const { readdir, stat } = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const projectDir = path.join(process.cwd(), '.chattable', project.deploymentId!);
      const targetDir = path.join(projectDir, dirPath as string);

      // Security check
      if (!path.normalize(targetDir).startsWith(path.normalize(projectDir))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const entries = await readdir(targetDir, { withFileTypes: true });

      const filtered = entries.filter(entry =>
        !['node_modules', '.git', 'dist', '.next', '.turbo', 'coverage'].includes(entry.name)
      );

      const tree = await Promise.all(
        filtered.map(async (entry) => {
          const fullPath = path.join(targetDir, entry.name);
          const relativePath = path.relative(projectDir, fullPath);
          const stats = await stat(fullPath);

          return {
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
          };
        })
      );

      tree.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json({ tree });
    } catch (error: any) {
      console.error('[Projects] Failed to get file tree:', error);
      res.status(500).json({
        error: 'Failed to get file tree',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/projects/:id/files
   * Read a file from the project
   */
  router.get('/:id/files', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { path: filePath } = req.query;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'File path is required',
        });
      }

      const project = await dbService.getProject(id, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({
          error: 'MCP not available',
          message: 'This project does not have an MCP server configured',
        });
      }

      const isLocal = project.deploymentId?.startsWith('local-');

      if (isLocal) {
        const { readFile } = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        const projectDir = path.join(process.cwd(), '.chattable', project.deploymentId!);
        const fullPath = path.join(projectDir, filePath);
        const normalizedPath = path.normalize(fullPath);
        if (!normalizedPath.startsWith(path.normalize(projectDir))) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'Cannot access files outside project directory',
          });
        }

        const content = await readFile(fullPath, 'utf-8');
        return res.json({
          path: filePath,
          content,
        });
      }

      throw new Error('File reading via MCP not yet implemented');
    } catch (error: any) {
      console.error('[Projects] Failed to read file:', error);
      res.status(500).json({
        error: 'Failed to read file',
        message: error.message,
        details: error.stack,
      });
    }
  });

  interface WidgetData {
    projectId: string;
    uri: string;
    toolInput: Record<string, any>;
    toolOutput: any;
    toolResponseMetadata?: Record<string, any> | null;
    toolId: string;
    toolName: string;
    theme?: 'light' | 'dark';
    htmlContent?: string;
    timestamp: number;
  }

  const widgetDataStore = new Map<string, WidgetData>();

  setInterval(
    () => {
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      for (const [toolId, data] of widgetDataStore.entries()) {
        if (now - data.timestamp > ONE_HOUR) {
          widgetDataStore.delete(toolId);
        }
      }
    },
    5 * 60 * 1000
  ).unref();

  const serializeForInlineScript = (value: unknown) =>
    JSON.stringify(value ?? null)
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

  /**
   * POST /api/projects/:projectId/mcp/widget/store
   * Store widget data for rendering
   */
  router.post('/:projectId/mcp/widget/store', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const {
        uri,
        toolInput,
        toolOutput,
        toolResponseMetadata,
        toolId,
        toolName,
        theme,
        htmlContent,
      } = req.body;

      if (!uri || !toolId || !toolName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: uri, toolId, toolName',
        });
      }

      widgetDataStore.set(toolId, {
        projectId,
        uri,
        toolInput: toolInput || {},
        toolOutput: toolOutput || null,
        toolResponseMetadata: toolResponseMetadata ?? null,
        toolId,
        toolName,
        theme: theme ?? 'light',
        htmlContent: htmlContent || '',
        timestamp: Date.now(),
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Widget] store failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  });

  /**
   * GET /api/projects/:projectId/mcp/widget-content/:toolId
   * Render widget HTML with injected window.openai API
   */
  router.get('/:projectId/mcp/widget-content/:toolId', async (req: Request, res: Response) => {
    try {
      let user = (req as any).user;

      if (!user && req.query.token) {
        // Token verification not supported in local mode
        // In production, you would verify the token here
        user = { id: 'local-user' };
      }

      if (!user) {
        return res.status(401).send('<html><body>Error: Unauthorized</body></html>');
      }

      const { projectId, toolId } = req.params;
      const widgetData = widgetDataStore.get(toolId);
      if (!widgetData) {
        return res.status(404).send(
          '<html><body>Error: Widget data not found or expired</body></html>'
        );
      }

      const {
        uri,
        toolInput,
        toolOutput,
        toolResponseMetadata,
        toolName,
        theme,
        htmlContent,
      } = widgetData;

      if (!htmlContent) {
        return res.status(404).send(
          '<html><body>Error: No HTML content found</body></html>'
        );
      }

      const project = await dbService.getProject(projectId, user.id);

      if (!project) {
        return res.status(404).send('<html><body>Error: Project not found</body></html>');
      }

      const mcpOrigin = project.ephemeralUrl
        ? new URL(project.ephemeralUrl).origin
        : '';

      const widgetStateKey = `openai-widget-state:${toolName}:${toolId}`;
      const apiScript = `
      <script>
        (function() {
          'use strict';

          const openaiAPI = {
            toolInput: ${serializeForInlineScript(toolInput)},
            toolOutput: ${serializeForInlineScript(toolOutput)},
            toolResponseMetadata: ${serializeForInlineScript(toolResponseMetadata)},
            displayMode: 'inline',
            maxHeight: 600,
            theme: ${JSON.stringify(theme ?? 'light')},
            locale: 'en-US',
            safeArea: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
            userAgent: {
              device: { type: 'desktop' },
              capabilities: { hover: true, touch: false }
            },
            widgetState: null,

            async setWidgetState(state) {
              this.widgetState = state;
              try {
                localStorage.setItem(${JSON.stringify(widgetStateKey)}, JSON.stringify(state));
              } catch (err) {
                console.error('[OpenAI Widget] Failed to save state:', err);
              }
              window.parent.postMessage({
                type: 'openai:setWidgetState',
                toolId: ${JSON.stringify(toolId)},
                state
              }, '*');
            },

            async callTool(toolName, params = {}) {
              return new Promise((resolve, reject) => {
                const requestId = \`tool_\${Date.now()}_\${Math.random()}\`;
                const handler = (event) => {
                  if (event.data.type === 'openai:callTool:response' &&
                      event.data.requestId === requestId) {
                    window.removeEventListener('message', handler);
                    if (event.data.error) {
                      reject(new Error(event.data.error));
                    } else {
                      resolve(event.data.result);
                    }
                  }
                };
                window.addEventListener('message', handler);
                window.parent.postMessage({
                  type: 'openai:callTool',
                  requestId,
                  toolName,
                  params
                }, '*');
                setTimeout(() => {
                  window.removeEventListener('message', handler);
                  reject(new Error('Tool call timeout'));
                }, 30000);
              });
            },

            async sendFollowupTurn(message) {
              const payload = typeof message === 'string'
                ? { prompt: message }
                : message;
              window.parent.postMessage({
                type: 'openai:sendFollowup',
                message: payload.prompt || payload
              }, '*');
            },

            async requestDisplayMode(options = {}) {
              const mode = options.mode || 'inline';
              this.displayMode = mode;
              window.parent.postMessage({
                type: 'openai:requestDisplayMode',
                mode
              }, '*');
              return { mode };
            },

            async sendFollowUpMessage(args) {
              const prompt = typeof args === 'string' ? args : (args?.prompt || '');
              return this.sendFollowupTurn(prompt);
            },

            async openExternal(options) {
              const href = typeof options === 'string' ? options : options?.href;
              if (!href) {
                throw new Error('href is required for openExternal');
              }
              window.parent.postMessage({
                type: 'openai:openExternal',
                href
              }, '*');
              window.open(href, '_blank', 'noopener,noreferrer');
            }
          };

          Object.defineProperty(window, 'openai', {
            value: openaiAPI,
            writable: false,
            configurable: false,
            enumerable: true
          });

          Object.defineProperty(window, 'webplus', {
            value: openaiAPI,
            writable: false,
            configurable: false,
            enumerable: true
          });

          setTimeout(() => {
            try {
              const globalsEvent = new CustomEvent('openai:set_globals', {
                detail: {
                  globals: {
                    displayMode: openaiAPI.displayMode,
                    maxHeight: openaiAPI.maxHeight,
                    theme: openaiAPI.theme,
                    locale: openaiAPI.locale,
                    safeArea: openaiAPI.safeArea,
                    userAgent: openaiAPI.userAgent
                  }
                }
              });
              window.dispatchEvent(globalsEvent);
            } catch (err) {
              console.error('[OpenAI Widget] Failed to dispatch globals event:', err);
            }
          }, 0);

          setTimeout(() => {
            try {
              const stored = localStorage.getItem(${JSON.stringify(widgetStateKey)});
              if (stored && window.openai) {
                window.openai.widgetState = JSON.parse(stored);
              }
            } catch (err) {
              console.error('[OpenAI Widget] Failed to restore widget state:', err);
            }
          }, 0);

          window.addEventListener('message', (event) => {
            if (event.data.type === 'openai:set_globals') {
              const { globals } = event.data;

              if (globals?.theme && window.openai) {
                window.openai.theme = globals.theme;

                try {
                  const globalsEvent = new CustomEvent('openai:set_globals', {
                    detail: { globals: { theme: globals.theme } }
                  });
                  window.dispatchEvent(globalsEvent);
                } catch (err) {
                  console.error('[OpenAI Widget] Failed to dispatch theme change:', err);
                }
              }
            }
          });
        })();
      </script>
    `;

      let modifiedHtml;
      // Use mcpOrigin (dev server URL) as base if available, otherwise default to /
      const baseHref = mcpOrigin ? `${mcpOrigin}/` : '/';

      if (htmlContent.includes('<html>') && htmlContent.includes('<head>')) {
        modifiedHtml = htmlContent.replace(
          '<head>',
          `<head><base href="${baseHref}">${apiScript}`
        );
      } else {
        modifiedHtml = `<!DOCTYPE html>
<html>
<head>
  <base href="${baseHref}">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${apiScript}
</head>
<body>
  ${htmlContent}
</body>
</html>`;
      }

      const allowedFrameOrigins = process.env.ALLOWED_FRAME_ORIGINS || 'http://localhost:5173 http://localhost:5174';

      // Default CSP directives
      // CRITICAL: Add mcpOrigin to connect-src to allow fetching data from dev server
      const cspDirectives = [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com${mcpOrigin ? ' ' + mcpOrigin : ''}`,
        "worker-src 'self' blob:",
        "child-src 'self' blob:",
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com${mcpOrigin ? ' ' + mcpOrigin : ''}`,
        `img-src 'self' data: https: blob:${mcpOrigin ? ' ' + mcpOrigin : ''}`,
        `media-src 'self' data: https: blob:${mcpOrigin ? ' ' + mcpOrigin : ''}`,
        `font-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com${mcpOrigin ? ' ' + mcpOrigin : ''}`,
        `connect-src 'self' https: wss: ws:${mcpOrigin ? ' ' + mcpOrigin : ''}`,
        `frame-ancestors 'self' ${allowedFrameOrigins}`,
      ];

      // Inject custom CSP from tool metadata if available
      if (toolResponseMetadata && toolResponseMetadata['openai/widgetCSP']) {
        try {
          const widgetCSP = toolResponseMetadata['openai/widgetCSP'];
          console.log('[Widget] Injecting custom CSP:', widgetCSP);

          const { connect_domains, resource_domains } = widgetCSP;

          // Helper to append domains to a directive
          const appendDomains = (directivePrefix: string, domains: string[]) => {
            if (!domains || !Array.isArray(domains)) return;

            const index = cspDirectives.findIndex(d => d.startsWith(directivePrefix));
            if (index !== -1) {
              cspDirectives[index] += ' ' + domains.join(' ');
            } else {
              cspDirectives.push(`${directivePrefix} ${domains.join(' ')}`);
            }
          };

          // Map connect_domains to connect-src
          if (connect_domains) {
            appendDomains('connect-src', connect_domains);
          }

          // Map resource_domains to multiple directives
          if (resource_domains) {
            appendDomains('img-src', resource_domains);
            appendDomains('media-src', resource_domains);
            appendDomains('font-src', resource_domains);
            appendDomains('style-src', resource_domains);
            appendDomains('script-src', resource_domains);
          }

        } catch (err) {
          console.error('[Widget] Failed to inject custom CSP:', err);
        }
      }

      res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(modifiedHtml);

    } catch (error: any) {
      console.error('[Widget] Failed to render widget:', error);
      res.status(500).send(
        `<html><body>Error: ${error.message || 'Unknown error'}</body></html>`
      );
    }
  });

  /**
   * GET /api/projects/:projectId/chat/history
   * Get chat message history for a project
   */
  router.get('/:projectId/chat/history', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get messages from Mastra Memory (threadId = projectId, resourceId = userId)
      const { MemoryService } = await import('../services/memory.service.js');
      const mastraMessages = await MemoryService.getThreadMessages(projectId, user.id);

      // Transform Mastra messages to match frontend format
      const messages = mastraMessages.map((msg: any) => ({
        message_id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
        message_type: 'chat', // Mastra messages are always chat type
        tool_info: null, // Tool info not stored in Mastra Memory
        metadata: {},
      }));

      res.json({ messages });
    } catch (error: any) {
      console.error('[Chat] Failed to get chat history:', error);
      res.status(500).json({
        error: 'Failed to get chat history',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/projects/:projectId/chat/history
   * Mastra Memory does not support clearing individual threads
   * This endpoint is no longer supported
   */
  router.delete('/:projectId/chat/history', async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'Chat history clearing is not supported with Mastra Memory',
      message: 'Messages are managed by Mastra Memory and cannot be individually cleared'
    });
  });

  /**
   * POST /api/projects/:projectId/chat
   * Stream chat response using Mastra agent
   */
  router.post('/:projectId/chat', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { message } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get project to access MCP URL
      const project = await dbService.getProject(projectId, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({ error: 'Project MCP server not available' });
      }

      // Note: Messages are now automatically saved by Mastra Memory
      // No need to manually save to chatMessages table

      let mcpTools;
      try {
        mcpTools = await mcpService.getTools(project.mcpEphemeralUrl);
      } catch (error: any) {
        console.error('[Chat] Failed to get MCP tools:', error);
        // If MCP server is not ready (e.g. fetch failed), return 503 so client can retry
        if (error.message.includes('fetch failed') || error.code === 'ECONNREFUSED') {
          return res.status(503).json({
            error: 'Project tools are initializing',
            retryAfter: 2
          });
        }
        throw error;
      }

      const { MemoryService } = await import('../services/memory.service.js');
      const { createCodeEditorAgent, streamCodeEditing } = await import('../mastra/agents/code-editor.js');

      const memory = await MemoryService.getMemory();
      const agent = createCodeEditorAgent(mcpTools, memory);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');

      try {
        let accumulatedResponse = '';

        // Stream with memory context (messages auto-saved by Mastra)
        for await (const textChunk of streamCodeEditing(agent, message, projectId, user.id)) {
          accumulatedResponse += textChunk;
          res.write(textChunk);
        }

        res.end();
        console.log('[Chat] Stream completed, response saved to Mastra Memory automatically');
      } catch (streamError: any) {
        console.error('[Chat] Stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: streamError.message });
        } else {
          res.end();
        }
      }

    } catch (error: any) {
      console.error('[Chat] Error:', error);
      console.error('[Chat] Error stack:', error.stack);
      if (!res.headersSent) {
        res.status(500).json({
          error: error.message || 'Internal server error',
          details: error.stack
        });
      }
    }
  });

  /**
   * GET /api/projects/:id/title
   * Get thread title from Mastra Memory
   */
  router.get('/:id/title', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get project from DB
      const project = await dbService.getProject(id);
      if (!project || project.userId !== user.id) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get thread from Mastra Memory
      const memory = await MemoryService.getMemory();
      const thread = await memory.getThreadById({ threadId: id });

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      // If title was generated, update project name in DB
      if (thread.title && thread.title !== project.name) {
        await dbService.updateProject(id, { name: thread.title });
        console.log(`[Projects] Updated project name to: ${thread.title}`);
      }

      res.json({ title: thread.title || project.name });
    } catch (error: any) {
      console.error('[Projects] Error fetching thread title:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  return router;
}
