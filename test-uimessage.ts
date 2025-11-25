/**
 * Test @ai-sdk/react useChat hook
 * This tests the actual type structure of UIMessage
 */

import { Chat } from 'ai';

async function testUIMessage() {
    console.log('🧪 Testing UIMessage structure...\n');

    // Create a mock chat to understand the message structure
    const chat = new Chat({
        id: 'test-chat',
        messages: [
            {
                id: 'msg-1',
                role: 'user',
                parts: [
                    { type: 'text', text: 'Hello' }
                ]
            },
            {
                id: 'msg-2',
                role: 'assistant',
                parts: [
                    { type: 'text', text: 'Hi there!' }
                ]
            }
        ]
    });

    const messages = chat.messages;

    console.log('Messages count:', messages.length);
    console.log('\nFirst message structure:');
    console.log('  id:', messages[0].id);
    console.log('  role:', messages[0].role);
    console.log('  parts:', messages[0].parts);
    console.log('  parts[0].type:', messages[0].parts[0].type);
    console.log('  parts[0].text:', (messages[0].parts[0] as any).text);

    // Helper to extract text from message
    const getText = (msg: typeof messages[0]) => {
        return msg.parts
            .filter(part => part.type === 'text')
            .map(part => (part as any).text)
            .join('');
    };

    console.log('\n✅ Extracted text from message 1:', getText(messages[0]));
    console.log('✅ Extracted text from message 2:', getText(messages[1]));

    console.log('\n📝 Correct usage:');
    console.log('  content: msg.parts.filter(p => p.type === "text").map(p => p.text).join("")');
    console.log('  NOT: msg.text (does not exist!)');
}

testUIMessage().catch(console.error);
