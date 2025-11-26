# CLAUDE.md - Chattable Project Guide

> AI-powered development environment for building Apps in ChatGPT (OpenAI Apps SDK)

## Quick Summary

**Chattable**은 ChatGPT 앱을 로컬에서 개발하고 테스트할 수 있는 AI 어시스턴트 기반 개발 환경입니다. 사용자가 채팅으로 코드를 수정하고, 실시간 프리뷰를 보며, MCP 도구를 통해 파일을 편집할 수 있습니다.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React 19)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  ChatPanel  │  │WidgetPreview│  │     ProjectContent      │  │
│  │ (AI SDK v5) │  │  (iframe)   │  │  (Resizable Panels)     │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │ HTTP / SSE                            │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────────┐
│                   Backend (Express.js)                           │
│  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────────┐  │
│  │   Mastra    │  │   Routes    │  │   LocalDeployment       │  │
│  │   Agent     │←→│ (projects)  │←→│   Adapter               │  │
│  │ + Memory    │  │             │  │ (.chattable folder)     │  │
│  └──────┬──────┘  └─────────────┘  └───────────┬─────────────┘  │
│         │                                       │                │
│         └───────────────────────────────────────┘                │
│                          ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              MCP Server (per project)                        ││
│  │  - File editing tools                                        ││
│  │  - Shell commands                                            ││
│  │  - Widget rendering                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend (`/src`)
| Package | Version | Purpose |
|---------|---------|---------|
| React | 19.1.1 | UI framework |
| Vite | 7.1.2 | Build tool (SWC) |
| @ai-sdk/react | 2.0.101 | `useChat` hook for streaming |
| @assistant-ui/react | 0.11.41 | Chat UI components |
| react-router-dom | 6.26.1 | Client-side routing |
| react-resizable-panels | 3.0.5 | Split panel layout |
| @monaco-editor/react | 4.7.0 | Code editor |
| lucide-react | 0.544.0 | Icons |

### Backend (`/server`)
| Package | Version | Purpose |
|---------|---------|---------|
| Express | 4.18.2 | HTTP server |
| @mastra/core | 0.24.5 | AI agent framework |
| @mastra/memory | 0.15.11 | Conversation persistence (LibSQL) |
| @mastra/mcp | 0.14.3 | MCP client wrapper |
| drizzle-orm | 0.44.7 | SQLite ORM |
| @ai-sdk/openai | 2.0.0 | OpenAI model integration |
| simple-git | 3.30.0 | Git operations |

## Project Structure

```
chattable/
├── template/                     # Apps SDK template (복사되어 프로젝트 생성)
│   ├── server/                   # MCP 서버 + Express
│   ├── web/                      # 위젯 React 앱
│   ├── shared/                   # 공유 코드
│   └── package.json              # pnpm workspace
│
├── src/                          # Frontend source
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Main app component & routing
│   ├── components/
│   │   ├── chat/
│   │   │   └── ChatPanel.tsx     # Main chat interface
│   │   ├── workspace/
│   │   │   ├── WidgetPreview.tsx # Widget iframe renderer
│   │   │   └── DevelopmentTab.tsx
│   │   ├── responsive/
│   │   │   └── ProjectContent.tsx # Project detail page
│   │   ├── home/
│   │   │   └── HomePanel.tsx     # Project list view
│   │   └── settings/
│   │       └── SettingsModal.tsx
│   ├── contexts/
│   │   ├── ProjectContext.tsx    # Project CRUD operations
│   │   ├── AuthContext.tsx       # Local-first auth
│   │   ├── ThemeContext.tsx      # Dark/light theme
│   │   └── ToastContext.tsx      # Notifications
│   ├── hooks/
│   │   ├── useProject.ts         # Project state hook
│   │   ├── useAuth.ts            # Auth hook
│   │   └── useProjectContext.ts
│   ├── types/
│   │   ├── project.ts            # Project interfaces
│   │   └── chat.ts               # Chat message types
│   ├── services/
│   │   └── api/
│   │       └── project.ts        # API client
│   └── utils/
│       └── api.ts                # HTTP client singleton
│
├── server/                       # Backend source
│   ├── src/
│   │   ├── index.ts              # Express entry point
│   │   ├── routes/
│   │   │   ├── projects.routes.ts # Main API routes
│   │   │   ├── auth.routes.ts
│   │   │   └── git.routes.ts
│   │   ├── services/
│   │   │   ├── deployment/
│   │   │   │   └── local.adapter.ts # Local project management
│   │   │   ├── mcp.service.ts    # MCP client management
│   │   │   └── memory.service.ts # Mastra Memory wrapper
│   │   ├── mastra/
│   │   │   └── agents/
│   │   │       └── code-editor.ts # AI agent definition
│   │   └── db/
│   │       ├── schema.ts         # Drizzle schema
│   │       └── db.service.ts     # Database operations
│   └── package.json
│
├── electron/                     # Electron main process
│   └── main.ts
│
├── .chattable/                   # Local project deployments
│   └── {project-uuid}/           # Each project folder
│       ├── server/               # Apps SDK template
│       └── node_modules/
│
└── package.json                  # Root package
```

