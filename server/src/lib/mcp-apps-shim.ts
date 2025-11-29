/**
 * MCP Apps Dual-Protocol Shim Generator (Server-side)
 *
 * Generates JavaScript to inject into widget iframes that supports:
 * 1. OpenAI Apps SDK protocol (window.openai + custom postMessage)
 * 2. MCP Apps protocol (JSON-RPC 2.0 over postMessage)
 *
 * This replaces the old OpenAI-only injection script in projects.routes.ts
 */

// MCP Apps method names (SEP-1865)
const MCP_UI_METHODS = {
  INITIALIZE: 'ui/initialize',
  INITIALIZED: 'ui/initialized',
  TOOL_INPUT: 'ui/notifications/tool-input',
  TOOL_RESULT: 'ui/notifications/tool-result',
  HOST_CONTEXT_CHANGED: 'ui/notifications/host-context-changed',
  OPEN_LINK: 'ui/open-link',
  MESSAGE: 'ui/message',
  SIZE_CHANGE: 'ui/notifications/size-change',
};

const PROTOCOL_VERSION = '2025-11-21';

export interface WidgetInjectionOptions {
  toolInput?: unknown;
  toolOutput?: unknown;
  toolResponseMetadata?: unknown;
  theme?: 'light' | 'dark';
  displayMode?: string;
  toolId?: string;
  toolName?: string;
  widgetStateKey?: string;
}

/**
 * Serialize a value for safe inline script injection
 */
function serializeForScript(value: unknown): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  try {
    // Use JSON.stringify and escape for script context
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  } catch {
    return 'null';
  }
}

/**
 * Generate the dual-protocol widget script
 *
 * This creates window.openai AND handles MCP Apps JSON-RPC messages,
 * allowing widgets built for either protocol to work.
 */
