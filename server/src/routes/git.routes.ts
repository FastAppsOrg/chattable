import { Router } from 'express';
import { gitService } from '../services/git.service.js';

export const createGitRoutes = () => {
    const router = Router();

    // Get status
    router.get('/:projectId/status', async (req, res) => {
        try {
            const { projectId } = req.params;
            const status = await gitService.getStatus(projectId);
            res.json(status);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get commit log
    router.get('/:projectId/log', async (req, res) => {
        try {
            const { projectId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
            const log = await gitService.getLog(projectId, limit);
            res.json(log);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Commit changes
    router.post('/:projectId/commit', async (req, res) => {
        try {
            const { projectId } = req.params;
            const { message, files } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Commit message is required' });
            }

            const result = await gitService.commit(projectId, message, files);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Push changes
    router.post('/:projectId/push', async (req, res) => {
        try {
            const { projectId } = req.params;
            const { remote, branch } = req.body;
            const result = await gitService.push(projectId, remote, branch);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Pull changes
    router.post('/:projectId/pull', async (req, res) => {
        try {
            const { projectId } = req.params;
            const { remote, branch } = req.body;
            const result = await gitService.pull(projectId, remote, branch);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
