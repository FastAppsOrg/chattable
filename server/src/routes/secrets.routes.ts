import { Router, Request, Response } from 'express';

export function createSecretsRoutes() {
  const router = Router();

  /**
   * @swagger
   * /api/secrets/status:
   *   get:
   *     summary: Get secrets status
   *     description: Check which API keys and secrets are configured
   *     tags: [Secrets]
   *     responses:
   *       200:
   *         description: Successfully retrieved secrets status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 has_github_token:
   *                   type: boolean
   *                   description: Whether GitHub token is configured
   *                 has_claude_key:
   *                   type: boolean
   *                   description: Whether Claude API key is configured
   *                 has_openai_key:
   *                   type: boolean
   *                   description: Whether OpenAI API key is configured
   *                 ai_provider:
   *                   type: string
   *                   nullable: true
   *                   description: Current AI provider (openai, claude, or null)
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      // For now, return basic status
      // In the future, this could check which env vars are set
      res.json({
        has_github_token: true, // Assume GitHub auth is configured via Supabase
        has_claude_key: false,
        has_openai_key: !!process.env.OPENAI_API_KEY,
        ai_provider: process.env.OPENAI_API_KEY ? 'openai' : null,
      });
    } catch (error: any) {
      console.error('[Secrets] Failed to get status:', error);
      res.status(500).json({
        error: 'Failed to get secrets status',
        message: error.message,
      });
    }
  });

  return router;
}
