import { Agent } from '@mastra/core/agent'
import { openai } from '@ai-sdk/openai'
import type { Memory } from '@mastra/memory'

/**
 * Code Editor Agent with MCP tools and Memory
 *
 * This agent has access to Freestyle MCP tools for editing files,
 * running commands, and managing the codebase.
 *
 * It also uses Mastra Memory for conversation persistence,
 * allowing it to remember context across multiple messages.
 */
export function createCodeEditorAgent(mcpTools: any, memory: Memory) {
  console.log('[Code Editor] Creating agent with tools:', mcpTools?.length || 0, 'tools')
  console.log('[Code Editor] Sample tool:', mcpTools?.[0]?.name)
  console.log('[Code Editor] Memory enabled:', !!memory)

  return new Agent({
    name: 'code-editor',
    instructions: `You are an expert code editor agent for Apps in ChatGPT (OpenAI Apps SDK) projects.

Your role is to help users build Apps in ChatGPT by editing code, adding features, and fixing bugs.

## Key Capabilities:
- Edit files using MCP tools
- Run shell commands to test code
- Install npm packages
- Understand the Apps SDK architecture
- Remember previous conversations and context

## Important Guidelines:
1. **Be Precise**: When editing files, use exact search-and-replace patterns
2. **Test Changes**: After making code changes, suggest running tests or preview
3. **Explain Changes**: Always explain what you're doing and why
4. **Ask Clarifying Questions**: If requirements are unclear, ask before making changes
5. **Follow Best Practices**: Write clean, maintainable, well-documented code
6. **Use Context**: Reference previous conversations when relevant`,
    model: openai('gpt-4o'),
    tools: mcpTools,
    memory: memory,
  })
}

/**
 * Stream chat response with code editing capabilities and memory
 *
 * @param agent - Mastra Agent instance with memory configured
 * @param userMessage - User's message
 * @param threadId - Thread ID for conversation grouping (e.g., projectId)
 * @param resourceId - Resource ID for user identification (e.g., userId)
 */
export async function* streamCodeEditing(
  agent: Agent,
  userMessage: string,
  threadId: string,
  resourceId: string,
) {
  console.log('[Code Editor] Starting stream for message:', userMessage.substring(0, 50))
  console.log('[Code Editor] Thread ID:', threadId)
  console.log('[Code Editor] Resource ID:', resourceId)

  try {
    // Using stream() with memory context
    // Mastra will automatically:
    // 1. Load previous conversation history from this thread
    // 2. Save user message to memory
    // 3. Save assistant response to memory
    // 4. Generate thread title if this is the first message
    const stream = await agent.stream(userMessage, {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    })

    // Iterate through the full stream to capture all events (text, tools, etc.)
    console.log('[Code Editor] Starting to iterate fullStream...')

    // @ts-ignore - Mastra/AI SDK types might not be fully updated in dev environment
    const fullStream = stream.fullStream;

    if (!fullStream) {
      console.warn('[Code Editor] stream.fullStream is missing, falling back to textStream');
      for await (const chunk of stream.textStream) {
        yield JSON.stringify({ type: 'text-delta', content: chunk }) + '\n';
      }
      return;
    }

    let chunkCount = 0;

    // @ts-ignore
    for await (const part of fullStream) {
      chunkCount++;
      try {
        if (part.type === 'text-delta') {
          // Try to handle different AI SDK versions
          // @ts-ignore
          const content = part.textDelta || part.text || (part.payload?.textDelta) || '';

          yield JSON.stringify({
            type: 'text-delta',
            content: content
          }) + '\n';
        }
        else if (part.type === 'tool-call') {
          console.log(`[Code Editor] Tool Call detected`);
          // @ts-ignore
          const toolName = part.toolName || part.payload?.toolName;
          // @ts-ignore
          const args = part.args || part.payload?.args;

          yield JSON.stringify({
            type: 'tool-call',
            toolName: toolName,
            toolCallId: part.toolCallId,
            args: args
          }) + '\n';
        }
        else if (part.type === 'tool-result') {
          console.log(`[Code Editor] Tool Result detected`);
          // @ts-ignore
          const toolName = part.toolName || part.payload?.toolName;

          yield JSON.stringify({
            type: 'tool-result',
            toolName: toolName,
            toolCallId: part.toolCallId,
            result: part.result
          }) + '\n';
        }
        else if (part.type === 'error') {
          console.error('[Code Editor] Stream Error:', part.error);
          yield JSON.stringify({
            type: 'error',
            error: String(part.error)
          }) + '\n';
        }
      } catch (err) {
        console.error('[Code Editor] Error processing stream part:', err);
      }
    }

    console.log('[Code Editor] Stream completed, total events:', chunkCount)
  } catch (error: any) {
    console.error('[Code Editor] Error during streaming:', error.message)
    console.error('[Code Editor] Error stack:', error.stack)
    // Re-throw to be caught by the route handler
    throw error
  }
}
