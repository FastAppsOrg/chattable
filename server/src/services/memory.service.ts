import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import path from 'path';

/**
 * Memory Service - Singleton for managing Mastra Memory
 *
 * This service provides a centralized Memory instance with LibSQL storage
 * for persistent conversation history and automatic thread title generation.
 */
export class MemoryService {
  private static memoryInstance: Memory | null = null;

  /**
   * Get the singleton Memory instance
   *
   * Configuration:
   * - Storage: LibSQL (SQLite) at ./memory.db
   * - Last Messages: 20 (conversation history limit)
   * - Generate Title: true (auto-generate thread titles from first message)
   */
  static getMemory(): Memory {
    if (!this.memoryInstance) {
      console.log('[MemoryService] Initializing Mastra Memory...');

      const dbPath = path.resolve(process.cwd(), 'memory.db');
      console.log('[MemoryService] Memory DB path:', dbPath);

      this.memoryInstance = new Memory({
        storage: new LibSQLStore({
          id: 'chattable-memory',
          url: `file:${dbPath}`,
        }),
        options: {
          lastMessages: 20,
          generateTitle: true,
        },
      });

      console.log('[MemoryService] Memory initialized successfully');
    }

    return this.memoryInstance;
  }

  /**
   * Get thread title for a specific conversation
   *
   * @param threadId - Thread ID (typically projectId)
   * @param resourceId - Resource ID (typically userId)
   * @returns Thread title if available, null otherwise
   */
  static async getThreadTitle(
    threadId: string,
    resourceId: string
  ): Promise<string | null> {
    try {
      const memory = this.getMemory();
      const storage = (memory as any).storage;

      if (!storage || typeof storage.getThread !== 'function') {
        console.warn('[MemoryService] Storage does not support getThread');
        return null;
      }

      const thread = await storage.getThread({ threadId, resourceId });
      return thread?.title || null;
    } catch (error) {
      console.error('[MemoryService] Error getting thread title:', error);
      return null;
    }
  }

  /**
   * Get all threads for a specific resource (user)
   *
   * @param resourceId - Resource ID (typically userId)
   * @returns Array of threads
   */
  static async getThreadsForResource(resourceId: string): Promise<any[]> {
    try {
      const memory = this.getMemory();
      const storage = (memory as any).storage;

      if (!storage || typeof storage.getThreadsByResourceId !== 'function') {
        console.warn('[MemoryService] Storage does not support getThreadsByResourceId');
        return [];
      }

      const threads = await storage.getThreadsByResourceId({ resourceId });
      return threads || [];
    } catch (error) {
      console.error('[MemoryService] Error getting threads:', error);
      return [];
    }
  }

  /**
   * Get messages from a specific thread
   *
   * @param threadId - Thread ID (typically projectId)
   * @param resourceId - Resource ID (typically userId)
   * @returns Array of messages in the thread
   */
  static async getThreadMessages(
    threadId: string,
    resourceId: string
  ): Promise<any[]> {
    try {
      console.log('[MemoryService] getThreadMessages called:', { threadId, resourceId });
      const memory = this.getMemory();
      const storage = (memory as any).storage;

      if (!storage || !storage.db) {
        console.error('[MemoryService] Storage or db is null');
        return [];
      }

      // Query mastra_messages table directly
      const query = `SELECT * FROM mastra_messages WHERE thread_id = ? ORDER BY createdAt ASC`;
      const result = await storage.db.execute(query, [threadId]);

      console.log('[MemoryService] Raw query result:', result?.rows?.length || 0, 'messages');

      if (!result || !result.rows) {
        return [];
      }

      // Parse Mastra message format and convert to frontend format
      const messages = result.rows.map((row: any) => {
        let textContent = '';

        // Parse the JSON content
        try {
          const contentObj = typeof row.content === 'string'
            ? JSON.parse(row.content)
            : row.content;

          // Extract text from Mastra format: {"format":2,"parts":[{"type":"text","text":"..."}]}
          if (contentObj && contentObj.parts && Array.isArray(contentObj.parts)) {
            for (const part of contentObj.parts) {
              if (part.type === 'text' && part.text) {
                textContent += part.text;
              }
            }
          } else if (typeof contentObj === 'string') {
            textContent = contentObj;
          }
        } catch (e) {
          console.warn('[MemoryService] Failed to parse content:', row.content);
          textContent = row.content;
        }

        return {
          id: row.id,
          role: row.role,
          content: textContent,
          timestamp: row.createdAt,
        };
      });

      console.log('[MemoryService] Returning', messages.length, 'parsed messages');
      return messages;
    } catch (error) {
      console.error('[MemoryService] Error getting messages:', error);
      return [];
    }
  }

  /**
   * Reset the Memory instance (useful for testing)
   */
  static reset(): void {
    this.memoryInstance = null;
  }
}
