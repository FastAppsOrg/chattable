export interface SessionUser {
  id: string;
  email?: string;
  metadata?: Record<string, any>;
}

export class SessionService {
  /**
   * Validate a session token
   * In local development mode, returns local-user for local-token
   */
  validateToken(token: string): SessionUser {
    if (token === 'local-token') {
      return { id: 'local-user' };
    }

    // For non-local tokens, we would validate against a session store
    // Currently not implemented since we're in local-first mode
    throw new Error('Invalid session token');
  }
}

export const sessionService = new SessionService();
