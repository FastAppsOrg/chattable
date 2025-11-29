# Widget Development Guide

Apps in ChatGPT SDK용 Widget을 HMR과 함께 개발하는 가이드입니다.

---

## 🚀 Quick Start

### 1. 개발 서버 시작

```bash
pnpm dev
```

이 명령어는 **MCP Server**를 시작하며, 개발 모드에서는 **Vite dev server가 자동으로 같은 포트에 마운트**됩니다:
- **Server**: `http://localhost:3000` (MCP Server + Widget Dev Server 통합)

### 2. Widget 개발 페이지 접속

브라우저에서 다음 URL로 접속:

```
http://localhost:3000/dev/widget-dev.html?widget=showcase
```

- `?widget=showcase` - 개발할 widget 이름 (파일명 기준)
- 다른 widget: `?widget=yourWidget`

### 3. 테스트 환경 (window.openai 자동 주입)

```
http://localhost:3000/dev/test-widget.html
```

`window.json` 데이터로 window.openai가 자동 주입되어 실제 동작을 테스트할 수 있습니다.

---

## 📝 Widget 개발하기

### Step 1: Schema 정의 (`shared/src/schemas/`)

Widget의 데이터 구조를 Zod schema로 정의합니다.

```typescript
// shared/src/schemas/yourWidget.schema.ts
import { z } from "zod";

export const YourWidgetSchema = z.object({
  title: z.string(),
  description: z.string(),
  count: z.number(),
  tags: z.array(z.string()),
});

export type YourWidget = z.infer<typeof YourWidgetSchema>;

// Example data - HMR 개발 시 사용됨
export const exampleYourWidgetData: YourWidget = {
  title: "Hello Widget",
  description: "This is an example widget",
  count: 42,
  tags: ["demo", "example"],
};
```

### Step 2: Schema Export (`shared/src/index.ts`)

```typescript
// shared/src/index.ts
export * from "./schemas/yourWidget.schema";
```

### Step 3: Widget 컴포넌트 구현 (`web/src/widgets/`)

```typescript
// web/src/widgets/yourWidget.tsx
import { defineWidget } from "@/utils/defineWidget";
import { YourWidgetSchema, exampleYourWidgetData, type YourWidget } from "@apps-sdk-template/shared";
import { useToolOutput } from "skybridge/web";
import { mountWidget } from "skybridge/web";

// @openai/apps-sdk-ui components
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import "@openai/apps-sdk-ui/css";

function YourWidgetComponent() {
  const data = useToolOutput() as YourWidget;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{data.title}</h1>
      <p className="text-gray-600">{data.description}</p>
      <div className="mt-4">
        <Badge color="primary">{data.count}</Badge>
      </div>
      <div className="mt-4 flex gap-2">
        {data.tags.map(tag => (
          <Badge key={tag} color="secondary">{tag}</Badge>
        ))}
      </div>
      <Button color="primary" className="mt-4">Action</Button>
    </div>
  );
}

// Widget 정의
const YourWidget = defineWidget({
  schema: YourWidgetSchema,
  exampleOutput: exampleYourWidgetData,  // HMR 개발 시 사용
  component: YourWidgetComponent,
});

export default YourWidget;

mountWidget(<YourWidget />);
```

### Step 4: HMR로 개발하기

1. 개발 서버가 실행 중인지 확인: `pnpm dev`
2. 브라우저에서 widget 페이지 열기:
   ```
   http://localhost:3000/dev/widget-dev.html?widget=yourWidget
   ```
3. `web/src/widgets/yourWidget.tsx` 파일 수정
4. **저장하면 즉시 브라우저에 반영됨** (페이지 리로드 없음!)

---

## 🎯 Example Data의 중요성

### 왜 Example Data가 필요한가?

Widget 개발 시 `window.openai`는 외부(widgetui-builder)에서 주입되지만, **HMR 개발 환경에서는 즉시 사용 가능한 example data가 필요**합니다.

```typescript
const YourWidget = defineWidget({
  schema: YourWidgetSchema,
  exampleOutput: exampleYourWidgetData,  // ← 이것이 HMR 개발을 가능하게 함!
  component: YourWidgetComponent,
});
```

### Example Data의 역할

1. **개발 중 미리보기**: window.openai 없이도 widget UI 확인 가능
2. **widget-metadata.json 생성**: 빌드 시 자동으로 추출되어 외부 도구에서 사용
3. **타입 안정성**: Schema와 Example이 항상 동기화됨 (TypeScript 검증)

---

## 🔧 개발 환경 구조

