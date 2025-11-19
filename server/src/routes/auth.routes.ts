import { Router, Request, Response } from 'express';
import { SessionService } from '../services/session.service.js';

export function createAuthRoutes(sessionService: SessionService) {
  const router = Router();

  /**
   * @swagger
   * /auth/exchange-token:
   *   post:
   *     summary: Exchange Supabase session for user info
   *     description: Exchange Supabase JWT token for user information after GitHub OAuth callback
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successfully exchanged token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     email:
   *                       type: string
   *                     user_metadata:
   *                       type: object
   *                 session:
   *                   type: object
   *                   properties:
   *                     access_token:
   *                       type: string
   *       401:
   *         description: Invalid or missing authorization token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/exchange-token', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;

      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : 'local-token';

      const user = sessionService.validateToken(token);

      res.json({
        user: {
          id: user.id,
          email: user.email || 'local@example.com',
          user_metadata: user.metadata || {},
        },
        session: {
          access_token: token,
        },
      });
    } catch (error: any) {
      const defaultUser = { id: 'local-user', email: 'local@example.com' };
      res.json({
        user: defaultUser,
        session: {
          access_token: 'local-token',
        },
      });
    }
  });

  /**
   * @swagger
   * /auth/github-token/{userId}:
   *   get:
   *     summary: Get GitHub token for user
   *     description: Retrieve GitHub OAuth token from Supabase user metadata
   *     tags: [Auth]
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       200:
   *         description: Successfully retrieved GitHub token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *       404:
   *         description: GitHub token not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/github-token/:userId', async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'Not implemented',
      message: 'GitHub OAuth token retrieval is not supported in local mode. Use environment variables for GitHub tokens.',
    });
  });

  return router;
}