## Core Concepts

### 1. Local-First Deployment

프로젝트가 생성되면 `template/` 폴더가 `.chattable/{uuid}/`로 복사됩니다:

```typescript
// server/src/services/deployment/local.adapter.ts
const projectDir = path.join(process.cwd(), '.chattable', projectId);
await cp(this.templateDir, projectDir, { recursive: true });  // 네트워크 불필요
await execAsync('pnpm install', { cwd: projectDir });
```

- 네트워크 연결 없이 오프라인에서도 동작
- 각 프로젝트는 고유한 포트(40000+)에서 dev 서버를 실행
- `template/`을 수정하면 새 프로젝트에 반영됨

### 2. Mastra Agent + MCP Tools

AI 에이전트는 MCP 도구를 통해 파일을 편집합니다:

```typescript
// server/src/mastra/agents/code-editor.ts
export function createCodeEditorAgent(mcpTools: any, memory: Memory) {
  return new Agent({
    name: 'code-editor',
    model: openai('gpt-4o-mini'),
    tools: mcpTools,  // MCP tools with execute()
    memory: memory,   // Conversation persistence
  });
}
```

**중요**: `@mastra/mcp`의 `MCPClient.getTools()`는 `execute()` 함수를 포함한 도구를 반환합니다. 원시 MCP SDK는 스키마만 반환합니다.

### 3. Conversation Memory

Mastra Memory가 대화 기록을 관리합니다:

```typescript
// Thread ID = project UUID
// Resource ID = user ID
const result = await agent.stream(messages, {
  memory: {
    thread: projectId,
    resource: userId,
  },
});
```

메모리는 첫 메시지 기반으로 스레드 제목을 자동 생성합니다.

### 4. AI SDK v5 Streaming

프론트엔드는 `@ai-sdk/react`의 `useChat` 훅을 사용합니다:

```typescript
// src/components/chat/ChatPanel.tsx
const { messages, input, handleSubmit, isLoading } = useChat({
  transport: new DefaultChatTransport({
    api: `/api/projects/${projectId}/chat`,
  }),
});
```

백엔드는 `toUIMessageStreamResponse()`로 스트림을 반환합니다.

### 5. Widget Preview

MCP 도구가 HTML 위젯을 반환하면 iframe에서 렌더링됩니다:

```typescript
// window.openai API가 iframe에 주입됨
window.openai = {
  toolInput,
  toolOutput,
  callTool(toolName, params),
  sendFollowupTurn(message),
  // ...
};
```

## Key Data Flows

### Project Creation
```
1. POST /api/projects (returns immediately, status='initializing')
2. Background: Clone → npm install → Start dev server
3. DB updated with ephemeral_url, mcp_ephemeral_url
4. Frontend polls /api/projects/:id/status
5. When status='active', show chat interface
```

### Chat Message
```
1. User types message in ChatPanel
2. useChat sends to /api/projects/:id/chat
3. Server gets MCP tools from project's MCP server
4. Mastra Agent processes with tools and memory
5. Stream response via AI SDK Data Stream Protocol
6. Frontend renders with assistant-ui components
```

### Widget Rendering
```
1. Tool returns _meta.openai.widget with uri
2. Store widget data: POST /mcp/widget/store
3. Render in iframe: GET /mcp/widget-content/:toolId
4. window.openai API injected for widget communication
```

## Database Schema

