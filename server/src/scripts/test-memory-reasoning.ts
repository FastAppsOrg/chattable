
import { CustomLibSQLStore } from '../services/custom-memory.store.js';
import { Memory } from '@mastra/memory';
import path from 'path';
import fs from 'fs';

async function verifyReasoningPersistence() {
    console.log('Starting verification of CustomLibSQLStore...');

    const dbPath = path.resolve(process.cwd(), 'test-memory.db');

    // Clean up previous test db
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    const storage = new CustomLibSQLStore({
        id: 'test-memory',
        url: `file:${dbPath}`,
    });

    const memory = new Memory({
        storage,
    });

    // Wait for initialization (alterTable)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const threadId = 'test-thread-' + Date.now();
    const resourceId = 'test-user-' + Date.now();
    const messageId = 'msg-' + Date.now();
    const reasoningContent = 'This is a test reasoning content.';

    console.log('Creating thread...');
    await memory.createThread({
        threadId,
        resourceId,
        title: 'Test Thread',
    });

    // Ensure the reasoning column exists after table creation
    await (storage as any).ensureReasoningColumn();

    const message = {
        id: messageId,
        resourceId: resourceId, // Add resourceId
        role: 'assistant',
        content: 'Hello world',
        createdAt: new Date(),
        reasoning: reasoningContent, // This is what we want to persist
    };

    console.log('Saving message with reasoning:', message);

    try {
        // We can't easily use memory.saveMessages directly as it might not expose it or it might sanitize inputs.
        // But we want to test if the STORE persists it.
        // If we use memory.saveMessages, it might strip 'reasoning' before passing to store?
        // Memory.saveMessages takes { messages: CoreMessage[] } usually?
        // Let's check Memory API.
        // If Memory strips it, then we need to patch Memory too?
        // But the issue said "Mastra's Memory system stores messages ... but doesn't preserve ...".
        // If I fixed the store, I need to make sure Memory passes it through.

        // However, for this test, let's try to use the STORE directly for saving,
        // but use MEMORY for setup (creating thread).
        // Or, if Memory.saveMessages supports passing extra fields (it likely takes generic objects), we can try.

        // Actually, the user code uses `agent.stream`.
        // The agent calls `memory.saveMessages`.
        // If `memory.saveMessages` strips it, my store fix won't work.
        // But `Memory` usually passes the object to `storage.saveMessages`.

        // Let's try to use `store.saveMessages` directly to verify the STORE first.
        // But we use `memory.createThread` to ensure thread exists.

        await storage.saveMessages({
            messages: [{
                ...message,
                threadId // store.saveMessages needs threadId on the message usually?
                // MastraMessageV2 has threadId? Let's check.
                // Yes, likely.
            } as any],
            format: 'v2'
        });

        console.log('Message saved. Retrieving...');

        const retrievedMessages = await storage.getMessages({
            threadId: threadId,
            format: 'v2'
        });

        console.log('Retrieved messages:', retrievedMessages);

        const retrievedMsg = retrievedMessages.find((m: any) => m.id === messageId);

        if (retrievedMsg && (retrievedMsg as any).reasoning === reasoningContent) {
            console.log('SUCCESS: Reasoning was persisted and retrieved correctly!');
        } else {
            console.error('FAILURE: Reasoning was NOT persisted or retrieved.');
            console.error('Expected:', reasoningContent);
            console.error('Actual:', retrievedMsg ? (retrievedMsg as any).reasoning : 'Message not found');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    } finally {
        // Cleanup
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    }
}

verifyReasoningPersistence();