export function generateWidgetScript(options: WidgetInjectionOptions): string {
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
<script>
(function() {
  'use strict';

  // Protocol Constants
  const MCP_METHODS = ${JSON.stringify(MCP_UI_METHODS)};
  const PROTOCOL_VERSION = '${PROTOCOL_VERSION}';

  // State
  let _toolInput = ${serializeForScript(toolInput)};
  let _toolOutput = ${serializeForScript(toolOutput)};
  let _toolResponseMetadata = ${serializeForScript(toolResponseMetadata)};
  let _widgetState = null;
  let _theme = ${serializeForScript(theme)};
  let _displayMode = ${serializeForScript(displayMode)};
  let _mcpInitialized = false;
  let _requestId = 0;
  let _pendingRequests = new Map();

  // JSON-RPC helper
  function sendJsonRpc(method, params, expectResponse) {
    const msg = { jsonrpc: '2.0', method, params };
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
    }
    window.parent.postMessage(msg, '*');
    return Promise.resolve();
  }

  function sendOpenAiMessage(type, data) {
    window.parent.postMessage({ type, ...data }, '*');
  }

  // Listen for messages from host (both protocols)
  window.addEventListener('message', function(event) {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    // MCP Apps Protocol (JSON-RPC 2.0)
    if (msg.jsonrpc === '2.0') {
      if ('id' in msg && !('method' in msg)) {
        const pending = _pendingRequests.get(msg.id);
        if (pending) {
          _pendingRequests.delete(msg.id);
          msg.error ? pending.reject(new Error(msg.error.message)) : pending.resolve(msg.result);
        }
        return;
      }

      switch (msg.method) {
        case MCP_METHODS.TOOL_INPUT:
          _toolInput = msg.params?.input;
          if (window.openai) window.openai.toolInput = _toolInput;
          break;
        case MCP_METHODS.TOOL_RESULT:
          _toolOutput = msg.params?.structuredContent ?? msg.params;
          if (window.openai) window.openai.toolOutput = _toolOutput;
          window.dispatchEvent(new CustomEvent('mcp:tool-result', { detail: _toolOutput }));
          break;
        case MCP_METHODS.HOST_CONTEXT_CHANGED:
          if (msg.params?.theme) {
            _theme = msg.params.theme;
            if (window.openai) window.openai.theme = _theme;
            window.dispatchEvent(new CustomEvent('openai:set_globals', {
              detail: { globals: { theme: _theme } }
            }));
          }
          break;
      }
      return;
    }

    // OpenAI Protocol (Legacy)
    if (msg.type === 'openai:set_globals') {
      const globals = msg.globals;
      if (globals?.theme) {
        _theme = globals.theme;
        if (window.openai) window.openai.theme = _theme;
        window.dispatchEvent(new CustomEvent('openai:set_globals', {
          detail: { globals: { theme: _theme } }
        }));
      }
    }
  });

  // window.openai API
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

    async setWidgetState(state) {
      _widgetState = state;
      ${widgetStateKey ? `try { localStorage.setItem(${serializeForScript(widgetStateKey)}, JSON.stringify(state)); } catch(e) {}` : ''}
      sendOpenAiMessage('openai:setWidgetState', { toolId: ${serializeForScript(toolId)}, state });
    },

    async callTool(toolName, params) {
      params = params || {};
      return new Promise((resolve, reject) => {
        const requestId = 'tool_' + Date.now() + '_' + Math.random();
        const handler = function(event) {
          if (event.data.type === 'openai:callTool:response' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result);
          }
        };
        window.addEventListener('message', handler);
        sendOpenAiMessage('openai:callTool', { requestId, toolName, params });
        setTimeout(function() { window.removeEventListener('message', handler); reject(new Error('Timeout')); }, 30000);
      });
    },

    async sendFollowupTurn(message) {
      const prompt = typeof message === 'string' ? message : (message?.prompt || '');
      sendJsonRpc(MCP_METHODS.MESSAGE, { role: 'user', content: { type: 'text', text: prompt } });
      sendOpenAiMessage('openai:sendFollowup', { message: prompt });
    },

    async sendFollowUpMessage(args) {
      return this.sendFollowupTurn(args);
    },

    async requestDisplayMode(options) {
      options = options || {};
      const mode = options.mode || 'inline';
      _displayMode = mode;
      sendOpenAiMessage('openai:requestDisplayMode', { mode });
      return { mode };
    },

    async openExternal(options) {
      const href = typeof options === 'string' ? options : options?.href;
      if (!href) throw new Error('href required');
      sendJsonRpc(MCP_METHODS.OPEN_LINK, { url: href });
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  Object.defineProperty(window, 'openai', { value: openaiAPI, writable: false, configurable: false, enumerable: true });
  Object.defineProperty(window, 'webplus', { value: openaiAPI, writable: false, configurable: false, enumerable: true });

  // Restore widget state
  ${widgetStateKey ? `setTimeout(function() { try { var s = localStorage.getItem(${serializeForScript(widgetStateKey)}); if (s) { _widgetState = JSON.parse(s); window.openai.widgetState = _widgetState; } } catch(e) {} }, 0);` : ''}

  // Dispatch initial globals
  setTimeout(function() {
    window.dispatchEvent(new CustomEvent('openai:set_globals', {
      detail: { globals: { displayMode: _displayMode, maxHeight: 600, theme: _theme, locale: 'en-US', safeArea: openaiAPI.safeArea, userAgent: openaiAPI.userAgent } }
    }));
  }, 0);

  // MCP handshake (optional)
  setTimeout(function() {
    sendJsonRpc(MCP_METHODS.INITIALIZE, { appInfo: { name: ${serializeForScript(toolName || 'Widget')}, version: '1.0.0' }, capabilities: {} }, true)
      .then(function(r) { _mcpInitialized = true; sendJsonRpc(MCP_METHODS.INITIALIZED); })
      .catch(function() {});
  }, 100);

  console.log('[Widget] Dual-protocol shim loaded (OpenAI + MCP Apps)');
})();
</script>
`;
}