```sql
-- server/src/db/schema.ts (Drizzle + SQLite)
projects (
  id TEXT PRIMARY KEY,           -- UUID, also used as folder name
  user_id TEXT,
  name TEXT,
  git_url TEXT,
  git_branch TEXT DEFAULT 'main',
  ephemeral_url TEXT,            -- Dev server URL (localhost:40xxx)
  mcp_ephemeral_url TEXT,        -- MCP server URL
  status TEXT CHECK (status IN ('initializing', 'active', 'stopped', 'failed', 'deleted')),
  created_at INTEGER,
  updated_at INTEGER,
  deleted_at INTEGER             -- Soft delete
)
```

## API Endpoints

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects | List all projects |
| POST | /api/projects | Create project (async deployment) |
| GET | /api/projects/:id | Get project |
| PATCH | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| GET | /api/projects/:id/status | Check container status |
| POST | /api/projects/:id/restart | Restart dev server |
| POST | /api/projects/:id/ensure-running | Auto-restart if disconnected |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects/:id/chat | Stream chat response |
| GET | /api/projects/:id/chat/history | Get chat history from Mastra Memory |
| GET | /api/projects/:id/title | Get auto-generated thread title |

### MCP
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects/:id/mcp/tools | List available tools |
| GET | /api/projects/:id/mcp/resources | List resources |
| POST | /api/projects/:id/mcp/tools/:name/call | Execute tool |
| POST | /api/projects/:id/mcp/widget/store | Store widget data |
| GET | /api/projects/:id/mcp/widget-content/:toolId | Render widget HTML |

## Common Commands

```bash
# Development
npm run dev                    # Start frontend + backend concurrently
npm run dev:web                # Frontend only (Vite on :5173)
npm run dev:server             # Backend only (Express on :3001)

# Build
npm run build                  # Build both
npm run build:web              # Build frontend
npm run build:server           # Build backend

# Database
cd server && npm run db:generate  # Generate Drizzle migrations
cd server && npm run db:push      # Apply migrations
cd server && npm run db:studio    # Open Drizzle Studio

# Testing
npm run test                   # Run Vitest
npm run test:ui                # Vitest with UI
```

## Environment Variables

```bash
# server/.env
PORT=3001                      # Backend port
FRONTEND_URL=http://localhost:5173
OPENAI_API_KEY=sk-...          # Required for AI agent

# Frontend (.env)
VITE_API_URL=http://localhost:3001
```

## Important Patterns

### 1. Immediate Response + Background Processing
프로젝트 생성 시 즉시 응답 후 백그라운드에서 배포:
```typescript
res.json({ project_id, status: 'initializing' });  // 즉시 반환
deploymentService.createProject(...).then(...)     // 백그라운드 실행
```

### 2. Singleton Services
```typescript
// API Client
const apiClient = ApiClient.getInstance();

// Memory Service
const memory = await MemoryService.getMemory();

// MCP Service (manages connections per project)
const tools = await mcpService.getTools(mcpUrl);
```

### 3. Context + Hooks Pattern
```typescript
// Provider wraps app
<ProjectProvider>
  <App />
</ProjectProvider>

// Components use hooks
const { projects, createProject } = useProjectContext();
```

### 4. Error Handling
```typescript
// Frontend: Toast notifications
const { showError } = useToast();
showError('Failed to create project');

// Backend: Consistent error response format
res.status(500).json({
  error: 'Operation failed',
  message: error.message,
  details: error.stack,
});
```

## Debugging Tips

1. **MCP 연결 실패**: dev 서버가 시작되기 전 MCP 연결 시도. `/ensure-running` 엔드포인트로 자동 재시작.

2. **채팅이 작동 안 함**: 프로젝트 status가 'active'인지 확인. 'initializing'이면 배포 완료 대기.

3. **위젯 렌더링 실패**: CSP 헤더 확인. `toolResponseMetadata['openai/widgetCSP']`로 커스텀 CSP 주입 가능.

4. **Memory 관련 이슈**: Mastra Memory는 LibSQL 사용. `server/memory.db` 파일 확인.

## Known Limitations

- 채팅 기록 개별 삭제 불가 (Mastra Memory 제약)
- 프로젝트당 하나의 AI 모델 (gpt-4o-mini)
- 로컬 배포만 지원 (클라우드 배포 미구현)

---

*Last updated: 2024-11*
