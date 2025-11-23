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

    // Iterate through the text stream
    console.log('[Code Editor] Starting to iterate textStream...')
    let chunkCount = 0

    for await (const chunk of stream.textStream) {
      chunkCount++
      if (chunkCount % 10 === 0) {
        console.log('[Code Editor] Progress: chunk #' + chunkCount)
      }
      yield chunk
    }

    console.log('[Code Editor] Stream completed, total chunks:', chunkCount)
  } catch (error: any) {
    console.error('[Code Editor] Error during streaming:', error.message)
    console.error('[Code Editor] Error stack:', error.stack)
    throw error
  }
}
