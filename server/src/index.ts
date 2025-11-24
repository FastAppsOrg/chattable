import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { parse } from 'url';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { createProjectsRoutes } from './routes/projects.routes.js';
import { createSecretsRoutes } from './routes/secrets.routes.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createGitHubRoutes } from './routes/github.routes.js';
import { createGitRoutes } from './routes/git.routes.js';
// import { createDevRoutes } from './routes/dev.routes.js';
import { LocalDeploymentAdapter } from './services/deployment/local.adapter.js';
import { dbService } from './db/db.service.js';
import { sessionService } from './services/session.service.js';
import { MCPService } from './services/mcp.service.js';
import { ChatWebSocketService } from './services/chat-websocket.service.js';
import mastraRoutes, { setDatabaseService } from './routes/mastra.routes.js';

dotenv.config();
process.setMaxListeners(20);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',
  ],
  credentials: true,
}));
app.use(express.json());

// Local-first deployment - all projects managed in .chattable folder
console.log('🏠 Using Local Deployment Adapter (projects in .chattable folder)');
const deploymentService = new LocalDeploymentAdapter();

const mcpService = new MCPService();
setDatabaseService(dbService);

const authMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    req.user = { id: 'local-user' };
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const user = sessionService.validateToken(token);
    req.user = user;
    next();
  } catch (error: any) {
    req.user = { id: 'local-user' };
    next();
  }
};

const conditionalAuthMiddleware = async (req: any, res: any, next: any) => {
  const fullPath = req.originalUrl || req.url || req.path;

  if (fullPath.includes('/mcp/widget-content/')) {
    return next();
  }

  return authMiddleware(req, res, next);
};

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AppKit Server API Docs',
}));

// Swagger JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes (public - no auth required)
app.use('/auth', createAuthRoutes(sessionService));

// Routes (require authentication, but widget-content uses query token)
app.use('/api/projects', conditionalAuthMiddleware, createProjectsRoutes(deploymentService, dbService, mcpService));
app.use('/api/secrets', createSecretsRoutes());
app.use('/api/git', authMiddleware, createGitRoutes());
app.use('/github', authMiddleware, createGitHubRoutes());

// Mastra routes - auth middleware applied for project updates
app.use('/api/mastra', authMiddleware, mastraRoutes);

// Development routes (no auth required for local dev)
// app.use('/api/dev', createDevRoutes());

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server health check
 *     description: Check if the AppKit server is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const chatWebSocketService = new ChatWebSocketService(wss, dbService);

server.on('upgrade', async (request, socket, head) => {
  const { pathname, query } = parse(request.url || '', true);

  const token = (query.token as string) || 'local-token';

  try {
    const user = sessionService.validateToken(token);

    const match = pathname?.match(/^\/projects\/([^/]+)\/chat$/);
    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const projectId = match[1];

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
      chatWebSocketService.handleConnection(ws as any, request, projectId, user.id);
    });
  } catch (error) {
    const user = { id: 'local-user' };
    const match = pathname?.match(/^\/projects\/([^/]+)\/chat$/);
    if (match) {
      const projectId = match[1];
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
        chatWebSocketService.handleConnection(ws as any, request, projectId, user.id);
      });
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  const forceShutdownTimeout = setTimeout(() => {
    console.error('❌ Graceful shutdown timed out, forcing exit...');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          console.error('❌ Error closing HTTP server:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const closePromises: Promise<void>[] = [];
    wss.clients.forEach((client) => {
      closePromises.push(
        new Promise((resolve) => {
          if (client.readyState === client.OPEN) {
            client.close(1000, 'Server shutting down');
            client.once('close', () => resolve());
            // Timeout for individual client close
            setTimeout(() => resolve(), 1000);
          } else {
            resolve();
          }
        })
      );
    });
    await Promise.all(closePromises);

    await new Promise<void>((resolve, reject) => {
      wss.close((err) => {
        if (err) {
          console.error('❌ Error closing WebSocket server:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    clearTimeout(forceShutdownTimeout);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

// Remove any existing listeners to prevent duplicates in dev environment
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');
process.removeAllListeners('uncaughtException');
process.removeAllListeners('unhandledRejection');

// Handle shutdown signals
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.once('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.once('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
