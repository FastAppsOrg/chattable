/**
 * Test Mastra agent stream with memory
 */
import { createCodeEditorAgent } from './src/mastra/agents/code-editor.js';
import { MemoryService } from './src/services/memory.service.js';
import { MCPService } from './src/services/mcp.service.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testMastraStream() {
    console.log('🧪 Testing Mastra Agent Stream...\n');

    try {
        // Get MCP tools
        console.log('Getting MCP tools...');
        const mcpTools = await MCPService.getMCPTools('test-project');
        console.log('✓ Got', mcpTools.length, 'tools');

        // Get memory
        console.log('Getting memory...');
        const memory = await MemoryService.getMemory();
        console.log('✓ Got memory');

        // Create agent
        console.log('Creating agent...');
        const agent = createCodeEditorAgent(mcpTools, memory);
        console.log('✓ Agent created');

        // Test stream
        console.log('\nStreaming message: "Say hello"...');
        const streamResult = await agent.stream('Say hello in one sentence', {
            memory: {
                thread: 'test-thread',
                resource: 'test-user',
            },
        });

        console.log('✓ Stream result obtained');
        console.log('  textStream exists:', !!streamResult.textStream);

        // Read stream
        console.log('\nReading stream...');
        let chunkCount = 0;
        let fullText = '';

        for await (const chunk of streamResult.textStream) {
            chunkCount++;
            fullText += chunk;
            console.log(`  Chunk ${chunkCount}:`, chunk);
        }

        console.log('\n✅ Stream completed!');
        console.log('  Total chunks:', chunkCount);
        console.log('  Full text:', fullText);

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMastraStream();
