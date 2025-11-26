# Known Issues

## Mastra + OpenAI Reasoning Model (gpt-5-mini) Memory Issue

### Problem
OpenAI의 reasoning 모델(gpt-5-mini, o1 등)을 Mastra Memory와 함께 사용할 때 대화 히스토리 오류 발생.

### Error Message
```
Item 'msg_xxx' of type 'message' was provided without its required 'reasoning' item: 'rs_xxx'.
```

### Root Cause
- OpenAI reasoning 모델은 응답 시 `reasoning` item을 생성
- 후속 대화에서 message와 함께 해당 reasoning item을 **필수로** 포함해야 함
- Mastra Memory가 reasoning item을 저장/복원하지 못해서 OpenAI API가 400 에러 반환

### Current Workaround
reasoning 모델 대신 일반 모델 사용:
```typescript
// Before (broken)
model: openai('gpt-5-mini'),

// After (working)
model: openai('gpt-4o-mini'),
```

### Related GitHub Issues
- [Issue #8259 - OpenAI reasoning configuration](https://github.com/mastra-ai/mastra/issues/8259)
  - 사용자가 `reasoningEffort`, `textVerbosity` 등 설정했지만 reasoning output이 안 나옴
- [Issue #5490 - Memory processor bug](https://github.com/mastra-ai/mastra/issues/5490)
  - TokenLimiter가 첫 번째 agent 호출에서만 실행되는 버그

### References
- [Mastra Agent Memory Documentation](https://github.com/mastra-ai/mastra/blob/main/docs/src/content/en/docs/agents/agent-memory.mdx)
- [GPT-5-mini Documentation](https://platform.openai.com/docs/models/gpt-5-mini)

### TODO
- [ ] Mastra GitHub에 reasoning model + memory 이슈 제기
- [ ] Mastra 업데이트 후 재테스트
- [ ] 또는 Memory 없이 reasoning 모델 사용하는 방법 구현

---
*Last updated: 2025-11-26*
