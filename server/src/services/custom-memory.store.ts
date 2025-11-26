import { LibSQLStore } from '@mastra/libsql';
import { MastraMessageV2 } from '@mastra/core';

/**
 * Custom LibSQL Store to handle 'reasoning' field persistence for GPT-5 Mini.
 * 
 * This class extends the default LibSQLStore to:
 * 1. Add a 'reasoning' column to the messages table if it doesn't exist.
 * 2. Intercept saveMessages to persist the 'reasoning' field.
 * 3. Intercept getMessages to retrieve the 'reasoning' field.
 */
export class CustomLibSQLStore extends LibSQLStore {
    constructor(config: any) {
        super(config);
        this.initReasoningColumn();
    }

    /**
     * Ensure the 'reasoning' column exists in the messages table.
     * Retries with exponential backoff to handle table creation timing.
     */
    private async initReasoningColumn(retries = 5) {
        const client = (this as any).client || (this as any).db;
        if (!client) {
            console.warn('[CustomLibSQLStore] No client available to init column');
            return;
        }

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Check if table exists first
                const tables = await client.execute('SELECT name FROM sqlite_master WHERE type="table" AND name="mastra_messages"');
                if (!tables.rows || tables.rows.length === 0) {
                    if (attempt < retries - 1) {
                        const delay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms, 800ms, 1600ms
                        console.log(`[CustomLibSQLStore] Table not ready yet, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    } else {
                        console.warn('[CustomLibSQLStore] Table mastra_messages not created after retries');
                        return;
                    }
                }

                // Check if column exists
                const tableInfo = await client.execute('PRAGMA table_info(mastra_messages)');
                const hasReasoning = tableInfo.rows.some((row: any) => row.name === 'reasoning');

                if (!hasReasoning) {
                    console.log('[CustomLibSQLStore] Adding reasoning column...');
                    await client.execute('ALTER TABLE mastra_messages ADD COLUMN reasoning TEXT');
                    console.log('[CustomLibSQLStore] ✅ Added reasoning column successfully');
                } else {
                    console.log('[CustomLibSQLStore] ✅ Reasoning column already exists');
                }
                return; // Success, exit retry loop
            } catch (e: any) {
                if (attempt < retries - 1) {
                    const delay = Math.pow(2, attempt) * 100;
                    console.warn(`[CustomLibSQLStore] Error on attempt ${attempt + 1}: ${e.message}, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error('[CustomLibSQLStore] Failed to add reasoning column after all retries:', e.message);
                }
            }
        }
    }

    /**
     * Public method to manually initialize reasoning column after tables are created
     */
    async ensureReasoningColumn() {
        await this.initReasoningColumn();
    }

