/**
 * Test AI SDK createUIMessageStream usage
 * Run with: node --loader tsx test-ai-sdk.ts
 */

async function testAISDK() {
    console.log('🧪 Testing AI SDK createUIMessageStream...\n');

    // Import AI SDK
    const { createUIMessageStream, createUIMessageStreamResponse } = await import('ai');

    // Test 1: Create UI message stream with simple text
    console.log('Test 1: Creating UI message stream with text chunks...');

    const uiStream = createUIMessageStream({
        execute: async ({ writer }) => {
            console.log('  ✓ Execute function called with writer');

            // Simulate streaming text chunks
            const chunks = ['Hello', ' ', 'World', '!'];
            for (const chunk of chunks) {
                console.log(`  ✓ Writing chunk: "${chunk}"`);
                writer.write({
                    type: 'text',
                    value: chunk,
                });

                // Small delay to simulate streaming
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('  ✓ All chunks written');
        },
    });

    console.log('  ✓ UI stream created:', typeof uiStream);
    console.log('  ✓ Is ReadableStream:', uiStream instanceof ReadableStream);

    // Test 2: Create response from stream
    console.log('\nTest 2: Creating HTTP response...');

    const response = createUIMessageStreamResponse({ stream: uiStream });

    console.log('  ✓ Response created:', response instanceof Response);
    console.log('  ✓ Response status:', response.status);
    console.log('  ✓ Content-Type:', response.headers.get('Content-Type'));
    console.log('  ✓ Has body:', !!response.body);

    // Test 3: Read and verify stream
    console.log('\nTest 3: Reading stream...');

    if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            console.log(`  ✓ Received chunk: ${chunk.substring(0, 50)}...`);
        }

        console.log('\n  ✓ Full response:', fullText);
    }

    console.log('\n✅ All tests passed!\n');
}

// Run test
testAISDK().catch(error => {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
});
