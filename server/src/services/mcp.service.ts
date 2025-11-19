import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Service for managing MCP clients for Freestyle projects
 * Each project gets its own MCP client connected to its mcpEphemeralUrl
 */
export class MCPService {
  private clients: Map<string, Client> = new Map();

  /**
   * Get or create an MCP client for a given URL
   * mcpUrl is used as the cache key since same URL = same MCP server
   */
  async getClient(mcpUrl: string): Promise<Client> {
    // Return existing client if available
    if (this.clients.has(mcpUrl)) {
      return this.clients.get(mcpUrl)!;
    }

    console.log(`[MCP] Creating new client at ${mcpUrl}`);

    // Create transport
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

    // Create client
    const client = new Client(
      {
        name: 'widgetui-builder',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect
    await client.connect(transport);

    // Store for reuse
    this.clients.set(mcpUrl, client);

    return client;
  }

  /**
   * Retry helper for MCP operations
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry on final attempt
        if (attempt < maxRetries) {
          const delay = delayMs * attempt; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[MCP] ${operationName} failed after ${maxRetries} attempts:`, lastError.message);
    throw lastError;
  }

  /**
   * Get MCP tools for a project
   */
  async getTools(mcpUrl: string) {
    try {
      const client = await this.getClient(mcpUrl);

      const response = await this.retryOperation(
        () => client.listTools(),
        'listTools',
        3,
        1000
      );

      // Official SDK returns tools with _meta preserved ✅
      const toolsArray = response.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        _meta: tool._meta, // Preserved from MCP server
      }));
      return toolsArray;
    } catch (error) {
      console.error('[MCP] getTools failed:', error);
      throw error;
    }
  }

  /**
   * Get MCP resources for a project
   */
  async getResources(mcpUrl: string) {
    try {
      const client = await this.getClient(mcpUrl);

      const response = await this.retryOperation(
        () => client.listResources(),
        'listResources',
        3,
        1000
      );

      return response.resources;
    } catch (error) {
      console.error('[MCP] getResources failed:', error);
      throw error;
    }
  }

  /**
   * Call an MCP tool with given parameters
   */
  async callTool(mcpUrl: string, toolName: string, params: Record<string, any>) {
    try {
      const client = await this.getClient(mcpUrl);

      const result = await this.retryOperation(
        () => client.callTool({
          name: toolName,
          arguments: params,
        }),
        `callTool(${toolName})`,
        3,
        1000
      );
      return result;
    } catch (error) {
      console.error(`[MCP] callTool(${toolName}) failed:`, error);
      throw error;
    }
  }

  /**
   * Read an MCP resource
   */
  async readResource(mcpUrl: string, uri: string) {
    try {
      const client = await this.getClient(mcpUrl);

      const result = await this.retryOperation(
        () => client.readResource({ uri }),
        `readResource(${uri})`,
        3,
        1000
      );

      return result;
    } catch (error) {
      console.error(`[MCP] readResource(${uri}) failed:`, error);
      throw error;
    }
  }

  /**
   * Close and remove a client for a URL
   */
  async closeClient(mcpUrl: string) {
    const client = this.clients.get(mcpUrl);
    if (client) {
      console.log(`[MCP] Closing client for ${mcpUrl}`);
      await client.close();
      this.clients.delete(mcpUrl);
    }
  }

  /**
   * Close all clients
   */
  async closeAll() {
    console.log('[MCP] Closing all clients');
    for (const [mcpUrl, client] of this.clients.entries()) {
      await client.close();
    }
    this.clients.clear();
  }
}
