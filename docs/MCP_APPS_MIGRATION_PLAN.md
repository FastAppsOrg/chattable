# MCP Apps Migration Plan

> Migrating Chattable from OpenAI Apps SDK to vendor-agnostic MCP Apps (SEP-1865)

## Executive Summary

The MCP Apps extension (SEP-1865) introduces a **vendor-agnostic standard** for embedding interactive UIs in MCP-powered chat applications. This plan outlines how to migrate Chattable from the current OpenAI-specific implementation to full MCP Apps compatibility while maintaining backward compatibility during the transition.

---

## 1. Current Architecture Analysis

### 1.1 Current Stack

| Layer | Technology | OpenAI Coupling |
|-------|------------|-----------------|
| Widget Runtime | `skybridge/web` | **High** - Uses `window.openai.*` API |
| Widget Server | `skybridge/server` (extends MCP SDK) | **Medium** - MCP base + OpenAI widget metadata |
| Host Rendering | `WidgetPreview.tsx` | **High** - OpenAI postMessage protocol |
| Communication | Custom postMessage (`openai:*` events) | **High** - Proprietary message format |

### 1.2 OpenAI-Specific Dependencies

```
template/web/src/
├── widget-dev.tsx           # Waits for window.openai
├── utils.ts                 # useWidgetState() uses window.openai.setWidgetState()
├── widgets/showcase.tsx     # Uses skybridge's useToolOutput()
└── utils/defineWidget.tsx   # Widget metadata format

src/components/workspace/
└── WidgetPreview.tsx        # OpenAI postMessage protocol (openai:*)
```

### 1.3 What Skybridge Does

`skybridge` is a thin abstraction over OpenAI's Apps SDK:
- **Server**: `McpServer.widget()` wraps tool + resource registration
- **Web**: `useToolOutput()`, `useOpenAiGlobal()` hooks abstract `window.openai`
- **Vite plugin**: Bundles widgets into separate entry points

---

## 2. MCP Apps Specification Summary

### 2.1 Core Concepts

| Concept | Description |
|---------|-------------|
| `ui://` Resources | Pre-declared HTML templates registered as MCP resources |
| `text/html+mcp` | MIME type for MCP-aware HTML content |
| Tool-UI Association | Tools reference UIs via `_meta["ui/resourceUri"]` |
| AppBridge | Host-side SDK for iframe communication |
| App | Guest-side (widget) SDK for host communication |
| PostMessageTransport | JSON-RPC 2.0 over postMessage |

### 2.2 Message Flow

```
┌─────────────┐         JSON-RPC 2.0/postMessage         ┌─────────────┐
│    Host     │ ◄────────────────────────────────────────► │   Guest UI  │
│ (AppBridge) │                                           │    (App)    │
└─────────────┘                                           └─────────────┘

1. Guest → Host: McpUiInitializeRequest
2. Host → Guest: McpUiInitializeResult (capabilities, context)
3. Guest → Host: McpUiInitializedNotification
4. Host → Guest: McpUiToolInputNotification (tool args)
5. Host → Guest: McpUiToolResultNotification (structured content)
6. Guest → Host: McpUiMessageRequest, McpUiOpenLinkRequest, etc.
```

### 2.3 Key Differences from OpenAI Apps

| Aspect | OpenAI Apps | MCP Apps |
|--------|-------------|----------|
| Protocol | Custom postMessage | JSON-RPC 2.0 over postMessage |
| API Injection | `window.openai` global | PostMessage transport only |
| Resource Declaration | Implicit (tool metadata) | Explicit `ui://` resources |
| CSP Handling | Metadata-based | `_meta.ui.connectDomains/resourceDomains` |
| Capability Negotiation | None | Explicit handshake |
| Fallback | None | Text-only for non-UI hosts |

---

## 3. Migration Strategy: Protocol Adapter Pattern

Following FastApps PR #33, we'll implement a **Protocol Adapter Layer** that supports both protocols simultaneously.

