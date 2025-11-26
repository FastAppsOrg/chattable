import { Router, Request, Response } from 'express';
import { IDeploymentService } from '../interfaces/deployment.interface.js';
import { DatabaseService } from '../db/db.service.js';
import { MCPService } from '../services/mcp.service.js';
import { MemoryService } from '../services/memory.service.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';

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

      // Create DB project record immediately with status='initializing'
      // project.id (UUID) is used as the folder name for local deployment
      const dbProject = await dbService.createProject({
        userId: user.id,
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
      } else if (project.status === 'active' && project.id) {
        try {
          const status = await deploymentService.getProjectStatus(project.id);
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

      if (!deploymentService.restartProject) {
        return res.status(400).json({
          error: 'Restart not supported',
          message: 'This deployment adapter does not support project restart',
        });
      }

      // Extract port from saved ephemeralUrl to reuse the same port
      let savedPort: number | undefined;
      if (project.ephemeralUrl) {
        try {
          const url = new URL(project.ephemeralUrl);
          savedPort = parseInt(url.port, 10);
          console.log(`[Projects] Restart: extracted saved port from DB: ${savedPort}`);
        } catch (e) {
          console.log(`[Projects] Restart: could not parse ephemeralUrl: ${project.ephemeralUrl}`);
        }
      }

      // project.id (UUID) is used as folder name
      const deployment = await deploymentService.restartProject(project.id, { savedPort });

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
   * POST /api/projects/:id/ensure-running
   * Check if dev server is running, auto-restart if disconnected
   * Used when entering project detail page to ensure dev server is available
   */
  router.post('/:id/ensure-running', async (req: Request, res: Response) => {
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

      // If project is still initializing, just return current status
      if (project.status === 'initializing') {
        return res.json({
          status: 'initializing',
          message: 'Project is still initializing',
          ephemeral_url: null,
          mcp_ephemeral_url: null,
          restarted: false,
        });
      }

      // Check current container status
      let containerStatus: 'running' | 'disconnected' | 'error' = 'disconnected';
      try {
        const statusResult = await deploymentService.getProjectStatus(project.id);
        containerStatus = statusResult.containerStatus;
      } catch (error: any) {
        console.log('[Projects] Status check failed, assuming disconnected:', error.message);
        containerStatus = 'disconnected';
      }

      // If already running, return current URLs
      if (containerStatus === 'running') {
        return res.json({
          status: 'running',
          message: 'Dev server is already running',
          ephemeral_url: project.ephemeralUrl,
          mcp_ephemeral_url: project.mcpEphemeralUrl,
          restarted: false,
        });
      }

      // Dev server is disconnected - try to restart
      console.log(`[Projects] Dev server disconnected for ${id}, attempting restart...`);

      if (!deploymentService.restartProject) {
        return res.json({
          status: 'disconnected',
          message: 'Restart not supported by deployment adapter',
          ephemeral_url: project.ephemeralUrl,
          mcp_ephemeral_url: project.mcpEphemeralUrl,
          restarted: false,
        });
      }

      // Extract port from saved ephemeralUrl to reuse the same port
      let savedPort: number | undefined;
      if (project.ephemeralUrl) {
        try {
          const url = new URL(project.ephemeralUrl);
          savedPort = parseInt(url.port, 10);
          console.log(`[Projects] Extracted saved port from DB: ${savedPort}`);
        } catch (e) {
          console.log(`[Projects] Could not parse ephemeralUrl: ${project.ephemeralUrl}`);
        }
      }

      try {
        // project.id (UUID) is used as folder name
        const deployment = await deploymentService.restartProject(project.id, { savedPort });

        // Update DB with new URLs
        await dbService.updateProject(id, user.id, {
          ephemeralUrl: deployment.ephemeralUrl,
          mcpEphemeralUrl: deployment.mcp.url,
        });

        console.log(`[Projects] Dev server restarted for ${id}`);

        return res.json({
          status: 'running',
          message: 'Dev server was restarted',
          ephemeral_url: deployment.ephemeralUrl,
          mcp_ephemeral_url: deployment.mcp.url,
          restarted: true,
        });
      } catch (restartError: any) {
        console.error(`[Projects] Failed to restart dev server for ${id}:`, restartError);
        return res.json({
          status: 'error',
          message: `Failed to restart: ${restartError.message}`,
          ephemeral_url: project.ephemeralUrl,
          mcp_ephemeral_url: project.mcpEphemeralUrl,
          restarted: false,
        });
      }
    } catch (error: any) {
      console.error('[Projects] ensure-running error:', error);
      res.status(500).json({
        error: 'Failed to check/restart project',
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

      if (name && updatedProject.id) {
        try {
          await deploymentService.updateProject(updatedProject.id, { name });
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

      if (project.id) {
        try {
          await deploymentService.deleteProject(project.id);
        } catch (error: any) {
          console.error('[Projects] Failed to delete deployment (continuing):', error.message);
        }
      }

      await mcpService.closeClient(project.id);
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

      // Get both Mastra tools (with execute) and raw tools (with _meta)
      const [toolsRecord, rawToolsList] = await Promise.all([
        mcpService.getTools(project.mcpEphemeralUrl),
        mcpService.getRawToolsList(project.mcpEphemeralUrl).catch(() => []),
      ]);

      // Create a map of raw tools by name for quick lookup of _meta
      const rawToolsMap = new Map<string, any>();
      for (const rawTool of rawToolsList) {
        rawToolsMap.set(rawTool.name, rawTool);
      }

      // Convert Record<string, Tool> to array format for frontend compatibility
      // MCPClient.getTools() returns { main_toolName: { description, inputSchema, execute, ... } }
      // Frontend expects: [{ name: 'toolName', description, inputSchema, ... }]
      // Strip 'main_' prefix since we only have one server
      // Note: Mastra converts inputSchema to Zod - we need to convert it back to JSON Schema
      const toolsArray = Object.entries(toolsRecord).map(([name, tool]: [string, any]) => {
        const cleanName = name.replace(/^main_/, '');
        const rawTool = rawToolsMap.get(cleanName);

        // Mastra MCPClient converts the original JSON schema to Zod
        // We need to convert it back to JSON Schema for the frontend
        let jsonSchema: any = { type: 'object', properties: {} };

        try {
          // Check if inputSchema is a Zod schema (has _def property)
          if (tool.inputSchema && tool.inputSchema._def) {
            jsonSchema = zodToJsonSchema(tool.inputSchema as ZodType);
            // Remove $schema and $ref from root if present
            delete jsonSchema.$schema;
          } else if (tool.inputSchema && typeof tool.inputSchema === 'object' && !tool.inputSchema['~standard']) {
            // Already a plain JSON schema
            jsonSchema = tool.inputSchema;
          }
        } catch (e) {
          console.warn(`[MCP Tools] Failed to convert Zod schema for ${name}:`, e);
        }

        return {
          name: cleanName,
          description: tool.description,
          inputSchema: jsonSchema,
          // Get _meta from raw tool since Mastra doesn't preserve it
          _meta: rawTool?._meta,
        };
      });

      res.json({
        tools: toolsArray,
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

      const isLocal = project.id?.startsWith('local-');

      if (!isLocal) {
        return res.status(400).json({
          error: 'Not supported',
          message: 'File tree is only available for local projects',
        });
      }

      const { readdir, stat } = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const projectDir = path.join(process.cwd(), '.chattable', project.id!);
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

      const isLocal = project.id?.startsWith('local-');

      if (isLocal) {
        const { readFile } = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        const projectDir = path.join(process.cwd(), '.chattable', project.id!);
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
   * Stream chat response using Mastra agent with AI SDK format
   *
   * Request body (AI SDK useChat format):
   * - messages: Array of { role: 'user' | 'assistant', content: string }
   *
   * Response: AI SDK UI Message Stream (Data Stream Protocol)
   */
  router.post('/:projectId/chat', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { messages } = req.body;
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      // Get project to access MCP URL
      const project = await dbService.getProject(projectId, user.id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!project.mcpEphemeralUrl) {
        return res.status(400).json({ error: 'Project MCP server not available' });
      }

      // Retry helper for MCP connection during warmup
      const getMcpToolsWithRetry = async (url: string, maxRetries = 5, initialDelay = 1000) => {
        let lastError: any;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Chat] Attempting MCP connection (${attempt}/${maxRetries})...`);
            const tools = await mcpService.getTools(url);
            console.log(`[Chat] MCP connection successful on attempt ${attempt}`);
            return tools;
          } catch (error: any) {
            lastError = error;
            const isConnectionError =
              error.message?.includes('fetch failed') ||
              error.message?.includes('Could not connect') ||
              error.message?.includes('ECONNREFUSED') ||
              error.code === 'ECONNREFUSED';

            if (!isConnectionError || attempt === maxRetries) {
              throw error;
            }

            const delay = initialDelay * attempt; // Linear backoff: 1s, 2s, 3s, 4s, 5s
            console.log(`[Chat] MCP not ready, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        throw lastError;
      };

      let mcpTools;
      try {
        mcpTools = await getMcpToolsWithRetry(project.mcpEphemeralUrl);
      } catch (error: any) {
        console.error('[Chat] Failed to get MCP tools after retries:', error);
        if (error.message?.includes('fetch failed') || error.message?.includes('Could not connect') || error.code === 'ECONNREFUSED') {
          return res.status(503).json({
            error: 'Project tools are still initializing. Please try again in a few seconds.',
            retryAfter: 5
          });
        }
        throw error;
      }

      const { MemoryService } = await import('../services/memory.service.js');
      const { createCodeEditorAgent, streamCodeEditingAISdk } = await import('../mastra/agents/code-editor.js');

      const memory = await MemoryService.getMemory();
      const agent = createCodeEditorAgent(mcpTools, memory);

      try {
        // Get AI SDK compatible Response
        const aiResponse = await streamCodeEditingAISdk(
          agent,
          messages,
          projectId,
          user.id
        );

        // Copy headers from AI SDK Response to Express response
        aiResponse.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        // Pipe the stream body to Express response
        if (aiResponse.body) {
          const reader = aiResponse.body.getReader();
          const decoder = new TextDecoder();

          const pump = async () => {
            let totalBytes = 0;
            let chunkCount = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                res.end();
                console.log('[Chat] AI SDK stream completed, total bytes:', totalBytes, 'chunks:', chunkCount);
                break;
              }
              chunkCount++;
              totalBytes += value.length;

              // Log ALL chunks to see what's coming through
              const text = decoder.decode(value, { stream: true });
              console.log(`[Chat] Chunk #${chunkCount}:`, text.substring(0, 500));

              res.write(value);
            }
          };

          await pump();
        } else {
          console.log('[Chat] No response body!');
          res.end();
        }
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

  return router;
}
