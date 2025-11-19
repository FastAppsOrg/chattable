import { Mastra } from '@mastra/core/mastra'
import { chatkitBuilderAgent } from './agents/chatkit-builder'

/**
 * Mastra instance configuration
 *
 * This configures the Mastra framework with our ChatKit builder agent.
 * The agent is designed to generate widget code based on user requests.
 */
export const mastra = new Mastra({
  agents: {
    chatkitBuilder: chatkitBuilderAgent,
  },
})

// Export agent for direct access
export { chatkitBuilderAgent, generateWidget, streamWidget } from './agents/chatkit-builder'
