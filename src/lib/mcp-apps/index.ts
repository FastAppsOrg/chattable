/**
 * MCP Apps Protocol Implementation
 *
 * Lean implementation of SEP-1865 (MCP Apps) for Chattable.
 *
 * This module provides:
 * - McpAppsHostBridge: Host-side protocol handler (like AppBridge in ext-apps SDK)
 * - OpenAI shim: Compatibility layer so existing skybridge widgets work unchanged
 * - Type definitions for the protocol
 *
 * @see https://github.com/modelcontextprotocol/ext-apps
 * @see https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/
 */

export * from './types';
export { McpAppsHostBridge, type HostBridgeOptions, type HostBridgeCallbacks } from './host-bridge';
export { generateOpenAIShimScript, wrapWidgetHtml } from './openai-shim';
export { generateDualProtocolScript, type DualProtocolOptions } from './dual-protocol-shim';
