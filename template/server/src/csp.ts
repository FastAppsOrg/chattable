import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { env } from "./env.js";

/**
 * Get the current server origin based on environment
 * In production, you might want to use a PUBLIC_URL environment variable
 */
export function getOrigin(): string {
  const port = env.PORT;
  // For local development
  return `http://localhost:${port}`;
}

/**
 * Get Widget CSP configuration for all widgets
 * This defines which domains widgets can connect to and load resources from
 *
 * TODO: Define the CSP domains based on your widget's needs
 * - connect_domains: Domains for fetch/XHR requests (APIs)
 * - resource_domains: Domains for loading images, fonts, etc.
 */
export function getWidgetCSP() {
  return {
    "openai/widgetCSP": {
      connect_domains: [
        getOrigin(), // Allow widgets to call back to this server
        // TODO: Add your external API domains here
        // Example: "https://api.example.com"
        "https://pokeapi.co/api/v2/pokemon"
      ],
      resource_domains: [
        getOrigin(),
        // TODO: Add domains for images, fonts, etc.
        // Example: "https://cdn.example.com"
      ],
    },
  };
}

/**
 * Middleware wrapper that automatically injects CSP metadata into widget responses
 * Usage: server.widget("name", config, schema, withCSP(handler))
 */
export function withCSP<TInput, TOutput extends CallToolResult>(
  handler: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    const result = await handler(input);

    // Inject CSP into _meta
    return {
      ...result,
      _meta: {
        ...result._meta,
        ...getWidgetCSP(),
      },
    } as TOutput;
  };
}
