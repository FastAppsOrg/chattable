import { Router, Request, Response } from 'express';

export function createGitHubRoutes() {
  const router = Router();

  /**
   * @swagger
   * /github/organizations:
   *   get:
   *     summary: Get GitHub organizations
   *     description: Retrieve GitHub organizations for the authenticated user
   *     tags: [GitHub]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successfully retrieved organizations
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   login:
   *                     type: string
   *                   id:
   *                     type: number
   *                   avatar_url:
   *                     type: string
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
  router.get('/organizations', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get GitHub token from user metadata
      const githubToken = user.user_metadata?.provider_token;

      if (!githubToken) {
        return res.status(404).json({ error: 'GitHub token not found' });
      }

      // Call GitHub API to get orgs
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const orgs = await response.json();
      res.json(orgs);
    } catch (error: any) {
      console.error('[GitHub] Failed to get organizations:', error);
      res.status(500).json({
        error: 'Failed to get organizations',
        message: error.message,
      });
    }
  });

  /**
   * @swagger
   * /github/repositories:
   *   get:
   *     summary: Get GitHub repositories
   *     description: Retrieve GitHub repositories for the authenticated user
   *     tags: [GitHub]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Successfully retrieved repositories
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: number
   *                   name:
   *                     type: string
   *                   full_name:
   *                     type: string
   *                   private:
   *                     type: boolean
   *                   html_url:
   *                     type: string
   *                   description:
   *                     type: string
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
  router.get('/repositories', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const githubToken = user.user_metadata?.provider_token;

      if (!githubToken) {
        return res.status(404).json({ error: 'GitHub token not found' });
      }

      // Call GitHub API to get repos
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const repos = await response.json();
      res.json(repos);
    } catch (error: any) {
      console.error('[GitHub] Failed to get repositories:', error);
      res.status(500).json({
        error: 'Failed to get repositories',
        message: error.message,
      });
    }
  });

  return router;
}
