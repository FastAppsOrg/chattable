import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AppKit Server API',
      version: '1.0.0',
      description: 'API documentation for the AppKit server with Freestyle integration, WebSocket chat, and Mastra AI widget builder',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Supabase access token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
            },
          },
        },
        Project: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: 'Project UUID',
            },
            name: {
              type: 'string',
              description: 'Project name',
            },
            git_url: {
              type: 'string',
              description: 'Git repository URL',
            },
            default_branch: {
              type: 'string',
              description: 'Default git branch',
            },
            status: {
              type: 'string',
              enum: ['initializing', 'active', 'failed'],
              description: 'Project status',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Project creation timestamp',
            },
            sandbox_id: {
              type: 'string',
              description: 'Freestyle sandbox ID',
            },
            ephemeral_url: {
              type: 'string',
              description: 'Ephemeral URL for the project',
            },
            mcp_ephemeral_url: {
              type: 'string',
              description: 'MCP Ephemeral URL for the project',
            },
          },
        },
        CreateProjectRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Project name',
            },
            gitUrl: {
              type: 'string',
              description: 'Git repository URL',
            },
            gitBranch: {
              type: 'string',
              description: 'Git branch',
              default: 'main',
            },
            templateUrl: {
              type: 'string',
              description: 'Template URL',
            },
          },
        },
        WidgetGenerateRequest: {
          type: 'object',
          required: ['userRequest'],
          properties: {
            userRequest: {
              type: 'string',
              description: 'User request for widget generation',
            },
            stream: {
              type: 'boolean',
              description: 'Whether to stream the response',
              default: false,
            },
          },
        },
        WidgetGenerateResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            designSpec: {
              type: 'string',
              description: 'Brief design explanation',
            },
            schema: {
              type: 'string',
              description: 'Zod schema code',
            },
            template: {
              type: 'string',
              description: 'TSX template code',
            },
            data: {
              type: 'string',
              description: 'Sample JSON data',
            },
            fullResponse: {
              type: 'string',
              description: 'Complete agent response',
            },
          },
        },
        ChatRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'User message',
            },
            projectId: {
              type: 'string',
              description: 'Optional project ID to update name on first message',
            },
            isFirstMessage: {
              type: 'boolean',
              description: 'Whether this is the first message in the chat',
              default: false,
            },
            stream: {
              type: 'boolean',
              description: 'Whether to stream the response',
              default: true,
            },
          },
        },
        ChatResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            message: {
              type: 'string',
              description: 'Agent response',
            },
            widget: {
              type: 'object',
              properties: {
                designSpec: {
                  type: 'string',
                },
                schema: {
                  type: 'string',
                },
                template: {
                  type: 'string',
                },
                data: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'Projects',
        description: 'Project management endpoints',
      },
      {
        name: 'Freestyle',
        description: 'Freestyle sandbox integration',
      },
      {
        name: 'GitHub',
        description: 'GitHub integration endpoints',
      },
      {
        name: 'Mastra',
        description: 'Mastra AI widget builder',
      },
      {
        name: 'Secrets',
        description: 'API secrets and configuration status',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);

