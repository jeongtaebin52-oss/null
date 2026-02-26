# NULL 프로젝트 — UX 플로우 가이드

> 최종 갱신: 2026-02-19  
> 목적: 사용자 여정 전체를 정의하고, 각 단계별 진입·이탈 조건, 에러/로딩 처리, 모바일 대응을 명확히 함

---

## 1. 전체 사용자 여정 맵

```
[비로그인 방문]
  │
  ├─→ 홈 피드 (/) ─── 라이브 작품 탐색
  │     ├─→ 작품 카드 클릭 → /live/[pageId]
  │     ├─→ "새 페이지" → 로그인 필요 → /login → /editor/advanced
  │     └─→ 라이브러리 → /library
  │
  ├─→ 회원가입 (/signup) → 로그인 (/login)
  │
  └─→ 배포된 페이지 직접 접근 → /p/[pageId]

[로그인 사용자]
  │
  ├─→ 홈 피드 (/) ─── 작품 탐색 + 새 작품 생성
  │
  ├─→ 라이브러리 (/library)
  │     ├─→ 새 작품 만들기 → /editor/advanced
  │     ├─→ 기존 작품 수정 → /editor/advanced?pageId=...
  │     ├─→ 퍼블리시/재퍼블리시
  │     ├─→ 배포/배포 해제
  │     ├─→ 대시보드 → /dashboard/[pageId]
  │     └─→ LIVE 보기 → /live/[pageId]
  │
  ├─→ 에디터 (/editor/advanced)
  │     ├─→ 캔버스 편집 (도구, 프리셋, 자산)
  │     ├─→ 임시 저장 (Draft)
  │     ├─→ 퍼블리시 → /p/[pageId]
  │     └─→ 프로토타입 프리뷰 (인에디터)
  │
  ├─→ 대시보드 (/dashboard)
  │     ├─→ 작품별 대시보드 → /dashboard/[pageId]
  │     │     ├─→ 방문, 클릭, 체류, 바운스율 확인
  │     │     ├─→ LIVE 보기 → /live/[pageId]
  │     │     ├─→ 수정 → /editor/advanced?pageId=...
  │     │     └─→ 리플레이 → /replay/[pageId] (Pro+)
  │     └─→ 전체 작품 목록 (라이브, 초안, 히스토리)
  │
  ├─→ 설정 (/settings) + 계정 (/account)
  │
  └─→ 업그레이드 (/upgrade) → 빌링 → /billing/success | /billing/cancel
```

---

## 2. 페이지 상태 모델

| 상태 | 설명 | 피드 노출 | /p/[id] 접근 | /live/[id] 접근 |
|------|------|-----------|-------------|----------------|
| `draft` | 초안 (미퍼블리시) | X | 배포 시만 | X |
| `live` | 퍼블리시됨 (24h 제한) | O | O | O |
| `expired` | 라이브 만료 | X | 배포 시만 | X |

### 배포(Deploy) vs 퍼블리시(Publish)
- **퍼블리시**: 피드 노출 + 24시간 제한 라이브. `status: "live"`, `live_started_at`, `live_expires_at` 설정
- **배포**: 영구 URL 할당 (`/p/[pageId]`). `deployed_at` 설정. 피드 노출과 무관
- 두 상태는 독립적 — 배포만 하고 퍼블리시 안 할 수 있고, 그 반대도 가능

---

## 3. 핵심 플로우 상세

### 3.1 새 작품 생성 → 퍼블리시

```
1. 라이브러리 또는 홈 → "새 작품 만들기" 클릭
2. /editor/advanced 진입 (새 pageId 생성)
3. 캔버스 편집
   - 도구 선택 (프레임, 텍스트, 도형, 펜 등)
   - 프리셋 삽입 (자산 패널)
   - 속성 편집 (우측 패널)
4. 임시 저장 (Ctrl+S 또는 자동 저장)
   - POST /api/pages 또는 POST /api/pages/[id]/version
5. 퍼블리시 버튼 → 퍼블리시 모달
   - saveDraft() 먼저 실행 (최신 버전 보장)
   - POST /api/pages/[id]/publish
   - 플랜 제한 확인 (maxLivePages)
   - status → "live", live_started_at → now, live_expires_at → now + 24h
6. /p/[pageId]로 리다이렉트
```

### 3.2 작품 수정

```
1. 라이브러리 → 작품 메뉴 → "에디터에서 수정"
   또는 대시보드 → "수정" 버튼
2. /editor/advanced?pageId=... 진입
3. 기존 문서 로드 (GET /api/pages/[pageId])
4. 편집 → 저장 → (선택) 재퍼블리시
```

### 3.3 실시간 뷰

```
1. 피드에서 작품 카드 클릭 → /live/[pageId]
2. Socket.IO 연결 (page:[pageId] 룸 참여)
3. 실시간 시청자 수, 분석 오버레이 표시
4. 채팅 메시지 실시간 수신 (polling 1초 + socket 이벤트)
5. 만료 시 page:closed 이벤트 → 연결 종료
```

### 3.4 리플레이 (Pro+)

```
1. 대시보드 → "리플레이" 버튼 → /replay/[pageId]
2. 24시간 이내 인터랙션 히스토리 재생
3. 타임라인 스크러버로 특정 시점 탐색
```

---

## 4. 인증 흐름

### 진입점
- `/login` — 이메일/비밀번호 로그인. `?next=` 쿼리로 리다이렉트 지원
- `/signup` — 회원가입

