import { MCPClient } from '@mastra/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Service for managing MCP clients for Freestyle projects
 * Uses @mastra/mcp's MCPClient which provides tools WITH execute functions
 *
 * Key difference from raw @modelcontextprotocol/sdk:
 * - MCPClient.getTools() returns tools that can actually execute
 * - Raw SDK only returns tool schemas without execute capability
 */
export class MCPService {
  private clients: Map<string, MCPClient> = new Map();
  private rawClients: Map<string, Client> = new Map();

  /**
   * Get or create an MCP client for a given URL
   * mcpUrl is used as the cache key since same URL = same MCP server
   */
  async getClient(mcpUrl: string): Promise<MCPClient> {
    // Return existing client if available
    if (this.clients.has(mcpUrl)) {
      return this.clients.get(mcpUrl)!;
    }

    console.log(`[MCP] Creating new MCPClient at ${mcpUrl}`);

    // Create MCPClient with HTTP configuration
    // MCPClient uses servers record with named servers
    const client = new MCPClient({
      id: mcpUrl, // Use URL as unique ID to prevent duplicate instances
      servers: {
        main: {
          url: new URL(mcpUrl),
          timeout: 30000, // 30 second timeout
        },
      },
    });

    console.log(`[MCP] MCPClient created for ${mcpUrl}`);

    // Store for reuse
    this.clients.set(mcpUrl, client);

    return client;
  }

  /**
   * Get MCP tools for a project - WITH execute functions!
   * This is the key method that was broken before
   */
  async getTools(mcpUrl: string) {
    try {
      const client = await this.getClient(mcpUrl);

      // MCPClient.getTools() returns tools with execute functions
      // This is the fix - these tools can actually be executed by Mastra Agent
      const tools = await client.getTools();

      console.log(`[MCP] Got ${Object.keys(tools).length} tools with execute functions`);

      // Log first tool to verify it has execute
      const firstToolName = Object.keys(tools)[0];
      if (firstToolName) {
        const firstTool = tools[firstToolName];
        console.log(`[MCP] Sample tool '${firstToolName}':`, {
          hasExecute: typeof firstTool.execute === 'function',
          description: firstTool.description?.substring(0, 50),
        });
      }

      return tools;
    } catch (error) {
      console.error('[MCP] getTools failed:', error);
      throw error;
    }
  }

  /**
   * Get or create a raw MCP SDK client for a given URL
   * This client is used to get raw tool metadata including _meta
   */
  async getRawClient(mcpUrl: string): Promise<Client> {
    if (this.rawClients.has(mcpUrl)) {
      return this.rawClients.get(mcpUrl)!;
    }

    console.log(`[MCP] Creating raw SDK client at ${mcpUrl}`);

    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    const client = new Client({ name: 'chattable-raw', version: '1.0.0' });
    await client.connect(transport);

    this.rawClients.set(mcpUrl, client);
    return client;
  }

  /**
   * Get raw MCP tools list with _meta intact
   * Uses raw MCP SDK client to call tools/list directly
   */
  async getRawToolsList(mcpUrl: string) {
    try {
      const client = await this.getRawClient(mcpUrl);
      const result = await client.listTools();
      return result.tools || [];
    } catch (error) {
      console.error('[MCP] getRawToolsList failed:', error);
      throw error;
    }
  }

  /**
   * Get MCP resources for a project
   */
  async getResources(mcpUrl: string) {
    try {
      const client = await this.getClient(mcpUrl);
      const response = await client.resources.list();
      // MCPClient returns { serverName: resources[] }, we want just the main server's resources
      return response.main || [];
    } catch (error) {
      console.error('[MCP] getResources failed:', error);
      throw error;
    }
  }

  /**
   * Read an MCP resource
   */
  async readResource(mcpUrl: string, uri: string) {
    try {
      const client = await this.getClient(mcpUrl);
      const result = await client.resources.read('main', uri);
      return result;
    } catch (error) {
      console.error(`[MCP] readResource(${uri}) failed:`, error);
      throw error;
    }
  }

  /**
   * Call an MCP tool directly (not via Agent)
   * Note: This bypasses the Agent, use getTools() for Agent-based tool execution
   */
  async callTool(mcpUrl: string, toolName: string, params: Record<string, any>) {
    try {
      const client = await this.getClient(mcpUrl);
      const tools = await client.getTools();

      // Tools are namespaced as serverName_toolName, so we need to find the right one
      // First try exact match, then try with main_ prefix
      let tool = tools[toolName];
      if (!tool) {
        tool = tools[`main_${toolName}`];
      }

      if (!tool) {
        throw new Error(`Tool '${toolName}' not found. Available: ${Object.keys(tools).join(', ')}`);
      }

      // Ensure params is always an object (even if empty)
      const safeParams = params && typeof params === 'object' ? params : {};

      console.log(`[MCP] callTool(${toolName}) with params:`, JSON.stringify(safeParams));

      // Mastra tool.execute expects { context: params } format
      // See: https://mastra.ai/docs/tools
      const result = await tool.execute({ context: safeParams });
      return result;
    } catch (error) {
      console.error(`[MCP] callTool(${toolName}) failed:`, error);
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
      await client.disconnect();
      this.clients.delete(mcpUrl);
    }
  }

  /**
   * Close all clients
   */
  async closeAll() {
    console.log('[MCP] Closing all clients');
    for (const [mcpUrl, client] of this.clients.entries()) {
      await client.disconnect();
    }
    this.clients.clear();

    // Close raw clients too
    for (const [mcpUrl, client] of this.rawClients.entries()) {
      await client.close();
    }
    this.rawClients.clear();
  }
}