### 3.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Widget Component (React)                          │
│                                                                         │
│   useWidgetData()  useHostContext()  useHostActions()                  │
│        │                 │                  │                           │
└────────┼─────────────────┼──────────────────┼───────────────────────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Protocol Abstraction Layer                            │
│                                                                         │
│   ┌─────────────────┐        ┌─────────────────┐                       │
│   │  OpenAI Adapter │        │  MCP Apps       │                       │
│   │  (Legacy)       │        │  Adapter        │                       │
│   │                 │        │                 │                       │
│   │ window.openai.* │        │ App SDK         │                       │
│   └─────────────────┘        └─────────────────┘                       │
│                                                                         │
│   Protocol detection: window.__WIDGET_PROTOCOL or capability check     │
└─────────────────────────────────────────────────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│  OpenAI Host        │          │  MCP Apps Host      │
│  (ChatGPT)          │          │  (Claude, etc.)     │
└─────────────────────┘          └─────────────────────┘
```

### 3.2 Server-Side Changes

#### 3.2.1 Register UI Resources

```typescript
// template/server/src/server.ts (NEW)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Register UI resource
server.resource(
  "ui://showcase",
  "Showcase Widget",
  async (uri) => ({
    contents: [{
      uri,
      mimeType: "text/html+mcp",
      text: await readFile("dist/widgets/showcase.html", "utf-8"),
    }],
  }),
  {
    description: "UI Component Showcase Widget",
    _meta: {
      ui: {
        connectDomains: [],      // External API domains
        resourceDomains: [],     // Static asset domains
        displayBorder: false,
      }
    }
  }
);

// Tool references UI via _meta
server.tool(
  "showcase",
  "Display UI Component Showcase",
  { title: z.string().optional() },
  async ({ title }) => ({
    structuredContent: { ...exampleData, title },
    content: [{ type: "text", text: `Showing showcase: ${title}` }],
  }),
  {
    _meta: {
      "ui/resourceUri": "ui://showcase"  // MCP Apps standard
    }
  }
);
```

#### 3.2.2 Graceful Degradation

```typescript
// Check host capabilities before returning UI
server.tool("showcase", ..., async (input, { execution }) => {
  const supportsUI = execution?.canDisplay?.mimeTypes?.includes("text/html+mcp");

  if (supportsUI) {
    return {
      structuredContent: showcaseData,
      content: [{ type: "text", text: "UI available" }],
    };
  } else {
    // Text-only fallback for non-UI hosts
    return {
      content: [{
        type: "text",
        text: formatAsMarkdown(showcaseData),
      }],
    };
  }
});
```

### 3.3 Widget-Side Changes

#### 3.3.1 Protocol-Agnostic Hooks

```typescript
// template/web/src/hooks/useWidgetData.ts (NEW)
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useToolOutput } from "skybridge/web";  // Legacy

export function useWidgetData<T>(): T | null {
  const protocol = detectProtocol();

  if (protocol === "mcp-apps") {
    const { app } = useApp({ name: "widget", version: "1.0.0" });
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
      if (!app) return;
      app.ontoolresult = (notification) => {
        setData(notification.params.structuredContent as T);
      };
    }, [app]);

    return data;
  } else {
    // Legacy OpenAI path
    return useToolOutput() as T;
  }
}

