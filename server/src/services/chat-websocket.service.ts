import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import type { DatabaseService } from '../db/db.service.js';
import { MCPService } from './mcp.service.js';
import { MemoryService } from './memory.service.js';
import { createCodeEditorAgent, streamCodeEditing } from '../mastra/agents/code-editor.js';

interface ChatWebSocketMessage {
  type: 'message' | 'abort' | 'reconnect' | 'file_search' | 'command_search';
  content?: string; // Client sends 'content'
  message?: string; // Keep for backward compatibility
  images?: any[];
  agent_type?: 'claude' | 'torch';
  agent?: 'claude' | 'torch'; // Keep for backward compatibility
  cto_mode?: boolean;
  stream?: boolean;
  permission_mode?: string;
  thinking_mode?: string;
  last_message_id?: string;
  last_buffer_index?: number;
  query?: string; // For file/command search
  path?: string; // For file search
}

interface WebSocketClient extends WebSocket {
  projectId?: string;
  userId?: string;
  isAlive?: boolean;
}

export class ChatWebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocketClient>> = new Map();
  private dbService: DatabaseService;
  private mcpService: MCPService;

  constructor(wss: WebSocketServer, dbService: DatabaseService) {
    this.wss = wss;
    this.dbService = dbService;
    this.mcpService = new MCPService();

    // Heartbeat to detect disconnected clients
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  async handleConnection(ws: WebSocketClient, req: IncomingMessage, projectId: string, userId: string) {
    console.log(`[ChatWS] New connection for project ${projectId}, user ${userId}`);

    ws.projectId = projectId;
    ws.userId = userId;
    ws.isAlive = true;

    // Add to clients map
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    this.clients.get(projectId)!.add(ws);

    // Heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: ChatWebSocketMessage = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
      } catch (error) {
        console.error('[ChatWS] Error handling message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`[ChatWS] Client disconnected from project ${projectId}`);
      const projectClients = this.clients.get(projectId);
      if (projectClients) {
        projectClients.delete(ws);
        if (projectClients.size === 0) {
          this.clients.delete(projectId);
        }
      }
    });

    // Send connection confirmation
    this.sendMessage(ws, {
      type: 'connected',
      projectId,
    });
  }

  private async handleMessage(ws: WebSocketClient, message: ChatWebSocketMessage) {
    const { type } = message;

    switch (type) {
      case 'message':
        await this.handleChatMessage(ws, message);
        break;

      case 'abort':
        await this.handleAbort(ws);
        break;

      case 'reconnect':
        await this.handleReconnect(ws, message);
        break;

      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  private async handleChatMessage(ws: WebSocketClient, message: ChatWebSocketMessage) {
    // Support both 'content' (new) and 'message' (old) fields
    const text = message.content || message.message;
    const { images, agent_type, agent } = message;
    const { projectId, userId } = ws;

    if (!text || !projectId || !userId) {
      return this.sendError(ws, 'Missing required fields');
    }

    const agentType = agent_type || agent || 'claude';

    console.log(`[ChatWS] Handling chat message for project ${projectId}`);

    // Broadcast user message to all tabs for multi-tab sync
    this.broadcastToProject(projectId, {
      type: 'message',
      message: {
        id: `user-msg-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        message_type: 'chat',
      },
    });

    try {
      // Get project details to access MCP URL
      const project = await this.dbService.getProject(projectId, userId);

      if (!project) {
        return this.sendError(ws, 'Project not found');
      }

      if (!project.mcpEphemeralUrl) {
        return this.sendError(ws, 'Project MCP server not available. Please ensure the project is active.');
      }

      // Get MCP tools for this project
      const mcpTools = await this.mcpService.getTools(project.mcpEphemeralUrl);
      console.log(`[ChatWS] Loaded ${mcpTools.length} MCP tools for project ${projectId}`);

      // Get Memory instance for conversation persistence
      const memory = await MemoryService.getMemory();
      console.log(`[ChatWS] Memory service ready`);

      // Create agent with MCP tools and Memory
      const codeAgent = createCodeEditorAgent(mcpTools, memory);
      console.log(`[ChatWS] Created code editor agent with memory`);

      // Stream response with memory context
      // threadId = projectId (group messages by project)
      // resourceId = userId (identify user across projects)
      const messageId = `msg_${Date.now()}`;
      let accumulatedContent = '';
      let chunkCount = 0;

      console.log(`[ChatWS] Starting to stream response for message: "${text.substring(0, 50)}..." with ID: ${messageId}`);

      try {
        for await (const chunk of streamCodeEditing(codeAgent, text, projectId, userId)) {
          accumulatedContent += chunk;
          chunkCount++;
          console.log(`[ChatWS] Chunk #${chunkCount}: +${chunk.length} chars (total: ${accumulatedContent.length} chars), sending with ID: ${messageId}`);

          this.sendMessage(ws, {
            type: 'stream',
            id: messageId, // Send consistent message ID
            content: accumulatedContent,
            metadata: {
              agent: agentType,
            },
          });
        }

        console.log(`[ChatWS] Stream completed, ${chunkCount} chunks, total content length: ${accumulatedContent.length}`);

        // Send completion
        this.sendMessage(ws, {
          type: 'complete',
        });
      } catch (streamError) {
        console.error('[ChatWS] Error during streaming:', streamError);
        throw streamError; // Re-throw to be caught by outer try-catch
      }
    } catch (error) {
      console.error('[ChatWS] Error handling chat message:', error);
      this.sendError(ws, error instanceof Error ? error.message : 'Failed to process message');
    }
  }

  private async handleAbort(ws: WebSocketClient) {
    console.log(`[ChatWS] Abort requested for project ${ws.projectId}`);

    this.sendMessage(ws, {
      type: 'aborted',
      message: 'Request aborted',
    });
  }

  private async handleReconnect(ws: WebSocketClient, message: ChatWebSocketMessage) {
    console.log(`[ChatWS] Reconnect requested for project ${ws.projectId}`);

    // Send reconnected confirmation
    this.sendMessage(ws, {
      type: 'reconnected',
      buffered_count: 0,
    });
  }

  private sendMessage(ws: WebSocketClient, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private sendError(ws: WebSocketClient, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      error,
    });
  }

  // Broadcast to all clients connected to a project
  broadcastToProject(projectId: string, data: any) {
    const projectClients = this.clients.get(projectId);
    if (projectClients) {
      projectClients.forEach((client) => {
        this.sendMessage(client, data);
      });
    }
  }
}
