import { Agent } from '@mastra/core/agent'
import { openai } from '@ai-sdk/openai'
import type { Memory } from '@mastra/memory'
import type { CoreMessage } from 'ai'
import { createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from 'ai'
import { toAISdkFormat } from '@mastra/ai-sdk'

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
  // MastraMCPClient.tools() returns Record<string, Tool>, not array
  const toolNames = mcpTools ? Object.keys(mcpTools) : []
  console.log('[Code Editor] Creating agent with tools:', toolNames.length, 'tools')
  console.log('[Code Editor] Tool names:', toolNames.slice(0, 5).join(', '), toolNames.length > 5 ? '...' : '')
  console.log('[Code Editor] Sample tool has execute:', mcpTools && toolNames[0] ? typeof mcpTools[toolNames[0]].execute === 'function' : false)
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
    model: openai('gpt-5-mini'),
    tools: mcpTools,
    memory: memory,
  })
}

/**
 * Stream chat response with code editing capabilities and memory
 * Uses native Mastra stream + toAISdkFormat for proper tool execution
 *
 * @param agent - Mastra Agent instance with memory configured
 * @param messages - AI SDK format messages array
 * @param threadId - Thread ID for conversation grouping (e.g., projectId)
 * @param resourceId - Resource ID for user identification (e.g., userId)
 * @returns Response object with AI SDK UI Message Stream
 */
export async function streamCodeEditingAISdk(
  agent: Agent,
  messages: CoreMessage[],
  threadId: string,
  resourceId: string,
): Promise<Response> {
  console.log('[Code Editor] Starting AI SDK stream (format: aisdk)')
  console.log('[Code Editor] Messages count:', messages.length)
  console.log('[Code Editor] Thread ID:', threadId)
  console.log('[Code Editor] Resource ID:', resourceId)

  try {
    // Convert messages to proper model format to handle reasoning items
    // This fixes the issue where Memory doesn't preserve reasoning items for gpt-5-mini
    // See: https://github.com/mastra-ai/mastra/issues/7823
    const modelMessages = convertToModelMessages(messages as any)

    // Use native Mastra stream + toAISdkFormat for proper tool execution
    // maxSteps: 10 allows multi-step tool execution
    const result = await agent.stream(modelMessages, {
      maxSteps: 10,
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    })

    // Get last assistant message ID for proper message continuation
    let lastMessageId: string | undefined
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      lastMessageId = (messages[messages.length - 1] as any).id
    }

    // Transform Mastra stream to AI SDK UI Message format
    const uiMessageStream = createUIMessageStream({
      execute: async ({ writer }) => {
        for await (const part of toAISdkFormat(result, {
          from: 'agent',
          lastMessageId,
          sendStart: true,
          sendFinish: true,
          sendReasoning: true,
          sendSources: true,
        })) {
          writer.write(part)
        }
      },
    })

    return createUIMessageStreamResponse({ stream: uiMessageStream })
  } catch (error: any) {
    console.error('[Code Editor] Error during streaming:', error.message)
    console.error('[Code Editor] Error stack:', error.stack)
    throw error
  }
}
