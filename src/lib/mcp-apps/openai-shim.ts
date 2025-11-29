/**
 * OpenAI Apps SDK Compatibility Shim
 *
 * This shim allows widgets built for OpenAI's Apps SDK (window.openai)
 * to work with the MCP Apps protocol. It translates between the two APIs.
 *
 * How it works:
 * 1. Host injects this script into the iframe
 * 2. Creates a `window.openai` object that widgets expect
 * 3. Under the hood, uses MCP Apps postMessage protocol
 *
 * This is the "magic" that keeps existing skybridge widgets working
 * while Chattable speaks MCP Apps protocol.
 */

import { MCP_UI_METHODS, PROTOCOL_VERSION } from './types';
import type {
  JsonRpcMessage,
  JsonRpcRequest,
  McpUiInitializeResult,
  McpUiToolInputParams,
  McpUiToolResultParams,
  McpUiHostContext,
} from './types';

/**
 * OpenAI-compatible API interface (what widgets expect)
 */
export interface OpenAIGlobal {
  // Data from tool execution
  toolInput: unknown;
  toolOutput: unknown;
  widgetState: unknown;

  // Context
  theme: 'light' | 'dark';
  displayMode: 'compact' | 'expanded';

  // Methods
  setWidgetState: (state: unknown) => void;
  callTool: (name: string, params: unknown) => Promise<unknown>;
  sendFollowupTurn: (message: string) => void;
  openLink: (url: string) => void;
}

/**
 * Generate the shim script to inject into iframe
 *
 * This creates a self-contained script that:
 * 1. Sets up MCP Apps protocol communication
 * 2. Creates window.openai with the expected API
 * 3. Handles initialization handshake
 */
export function generateOpenAIShimScript(): string {
  // This script runs inside the iframe
  return `
(function() {
  'use strict';

  // Protocol constants
  const METHODS = ${JSON.stringify(MCP_UI_METHODS)};
  const PROTOCOL_VERSION = '${PROTOCOL_VERSION}';

  // State
  let toolInput = null;
  let toolOutput = null;
  let widgetState = null;
  let hostContext = { theme: 'light', displayMode: 'expanded' };
  let isInitialized = false;
  let pendingCallbacks = [];
  let requestId = 0;
  let pendingRequests = new Map();

  // JSON-RPC helpers
  function sendRequest(method, params) {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage({
        jsonrpc: '2.0',
        id,
        method,
        params
      }, '*');
    });
  }

  function sendNotification(method, params) {
    window.parent.postMessage({
      jsonrpc: '2.0',
      method,
      params
    }, '*');
  }

  function sendResponse(id, result) {
    window.parent.postMessage({
      jsonrpc: '2.0',
      id,
      result
    }, '*');
  }

  // Handle messages from host
  window.addEventListener('message', function(event) {
    if (event.source !== window.parent) return;

    const msg = event.data;
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return;

    // Handle response to our requests
    if ('id' in msg && !('method' in msg)) {
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Handle notifications from host
    switch (msg.method) {
      case METHODS.TOOL_INPUT:
        toolInput = msg.params?.input;
        window.openai.toolInput = toolInput;
        console.log('[OpenAI Shim] Received tool input');
        break;

      case METHODS.TOOL_RESULT:
        toolOutput = msg.params?.structuredContent ?? msg.params?.content?.[0]?.text ?? msg.params;
        window.openai.toolOutput = toolOutput;
        console.log('[OpenAI Shim] Received tool result');
        // Notify listeners
        pendingCallbacks.forEach(cb => cb());
        pendingCallbacks = [];
        break;

      case METHODS.HOST_CONTEXT_CHANGED:
        Object.assign(hostContext, msg.params);
        window.openai.theme = hostContext.theme || 'light';
        window.openai.displayMode = hostContext.displayMode || 'expanded';
        console.log('[OpenAI Shim] Context changed:', hostContext);
        break;

      case METHODS.SANDBOX_RESOURCE_READY:
        // For double-iframe sandbox pattern - not needed for simple case
        break;
    }
  });

  // Create window.openai API
  window.openai = {
    // Data properties (reactive via getters)
    get toolInput() { return toolInput; },
    get toolOutput() { return toolOutput; },
    get widgetState() { return widgetState; },
    get theme() { return hostContext.theme || 'light'; },
    get displayMode() { return hostContext.displayMode || 'expanded'; },

    // State management
    setWidgetState: function(state) {
      widgetState = state;
      // Could notify host if needed
      console.log('[OpenAI Shim] Widget state updated');
    },

    // Tool calling
    callTool: function(name, params) {
      console.log('[OpenAI Shim] Calling tool:', name);
      // For now, just log - full implementation would go through host
      return Promise.resolve({});
    },

    // Send message to conversation
    sendFollowupTurn: function(message) {
      console.log('[OpenAI Shim] Sending followup:', message);
      sendRequest(METHODS.MESSAGE, {
        role: 'user',
        content: { type: 'text', text: message }
      });
    },

    // Open external link
    openLink: function(url) {
      console.log('[OpenAI Shim] Opening link:', url);
      sendRequest(METHODS.OPEN_LINK, { url });
    },

    // Utility: wait for tool output
    onToolOutput: function(callback) {
      if (toolOutput !== null) {
        callback();
      } else {
        pendingCallbacks.push(callback);
      }
    }
  };

  // Initialize connection with host
  sendRequest(METHODS.INITIALIZE, {
    appInfo: { name: 'Widget', version: '1.0.0' },
    capabilities: {}
  }).then(function(result) {
    console.log('[OpenAI Shim] Initialized with host:', result.host?.name);
    hostContext = result.context || hostContext;
    window.openai.theme = hostContext.theme || 'light';
    window.openai.displayMode = hostContext.displayMode || 'expanded';
    isInitialized = true;

    // Send initialized notification
    sendNotification(METHODS.INITIALIZED);
  }).catch(function(err) {
    console.error('[OpenAI Shim] Init failed:', err);
  });

  console.log('[OpenAI Shim] Loaded - window.openai available');
})();
`;
}

/**
 * Generate a complete HTML wrapper that:
 * 1. Injects the OpenAI shim
 * 2. Sets initial data
 * 3. Loads the actual widget HTML
 */
export function wrapWidgetHtml(
  widgetHtml: string,
  options: {
    toolInput?: unknown;
    toolOutput?: unknown;
    theme?: 'light' | 'dark';
  } = {}
): string {
  const shimScript = generateOpenAIShimScript();

  // Inject shim before </head> or at start of <body>
  const injection = `
<script>
${shimScript}

// Set initial data if provided
${options.toolOutput !== undefined ? `window.openai.toolOutput = ${JSON.stringify(options.toolOutput)};` : ''}
${options.toolInput !== undefined ? `window.openai.toolInput = ${JSON.stringify(options.toolInput)};` : ''}
</script>
`;

  // Try to inject into <head>
  if (widgetHtml.includes('</head>')) {
    return widgetHtml.replace('</head>', `${injection}</head>`);
  }

  // Fallback: inject at start of <body>
  if (widgetHtml.includes('<body>')) {
    return widgetHtml.replace('<body>', `<body>${injection}`);
  }

  // Last resort: prepend
  return injection + widgetHtml;
}
