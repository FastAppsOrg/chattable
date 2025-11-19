import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),

  name: text('name'),
  description: text('description'),

  freestyleRepoId: text('freestyle_repo_id').notNull().unique(),
  gitUrl: text('git_url'),
  gitBranch: text('git_branch').default('main'),

  ephemeralUrl: text('ephemeral_url'),
  mcpEphemeralUrl: text('mcp_ephemeral_url'),

  status: text('status', {
    enum: ['initializing', 'active', 'stopped', 'failed', 'deleted']
  }).notNull().default('initializing'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),

  messageId: text('message_id').notNull().unique(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),

  messageType: text('message_type', {
    enum: ['chat', 'tool', 'system', 'error']
  }).default('chat'),

  toolInfo: text('tool_info', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }),

  timestamp: integer('timestamp', { mode: 'timestamp' })
    .$defaultFn(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
