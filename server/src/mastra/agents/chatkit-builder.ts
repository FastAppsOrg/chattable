import { Agent } from '@mastra/core/agent'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

// Read the system prompt file
const SYSTEM_PROMPT_PATH = path.resolve(process.cwd(), '../SYSTEM_PROMPT.md')

async function loadSystemPrompt(): Promise<string> {
  try {
    const content = await fs.readFile(SYSTEM_PROMPT_PATH, 'utf-8')
    return content
  } catch (error) {
    console.error('Failed to load SYSTEM_PROMPT.md:', error)
    // Fallback to basic instructions
    return `You are an expert ChatKit widget designer. Create beautiful, simple widgets using the ChatKit widget system.

Output format:
1. WIDGET SCHEMA (TypeScript with Zod)
2. WIDGET TEMPLATE (TSX using ChatKit components)
3. WIDGET DATA (JSON sample data)

Keep widgets simple and focused. Use Card or ListView as root containers.`
  }
}

// Initialize the system prompt
let systemPromptContent = ''
loadSystemPrompt().then(content => {
  systemPromptContent = content
})

/**
 * ChatKit Widget Builder Agent
 *
 * This agent specializes in generating ChatKit widget code based on user requests.
 * It outputs:
 * - Zod schema for widget state
 * - TSX template using ChatKit components
 * - Sample JSON data that satisfies the schema
 */
export const chatkitBuilderAgent = new Agent({
  name: 'chatkit-builder',
  instructions: async () => {
    // Ensure system prompt is loaded
    if (!systemPromptContent) {
      systemPromptContent = await loadSystemPrompt()
    }

    return `${systemPromptContent}

## Additional Instructions

When generating a widget, always output in this exact format:

### DESIGN SPEC
[Brief 1-3 sentence explanation of the widget design]

### WIDGET SCHEMA
\`\`\`typescript
import { z } from "zod"

// Define your schema here
const WidgetState = z.strictObject({
  // ... fields
})

export default WidgetState
\`\`\`

### WIDGET TEMPLATE
\`\`\`tsx
<Card>
  {/* Your widget UI here */}
</Card>
\`\`\`

### WIDGET DATA
\`\`\`json
{
  // Sample data that satisfies the schema
}
\`\`\`

Remember:
- Keep widgets simple and focused
- Use Card or ListView as root container
- Text components use value prop, not children
- Follow the component reference strictly
- Include only the minimal data needed
- Keep complexity low unless explicitly requested
`
  },
  model: openai('gpt-4o-mini'),
})

/**
 * Generate a ChatKit widget from a user request
 */
export async function generateWidget(userRequest: string): Promise<{
  designSpec: string
  schema: string
  template: string
  data: string
  fullResponse: string
}> {
  const result = await chatkitBuilderAgent.generate([
    {
      role: 'user',
      content: userRequest,
    },
  ])

  const fullResponse = result.text || ''

  // Parse the response to extract sections
  const sections = {
    designSpec: extractSection(fullResponse, 'DESIGN SPEC'),
    schema: extractSection(fullResponse, 'WIDGET SCHEMA'),
    template: extractSection(fullResponse, 'WIDGET TEMPLATE'),
    data: extractSection(fullResponse, 'WIDGET DATA'),
    fullResponse,
  }

  return sections
}

/**
 * Extract a section from the agent response
 */
function extractSection(response: string, sectionName: string): string {
  const patterns = [
    new RegExp(`###\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n###|$)`, 'i'),
    new RegExp(`##\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i'),
    new RegExp(`#\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n#|$)`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = response.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return ''
}

/**
 * Stream widget generation for real-time updates
 */
export async function* streamWidget(userRequest: string) {
  // Using stream() with AI SDK v5
  const stream = await chatkitBuilderAgent.stream([
    {
      role: 'user',
      content: userRequest,
    },
  ])

  for await (const chunk of stream.textStream) {
    yield chunk
  }
}
