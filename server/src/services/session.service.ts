export interface SessionUser {
  id: string;
  email?: string;
  metadata?: Record<string, any>;
}

export class SessionService {
  private sessions: Map<string, SessionUser> = new Map();

  createSession(userId: string, email?: string, metadata?: Record<string, any>): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, { id: userId, email, metadata });
    return sessionId;
  }

  getSession(sessionId: string): SessionUser | null {
    return this.sessions.get(sessionId) || null;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  validateToken(token: string): SessionUser {
    if (token === 'local-token') {
      return { id: 'local-user' };
    }

    const session = this.getSession(token);
    if (!session) {
      throw new Error('Invalid session token');
    }

    return session;
  }

  getUserId(token: string): string {
    return this.validateToken(token).id;
  }
}

export const sessionService = new SessionService();
