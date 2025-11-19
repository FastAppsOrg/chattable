# AppKit Server

Express.js backend for AppKit with Freestyle.sh integration.

## Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your credentials:
```env
FREESTYLE_API_KEY=your_freestyle_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

3. Install dependencies:
```bash
npm install
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## API Documentation

Interactive API documentation is available via Swagger UI:

```
http://localhost:3001/api-docs
```

The Swagger UI provides:
- Complete API reference for all endpoints
- Request/response schemas
- Interactive testing interface
- Authentication support

For more details, see [SWAGGER.md](./SWAGGER.md)

## API Endpoints

### Freestyle Integration

- `POST /api/freestyle/projects` - Create new project (Git repo + dev server)
  ```json
  {
    "userId": "user-123",
    "templateUrl": "https://github.com/alpic-ai/apps-sdk-template" // optional, defaults to Apps SDK template
  }
  ```

- `GET /api/freestyle/projects/:repoId/dev-server` - Get dev server URL

- `POST /api/freestyle/projects/:repoId/deploy` - Deploy to production
  ```json
  {
    "domains": ["myapp.example.com"]
  }
  ```

### Health Check

- `GET /health` - Server health status

## Architecture

```
server/
├── src/
│   ├── index.ts              # Express app setup
│   ├── routes/
│   │   └── freestyle.routes.ts
│   └── services/
│       ├── freestyle.service.ts   # Freestyle SDK wrapper
│       └── supabase.service.ts    # Auth service
├── package.json
└── tsconfig.json
```

## Authentication

All `/api/freestyle/*` routes require Bearer token authentication via Supabase.

Example:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -X POST http://localhost:3001/api/freestyle/projects \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123"}'
```
