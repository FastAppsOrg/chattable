import { Router, Request, Response } from 'express'
import { generateWidget, streamWidget } from '../mastra'
import { DatabaseService } from '../db/db.service.js'

// This will be injected by index.ts
let dbService: DatabaseService

export function setDatabaseService(service: DatabaseService) {
  dbService = service
}

const router = Router()

/**
 * @swagger
 * /api/mastra/generate-widget:
 *   post:
 *     summary: Generate a ChatKit widget
 *     description: Generate a ChatKit widget from a user request using Mastra AI
 *     tags: [Mastra]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WidgetGenerateRequest'
 *     responses:
 *       200:
 *         description: Successfully generated widget
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WidgetGenerateResponse'
 *       400:
 *         description: Missing required field
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Widget generation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/generate-widget', async (req: Request, res: Response) => {
  try {
    const { userRequest, stream = false } = req.body

    if (!userRequest) {
      return res.status(400).json({
        error: 'Missing required field: userRequest',
      })
    }

    // Streaming response
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      try {
        for await (const chunk of streamWidget(userRequest)) {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
        }
        res.write('data: [DONE]\n\n')
        res.end()
      } catch (error) {
        console.error('Streaming error:', error)
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
        res.end()
      }
      return
    }

    // Non-streaming response
    const result = await generateWidget(userRequest)

    return res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Widget generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate widget',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * @swagger
 * /api/mastra/chat:
 *   post:
 *     summary: Chat with the ChatKit builder agent
 *     description: Conversational widget building interface with Mastra AI
 *     tags: [Mastra]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: Successfully processed chat message
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Missing required field
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Chat processing failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, projectId, isFirstMessage = false, stream = true } = req.body
    const user = (req as any).user

    if (!message) {
      return res.status(400).json({
        error: 'Missing required field: message',
      })
    }

    // Update project name on first message
    if (isFirstMessage && projectId && user && dbService) {
      try {
        // Extract a concise name from the first message (max 100 chars)
        const projectName = message.trim().substring(0, 100)

        await dbService.updateProject(projectId, user.id, {
          name: projectName,
        })
      } catch (error) {
        console.error('[Mastra] Failed to update project name:', error)
        // Don't fail the request if name update fails
      }
    }

    // For now, chat endpoint behaves similarly to generate-widget
    // but is designed to be extended with conversation history
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      try {
        for await (const chunk of streamWidget(message)) {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
        }
        res.write('data: [DONE]\n\n')
        res.end()
      } catch (error) {
        console.error('Chat streaming error:', error)
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
        res.end()
      }
      return
    }

    const result = await generateWidget(message)

    return res.json({
      success: true,
      message: result.fullResponse,
      widget: {
        designSpec: result.designSpec,
        schema: result.schema,
        template: result.template,
        data: result.data,
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * @swagger
 * /api/mastra/health:
 *   get:
 *     summary: Mastra service health check
 *     description: Check if the Mastra ChatKit builder service is running
 *     tags: [Mastra, Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: mastra-chatkit-builder
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    service: 'mastra-chatkit-builder',
    timestamp: new Date().toISOString(),
  })
})

export default router
