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
  private static initializationPromise: Promise<Memory> | null = null;

  /**
   * Get the singleton Memory instance with proper async initialization
   *
   * Configuration:
   * - Storage: LibSQL (SQLite) at ./memory.db
   * - Last Messages: 20 (conversation history limit)
   * - Generate Title: true (auto-generate thread titles from first message)
   */
  static async getMemory(): Promise<Memory> {
    // If already initialized, return immediately
    if (this.memoryInstance) {
      return this.memoryInstance;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = (async () => {
      const dbPath = path.resolve(process.cwd(), 'memory.db');

      const storage = new LibSQLStore({
        id: 'chattable-memory',
        url: `file:${dbPath}`,
      });

      this.memoryInstance = new Memory({
        storage,
        options: {
          lastMessages: 20,
          generateTitle: true,
        },
      });

      return this.memoryInstance;
    })();

    return this.initializationPromise;
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
      const memory = await this.getMemory();
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
      const memory = await this.getMemory();
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
      const memory = await this.getMemory();

      // Use Mastra Memory API recall() method
      const result = await memory.recall({
        threadId,
        resourceId,
        perPage: false, // Get all messages
      });

      if (!result || !result.messages) {
        return [];
      }

      // Parse Mastra message format and convert to frontend format
      const messages = result.messages.map((msg: any) => {
        let textContent = '';

        // Extract text content from message
        if (typeof msg.content === 'string') {
          textContent = msg.content;
        } else if (msg.content && Array.isArray(msg.content)) {
          // Handle array of content parts
          for (const part of msg.content) {
            if (typeof part === 'string') {
              textContent += part;
            } else if (part.type === 'text' && part.text) {
              textContent += part.text;
            }
          }
        } else if (msg.content && msg.content.parts) {
          // Handle {"format":2,"parts":[...]} format
          for (const part of msg.content.parts) {
            if (part.type === 'text' && part.text) {
              textContent += part.text;
            }
          }
        }

        return {
          id: msg.id || `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          content: textContent,
          timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
        };
      });

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
