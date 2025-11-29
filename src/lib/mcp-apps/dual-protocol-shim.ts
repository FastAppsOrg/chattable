/**
 * Dual Protocol Shim Generator
 *
 * Generates a script that supports BOTH:
 * 1. OpenAI Apps SDK protocol (window.openai + custom postMessage)
 * 2. MCP Apps protocol (JSON-RPC 2.0 over postMessage)
 *
 * This allows Chattable to:
 * - Work with existing skybridge widgets (OpenAI protocol)
 * - Work with new MCP Apps widgets (SEP-1865 protocol)
 * - Gradually migrate without breaking anything
 *
 * The host (WidgetPreview) can choose which protocol to speak.
 */

import { MCP_UI_METHODS, PROTOCOL_VERSION } from './types';

export interface DualProtocolOptions {
  toolInput?: unknown;
  toolOutput?: unknown;
  toolResponseMetadata?: unknown;
  theme?: 'light' | 'dark';
  displayMode?: 'inline' | 'compact' | 'expanded';
  toolId?: string;
  toolName?: string;
  widgetStateKey?: string;
}

/**
 * Generate the dual-protocol script to inject into iframe
 *
 * This creates window.openai AND handles MCP Apps JSON-RPC messages
 */
export function generateDualProtocolScript(options: DualProtocolOptions): string {
  const {
    toolInput = null,
    toolOutput = null,
    toolResponseMetadata = null,
    theme = 'light',
    displayMode = 'inline',
    toolId = '',
    toolName = '',
    widgetStateKey = '',
  } = options;

  return `
(function() {
  'use strict';

  // ==========================================================================
  // Protocol Constants
  // ==========================================================================
  const MCP_METHODS = ${JSON.stringify(MCP_UI_METHODS)};
  const PROTOCOL_VERSION = '${PROTOCOL_VERSION}';

  // ==========================================================================
  // State
  // ==========================================================================
  let _toolInput = ${JSON.stringify(toolInput)};
  let _toolOutput = ${JSON.stringify(toolOutput)};
  let _toolResponseMetadata = ${JSON.stringify(toolResponseMetadata)};
  let _widgetState = null;
  let _theme = ${JSON.stringify(theme)};
  let _displayMode = ${JSON.stringify(displayMode)};

  // For MCP Apps protocol
  let _mcpInitialized = false;
  let _requestId = 0;
  let _pendingRequests = new Map();

  // ==========================================================================
  // Dual-Protocol Message Handling
  // ==========================================================================

  function sendJsonRpc(method, params, expectResponse = false) {
    const msg = {
      jsonrpc: '2.0',
      method,
      params,
    };

    if (expectResponse) {
      const id = ++_requestId;
      msg.id = id;
      return new Promise((resolve, reject) => {
        _pendingRequests.set(id, { resolve, reject });
        window.parent.postMessage(msg, '*');
        setTimeout(() => {
          if (_pendingRequests.has(id)) {
            _pendingRequests.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    } else {
      window.parent.postMessage(msg, '*');
      return Promise.resolve();
    }
  }

  function sendOpenAiMessage(type, data) {
    window.parent.postMessage({ type, ...data }, '*');
  }

  // Listen for messages from host (both protocols)
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;

    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    // =======================================================================
    // MCP Apps Protocol (JSON-RPC 2.0)
    // =======================================================================
    if (msg.jsonrpc === '2.0') {
      // Handle response to our requests
      if ('id' in msg && !('method' in msg)) {
        const pending = _pendingRequests.get(msg.id);
        if (pending) {
          _pendingRequests.delete(msg.id);
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
        case MCP_METHODS.TOOL_INPUT:
          _toolInput = msg.params?.input;
          if (window.openai) window.openai.toolInput = _toolInput;
          console.log('[DualProtocol] MCP: Received tool input');
          break;

        case MCP_METHODS.TOOL_RESULT:
          _toolOutput = msg.params?.structuredContent ?? msg.params;
          if (window.openai) window.openai.toolOutput = _toolOutput;
          console.log('[DualProtocol] MCP: Received tool result');
          // Dispatch event for widgets that listen
          window.dispatchEvent(new CustomEvent('mcp:tool-result', { detail: _toolOutput }));
          break;

        case MCP_METHODS.HOST_CONTEXT_CHANGED:
          if (msg.params?.theme) {
            _theme = msg.params.theme;
            if (window.openai) window.openai.theme = _theme;
            // Dispatch OpenAI-style event for compatibility
            window.dispatchEvent(new CustomEvent('openai:set_globals', {
              detail: { globals: { theme: _theme } }
            }));
          }
          if (msg.params?.displayMode) {
            _displayMode = msg.params.displayMode;
            if (window.openai) window.openai.displayMode = _displayMode;
          }
          break;
      }
      return;
    }

    // =======================================================================
    // OpenAI Protocol (Legacy)
    // =======================================================================
    if (msg.type === 'openai:set_globals') {
      const { globals } = msg;
      if (globals?.theme) {
        _theme = globals.theme;
        if (window.openai) window.openai.theme = _theme;
        window.dispatchEvent(new CustomEvent('openai:set_globals', {
          detail: { globals: { theme: _theme } }
        }));
      }
    }

    if (msg.type === 'openai:callTool:response') {
      // Handled by promise in callTool
    }
  });

  // ==========================================================================
  // window.openai API (Compatible with skybridge widgets)
  // ==========================================================================
  const openaiAPI = {
    get toolInput() { return _toolInput; },
    set toolInput(v) { _toolInput = v; },

    get toolOutput() { return _toolOutput; },
    set toolOutput(v) { _toolOutput = v; },

    get toolResponseMetadata() { return _toolResponseMetadata; },

    get widgetState() { return _widgetState; },
    set widgetState(v) { _widgetState = v; },

    get theme() { return _theme; },
    set theme(v) { _theme = v; },

    get displayMode() { return _displayMode; },
    set displayMode(v) { _displayMode = v; },

    locale: 'en-US',
    maxHeight: 600,
    safeArea: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
    userAgent: { device: { type: 'desktop' }, capabilities: { hover: true, touch: false } },

    // State management
    async setWidgetState(state) {
      _widgetState = state;
      ${widgetStateKey ? `
      try {
        localStorage.setItem(${JSON.stringify(widgetStateKey)}, JSON.stringify(state));
      } catch (err) {
        console.error('[OpenAI Widget] Failed to save state:', err);
      }
      ` : ''}
      // Send via both protocols
      sendOpenAiMessage('openai:setWidgetState', { toolId: ${JSON.stringify(toolId)}, state });
    },

    // Tool calling
    async callTool(toolName, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = \`tool_\${Date.now()}_\${Math.random()}\`;
        const handler = (event) => {
          if (event.data.type === 'openai:callTool:response' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', handler);
        sendOpenAiMessage('openai:callTool', { requestId, toolName, params });
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Tool call timeout'));
        }, 30000);
      });
    },

    // Send followup message
    async sendFollowupTurn(message) {
      const prompt = typeof message === 'string' ? message : (message?.prompt || '');
      // Try MCP protocol first, fallback to OpenAI
      sendJsonRpc(MCP_METHODS.MESSAGE, {
        role: 'user',
        content: { type: 'text', text: prompt }
      });
      sendOpenAiMessage('openai:sendFollowup', { message: prompt });
    },

    async sendFollowUpMessage(args) {
      const prompt = typeof args === 'string' ? args : (args?.prompt || '');
      return this.sendFollowupTurn(prompt);
    },

    // Display mode
    async requestDisplayMode(options = {}) {
      const mode = options.mode || 'inline';
      _displayMode = mode;
      sendOpenAiMessage('openai:requestDisplayMode', { mode });
      return { mode };
    },

    // External links
    async openExternal(options) {
      const href = typeof options === 'string' ? options : options?.href;
      if (!href) throw new Error('href is required');
      // Try MCP protocol
      sendJsonRpc(MCP_METHODS.OPEN_LINK, { url: href });
      // Also open directly
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  // Make it non-writable
  Object.defineProperty(window, 'openai', {
    value: openaiAPI,
    writable: false,
    configurable: false,
    enumerable: true
  });

  // Also expose as webplus (OpenAI alias)
  Object.defineProperty(window, 'webplus', {
    value: openaiAPI,
    writable: false,
    configurable: false,
    enumerable: true
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // Restore widget state from localStorage
  ${widgetStateKey ? `
  setTimeout(() => {
    try {
      const stored = localStorage.getItem(${JSON.stringify(widgetStateKey)});
      if (stored) {
        _widgetState = JSON.parse(stored);
        window.openai.widgetState = _widgetState;
      }
    } catch (err) {}
  }, 0);
  ` : ''}

  // Dispatch initial globals event
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('openai:set_globals', {
      detail: {
        globals: {
          displayMode: _displayMode,
          maxHeight: openaiAPI.maxHeight,
          theme: _theme,
          locale: openaiAPI.locale,
          safeArea: openaiAPI.safeArea,
          userAgent: openaiAPI.userAgent
        }
      }
    }));
  }, 0);

  // Try MCP Apps handshake (optional - host may not support it)
  setTimeout(() => {
    sendJsonRpc(MCP_METHODS.INITIALIZE, {
      appInfo: { name: ${JSON.stringify(toolName || 'Widget')}, version: '1.0.0' },
      capabilities: {}
    }, true).then((result) => {
      console.log('[DualProtocol] MCP handshake success:', result?.host?.name);
      _mcpInitialized = true;
      sendJsonRpc(MCP_METHODS.INITIALIZED);
    }).catch((err) => {
      console.log('[DualProtocol] MCP handshake failed (host may not support it):', err.message);
    });
  }, 100);

  console.log('[DualProtocol] Loaded - window.openai available, MCP Apps supported');
})();
`;
}
