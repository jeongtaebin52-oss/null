# NULL 프로젝트 — 세션 컨텍스트

> 최종 갱신: 2026-02-20
> 목적: 채팅방 이전 시 다음 AI가 현재 상태를 정확히 파악하기 위한 중립적 사실 기록
> 주의: 이 문서는 "무엇을 해야 한다"가 아닌 "무엇이 있고, 무엇이 된다"만 기록. 판단은 다음 AI + 사용자가 함.

---

## 0. 프로젝트 비전 (사용자 원문)

> "무조건 100% 어떤 서비스, 앱이든 제작 및 배포가 NULL 하나로 다 끝날 수 있어야 돼.
> 쇼핑몰이든 본인이 구상한 서비스든 뭐든 웹이든 앱이든 단순한 프로젝트든 어려운 프로젝트든 모두를 만들 수 있어야 돼.
> 프로토타입 같은 찌끄레기 버러지 수준이 아니라 정말 이대로 출시하고 실제 관리 및 실동작하는 100% 완전한 서비스가 나와야 돼.
> 완벽한 자유도와 완벽도를 만들어내야만 해. 어떤 아이디어든 완벽히 실현 가능한 에디터."

## 1. 사용자 디자인 철학 제약

- NULL은 미니멀/클린 디자인 철학
- "너무 클로드를 사용한 느낌" = 이모지, 아기자기한 UI, 화려한 그라데이션 금지
- 기능 추가는 좋지만 기존 디자인 톤을 바꾸지 말 것
- "굳이 막 너무 바꾸려 하지마" — 필요 최소한 변경

---

## 2. 현재 구현 완료 상태 (코드 레벨)

### Phase 1: 앱 인증 + 연산 변수 — 완료

| 구성 요소 | 파일 | 상태 |
|----------|------|------|
| Prisma 모델: AppUser, AppSession | `prisma/schema.prisma:463-494` | 완료 |
| 인증 라이브러리 | `src/lib/app-auth.ts` | 완료 (register, login, logout, me, update, changePassword, list, setRole, delete) |
| API: register | `src/app/api/app/[pageId]/auth/register/route.ts` | 완료 |
| API: login | `src/app/api/app/[pageId]/auth/login/route.ts` | 완료 |
| API: logout | `src/app/api/app/[pageId]/auth/logout/route.ts` | 완료 |
| API: me | `src/app/api/app/[pageId]/auth/me/route.ts` | 완료 |
| API: users | `src/app/api/app/[pageId]/auth/users/route.ts` | 완료 |
| 런타임 연결: $app_user 변수 | `src/advanced/runtime/player.tsx` useEffect (appPageId → /auth/me → applyVariableOverrides) | 완료 |
| 런타임 액션: appAuth | `src/advanced/runtime/player.tsx` handleAction 내 `action.type === "appAuth"` 분기 | 완료 |
| 에디터 UI: appAuth 액션 타입 | `src/advanced/ui/AdvancedEditorView.tsx` select option + 설정 패널 | 완료 |
| Variable.computed (수식) | `src/advanced/doc/scene.ts` Variable 타입에 `computed?: { formula, dependencies }` | 완료 |
| 수식 평가 엔진 | `src/advanced/runtime/player.tsx` evaluateFormula() + computeAllFormulas() | 완료 |
| 수식 자동 재계산 | `src/advanced/runtime/player.tsx` useEffect (variableOverrides 변경 시 computed 재평가) | 완료 |
| 에디터 UI: 수식 입력 | `src/advanced/ui/AdvancedEditorView.tsx` 변수 패널에 "fx" 입력 + "+ 수식 추가" | 완료 |

### Phase 2: 외부 API 호출 + 시크릿 — 완료

| 구성 요소 | 파일 | 상태 |
|----------|------|------|
| Prisma 모델: AppSecret | `prisma/schema.prisma:496-508` | 완료 |
| API: 시크릿 CRUD | `src/app/api/app/[pageId]/secrets/route.ts` | 완료 |
| 프록시 API | `src/app/api/app/[pageId]/proxy/route.ts` | 완료 (CORS 우회, 시크릿 보간, 차단 호스트, 타임아웃) |
| PrototypeAction: apiCall | `src/advanced/doc/scene.ts` PrototypeAction 유니온에 apiCall 추가 | 완료 |
| 런타임 액션: apiCall | `src/advanced/runtime/player.tsx` handleAction 내 `action.type === "apiCall"` 분기 | 완료 |
| 에디터 UI: apiCall 액션 | `src/advanced/ui/AdvancedEditorView.tsx` select option + URL/Method/응답변수/에러변수 설정 | 완료 |

### Phase 3: 워크플로우 — 완료 (엔진 + API + 에디터 UI)