function detectProtocol(): "openai-apps" | "mcp-apps" {
  // Server-injected hint takes precedence
  if ((window as any).__WIDGET_PROTOCOL) {
    return (window as any).__WIDGET_PROTOCOL;
  }

  // Feature detection
  if ((window as any).openai) {
    return "openai-apps";
  }

  // Default to MCP Apps for new implementations
  return "mcp-apps";
}
```

#### 3.3.2 Host Actions Abstraction

```typescript
// template/web/src/hooks/useHostActions.ts (NEW)
export function useHostActions() {
  const protocol = detectProtocol();
  const { app } = protocol === "mcp-apps" ? useApp(...) : { app: null };

  return {
    openLink: async (url: string) => {
      if (protocol === "mcp-apps") {
        await app?.sendOpenLink(url);
      } else {
        window.openai?.openLink(url);
      }
    },

    sendMessage: async (message: string) => {
      if (protocol === "mcp-apps") {
        await app?.sendMessage({
          role: "user",
          content: { type: "text", text: message },
        });
      } else {
        window.openai?.sendFollowupTurn(message);
      }
    },

    callTool: async (name: string, params: any) => {
      if (protocol === "mcp-apps") {
        return await app?.callServerTool(name, params);
      } else {
        return await window.openai?.callTool(name, params);
      }
    },
  };
}
```

#### 3.3.3 Host Context Abstraction

```typescript
// template/web/src/hooks/useHostContext.ts (NEW)
export function useHostContext() {
  const protocol = detectProtocol();
  const { app } = protocol === "mcp-apps" ? useApp(...) : { app: null };

  const [context, setContext] = useState({
    theme: "light" as "light" | "dark",
    displayMode: "expanded" as "compact" | "expanded",
    locale: "en-US",
  });

  useEffect(() => {
    if (protocol === "mcp-apps" && app) {
      app.onhostcontextchanged = (notification) => {
        setContext(prev => ({ ...prev, ...notification.params }));
      };
    } else if (protocol === "openai-apps") {
      // Poll window.openai globals
      const interval = setInterval(() => {
        setContext({
          theme: (window.openai as any)?.theme || "light",
          displayMode: (window.openai as any)?.displayMode || "expanded",
          locale: navigator.language,
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [app, protocol]);

  return context;
}
```

### 3.4 Host-Side Changes (Chattable Frontend)

#### 3.4.1 Replace WidgetPreview with AppBridge

```typescript
// src/components/workspace/MCPAppRenderer.tsx (NEW)
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

interface MCPAppRendererProps {
  projectId: string;
  toolName: string;
  toolInput?: any;
  toolResult?: any;
  resourceHtml: string;
}

export function MCPAppRenderer({
  projectId,
  toolName,
  toolInput,
  toolResult,
  resourceHtml,
}: MCPAppRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const { theme } = useTheme();

  // Setup bridge on mount
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const bridge = new AppBridge(
      null, // No MCP client needed for local rendering
      { name: "Chattable", version: "1.0.0" },
      {
        extensions: ["io.modelcontextprotocol/ui"],
        mimeTypes: ["text/html+mcp"],
        openLinks: true,
        serverTools: false, // Tools handled by our backend
      }
    );
    bridgeRef.current = bridge;

    // Wire event handlers
    bridge.oninitialized = () => {
      if (toolInput) bridge.sendToolInput(toolName, toolInput);
      if (toolResult) bridge.sendToolResult(toolResult);
    };

    bridge.onmessage = (msg) => {
      console.log("[AppBridge] Message from widget:", msg);
      // Forward to chat if needed
    };

    bridge.onopenlink = (url) => {
      window.open(url, "_blank");
    };

    bridge.onsizechange = (width, height) => {
      iframe.style.height = `${height}px`;
    };

    // Connect transport
    const onLoad = async () => {
      const transport = new PostMessageTransport(
        iframe.contentWindow!,
        iframe.contentWindow!
      );
      await bridge.connect(transport);
      bridge.sendSandboxResourceReady(resourceHtml);
    };

    iframe.addEventListener("load", onLoad);

    return () => {
      iframe.removeEventListener("load", onLoad);
      bridge.disconnect();
    };
  }, []);

  // Send context updates
  useEffect(() => {
    bridgeRef.current?.sendHostContextChanged({ theme });
  }, [theme]);

  // Send tool result updates
  useEffect(() => {
    if (toolResult) {
      bridgeRef.current?.sendToolResult(toolResult);
    }
  }, [toolResult]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: "100%", border: "none" }}
      title={`Widget: ${toolName}`}
    />
  );
}
```

#### 3.4.2 Update Widget Storage Endpoint

```typescript
// server/src/routes/projects.routes.ts (MODIFY)
// Add MCP Apps resource fetching

router.get("/projects/:id/mcp/ui-resource/:uri", async (req, res) => {
  const { id, uri } = req.params;
  const mcpUrl = await getMcpUrl(id);

  // Fetch resource from MCP server
  const resource = await mcpClient.readResource(`ui://${uri}`);

  res.json({
    html: resource.contents[0].text,
    metadata: resource._meta?.ui || {},
  });
});
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Week 1)

1. **Install ext-apps SDK**
   ```bash
   cd template/web && pnpm add @modelcontextprotocol/ext-apps
   cd template/server && pnpm add @modelcontextprotocol/ext-apps
   ```

2. **Create protocol abstraction hooks**
   - `useWidgetData()` - Protocol-agnostic data access
   - `useHostContext()` - Unified theme/locale/viewport
   - `useHostActions()` - openLink, sendMessage, callTool

3. **Add server-side protocol hint injection**
   - Inject `<script>window.__WIDGET_PROTOCOL="..."</script>` into HTML

### Phase 2: Server Migration (Week 2)

1. **Register UI resources with `ui://` scheme**
2. **Update tool metadata to use `_meta["ui/resourceUri"]`**
3. **Add graceful degradation for text-only hosts**
4. **Update CSP handling to use `_meta.ui.*` format**

### Phase 3: Host Migration (Week 3)

1. **Create `MCPAppRenderer` component**
   - Replace custom postMessage with AppBridge
   - Implement full MCP Apps initialization flow

2. **Update `WidgetPreview` to delegate to appropriate renderer**
   - Detect protocol and choose renderer

3. **Implement double-iframe sandbox pattern** (optional, for enhanced security)

### Phase 4: Widget Migration (Week 4)

1. **Migrate existing widgets to protocol-agnostic hooks**
2. **Update `defineWidget()` to work with both protocols**
3. **Test widgets in both OpenAI and MCP Apps hosts**

### Phase 5: Cleanup & Documentation

1. **Remove OpenAI-only code paths** (optional, if dropping support)
2. **Update WIDGET_DEVELOPMENT.md with new patterns**
3. **Add MCP Apps compatibility badge**

---

## 5. File Changes Summary

### New Files

| Path | Purpose |
|------|---------|
| `template/web/src/hooks/useWidgetData.ts` | Protocol-agnostic data hook |
| `template/web/src/hooks/useHostContext.ts` | Unified context hook |
| `template/web/src/hooks/useHostActions.ts` | Host action abstraction |
| `template/web/src/lib/protocol.ts` | Protocol detection logic |
| `src/components/workspace/MCPAppRenderer.tsx` | MCP Apps host renderer |

### Modified Files

| Path | Changes |
|------|---------|
| `template/server/src/server.ts` | Add UI resource registration |
| `template/web/src/widget-dev.tsx` | Support both protocols |
| `template/web/src/widgets/*.tsx` | Use new hooks |
| `src/components/workspace/WidgetPreview.tsx` | Delegate to protocol-specific renderer |
| `server/src/routes/projects.routes.ts` | Add UI resource endpoints |

### Deprecated (Phase 5)

| Path | Replacement |
|------|-------------|
| `template/web/src/utils.ts` (useWidgetState) | `useWidgetData` |
| Direct `window.openai` usage | Protocol hooks |

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// Test protocol detection
describe("detectProtocol", () => {
  it("returns mcp-apps when __WIDGET_PROTOCOL is set", () => {
    (window as any).__WIDGET_PROTOCOL = "mcp-apps";
    expect(detectProtocol()).toBe("mcp-apps");
  });

  it("returns openai-apps when window.openai exists", () => {
    (window as any).openai = {};
    expect(detectProtocol()).toBe("openai-apps");
  });
});
```

### 6.2 Integration Tests

1. **Chattable as Host**: Render widgets using MCPAppRenderer
2. **External MCP Apps Host**: Test widgets in Claude Desktop, MCPJam Inspector
3. **Legacy ChatGPT**: Ensure OpenAI path still works

### 6.3 E2E Test Matrix

| Host | Protocol | Expected Behavior |
|------|----------|-------------------|
| Chattable | MCP Apps | Full functionality |
| Claude Desktop | MCP Apps | Full functionality |
| ChatGPT | OpenAI Apps | Full functionality (legacy) |
| Text-only Client | N/A | Graceful text fallback |

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing OpenAI widgets | Protocol adapter pattern, feature flags |
| Performance overhead from abstraction | Lazy protocol detection, minimal runtime checks |
| ext-apps SDK instability (draft spec) | Pin versions, abstract SDK behind our hooks |
| Missing features in MCP Apps | Maintain OpenAI fallback during transition |

---

## 8. Success Metrics

- [ ] Widgets render correctly in Chattable (MCP Apps mode)
- [ ] Widgets render correctly in external MCP Apps hosts
- [ ] OpenAI/ChatGPT compatibility maintained (if needed)
- [ ] No regression in widget development experience
- [ ] Documentation updated with new patterns

---

## 9. References

- [MCP Apps Blog Post](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/)
- [ext-apps Repository](https://github.com/modelcontextprotocol/ext-apps)
- [SEP-1865 Specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx)
- [FastApps PR #33](https://github.com/FastAppsOrg/FastApps/pull/33)
