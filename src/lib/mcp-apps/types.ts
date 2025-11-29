/**
 * MCP Apps Protocol Types (SEP-1865)
 *
 * Minimal implementation of the MCP Apps wire protocol.
 * This is JSON-RPC 2.0 over postMessage between host and guest UI.
 *
 * @see https://github.com/modelcontextprotocol/ext-apps
 */

// =============================================================================
// JSON-RPC Base Types
// =============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// =============================================================================
// MCP Apps Host Context
// =============================================================================

export interface McpUiHostContext {
  theme?: 'light' | 'dark';
  displayMode?: 'compact' | 'expanded';
  viewport?: { width: number; height: number };
  locale?: string;
  timeZone?: string;
  platform?: 'web' | 'desktop' | 'mobile';
}

// =============================================================================
// MCP Apps Capabilities
// =============================================================================

export interface McpUiHostCapabilities {
  extensions?: string[];
  mimeTypes?: string[];
  openLinks?: boolean;
  serverTools?: boolean;
  serverResources?: boolean;
  logging?: boolean;
}

export interface McpUiAppCapabilities {
  tools?: { listChanged: boolean };
  experimental?: boolean;
}

// =============================================================================
// Initialize Handshake
// =============================================================================

export interface McpUiInitializeParams {
  appInfo: {
    name: string;
    version: string;
  };
  capabilities?: McpUiAppCapabilities;
}

export interface McpUiInitializeResult {
  protocolVersion: string;
  host: {
    name: string;
    version: string;
  };
  capabilities: McpUiHostCapabilities;
  context?: McpUiHostContext;
}

// =============================================================================
// Notifications: Host → Guest
// =============================================================================

export interface McpUiToolInputParams {
  name: string;
  input: unknown;
}

export interface McpUiToolResultParams {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export interface McpUiHostContextChangedParams extends Partial<McpUiHostContext> {}

// =============================================================================
// Requests: Guest → Host
// =============================================================================

export interface McpUiOpenLinkParams {
  url: string;
}

export interface McpUiMessageParams {
  role: string;
  content: {
    type: 'text';
    text: string;
  };
}

export interface McpUiSizeChangeParams {
  width: number;
  height: number;
}

// =============================================================================
// Method Names
// =============================================================================

export const MCP_UI_METHODS = {
  // Initialization
  INITIALIZE: 'ui/initialize',
  INITIALIZED: 'ui/initialized',

  // Host → Guest notifications
  TOOL_INPUT: 'ui/notifications/tool-input',
  TOOL_RESULT: 'ui/notifications/tool-result',
  HOST_CONTEXT_CHANGED: 'ui/notifications/host-context-changed',
  SANDBOX_RESOURCE_READY: 'ui/notifications/sandbox-resource-ready',

  // Guest → Host requests
  OPEN_LINK: 'ui/open-link',
  MESSAGE: 'ui/message',
  SIZE_CHANGE: 'ui/notifications/size-change',
  LOGGING: 'ui/logging',
} as const;

export const PROTOCOL_VERSION = '2025-11-21';