### 익명 사용자
- `/api/anon/init` — 최초 접근 시 `anon_user_id` 쿠키 발급
- 피드 탐색, 라이브 뷰, 배포 페이지 접근 가능
- 에디터, 라이브러리, 대시보드 접근 시 → 로그인 리다이렉트

### 보호 라우트
| 라우트 | 인증 필요 | 비고 |
|--------|-----------|------|
| `/` | X | 피드 탐색 자유 |
| `/live/[id]` | X | 시청 자유 |
| `/p/[id]` | X | 배포 페이지 자유 접근 |
| `/editor/*` | O | 미인증 → /login |
| `/library` | O | 내 작품 관리 |
| `/dashboard/*` | O | 분석 데이터 |
| `/settings` | O | 설정 |
| `/account` | O | 계정 관리 |
| `/upgrade` | O | 플랜 업그레이드 |

---

## 5. 에러 처리

### 에러 바운더리
- `src/components/error-boundary.tsx` — React ErrorBoundary
- 렌더링 에러 시 "문제가 발생했습니다" + "다시 시도" 버튼
- `Providers` 컴포넌트에서 전역 래핑

### API 에러 핸들링
- `src/lib/api-handler.ts` — `withErrorHandler` 래퍼
- 모든 API 라우트에 try/catch, 구조화 로깅
- 500 에러 시 `{ error: "internal_error", message: "..." }` 반환

### 전역 에러 수집
- `window.addEventListener("error")` — JS 런타임 에러
- `window.addEventListener("unhandledrejection")` — 미처리 Promise 에러
- 소켓을 통해 서버 로깅

### 404 페이지
- `src/app/not-found.tsx` — "페이지를 찾을 수 없습니다"
- 뒤로가기, 홈, 라이브러리 링크 제공

---

## 6. 로딩 상태

| 위치 | 방식 | 표시 |
|------|------|------|
| 에디터 페이지 | `<Suspense>` | "로딩 중..." |
| 프리뷰 페이지 | `<Suspense>` | "로딩 중..." |
| 피드 | 스켈레톤 카드 | 카드 형태 플레이스홀더 |
| 라이브러리 | 스피너 | 중앙 스피너 |
| 대시보드 | 로딩 인디케이터 | 데이터 영역 로딩 |
| 에디터 상태 | 상태바 | `idle` / `saving` / `publishing` / `loading` |

---

## 7. 모바일 대응

### 반응형 패턴
- Tailwind 브레이크포인트: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`
- 모바일 우선 디자인 (기본 → sm → md → lg)

### 주요 컴포넌트별 대응
| 컴포넌트 | 모바일 | 태블릿 | 데스크톱 |
|----------|--------|--------|----------|
| 피드 그리드 | 1열 | 2열 (md) | 3열 (xl) |
| 라이브러리 그리드 | 1열 | 2열 (sm) | 3열 (lg) |
| 대시보드 그리드 | 1열 | 2열 (sm) | 3열 (lg) |
| 에디터 | 모바일 캔버스 프리뷰 토글 | 축소 패널 | 전체 패널 |
| 헤더/네비 | 스티키 + 반응형 | 확장 | 전체 |

### 터치 지원
- 피드: Pull-to-refresh
- 에디터: 터치 제스처 (줌, 패닝)
- 프리셋: 모바일 뷰포트 사이즈 `360×640`

---

## 8. 현재 미비 사항 및 개선 방향

### 온보딩 부재
- 현재 첫 방문 사용자를 위한 가이드 플로우 없음
- 개선: 첫 에디터 진입 시 인터랙티브 투어 또는 시작 템플릿 선택 화면

### 퍼블리시 전 프리뷰 부재
- 에디터에서 바로 퍼블리시 → 의도치 않은 상태로 공개 가능
- 개선: 퍼블리시 모달에 프리뷰 임베드 또는 별도 프리뷰 단계

### 에디터 이중 구조
- 기본 에디터(/editor)와 고급 에디터(/editor/advanced) 분리
- 사용자 혼란 가능 → 고급 에디터로 통합 또는 명확한 안내 필요

### 에러/로딩 상태 통일
- 현재 컴포넌트마다 다른 로딩 UI
- 개선: 공통 로딩 컴포넌트, 스켈레톤 패턴 통일

---

## 9. 라우트 전체 목록

| 라우트 | 컴포넌트 | 용도 |
|--------|----------|------|
| `/` | Feed | 홈 피드 |
| `/login` | LoginPage | 로그인 |
| `/signup` | SignupPage | 회원가입 |
| `/editor` | EditorView | 기본 에디터 |
| `/editor/advanced` | AdvancedEditor | 고급 에디터 |
| `/library` | LibraryView | 작품 관리 |
| `/dashboard` | DashboardListView | 대시보드 목록 |
| `/dashboard/[pageId]` | DashboardWorkView | 작품별 대시보드 |
| `/live/[pageId]` | LiveView | 라이브 뷰 |
| `/p/[pageId]` | WorkView | 배포 페이지 |
| `/replay/[pageId]` | ReplayView | 리플레이 (Pro+) |
| `/settings` | SettingsPage | 설정 |
| `/account` | AccountPage | 계정 |
| `/upgrade` | UpgradePage | 플랜 업그레이드 |
| `/billing/success` | BillingSuccess | 결제 성공 |
| `/billing/cancel` | BillingCancel | 결제 취소 |
| `/privacy` | PrivacyPage | 개인정보처리방침 |
| `/terms` | TermsPage | 이용약관 |
| `/ops/[slug]` | AdminConsole | 관리자 (ADMIN_SECRET_SLUG) |
