import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),

  name: text('name'),
  description: text('description'),

  // deploymentId removed - use id (UUID) as folder name directly
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

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
