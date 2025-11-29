/**
 * MCP Apps Host Bridge
 *
 * Implements the HOST side of the MCP Apps protocol.
 * This is equivalent to AppBridge in the official ext-apps SDK.
 *
 * The bridge handles:
 * 1. Initialization handshake with guest UI
 * 2. Sending tool input/result to guest
 * 3. Receiving requests from guest (openLink, message, etc.)
 * 4. Theme/context synchronization
 */

import {
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type McpUiHostContext,
  type McpUiHostCapabilities,
  type McpUiInitializeParams,
  type McpUiToolInputParams,
  type McpUiToolResultParams,
  type McpUiOpenLinkParams,
  type McpUiMessageParams,
  type McpUiSizeChangeParams,
  MCP_UI_METHODS,
  PROTOCOL_VERSION,
} from './types';

export interface HostBridgeOptions {
  hostName?: string;
  hostVersion?: string;
  capabilities?: McpUiHostCapabilities;
  context?: McpUiHostContext;
}

export interface HostBridgeCallbacks {
  onInitialized?: () => void;
  onOpenLink?: (url: string) => void;
  onMessage?: (role: string, text: string) => void;
  onSizeChange?: (width: number, height: number) => void;
  onLogging?: (level: string, message: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Host-side bridge for MCP Apps protocol
 */
export class McpAppsHostBridge {
  private iframe: HTMLIFrameElement | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private requestId = 0;
  private isConnected = false;

  private options: Required<HostBridgeOptions>;
  private callbacks: HostBridgeCallbacks;

  constructor(options: HostBridgeOptions = {}, callbacks: HostBridgeCallbacks = {}) {
    this.options = {
      hostName: options.hostName ?? 'Chattable',
      hostVersion: options.hostVersion ?? '1.0.0',
      capabilities: options.capabilities ?? {
        extensions: ['io.modelcontextprotocol/ui'],
        mimeTypes: ['text/html+mcp'],
        openLinks: true,
        serverTools: false,
        logging: true,
      },
      context: options.context ?? {
        theme: 'light',
        displayMode: 'expanded',
        platform: 'web',
      },
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to an iframe containing the guest UI
   */
  connect(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;

    this.messageHandler = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (event.source !== iframe.contentWindow) {
        return;
      }

      try {
        const message = event.data as JsonRpcMessage;
        if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
          return;
        }

        this.handleMessage(message);
      } catch (error) {
        console.error('[McpAppsHostBridge] Error handling message:', error);
        this.callbacks.onError?.(error as Error);
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Disconnect from the iframe
   */
  disconnect(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe = null;
    this.isConnected = false;
    this.pendingRequests.clear();
  }

  /**
   * Handle incoming JSON-RPC messages from guest
   */
  private handleMessage(message: JsonRpcMessage): void {
    // Handle responses to our requests
    if ('id' in message && !('method' in message)) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Handle requests and notifications from guest
    const method = (message as JsonRpcRequest | JsonRpcNotification).method;
    const params = (message as JsonRpcRequest | JsonRpcNotification).params;
    const id = 'id' in message ? message.id : undefined;

    switch (method) {
      case MCP_UI_METHODS.INITIALIZE:
        this.handleInitialize(params as McpUiInitializeParams, id);
        break;

      case MCP_UI_METHODS.INITIALIZED:
        this.isConnected = true;
        console.log('[McpAppsHostBridge] Guest initialized');
        this.callbacks.onInitialized?.();
        break;

      case MCP_UI_METHODS.OPEN_LINK:
        const linkParams = params as McpUiOpenLinkParams;
        this.callbacks.onOpenLink?.(linkParams.url);
        if (id !== undefined) {
          this.sendResponse(id, {});
        }
        break;

      case MCP_UI_METHODS.MESSAGE:
        const msgParams = params as McpUiMessageParams;
        this.callbacks.onMessage?.(msgParams.role, msgParams.content.text);
        if (id !== undefined) {
          this.sendResponse(id, {});
        }
        break;

      case MCP_UI_METHODS.SIZE_CHANGE:
        const sizeParams = params as McpUiSizeChangeParams;
        this.callbacks.onSizeChange?.(sizeParams.width, sizeParams.height);
        break;

      case MCP_UI_METHODS.LOGGING:
        const logParams = params as { level?: string; message: string };
        this.callbacks.onLogging?.(logParams.level ?? 'info', logParams.message);
        break;

      default:
        console.warn('[McpAppsHostBridge] Unknown method:', method);
    }
  }

  /**
   * Handle initialization request from guest
   */
  private handleInitialize(params: McpUiInitializeParams, id?: string | number): void {
    console.log('[McpAppsHostBridge] Guest requesting init:', params.appInfo);

    if (id !== undefined) {
      this.sendResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        host: {
          name: this.options.hostName,
          version: this.options.hostVersion,
        },
        capabilities: this.options.capabilities,
        context: this.options.context,
      });
    }
  }

  /**
   * Send a JSON-RPC response
   */
  private sendResponse(id: string | number, result: unknown): void {
    this.postMessage({
      jsonrpc: '2.0',
      id,
      result,
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(method: string, params?: unknown): void {
    this.postMessage({
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  /**
   * Post a message to the iframe
   */
  private postMessage(message: JsonRpcMessage): void {
    if (!this.iframe?.contentWindow) {
      console.warn('[McpAppsHostBridge] No iframe connected');
      return;
    }
    this.iframe.contentWindow.postMessage(message, '*');
  }

  // ===========================================================================
  // Public API: Send data to guest
  // ===========================================================================

  /**
   * Send tool input to guest
   */
  sendToolInput(toolName: string, input: unknown): void {
    this.sendNotification(MCP_UI_METHODS.TOOL_INPUT, {
      name: toolName,
      input,
    } satisfies McpUiToolInputParams);
  }

  /**
   * Send tool result to guest
   */
  sendToolResult(result: McpUiToolResultParams): void {
    this.sendNotification(MCP_UI_METHODS.TOOL_RESULT, result);
  }

  /**
   * Send host context update (theme, viewport, etc.)
   */
  sendHostContextChanged(context: Partial<McpUiHostContext>): void {
    // Update our stored context
    Object.assign(this.options.context, context);

    this.sendNotification(MCP_UI_METHODS.HOST_CONTEXT_CHANGED, context);
  }

  /**
   * Send HTML content to sandbox (for double-iframe pattern)
   */
  sendSandboxResourceReady(html: string): void {
    this.sendNotification(MCP_UI_METHODS.SANDBOX_RESOURCE_READY, { html });
  }

  /**
   * Check if guest is connected and initialized
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
