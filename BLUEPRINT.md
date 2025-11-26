# BLUEPRINT.md - Chattable Roadmap

> 하나씩 뽀개기 위한 기능 개발 블루프린트

---

## Feature 1: Swagger → MCP 도구 자동 생성

### 목표
Swagger/OpenAPI URL을 입력받아 자동으로 MCP 도구를 생성한다.

### 사용자 플로우
```
1. User: "https://api.example.com/swagger.json" 입력
2. Chattable: Swagger 파싱 → 엔드포인트 목록 표시
3. User: 원하는 엔드포인트 선택 (또는 AI 추천)
4. Chattable: 선택된 엔드포인트 → MCP 도구로 변환
5. 결과: template/server/src/tools/{toolName}.ts 생성
```

### 기술 구현

#### Phase 1: Swagger 파싱
- [ ] Swagger/OpenAPI JSON 파싱 유틸 생성
- [ ] 엔드포인트 목록 추출 (path, method, parameters, response schema)
- [ ] "Know/Do/Show" 관점에서 추천 로직 (GET → Know, POST/PUT/DELETE → Do)

#### Phase 2: MCP 도구 생성
- [ ] 엔드포인트 → MCP Tool 템플릿 변환기
- [ ] 파라미터 → Zod 스키마 변환
- [ ] 프록시 호출 코드 생성 (원본 API 호출)

#### Phase 3: 통합
- [ ] 프로젝트 생성 시 Swagger URL 옵션 추가
- [ ] 생성된 도구를 template/server/src/tools/에 주입
- [ ] server.ts에 도구 등록 코드 추가

### 파일 구조 (예상)
```
template/
└── server/
    └── src/
        └── tools/
            ├── index.ts              # 도구 export
            ├── getProducts.ts        # Swagger에서 생성된 도구
            └── createOrder.ts        # Swagger에서 생성된 도구
```

### 생성될 코드 예시
```typescript
// template/server/src/tools/getProducts.ts
import { z } from 'zod';

export const getProductsTool = {
  name: 'get_products',
  description: 'Search products by keyword',
  parameters: z.object({
    keyword: z.string().describe('Search keyword'),
    limit: z.number().optional().default(10),
  }),
  execute: async ({ keyword, limit }) => {
    const response = await fetch(
      `https://api.example.com/products?q=${keyword}&limit=${limit}`
    );
    return response.json();
  },
};
```

### 완료 조건
- [ ] Swagger URL 입력 → MCP 도구 파일 생성
- [ ] 생성된 도구가 MCP 서버에서 동작
- [ ] Chattable 채팅에서 도구 호출 가능

---

## Feature 2: Widget Builder (위젯 빌더)

### 목표
MCP 도구의 응답을 시각화하는 위젯을 Mastra Agent가 자동 생성한다.

### 사용자 플로우
```
1. MCP 도구 생성 완료 (Feature 1)
2. User: "이 도구에 맞는 위젯 만들어줘"
3. Mastra Agent: WIDGET_AGENT_PROMPT.md 기반으로 스키마 분석 → 위젯 코드 생성
4. 결과: template/web/src/widgets/{widgetName}.tsx + shared/src/schemas/{widget}.schema.ts
```

### 기술 구현

#### Phase 1: 위젯 에이전트 시스템 프롬프트 ✅
- [x] 템플릿 구조 분석 (shared → server → web 3계층)
- [x] defineWidget(), mountWidget() 패턴 정리
- [x] @openai/apps-sdk-ui 컴포넌트 레퍼런스 정리
- [x] WIDGET_AGENT_PROMPT.md 생성

#### Phase 2: 템플릿 정리 🔄
- [ ] Pokemon 예시 제거 → 깨끗한 시작점
- [ ] @openai/apps-sdk-ui 의존성 추가
- [ ] AppsSDKUIProvider 설정
- [ ] 에이전트가 파일 생성하기 좋은 구조로 정리

#### Phase 3: Mastra Agent 연동
- [ ] WIDGET_AGENT_PROMPT.md를 에이전트 시스템 프롬프트로 적용
- [ ] 에이전트가 template/ 내 파일 생성할 수 있도록 MCP 도구 확인

### 파일 구조
```
template/
├── shared/src/schemas/
│   ├── index.ts                 # Schema exports
│   └── {widget}.schema.ts       # Zod Schema + Example Data
│
├── web/src/widgets/
│   └── {widget}.tsx             # Widget Component
│
└── server/src/tools/
    └── {tool}.ts                # MCP Tool (Feature 1에서 생성)
```

### 생성될 코드 예시

**Schema (shared/src/schemas/products.schema.ts):**
```typescript
import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  stock: z.number(),
  imageUrl: z.string().url().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const ProductsSchema = z.object({
  products: z.array(ProductSchema),
  total: z.number(),
});

export type Products = z.infer<typeof ProductsSchema>;

export const exampleProductsData: Products = {
  products: [
    { id: "1", name: "Widget Pro", price: 29.99, stock: 150 },
    { id: "2", name: "Widget Lite", price: 9.99, stock: 500 },
  ],
  total: 2,
};
```

**Widget (web/src/widgets/products.tsx):**
```tsx
import { defineWidget } from "@/utils/defineWidget";
import { ProductsSchema, exampleProductsData, type Products } from "@apps-sdk-template/shared";
import { mountWidget, useToolOutput } from "skybridge/web";

function ProductsWidget() {
  const { products, total } = useToolOutput() as Products;

  return (
    <div className="divide-y rounded-lg border">
      <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600">
        {total} products found
      </div>
      {products.map((product) => (
        <div key={product.id} className="flex items-center justify-between p-4">
          <div>
            <h3 className="font-medium">{product.name}</h3>
            <p className="text-sm text-gray-500">Stock: {product.stock}</p>
          </div>
          <div className="text-lg font-bold">${product.price}</div>
        </div>
      ))}
    </div>
  );
}

const Products = defineWidget({
  schema: ProductsSchema,
  exampleOutput: exampleProductsData,
  component: ProductsWidget,
});

export default Products;
mountWidget(<Products />);
```

### 완료 조건
- [x] 위젯 에이전트 시스템 프롬프트 작성 (WIDGET_AGENT_PROMPT.md)
- [ ] 템플릿 정리 (Pokemon 제거, apps-sdk-ui 추가)
- [ ] Mastra Agent에 프롬프트 적용
- [ ] Chattable에서 위젯 생성 테스트

---

## 우선순위

| 순서 | 기능 | 이유 |
|-----|------|------|
| 1 | Feature 2: 위젯 빌더 | 템플릿 정리 먼저 → 에이전트 테스트 가능 |
| 2 | Feature 1: Swagger → MCP | 위젯 빌더가 준비되면 통합 테스트 |

---

## 진행 상태

### Feature 2: Widget Builder (위젯 빌더)
- Phase 1: ✅ **Complete** - WIDGET_AGENT_PROMPT.md 생성
- Phase 2: 🔄 **Next** - 템플릿 정리
- Phase 3: ⬜ Not Started

### Feature 1: Swagger → MCP 도구
- Phase 1: ⬜ Not Started
- Phase 2: ⬜ Not Started
- Phase 3: ⬜ Not Started

---

*Last updated: 2024-11*