    /**
     * Override saveMessages to persist reasoning.
     */
    async saveMessages(args: any): Promise<any> {
        // 1. Call super to save standard fields
        const savedMessages = await super.saveMessages(args);

        // 2. Update records with reasoning where present
        // We do this individually or in batch if possible. 
        // Since super.saveMessages doesn't return the reasoning, we use the input args.

        const messagesWithReasoning = args.messages.filter((msg: any) => msg.reasoning);

        if (messagesWithReasoning.length > 0) {
            for (const msg of messagesWithReasoning) {
                try {
                    // We use the raw query or update method if available.
                    // LibSQLStore has `insert` and `batchInsert` but not a direct `update` for arbitrary columns easily exposed 
                    // except `updateMessages` which takes specific fields.
                    // Let's check if `updateMessages` is flexible enough or if we need to use raw SQL.
                    // The type definition for updateMessages showed:
                    // updateMessages({ messages }: { messages: (Partial<...> & { id: string; ... })[] }): Promise<...>

                    // If updateMessages is strict, we might need another way.
                    // But wait, LibSQLStore uses Drizzle or raw SQL under the hood?
                    // The `LibSQLStore` class likely has a `client` property but it might be private.

                    // Workaround: If we can't use updateMessages for custom columns, we might need to use `execute` if exposed,
                    // or rely on `saveMessages` actually being able to save it if we modified the schema?
                    // No, `saveMessages` in parent likely filters fields based on its known schema.

                    // Let's try to use `this.database.execute` if accessible, or `this.client`.
                    // If those are private, we are in a bit of a bind.

                    // However, we can try `updateMessages` and see if it passes through extra fields if we cast it.
                    // If not, we might need to use a raw query.

                    // Let's assume for now we can use a raw query via the underlying client if we can access it.
                    // `LibSQLStore` extends `MastraStore`? No, it implements `Storage`.

                    // Let's try to access `this.client` (it is often protected or public in these libs).
                    const client = (this as any).client || (this as any).db;
                    if (client) {
                        await client.execute({
                            sql: 'UPDATE mastra_messages SET reasoning = ? WHERE id = ?',
                            args: [(msg as any).reasoning, msg.id]
                        });
                    } else {
                        console.warn('[CustomLibSQLStore] Could not access DB client to save reasoning');
                    }

                } catch (err) {
                    console.error(`[CustomLibSQLStore] Failed to save reasoning for message ${msg.id}:`, err);
                }
            }
        }

        return savedMessages;
    }

    /**
     * Override getMessages to retrieve reasoning.
     */
    async getMessages(args: any): Promise<any[]> {
        const messages = await super.getMessages(args);

        // If we successfully added the column, we need to fetch it.
        // super.getMessages likely selects specific columns.
        // If it selects *, we are good. If it selects specific columns, we missed it.

        // If super.getMessages misses it, we might need to fetch reasoning separately and merge.
        // This is inefficient but safe.

        if (messages.length > 0) {
            const client = (this as any).client || (this as any).db;
            if (client) {
                const ids = messages.map(m => m.id);
                const placeholders = ids.map(() => '?').join(',');
                try {
                    const result = await client.execute({
                        sql: `SELECT id, reasoning FROM mastra_messages WHERE id IN (${placeholders}) AND reasoning IS NOT NULL`,
                        args: ids
                    });

                    const reasoningMap = new Map();
                    if (result.rows) {
                        for (const row of result.rows) {
                            reasoningMap.set(row.id, row.reasoning);
                        }
                    }

                    // Merge reasoning back into messages
                    for (const msg of messages) {
                        if (reasoningMap.has(msg.id)) {
                            (msg as any).reasoning = reasoningMap.get(msg.id);
                        }
                    }
                } catch (err: any) {
                    console.error('[CustomLibSQLStore] Failed to fetch reasoning:', err);
                    console.error('[CustomLibSQLStore] Error message:', err.message);

                    // Try to add column again if it's missing
                    if (err.message && err.message.includes('no such column')) {
                        console.log('[CustomLibSQLStore] Column missing, attempting to add it now...');
                        try {
                            await client.execute('ALTER TABLE mastra_messages ADD COLUMN reasoning TEXT');
                            console.log('[CustomLibSQLStore] Added reasoning column (late init)');
                            // Retry the select? No, just let next call succeed.
                        } catch (e) {
                            console.error('[CustomLibSQLStore] Failed to add column on retry:', e);
                        }
                    }

                    try {
                        const tables = await client.execute('SELECT name FROM sqlite_master WHERE type="table"');
                        console.log('[CustomLibSQLStore] Available tables:', tables.rows);

                        const tableInfo = await client.execute('PRAGMA table_info(mastra_messages)');
                        console.log('[CustomLibSQLStore] mastra_messages schema:', tableInfo.rows);

                        const allRows = await client.execute('SELECT * FROM mastra_messages');
                        console.log('[CustomLibSQLStore] All messages:', allRows.rows);
                    } catch (e) {
                        console.error('[CustomLibSQLStore] Failed to inspect DB:', e);
                    }
                }
            }
        }

        return messages;
    }
}