| 구성 요소 | 파일 | 상태 |
|----------|------|------|
| Prisma 모델: AppWorkflow, AppWorkflowLog | `prisma/schema.prisma:510-537` | 완료 |
| 워크플로우 실행 엔진 | `src/lib/app-workflow.ts` | 완료 (create_record, update_record, delete_record, api_call, set_variable, condition, loop, delay, log) |
| API: 워크플로우 CRUD + trigger | `src/app/api/app/[pageId]/workflows/route.ts` | 완료 |
| 에디터 워크플로우 빌더 UI | `src/advanced/ui/AdvancedEditorView.tsx` panelMode="workflow" | 완료 (이름, 트리거, 스텝 JSON 편집, CRUD) |

### Phase 4: 반응형 — 완료 (인프라 + 에디터 UI)

| 구성 요소 | 파일 | 상태 |
|----------|------|------|
| PageBreakpoint 타입 확장 | `src/advanced/doc/scene.ts` minWidth/maxWidth 추가 | 완료 |
| Node.breakpointOverrides | `src/advanced/doc/scene.ts` Node 인터페이스에 breakpointOverrides 추가 | 완료 |
| 런타임 브레이크포인트 감지 | `src/advanced/runtime/player.tsx` activeBreakpointId useMemo | 완료 |
| 런타임 반응형 렌더링 | `src/advanced/runtime/player.tsx` laidOutResponsive useMemo | 완료 |
| 에디터 페이지 브레이크포인트 관리 | `src/advanced/ui/AdvancedEditorView.tsx` (기존) | 완료 |
| 에디터 노드별 브레이크포인트 오버라이드 UI | `src/advanced/ui/AdvancedEditorView.tsx` 속성 패널 내 W/H/숨김 편집 | 완료 |

### Phase 5: 수식 + 컬렉션 데이터 — 완료

| 구성 요소 | 파일 | 상태 |
|----------|------|------|
| 수식 내 컬렉션 데이터 접근 | `src/advanced/runtime/player.tsx` COLLECTION("slug").sum/avg/min/max/count/where/pluck | 완료 |
| 컬렉션 데이터 런타임 캐싱 | `src/advanced/runtime/player.tsx` collectionCache state + useEffect | 완료 |

### Phase 6: UX 플로우 개선 — 완료

| 구성 요소 | 파일 | 상태 |
|----------|------|------|
| 첫 방문 온보딩 오버레이 | `src/advanced/ui/AdvancedEditorView.tsx` showOnboarding state + localStorage | 완료 |
| 퍼블리시 모달 라이브 프리뷰 | `src/advanced/ui/AdvancedEditorView.tsx` AdvancedRuntimeRenderer 임베드 | 완료 |
| 에러/로딩 메시지 타입별 색상 구분 | `src/advanced/ui/AdvancedEditor.constants.ts` resolveMessageType + 에디터 메시지 바 | 완료 |
| 저장/배포 버튼 로딩 스피너 | `src/advanced/ui/AdvancedEditorView.tsx` animate-spin 인라인 스피너 | 완료 |
| 프리셋 설명 인라인 표시 | `src/advanced/ui/AdvancedEditorView.tsx` 프리셋 버튼 내 description 표시 | 완료 |

---

## 3. 기존에 해결된 버그