```
apps-sdk-template/
├── shared/                          # 공유 Schema 패키지
│   └── src/
│       ├── index.ts                 # Export all schemas
│       └── schemas/
│           └── yourWidget.schema.ts # Zod Schema + Example Data
│
├── web/                             # Widget 개발 환경
│   ├── src/
│   │   ├── widgets/
│   │   │   └── yourWidget.tsx       # Widget 구현
│   │   ├── widget-dev.tsx           # HMR 개발 로더
│   │   └── utils/
│   │       └── defineWidget.tsx     # Widget 정의 헬퍼
│   │
│   ├── widget-dev.html              # HMR 개발 페이지
│   ├── test-widget.html             # 테스트 환경 (window.openai 주입)
│   └── window.json                  # 테스트용 Mock Data
│
└── server/                          # MCP Server
    └── src/
        └── index.ts                 # Server 구현
```

---

## 🌐 URL 구조

### 개발 서버 URL (모두 포트 3000)

| URL | 용도 | 설명 |
|-----|------|------|
| `http://localhost:3000/mcp` | MCP Endpoint | MCP protocol endpoint |
| `http://localhost:3000/dev/widget-dev.html?widget=showcase` | HMR 개발 | window.openai 없이 example data로 개발 |
| `http://localhost:3000/dev/test-widget.html` | 통합 테스트 | window.json으로 window.openai 자동 주입 |

⚡ **포인트**: 모든 것이 **단일 포트(3000)**에서 제공됩니다.

### Query Parameters

- `?widget=<name>` - 로드할 widget 이름 (파일명 기준)
  - 예: `?widget=showcase` → `src/widgets/showcase.tsx` 로드

---

## 🎨 Example: Showcase Widget

완전한 예제는 `web/src/widgets/showcase.tsx`를 참고하세요.

### Schema 정의

```typescript
// shared/src/schemas/showcase.schema.ts
export const ShowcaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  notifications: z.array(NotificationSchema),
  actions: z.array(ActionSchema),
  stats: z.array(StatSchema),
  markdown: z.string(),
});

export const exampleShowcaseData: Showcase = {
  title: "UI Component Showcase",
  description: "A demonstration of @openai/apps-sdk-ui components",
  notifications: [...],
  actions: [...],
  stats: [...],
  markdown: "...",
};
```

### Widget 구현

```typescript
// web/src/widgets/showcase.tsx
import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Markdown } from "@openai/apps-sdk-ui/components/Markdown";

const Showcase = defineWidget({
  schema: ShowcaseSchema,
  exampleOutput: exampleShowcaseData,
  component: ShowcaseWidget,
});
```

### 접속

```
http://localhost:3000/dev/widget-dev.html?widget=showcase
```

---

## 📦 빌드 & 배포

### 빌드

```bash
pnpm build
```

생성되는 파일:
- `web/dist/showcase.js` - Widget 번들
- `web/dist/widget-metadata.json` - Example data
- `web/dist/style.css` - 스타일시트

### widget-metadata.json 구조

```json
{
  "showcase": {
    "name": "showcase",
    "exampleOutput": {
      "title": "UI Component Showcase",
      ...
    }
  }
}
```

---

## 💡 Best Practices

### 1. Schema를 Single Source of Truth로 사용

```typescript
// ✅ Good: Zod schema에서 타입 추론
export type Showcase = z.infer<typeof ShowcaseSchema>;

// ❌ Bad: 별도의 TypeScript interface 정의
interface Showcase {
  title: string;
}
```

### 2. @openai/apps-sdk-ui 컴포넌트 사용

```typescript
// ✅ Good: apps-sdk-ui 컴포넌트 사용
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Alert } from "@openai/apps-sdk-ui/components/Alert";

// ChatGPT와 일관된 스타일
<Button color="primary" variant="solid">Action</Button>
<Alert color="success" title="Success!" />
```

### 3. Widget은 순수 컴포넌트로 작성

```typescript
// ✅ Good: Props만 받아서 렌더링
function ShowcaseWidget() {
  const data = useToolOutput() as Showcase;
  return <div>{data.title}</div>;
}

// ❌ Bad: 직접 API 호출
function ShowcaseWidget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/data').then(setData);  // 외부 의존성
  }, []);
}
```

---

## 🎓 Learn More

- **Zod Documentation**: https://zod.dev
- **@openai/apps-sdk-ui**: https://github.com/openai/apps-sdk-ui
- **Vite HMR API**: https://vitejs.dev/guide/api-hmr.html
- **Apps in ChatGPT**: https://platform.openai.com/docs/apps

---

**Happy Widget Development! 🎉**
