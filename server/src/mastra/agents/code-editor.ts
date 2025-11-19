import { Agent } from '@mastra/core'
import { openai } from '@ai-sdk/openai'

/**
 * Code Editor Agent with MCP tools
 *
 * This agent has access to Freestyle MCP tools for editing files,
 * running commands, and managing the codebase.
 */
export function createCodeEditorAgent(mcpTools: any) {
  console.log('[Code Editor] Creating agent with tools:', mcpTools?.length || 0, 'tools')
  console.log('[Code Editor] Sample tool:', mcpTools?.[0]?.name)
  console.log('[Code Editor] OpenAI API key exists:', !!process.env.OPENAI_API_KEY)
  console.log('[Code Editor] OpenAI API key prefix:', process.env.OPENAI_API_KEY?.substring(0, 20))

  return new Agent({
    name: 'code-editor',
    instructions: `You are an expert code editor agent for Apps in ChatGPT (OpenAI Apps SDK) projects.

Your role is to help users build Apps in ChatGPT by editing code, adding features, and fixing bugs.

## Key Capabilities:
- Edit files using MCP tools
- Run shell commands to test code
- Install npm packages
- Understand the Apps SDK architecture

## Important Guidelines:
1. **Be Precise**: When editing files, use exact search-and-replace patterns
2. **Test Changes**: After making code changes, suggest running tests or preview
3. **Explain Changes**: Always explain what you're doing and why
4. **Ask Clarifying Questions**: If requirements are unclear, ask before making changes
5. **Follow Best Practices**: Write clean, maintainable, well-documented code`,
    model: openai('gpt-4o'),
    tools: mcpTools,
  })
}

/**
 * Stream chat response with code editing capabilities
 */
export async function* streamCodeEditing(
  agent: Agent,
  userMessage: string,
) {
  console.log('[Code Editor] Starting stream for message:', userMessage.substring(0, 50))

  try {
    // Using stream() with AI SDK v5 model
    console.log('[Code Editor] Calling agent.stream() with message array...')
    const stream = await agent.stream([
      {
        role: 'user',
        content: userMessage,
      },
    ])
    console.log('[Code Editor] Stream created successfully')

    // Use for await to iterate textStream (async iterable)
    console.log('[Code Editor] Starting to iterate textStream with for await...')
    let chunkCount = 0

    for await (const chunk of stream.textStream) {
      chunkCount++
      console.log('[Code Editor] Chunk #' + chunkCount + ':', typeof chunk, chunk?.substring ? chunk.substring(0, 50) : chunk)
      yield chunk
    }

    console.log('[Code Editor] Stream completed, total chunks:', chunkCount)
  } catch (error: any) {
    console.error('[Code Editor] Error during streaming:', error.message)
    console.error('[Code Editor] Error stack:', error.stack)
    console.error('[Code Editor] Full error:', error)
    throw error
  }
}
