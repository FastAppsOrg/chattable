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
http://localhost:3000/dev/widget-dev.html?widget=pokemon
```

- `?widget=pokemon` - 개발할 widget 이름 (파일명 기준)
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

function YourWidgetComponent() {
  const data = useToolOutput() as YourWidget;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{data.title}</h1>
      <p className="text-gray-600">{data.description}</p>
      <div className="mt-4">
        <span className="font-semibold">Count:</span> {data.count}
      </div>
      <div className="mt-2">
        <span className="font-semibold">Tags:</span>
        {data.tags.map(tag => (
          <span key={tag} className="ml-2 px-2 py-1 bg-blue-100 rounded">
            {tag}
          </span>
        ))}
      </div>
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

### Example Data 정의 방법

#### 방법 1: 정적 데이터 (권장)

```typescript
export const exampleYourWidgetData: YourWidget = {
  title: "Example Title",
  count: 42,
  tags: ["tag1", "tag2"],
};
```

#### 방법 2: 함수형 (동적 생성)

```typescript
export const exampleYourWidgetData = (): YourWidget => ({
  title: `Widget ${Date.now()}`,
  count: Math.floor(Math.random() * 100),
  tags: ["dynamic", "generated"],
});
```

#### 방법 3: 생략 (Faker 자동 생성)

```typescript
// exampleOutput을 생략하면 Faker가 Schema에서 자동 생성
const YourWidget = defineWidget({
  schema: YourWidgetSchema,
  // exampleOutput 생략 - faker가 자동으로 mock data 생성
  component: YourWidgetComponent,
});
```

⚠️ **주의**: 자동 생성된 데이터는 랜덤이므로, 실제 데이터와 다를 수 있습니다. 정확한 개발을 위해서는 **실제 데이터 구조를 반영한 명시적 example을 권장**합니다.

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
| `http://localhost:3000/dev/widget-dev.html?widget=pokemon` | HMR 개발 | window.openai 없이 example data로 개발 |
| `http://localhost:3000/dev/test-widget.html` | 통합 테스트 | window.json으로 window.openai 자동 주입 |

⚡ **포인트**: 모든 것이 **단일 포트(3000)**에서 제공됩니다.
- Remote 환경에서 포트 하나만 열면 됨 (예: ngrok, codespaces)
- Vite dev server가 Express 서버의 루트에 마운트되어 HMR 지원
- HTML 파일들은 커스텀 미들웨어로 직접 서빙

### Query Parameters

- `?widget=<name>` - 로드할 widget 이름 (파일명 기준)
  - 예: `?widget=pokemon` → `src/widgets/pokemon.tsx` 로드

---

## 🔄 HMR (Hot Module Replacement) 동작

### 지원되는 변경사항

✅ **즉시 반영됨 (페이지 리로드 없음)**
- React 컴포넌트 수정
- 스타일 변경 (CSS, Tailwind)
- 컴포넌트 props 변경
- 상태 관리 로직 수정

⚠️ **페이지 리로드 필요**
- Schema 변경 (`shared/src/schemas/`)
- Example data 변경
- defineWidget 호출 변경

### HMR 확인 방법

1. Widget 파일 수정 후 저장
2. 브라우저 콘솔에서 확인:
   ```
   [vite] (client) hmr update /src/widgets/yourWidget.tsx
   ```
3. 페이지 리로드 없이 변경사항이 즉시 반영됨

---

## 🎨 Example: Pokemon Widget

완전한 예제는 `web/src/widgets/pokemon.tsx`를 참고하세요.

### Schema 정의

```typescript
// shared/src/schemas/pokemon.schema.ts
export const PokemonSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  imageUrl: z.string().url(),
  types: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })),
  stats: z.array(z.object({
    name: z.string(),
    value: z.number(),
  })),
});

export const examplePokemonData: Pokemon = {
  id: 25,
  name: "pikachu",
  description: "When several of these Pokémon gather...",
  imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/...",
  types: [{ id: "electric", name: "Electric" }],
  stats: [
    { name: "hp", value: 35 },
    { name: "attack", value: 55 },
  ],
};
```

### Widget 구현