| 버그 | 원인 | 해결 | 파일 |
|------|------|------|------|
| "Objects are not valid as a React child" | variableOverrides/textOverrides에 object가 그대로 들어감 | 모든 override 할당에 string/number/boolean 타입 체크 추가. pushNotice에 message: unknown 처리 | player.tsx |
| Prisma 500 에러 | API route에 try/catch 없음 | withErrorHandler 래퍼 적용 | api-handler.ts, 각 route.ts |
| 실시간 채팅 안 됨 | Socket.IO 메시지 브로드캐스트 누락 + 페이지 상태 제한 | chat:notify 핸들러 추가, 1초 폴링 fallback, 페이지 상태 제한 완화 | socket.ts, player.tsx, live-view.tsx |
| 하드코딩 localhost URL | sitemap, live-view 등에 localhost:3000 직접 사용 | getBaseUrl() 유틸 생성, 환경변수 기반 동적 해결 | url.ts, 각 파일 |
| TypeScript 타입 에러 (shadow, constraints, layoutSizing) | Effect/Constraints/LayoutSizingAxis 타입 불일치 | scene.ts 참조하여 정확한 속성명으로 교정 | assetLibraryPresets.ts |
| Next.js 15 API route params 타입 에러 | params가 Promise로 변경됨 | 모든 app/[pageId]/* route에 `params: Promise<>` + `await context.params` 적용 | auth/*, proxy, secrets, workflows route.ts |
| player.tsx refetchHeaders 타입 에러 | `{} | { "x-anon-user-id": string }` 타입이 HeadersInit과 불일치 | `Record<string, string>` 명시적 타입 지정 | player.tsx |

## 4. 알려진 기존 TypeScript 에러 (이번 세션 변경과 무관)

- `e2e/asset-library.spec.ts:122` — void 표현식 truthiness 테스트
- `e2e/chat-api.spec.ts:5,6` — initAnon 함수의 request 타입 문제
- `src/advanced/ui/AdvancedEditor.assetLibraryPresets.ts:1845-1870` — BuildCtx 타입 불일치 (이전 세션 이전부터 존재)

## 5. Prisma 마이그레이션 상태

- `prisma db push` 완료 — DB 스키마가 schema.prisma와 동기화됨
- `prisma generate`는 개발 서버가 파일을 잠그는 EPERM 에러 발생 → 서버 재시작 시 자동 해결

---

## 6. 미착수 작업 목록

### 사용자가 명시적으로 보류한 것
- 3차 기능 (OTP/2FA, 주소 검색, 고급 검색) — API 키 미발급

### 관련 기존 문서
- `docs/전략_완전한_서비스_빌더.md` — 5대 핵심 기능 전략
- `docs/프리셋_사용성_개선_전략.md` — 비개발자 프리셋 사용성 개선
- `docs/UX_플로우_가이드.md` — 전체 UX 흐름 정의
- `docs/정보_자산_실기능_구현_로드맵.md` — 에셋 프리셋 실기능 로드맵

---

## 7. 파일 변경 이력 (이번 세션)

### 새로 생성한 파일
- `src/app/api/app/[pageId]/proxy/route.ts` — 외부 API 프록시
- `src/app/api/app/[pageId]/workflows/route.ts` — 워크플로우 CRUD + trigger API
- `src/lib/app-workflow.ts` — 워크플로우 실행 엔진

### 수정한 파일
- `src/advanced/doc/scene.ts` — Variable.computed 추가, PrototypeAction에 apiCall/appAuth 추가, PageBreakpoint에 minWidth/maxWidth 추가, Node에 breakpointOverrides 추가
- `src/advanced/runtime/player.tsx` — evaluateFormula/computeAllFormulas 함수 추가, appAuth/apiCall 핸들러, $app_user 세션 복원 useEffect, computed 변수 자동 재계산 useEffect, 반응형 브레이크포인트 감지(activeBreakpointId) + 렌더링(laidOutResponsive), 컬렉션 데이터 캐시(collectionCache), refetchHeaders 타입 수정
- `src/advanced/ui/AdvancedEditorView.tsx` — apiCall/appAuth 액션 타입 option 추가, 해당 설정 패널 UI, 수식 입력 UI ("fx" + "+ 수식 추가"), 워크플로우 빌더 UI (panelMode="workflow"), 노드별 브레이크포인트 오버라이드 UI, 프리셋 description 인라인 표시, 첫 방문 온보딩 오버레이, 퍼블리시 모달 라이브 프리뷰, 에러/로딩 메시지 타입별 색상 구분, 저장/배포 버튼 스피너
- `src/advanced/ui/AdvancedEditor.constants.ts` — resolveMessageType 함수 추가 (에러/성공/정보 메시지 분류)
- `prisma/schema.prisma` — AppWorkflow, AppWorkflowLog 모델 추가, Page에 app_workflows 관계 추가
- `src/app/api/app/[pageId]/auth/login/route.ts` — Next.js 15 async params 적용
- `src/app/api/app/[pageId]/auth/register/route.ts` — Next.js 15 async params 적용
- `src/app/api/app/[pageId]/auth/logout/route.ts` — Next.js 15 async params 적용 + cookies() await
- `src/app/api/app/[pageId]/auth/me/route.ts` — Next.js 15 async params 적용 + getToken async 전환
- `src/app/api/app/[pageId]/auth/users/route.ts` — Next.js 15 async params 적용 + getToken async 전환
- `src/app/api/app/[pageId]/proxy/route.ts` — Next.js 15 async params 적용
- `src/app/api/app/[pageId]/secrets/route.ts` — Next.js 15 async params 적용
- `src/app/api/app/[pageId]/workflows/route.ts` — Next.js 15 async params 적용

### 이전 세션에서 수정된 파일 (이번 세션 이전)
- `src/advanced/runtime/player.tsx` — React child 에러 수정, 실시간 채팅 폴링, chatRefetchSignal/onChatSent
- `src/components/live-view.tsx` — Socket.IO 채팅 연결
- `src/server/socket.ts` — chat:notify 핸들러
- `src/lib/api-handler.ts` — withErrorHandler, safeParseBody (신규)
- `src/lib/url.ts` — getBaseUrl() (신규)
- `src/advanced/ui/AdvancedEditor.assetLibraryPresets.ts` — 프리셋 시각 품질 개선 (COLORS 확장, shadow, 반응형 기본값)
- `src/advanced/ui/AdvancedEditor.types.ts` — PresetDefinition에 description/tags 추가
- 각 API route — withErrorHandler 적용

---

## 8. 금지 사항

- 이 문서의 내용을 "해야 할 일 목록"으로 해석하지 말 것
- 특정 접근법이 "정답"이라고 단정하지 말 것
- 사용자에게 확인 없이 대규모 리팩토링하지 말 것
- NULL 디자인 철학(미니멀/클린)을 벗어나는 UI 변경 금지
