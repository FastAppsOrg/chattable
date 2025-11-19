import { db } from './index';
import { projects, type Project, type NewProject } from './schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

export class DatabaseService {
  async createProject(project: NewProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async getProjects(userId?: string): Promise<Project[]> {
    const conditions = userId
      ? [eq(projects.userId, userId), isNull(projects.deletedAt)]
      : [isNull(projects.deletedAt)];

    return db.select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt));
  }

  async getProject(projectId: string, userId?: string): Promise<Project | undefined> {
    const conditions = userId
      ? [eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)]
      : [eq(projects.id, projectId), isNull(projects.deletedAt)];

    const [project] = await db.select()
      .from(projects)
      .where(and(...conditions))
      .limit(1);

    return project;
  }

  async updateProject(
    projectId: string,
    userId: string | undefined,
    updates: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>
  ): Promise<Project | undefined> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    const conditions = userId
      ? [eq(projects.id, projectId), eq(projects.userId, userId)]
      : [eq(projects.id, projectId)];

    const [updated] = await db.update(projects)
      .set(updateData)
      .where(and(...conditions))
      .returning();

    return updated;
  }

  async deleteProject(projectId: string, userId?: string): Promise<void> {
    const conditions = userId
      ? [eq(projects.id, projectId), eq(projects.userId, userId)]
      : [eq(projects.id, projectId)];

    await db.update(projects)
      .set({
        deletedAt: new Date(),
        status: 'deleted'
      })
      .where(and(...conditions));
  }

  /**
   * @deprecated Use Mastra Memory instead. Messages are automatically saved when using agent.stream() with memory context.
   */
  async saveChatMessage(message: NewChatMessage): Promise<ChatMessage | null> {
    try {
      const [saved] = await db.insert(chatMessages).values(message).returning();
      return saved;
    } catch (error: any) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return null;
      }
      throw error;
    }
  }

}

export const dbService = new DatabaseService();