```typescript
// web/src/widgets/pokemon.tsx
const PokemonWidget = defineWidget({
  schema: PokemonSchema,
  exampleOutput: examplePokemonData,
  component: PokemonWidgetComponent,
});
```

### 접속

```
http://localhost:3000/dev/widget-dev.html?widget=pokemon
```

---

## 📦 빌드 & 배포

### 빌드

```bash
pnpm build
```

생성되는 파일:
- `web/dist/pokemon.js` - Widget 번들
- `web/dist/widget-metadata.json` - Example data (widgetui-builder용)
- `web/dist/style.css` - 스타일시트

### widget-metadata.json 구조

```json
{
  "pokemon": {
    "name": "pokemon",
    "exampleOutput": {
      "id": 25,
      "name": "pikachu",
      ...
    }
  }
}
```

이 파일은 외부 도구(widgetui-builder)가 widget의 example data를 읽어 미리보기를 제공할 때 사용됩니다.

---

## 🐛 트러블슈팅

### window.openai not available

**증상**: Widget이 로드되지 않고 안내 페이지만 표시됨

**해결**:
- 개발 환경: `http://localhost:3000/dev/test-widget.html` 사용
- 프로덕션: 부모 iframe에서 window.openai 주입 필요

### HMR이 작동하지 않음

**증상**: 파일 수정 후 변경사항이 반영되지 않음

**해결**:
1. 개발 서버 재시작: `pnpm dev`
2. 브라우저 캐시 삭제 (Cmd+Shift+R)
3. Schema 변경 시에는 페이지 수동 리로드 필요

### Widget을 찾을 수 없음

**증상**: `Widget "yourWidget" not found`

**해결**:
1. 파일명 확인: `src/widgets/yourWidget.tsx` (대소문자 구분)
2. URL 파라미터 확인: `?widget=yourWidget`
3. defineWidget 사용 확인

---

## 💡 Best Practices

### 1. Schema를 Single Source of Truth로 사용

```typescript
// ✅ Good: Zod schema에서 타입 추론
export type Pokemon = z.infer<typeof PokemonSchema>;

// ❌ Bad: 별도의 TypeScript interface 정의
interface Pokemon {
  id: number;
  name: string;
}
```

### 2. 실제 데이터 구조를 반영한 Example 작성

```typescript
// ✅ Good: 실제 API 응답과 동일한 구조
export const examplePokemonData: Pokemon = {
  id: 25,
  name: "pikachu",
  // 모든 필수 필드 포함
};

// ❌ Bad: 간단한 mock data
export const examplePokemonData: Pokemon = {
  id: 1,
  name: "test",
};
```

### 3. Widget은 순수 컴포넌트로 작성

```typescript
// ✅ Good: Props만 받아서 렌더링
function PokemonWidgetComponent() {
  const data = useToolOutput() as Pokemon;
  return <div>{data.name}</div>;
}

// ❌ Bad: 직접 API 호출
function PokemonWidgetComponent() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/pokemon').then(setData);  // 외부 의존성
  }, []);
}
```

### 4. HMR 친화적인 상태 관리

```typescript
// ✅ Good: 로컬 상태 최소화
const [isNavigating, setIsNavigating] = useState(false);

// ⚠️ 주의: 복잡한 상태는 HMR 시 초기화될 수 있음
const [complexState, setComplexState] = useState({
  cache: new Map(),
  history: [],
});
```

---

## 🎓 Learn More

- **Zod Documentation**: https://zod.dev
- **Vite HMR API**: https://vitejs.dev/guide/api-hmr.html
- **Skybridge SDK**: https://github.com/anthropics/skybridge
- **Apps in ChatGPT**: https://platform.openai.com/docs/apps

---

## 🤝 Contributing

Widget을 추가하거나 개선할 때:

1. Schema 먼저 정의 (`shared/src/schemas/`)
2. Example data 작성 (실제 데이터 구조 반영)
3. Widget 컴포넌트 구현 (`web/src/widgets/`)
4. HMR로 개발 및 테스트
5. 빌드 테스트: `pnpm build`

---

**Happy Widget Development! 🎉**
