# NULL 요구사항 정리 (정확/무과장 버전)

이 문서는 **“NULL 하나로 모든 서비스 제작/배포/운영이 끝나야 한다”**는 요구를 **정확하게** 정리한 기준서다.
모호한 홍보 문구, 과장, 자기보호적 회피, 할루시네이션, 사용자 우호적(근거 없는 긍정) 답변은 **절대 금지**이며, 이 기준을 위배하는 주장은 명시적으로 무효다.

---

## 1) 최상위 목표 (비타협)

- **NULL 하나로** 디자인 → FE → BE → 배포 → 운영까지 **전 과정 완결**
- **어떤 웹/앱 서비스든 구현 가능**
- **프로토타입 수준 금지**, 실서비스 즉시 운영 수준의 완성도
- 모바일은 **웹으로 제작 → 앱 빌더 방식 패키징** (네이티브 브리지 포함)
- **관리형 호스팅**을 NULL이 직접 제공 (도메인/SSL/스케일/모니터링/로그/백업 포함)
- **AI 기능은 나중에** (현 시점 범위에서 제외)

---

## 2) “NULL로 시작해 NULL로 끝난다”의 정의

다음이 모두 **NULL 내부에서 가능**해야 한다.

- UI/UX 설계와 디자인 시스템 구성
- 화면 구성/인터랙션/상태/라우팅 구현
- 데이터 모델링/CRUD/비즈니스 로직/권한/인증
- 결제/구독/알림/외부 API 연동
- 배포/도메인/SSL/스케일/로그/모니터링/백업
- 모바일 패키징 및 네이티브 기능/하드웨어 연동

**예외 없음.** 외부 연동이 필요하더라도 **플러그인/브리지를 NULL 안에서 설치·설정·운영**할 수 있어야 한다.
즉 “NULL 밖에서 개발/설정해야 하는 것”이 남으면 실패다.

---

## 3) 품질/진실성 원칙 (절대 기준)

다음은 금지한다.

- 거짓말, 과장, 불확실한 주장
- 스스로를 보호하기 위한 회피성 답변
- 근거 없는 낙관/칭찬/희망 회로
- 구현되지 않은 기능을 “가능”이라고 표현

**모든 기능 주장은 반드시 코드/테스트/실행 증거로 뒷받침되어야 한다.**
확인 불가한 것은 “불확실/미구현”으로 명시한다.

---

## 4) 필수 기능 범주 (A~H, 전부 필수)

### A. 에디터/디자인
- Figma import (레이어 구조, 스타일, 컴포넌트/인스턴스/변형)
- 반응형/브레이크포인트/오버레이
- 프로토타이핑/인터랙션 구성
- 자산 라이브러리/컴포넌트/템플릿
- 협업(코멘트/커서/선택 공유)

### B. 고급 FE/런타임
- 렌더링/상태관리/라우팅
- 입력/검증/폼 제출/파일 업로드
- 데이터 바인딩(list/table) 및 정렬/필터
- 앱 인증 UX 연동
- 네이티브 호출(nativeCall) 및 웹 fallback
- PWA 기본 구성(설치 가능)

### C. 데이터/BE
- 스키마 정의 + CRUD
- 마이그레이션(보존/정리/리네임/기본값)
- 비즈니스 로직/권한/인증
- 워크플로(트리거/실행/로그)
- 웹훅/크론 트리거
- 데이터 검증 규칙(타입/필수/범위/패턴/enum)

### D. 인증/보안
- 사용자/역할/권한(RBAC/ABAC)
- 세션/토큰/감사 로그
- 시크릿 관리/프록시 연동

### E. 결제/구독/상거래
- 결제/구독/정산/환불
- 주문/장바구니/배송

### F. 외부 연동/플러그인
- 외부 API 연결/자격 증명 관리
- 플러그인 설치/검증/권한 모델
- SDK/마켓

### G. 모바일/하드웨어
- 패키징(웹→앱)
- 네이티브 브리지/하드웨어 제어

### H. 배포/운영
- 원클릭 배포
- 도메인/SSL/CDN/스케일
- 로그/모니터링/백업

---

## 5) 제외(현재 범위)

- **완전 독립 설치/업그레이드/이관(Export/Import)**
  - 이 부분은 **나중에 진행**
- **AI 기능**
  - 현재 범위에서 제외

---

## 6) 성공 기준 (완료의 정의)

다음이 **모두** 충족되어야 한다.

1. A~H 모든 범주에서 **실제 구현** 완료
2. 기능별 **테스트/시나리오** 검증 완료
3. 미구현/미검증 항목 **0개**
4. 모바일/하드웨어 기능을 **NULL 내부에서 설정/배포** 가능
5. 배포/운영을 NULL 내부에서 완결

---

## 7) 진행 방식 (필수 프로세스)

1. **커버리지 매트릭스 작성**
2. **갭 분석**(구현 vs 요구)
3. **로드맵 + 구현**
4. **증거 기반 완료**

---

## 8) 문서 사용 규칙

- 이 문서는 **최상위 기준**이며 예외가 없다.
- 기능이 부족하면 반드시 **미구현**으로 기록한다.
- 성과 보고에는 **증거(파일/테스트/로그)**가 포함되어야 한다.

---

## 9) 검증 범위 (코드 전체 스캔)

- 기준일: 2026-02-23
- 제외 디렉터리: `node_modules/`, `.next/`, `nu11/`
- 텍스트 파일 수: 357
- 바이너리 파일 수: 6
- 바이너리 목록: `.eslint.json`, `eslint.config.zip.old`, `null.zip`, `public/icon-192.png`, `public/icon-512.png`, `src/app/favicon.ico`
- 비고: 위 범위 내 모든 텍스트 파일을 로드해 기능 여부를 판단한다.

---

## 10) 현재 구현 기능 (코드 확인)

### A. 에디터/디자인
- 노드 타입: frame/group/rect/ellipse/line/arrow/polygon/star/path/text/image/video/section/slice/component/instance/hotspot/table (`src/advanced/doc/scene.ts`)
- 스타일: fill/gradient/stroke/shadow/blur/noise/blend/opacity/radius/stroke cap/join/텍스트 스타일 (`src/advanced/doc/scene.ts`)
- 제약/오토레이아웃/오버레이/브레이크포인트 (`src/advanced/doc/scene.ts`, `src/advanced/ui/AdvancedEditorView.tsx`)
- 컴포넌트/인스턴스/변형 (`src/advanced/doc/scene.ts`, `src/advanced/ui/AdvancedEditorView.tsx`)
- 벡터/불리언 연산 (`src/advanced/geom/boolean.ts`, `src/advanced/ui/AdvancedEditorView.tsx`)
- 프로토타입 액션: click/hover/load/scroll/onPress/onDragStart/onDragEnd/whileHover + navigate/back/overlay/closeOverlay/url/submit/setVariable/scrollTo/setVariant/apiCall/nativeCall/appAuth (`src/advanced/doc/scene.ts`, `src/advanced/runtime/player.tsx`)
- Export: JSON/Tokens/SVG/PNG/JPG/PDF (`src/advanced/ui/AdvancedEditorView.tsx`)
- Figma import API + UI (`src/app/api/pages/[pageId]/figma/import/route.ts`, `src/advanced/ui/AdvancedEditorView.tsx`)
- 협업/코멘트/커서 공유 (`src/server/socket.ts`, `src/app/api/pages/[pageId]/collab/route.ts`, `src/app/api/pages/[pageId]/comments/route.ts`)

### B. 고급 FE/런타임
- AdvancedRuntimePlayer 렌더링 (`src/advanced/runtime/player.tsx`)
- 변수 모드/수식 계산 (`src/advanced/runtime/renderer.tsx`, `src/advanced/runtime/player.tsx`)
- 컬렉션 바인딩(list/table) (`src/advanced/runtime/renderer.tsx`)
- 폼 제출 + 파일 업로드 payload 생성 (`src/advanced/runtime/player.tsx`)
- API Call 액션 `/api/app/{pageId}/proxy` (`src/advanced/runtime/player.tsx`, `src/app/api/app/[pageId]/proxy/route.ts`)
- App auth 액션(login/register/logout) (`src/advanced/runtime/player.tsx`, `src/app/api/app/[pageId]/auth/*`)
- nativeCall 액션 + 웹 fallback(기기 정보/네트워크/위치/클립보드/공유/진동) (`src/advanced/runtime/player.tsx`)
- PWA 기본 구성(설치 가능) (`public/manifest.json`, `public/sw.js`, `src/components/sw-register.tsx`, `src/app/layout.tsx`)
- PWA offline fallback + 기본 캐시 (`public/sw.js`, `public/offline.html`)

### C. 데이터/BE
- AppCollection/AppRecord 스키마 + CRUD API (`src/lib/app-data.ts`, `src/app/api/app/[pageId]/schema/route.ts`, `src/app/api/app/[pageId]/[model]/*`)
- 스키마 마이그레이션(보존/정리/리네임/기본값) (`src/lib/app-data.ts`)
- App 데이터 검증(타입/필수/범위/패턴/enum, strict 모드) (`src/lib/app-data.ts`, `src/app/api/app/[pageId]/[model]/*`)
- AppUser 인증/권한 API (`src/lib/app-auth.ts`, `src/app/api/app/[pageId]/auth/*`)
- App 사용자 관리 API + 대시보드 UI (`src/app/api/app/[pageId]/auth/users/route.ts`, `src/components/dashboard-work-view.tsx`)
- AppWorkflow 실행 + 로그 (`src/lib/app-workflow.ts`, `prisma/schema.prisma`)
- 워크플로 로그 조회 API (`src/app/api/app/[pageId]/workflows/logs/route.ts`)
- 워크플로 자동 트리거(record_created/updated/deleted) (`src/lib/app-workflow.ts`, `src/app/api/app/[pageId]/[model]/*`)
- 워크플로 트리거(user_registered/user_logged_in) (`src/app/api/app/[pageId]/auth/login/route.ts`, `src/app/api/app/[pageId]/auth/register/route.ts`)
- 웹훅 트리거 엔드포인트 `/api/app/{pageId}/webhooks/{path}` (시크릿 설정 시 HMAC 서명 검증) (`src/app/api/app/[pageId]/webhooks/[...path]/route.ts`, `src/lib/app-workflow.ts`)
- 웹훅 시크릿 관리 API `/api/app/{pageId}/webhooks/secret` (`src/app/api/app/[pageId]/webhooks/secret/route.ts`)
- 크론 실행 엔드포인트 `/api/cron/workflows` (`src/app/api/cron/workflows/route.ts`, `src/lib/cron.ts`)
- 내부 스케줄러(커스텀 서버 환경, `INTERNAL_CRON=false`로 비활성화 가능) (`src/server/cron-scheduler.ts`, `src/lib/workflow-scheduler.ts`, `server.ts`)
- 내부 스케줄러: 만료 처리/일일 리포트 실행 (SystemSetting 기반 1일 1회) (`src/server/cron-scheduler.ts`, `src/lib/daily-reports.ts`)
- 워크플로 단계 재시도(고정 지연) + api_call 재시도/백오프/타임아웃 (`src/lib/app-workflow.ts`)
- 폼 제출 트리거 엔드포인트 `/api/app/{pageId}/forms/{formName}` (`src/app/api/app/[pageId]/forms/[formName]/route.ts`, `src/lib/app-workflow.ts`)
- AppSecret 관리 API(소유자 인증) + 프록시 연동 (`src/app/api/app/[pageId]/secrets/route.ts`, `src/app/api/app/[pageId]/proxy/route.ts`, `prisma/schema.prisma`)
- App 시크릿 대시보드 UI (`src/components/dashboard-work-view.tsx`)
- 파일 업로드(로컬 저장) (`src/lib/storage.ts`, `src/app/api/app/[pageId]/upload/route.ts`)
- 공개/배포 게이트(`deployed_at`) (`src/app/p/[pageId]/page.tsx`, `prisma/schema.prisma`)
- 분석/통계 API (`src/app/api/pages/[pageId]/stats/route.ts`, `src/app/api/pages/[pageId]/spikes/route.ts`)
- Spikes API: DB 버킷 집계 + SystemSetting 기반 윈도우/버킷/하이라이트/TopK (`src/app/api/pages/[pageId]/spikes/route.ts`, `src/lib/system-settings.ts`)
- Witness 밀도 캡 설정(SystemSetting) (`src/app/api/pages/[pageId]/witness/route.ts`, `src/lib/system-settings.ts`)
- 결제/플랜 기본(Stripe) (`src/app/api/billing/*`, `src/lib/billing.ts`)

### D. 실시간 이벤트
- 실시간 접속/이벤트 수집(Socket) (`src/server/socket.ts`, `src/components/work-view.tsx`)
### D-1. 보안/정책
- IP 해시 정책: noip fallback on/off (`allow_noip_fallback`) (`src/lib/system-settings.ts`, `src/app/api/pages/[pageId]/report/route.ts`, `src/app/api/pages/[pageId]/upvote/route.ts`, `src/app/api/admin/pages/[pageId]/report/route.ts`, `src/app/api/admin/pages/[pageId]/upvote/route.ts`)

### E. 호스팅/운영
- 호스팅 설정 API (도메인/HTTPS/WWW 설정 저장) (`src/app/api/app/[pageId]/hosting/route.ts`)
- 호스팅 설정 대시보드 UI (`src/components/dashboard-work-view.tsx`)
- 커스텀 도메인 레지스트리(PageDomain) + 서버 도메인 라우팅/HTTPS·WWW 리디렉션 (`prisma/schema.prisma`, `src/server/domain-router.ts`, `server.ts`)
- 도메인 상태 점검 API(DNS/SSL) + 대시보드 UI (`src/app/api/app/[pageId]/hosting/status/route.ts`, `src/components/dashboard-work-view.tsx`)
- 배포/라이브 제어 대시보드 UI (`src/components/dashboard-work-view.tsx`)
- 운영 헬스/메트릭/로그 API (관리자 세션 필요) (`src/app/api/ops/health/route.ts`, `src/app/api/ops/metrics/route.ts`, `src/app/api/ops/logs/route.ts`)

### F. 모바일/네이티브
- 네이티브 브리지 호스트 스크립트 + Capacitor 매핑 (`public/native-bridge-host.js`, `src/components/native-bridge-host.tsx`, `src/app/layout.tsx`)
- Capacitor 매핑 확장: camera/filesystem/preferences/push/localNotifications/app/browser/statusBar/keyboard
- React Native WebView 호스트 샘플 (`mobile/react-native-host/*`)
- Capacitor 호스트 샘플 (`mobile/capacitor-host/*`)
- 모바일 패키징 설정 API `/api/app/{pageId}/mobile` (GET/PUT)
- 모바일 호스트 구성 출력 `/api/app/{pageId}/mobile/host-config` (Capacitor/RN 설정 JSON)
- 모바일 호스트 패키지 다운로드 `/api/app/{pageId}/mobile/package?type=capacitor|react-native` (ZIP)
- 호스트 설정 파일 지원 `host.config.json` (Capacitor/RN 호스트)
- React Native 호스트 브리지 확장(네트워크/클립보드/설정/URL 열기/지오로케이션/카메라/파일시스템/상태바/키보드, RN 모듈 필요) (`mobile/react-native-host/App.tsx`)
- nativeCall 프리셋/예시 인자 UI (`src/advanced/runtime/native-commands.ts`, `src/advanced/ui/AdvancedEditorView.tsx`)
- web fallback 카메라/파일 선택 지원 (`public/native-bridge-host.js`, `src/advanced/runtime/player.tsx`)
- web fallback 파일시스템/알림(로컬/푸시 기본) 지원 (`public/native-bridge-host.js`, `src/advanced/runtime/player.tsx`)

---

## 11) 확인된 제한/미구현 (코드 기준)

- 스키마 마이그레이션 테스트 미완료
- 워크플로 스케줄 트리거: **부분 구현** (내부 스케줄러 지원, 서버리스 환경은 외부 호출 필요)
- 크론 파서 제한: 5필드만 지원, `?`, `L`, `W`, `#` 등 고급 문법 미지원 (서버 시간 기준)
- 웹훅: 시크릿 미설정 시 공개, 설정 시 서명 검증 필수
- 모바일 패키징/네이티브 브리지/하드웨어 연동: **부분 구현** (nativeCall + 제한된 웹 fallback + RN/Capacitor 호스트 샘플 + host.config.json + 모바일 설정 API/호스트 구성 출력 + 호스트 ZIP 패키지 다운로드 + Capacitor 기본 플러그인 매핑, 실제 네이티브 빌드 파이프라인/스토어 배포/권한·디바이스 제어 검증 미구현, RN 모듈(지오로케이션/카메라/파일시스템) 실기기 검증 미완료)
- 비디오 컨트롤/플레이어 기능 미구현
- 상거래(주문/장바구니/배송) 미구현
- 플러그인 SDK/마켓 미구현
- 호스팅 자동화: DNS TXT 인증/도메인 상태 점검/커스텀 도메인 라우팅은 구현, SSL 자동 발급·배포/CDN/스케일링/무중단 배포는 미구현
- PWA 오프라인/캐시 전략: **부분 구현** (offline fallback + 정적 캐시, 세부 전략/제어 미구현)
- 워크플로 재시도/백오프: **부분 구현** (api_call 포함, 일반 단계는 고정 지연 재시도만 지원 / 지수 백오프·서킷브레이커 미구현)
- 외부 스토리지(S3 등) 미구현

---

## 12) 사용자 요구사항 원문 (그대로)

> 무조건 100% 어떤 서비스, 앱이든 제작 및 배포가 NULL 하나로 다 끝날 수 있어야 돼. 쇼핑몰이든 본인이 구상한 서비스든 뭐든 웹이든 앱이든 단순한 프로젝트든 어려운 프로젝트든 모두를 만들 수 있어야 돼. 프로토타입 같은 찌끄레기 버러지 수준이 아니라 정말 이대로 출시하고 실제 관리 및 실동작하는 100% 완전한 서비스가 나와야 돼. 완벽한 자유도와 완벽도를 만들어내야만 해. 어떤 아이디어든 완벽히 실현 가능한 에디터.
>
> 나는 전부 만족을 해야 돼  
> 진짜 뭐 나는 기발한 아이디어가 있어서 이걸로  
> 웹 서비스를 만들어서 성공할 거야  
> 하는 사람들 그리고 기존에 수많은 서비스들이 있잖아 앱이든 웹이든 이런 모든 분야를 이 에디터에서 전부 구현이 가능해야 돼 AI 기능이 필요하면 사용자가 토큰 발급 받아서 여기에 본인 토큰 넣으면 알아서 API 끌어와서 쓸 수 있고 이런 식으로 (AI 넣는건 나중에 할거니까 일단 제외)  
> 진짜 어떤 웹 앱 서비스든 만들 수 있어야 하는 거야  
> 이해 했어?
>
> 모바일은 올릴 때 음 그냥 앱 빌더처럼 웹으로 개발하고 간단하게 앱 빌더로 올리잖아 그런 식으로 하지 않을까 싶어  
> 반드시 해야 하는 건 모든 거야 너가 예로 든 서비스들은 당연하고 그게 어떤 것이든 전부 카메라가 필요한 것들 뭐가 필요한 것들 외부 무슨 장치가 필요한 것들 등등  
> 실제 디자인-FE-BE(엔지니어링) 과정을 NULL에서 끝낼 수 있게 하고 싶은 거야  
> 그리고 NULL 자체 호스팅을 지원해야 하고
>
> 음 모든 것이 NULL 로 시작해서 NULL로 끝나야 돼  
> 그리고 기능 부분에서도 더 필요하지 않아?  
> 어드벤스드 에디터
>
> 완전 독립 설치/업그레이드/이관 이건 나중에 해도 돼  
> 호스팅 자체나 뭔가 인프라적인 부분들도 NULL에서 지원할 거야
>
> 독립으로 이관시켜 주는 건 나중 일이니까 지금은 생각하지 마

---

## 13) 커버리지 매트릭스 (현재 상태)

| 범주 | 요구 수준 | 현재 상태 | 근거 |
| --- | --- | --- | --- |
| A. 에디터/디자인 | 100% | 부분 구현 | `src/advanced/*` |
| B. 고급 FE/런타임 | 100% | 부분 구현 | `src/advanced/runtime/*` |
| C. 데이터/BE | 100% | 부분 구현 | `src/lib/app-data.ts`, `src/app/api/app/*` |
| D. 인증/보안 | 100% | 부분 구현 | `src/lib/app-auth.ts`, `src/app/api/app/*` |
| E. 결제/상거래 | 100% | 부분 구현 | Stripe 기본 플로우만 존재 |
| F. 외부 연동/플러그인 | 100% | 부분 구현 | 플러그인 JSON 저장/검증만 존재 |
| G. 하드웨어/네이티브 | 100% | 부분 구현 | nativeCall 런타임 호출 + 제한된 웹 fallback + RN/Capacitor 호스트 샘플 |
| H. 배포/운영 | 100% | 부분 구현 | `deployed_at` 게이트 + 설정 저장 API |

**판정 원칙:** 100% 충족 전까지는 “부분 구현”으로만 표기한다.

---

## 14) 페이지 API 라우트 목록

- `alerts`, `analytics`, `calendar`, `call-state`, `chat`, `collab`, `comments`, `deploy`, `duplicate`, `events`, `export`, `figma`, `ghost`, `heatmap`, `kanban`, `note`, `notifications`, `presence`, `publish`, `replay`, `report`, `search`, `segments`, `sessions`, `settings`, `spikes`, `stats`, `todos`, `upvote`, `version`, `versions`, `witness`

**주의:** 라우트 존재가 기능 완성은 아니다. 반드시 구현/테스트 증거가 필요하다.

---

## 15) 최근 변경 (2026-02-23)

- 워크플로 자동 트리거 연결 (record_created/updated/deleted)
  - `src/lib/app-workflow.ts`
  - `src/app/api/app/[pageId]/[model]/*`
- 스키마 마이그레이션 도입 (preserve/prune + rename/delete/defaults, 테스트 미완료)
  - `src/lib/app-data.ts`
  - `src/app/api/app/[pageId]/schema/route.ts`
- 플러그인 저장/검증 API 추가 (PageSetting 기반, SDK/마켓 미구현)
  - `src/lib/app-plugins.ts`
  - `src/app/api/app/[pageId]/plugins/route.ts`
  - `src/advanced/ui/AdvancedEditorView.tsx`
- 스토리지 추상화 추가 (local backend만 구현, 외부 스토리지 미구현)
  - `src/lib/storage.ts`
  - `src/app/api/app/[pageId]/upload/route.ts`
- 네이티브 브리지 액션(nativeCall) + 런타임 호출 + 웹 fallback(제한된 명령, 테스트 미완료)
  - `src/advanced/doc/scene.ts`
  - `src/advanced/runtime/player.tsx`
  - `src/advanced/ui/AdvancedEditorView.tsx`
- 웹훅 시크릿/서명 검증 추가 (HMAC + 타임스탬프 5분 윈도우, 테스트 미완료)
  - `src/app/api/app/[pageId]/webhooks/[...path]/route.ts`
  - `src/app/api/app/[pageId]/webhooks/secret/route.ts`
- 스케줄/크론 실행 엔드포인트 추가 (5필드 제한, 테스트 미완료)
  - `src/app/api/cron/workflows/route.ts`
  - `src/lib/cron.ts`
- PWA 기본 구성 추가 (manifest + service worker, 테스트 미완료)
  - `public/manifest.json`
  - `public/sw.js`
  - `src/components/sw-register.tsx`
  - `src/app/layout.tsx`
- 호스팅 설정 API 추가 (도메인/HTTPS/WWW 설정 저장, 실제 DNS/SSL 자동화 미구현)
  - `src/app/api/app/[pageId]/hosting/route.ts`
- 네이티브 브리지 호스트 스크립트 Capacitor 매핑 확장
  - `public/native-bridge-host.js`
- Capacitor 호스트 플러그인 의존성 추가 (camera/filesystem/preferences/push/localNotifications/app/browser/statusBar/keyboard)
  - `mobile/capacitor-host/package.json`
- nativeCall 프리셋/예시 인자 UI 추가
  - `src/advanced/runtime/native-commands.ts`
  - `src/advanced/ui/AdvancedEditorView.tsx`
- Web fallback 확장 (browser/app open, preferences)
  - `src/advanced/runtime/player.tsx`
- Web fallback 카메라/파일 선택 지원
  - `public/native-bridge-host.js`
  - `src/advanced/runtime/player.tsx`
- Web fallback 파일시스템/알림(로컬/푸시 기본) 지원
  - `public/native-bridge-host.js`
  - `src/advanced/runtime/player.tsx`
- PWA offline fallback + 기본 캐시 추가
  - `public/sw.js`
  - `public/offline.html`
- 내부 스케줄러(커스텀 서버) + 크론 실행 로직 분리
  - `src/server/cron-scheduler.ts`
  - `src/lib/workflow-scheduler.ts`
  - `src/app/api/cron/workflows/route.ts`
  - `server.ts`
- 워크플로 단계 재시도(고정 지연) + api_call 재시도/백오프/타임아웃
  - `src/lib/app-workflow.ts`
- 워크플로 트리거(user_registered/user_logged_in) 연결
  - `src/app/api/app/[pageId]/auth/login/route.ts`
  - `src/app/api/app/[pageId]/auth/register/route.ts`
- 폼 제출 트리거 엔드포인트 추가
  - `src/app/api/app/[pageId]/forms/[formName]/route.ts`
- React Native WebView 호스트 샘플 추가
  - `mobile/react-native-host/App.tsx`
  - `mobile/react-native-host/package.json`
  - `mobile/react-native-host/README.md`
- Capacitor 호스트 샘플 추가
  - `mobile/capacitor-host/package.json`
  - `mobile/capacitor-host/capacitor.config.ts`
  - `mobile/capacitor-host/www/index.html`
  - `mobile/capacitor-host/README.md`
- 인코딩 깨짐 정리
  - `src/advanced/runtime/player.tsx`
  - `src/advanced/runtime/renderer.tsx`
  - `src/advanced/ui/AdvancedEditorView.tsx`
  - `src/advanced/ui/AdvancedEditor.assetLibraryPresets.ts`
  - `src/components/editor-view.tsx`
  - `src/components/settings-view.tsx`
  - `src/components/work-view.tsx`
  - `src/app/not-found.tsx`
- E2E 타임아웃 완화(요청 제한/직렬화)
  - `playwright.config.ts`
  - `e2e/route-health.spec.ts`
  - `e2e/smoke.spec.ts`
- E2E 온보딩 오버레이 차단 제거 + 문구 정리
  - `src/advanced/ui/AdvancedEditorView.tsx`
- 일일 리포트 로직 분리 + 내부 스케줄러 만료/리포트 실행
  - `src/lib/daily-reports.ts`
  - `src/app/api/cron/daily-reports/route.ts`
  - `src/server/cron-scheduler.ts`
  - `src/lib/expire.ts`
- 워크플로 단계 재시도(고정 지연) + 스텝 제한/오류 로그 개선
  - `src/lib/app-workflow.ts`
- 모바일 패키징 설정 API + 호스트 구성 출력
  - `src/lib/mobile-host.ts`
  - `src/app/api/app/[pageId]/mobile/route.ts`
  - `src/app/api/app/[pageId]/mobile/host-config/route.ts`
- 모바일 호스트 패키지 다운로드 API + 대시보드 설정 UI
  - `src/lib/zip.ts`
  - `src/lib/mobile-package.ts`
  - `src/app/api/app/[pageId]/mobile/package/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 호스팅 설정 대시보드 UI
  - `src/components/dashboard-work-view.tsx`
- 배포/라이브 제어 대시보드 UI
  - `src/components/dashboard-work-view.tsx`
- App 데이터 검증 규칙
  - `src/lib/app-data.ts`
  - `src/app/api/app/[pageId]/[model]/route.ts`
  - `src/app/api/app/[pageId]/[model]/[id]/route.ts`
- App 시크릿 관리 보강
  - `src/app/api/app/[pageId]/secrets/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 모바일 호스트 설정 파일 + RN 브리지 확장
  - `mobile/capacitor-host/host.config.json`
  - `mobile/capacitor-host/capacitor.config.ts`
  - `mobile/react-native-host/host.config.json`
  - `mobile/react-native-host/App.tsx`
  - `mobile/react-native-host/package.json`
  - `mobile/react-native-host/README.md`
- 로그인/회원가입 메시지 정리 + 에디터 주석 정리
  - `src/app/api/app/[pageId]/auth/login/route.ts`
  - `src/app/api/app/[pageId]/auth/register/route.ts`
  - `src/components/editor-view.tsx`
- 메인 피드 한국어화 보강
  - `src/components/feed.tsx`
- Live 화면 한국어화 + 메타 설명 한국어화
  - `src/components/live-view.tsx`
  - `src/app/layout.tsx`
- 리플레이 하이라이트 설정화 + 라벨 정리
  - `src/app/api/pages/[pageId]/replay/route.ts`
- 작품 상세(Work) 리플레이 문구 한국어화
  - `src/components/work-view.tsx`
- 작품 상세(Work) UI 한국어화 + 리플레이 플레이어 라벨 정리
  - `src/components/work-view.tsx`
  - `src/components/replay-player.tsx`
- 시스템 설정(Admin) 확장
  - `src/app/api/admin/settings/route.ts`
- 관리자 콘솔 설정 UI 확장
  - `src/components/admin-console.tsx`
- 설정 화면 한국어화
  - `src/components/settings-view.tsx`
- 계정 화면 기본 라벨 한국어화
  - `src/components/account-view.tsx`
- 추천(Upvote) API 오류 문구 한국어화
  - `src/app/api/pages/[pageId]/upvote/route.ts`
- 신고(Report) API 오류 문구 한국어화
  - `src/app/api/pages/[pageId]/report/route.ts`
- App 인증 API 오류 문구 한국어화
  - `src/app/api/app/[pageId]/auth/login/route.ts`
  - `src/app/api/app/[pageId]/auth/register/route.ts`
- App 프로필/비밀번호 API 오류 문구 한국어화
  - `src/app/api/app/[pageId]/auth/me/route.ts`
- App 사용자 관리 API 오류 문구 한국어화
  - `src/app/api/app/[pageId]/auth/users/route.ts`
- 관리자 콘솔 헤더 라벨 한국어화
  - `src/components/admin-console.tsx`
- 대시보드 워크 뷰 잔여 라벨 한국어화
  - `src/components/dashboard-work-view.tsx`
- API 오류/검증 메시지 한국어화 보강
  - `src/app/api/pages/[pageId]/chat/route.ts`
  - `src/app/api/pages/[pageId]/calendar/route.ts`
  - `src/app/api/pages/[pageId]/call-state/route.ts`
  - `src/app/api/pages/[pageId]/todos/route.ts`
  - `src/app/api/pages/[pageId]/settings/route.ts`
  - `src/app/api/pages/[pageId]/note/route.ts`
  - `src/app/api/pages/[pageId]/kanban/columns/route.ts`
  - `src/app/api/pages/[pageId]/kanban/cards/route.ts`
  - `src/app/api/pages/[pageId]/kanban/cards/[id]/route.ts`
  - `src/app/api/admin/pages/[pageId]/upvote/route.ts`
  - `src/app/api/admin/pages/[pageId]/report/route.ts`
  - `src/app/api/pages/[pageId]/alerts/test/route.ts`
  - `src/app/api/pages/[pageId]/alerts/notify/route.ts`
  - `src/app/api/pages/[pageId]/alerts/settings/route.ts`
- 앱 API 오류 메시지 한국어화 보강 (프록시/워크플로/웹훅/피그마)
  - `src/app/api/app/[pageId]/proxy/route.ts`
  - `src/app/api/app/[pageId]/workflows/route.ts`
  - `src/app/api/app/[pageId]/webhooks/[...path]/route.ts`
  - `src/app/api/pages/[pageId]/figma/import/route.ts`
- 리플레이 MP4 안내 문구 정리
  - `src/components/replay-view.tsx`
- 호스팅 도메인 인증(DNS TXT) 추가
  - `src/app/api/app/[pageId]/hosting/route.ts`
  - `src/app/api/app/[pageId]/hosting/verify/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 네이티브 브리지 기능 목록 제공
  - `public/native-bridge-host.js`
- 커스텀 도메인 레지스트리(PageDomain) + 서버 도메인 라우팅/HTTPS·WWW 리디렉션
  - `prisma/schema.prisma`
  - `src/server/domain-router.ts`
  - `server.ts`
- 도메인 상태 점검 API(DNS/SSL) + 대시보드 UI
  - `src/app/api/app/[pageId]/hosting/status/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 도메인 인증 API: PageDomain 동기화 + 도메인 충돌 방지
  - `src/app/api/app/[pageId]/hosting/verify/route.ts`
  - `src/app/api/app/[pageId]/hosting/route.ts`
- 백업/복구에 PageDomain 포함 + 도메인 충돌 검사
  - `src/app/api/pages/[pageId]/backup/route.ts`
- 공개 페이지 메타/로딩 문구 복원 + 리플레이 하이라이트 라벨 정리
  - `src/app/p/[pageId]/page.tsx`
  - `src/app/api/pages/[pageId]/replay/route.ts`
- 운영 헬스/메트릭/로그 API + 서버 로그 기록
  - `src/app/api/ops/health/route.ts`
  - `src/app/api/ops/metrics/route.ts`
  - `src/app/api/ops/logs/route.ts`
  - `src/lib/system-log.ts`
  - `server.ts`
- 기본 에디터 디자인 확장(요소 타입/속성/폼 바인딩/액션 런타임)
  - `src/components/editor-fields.tsx`
  - `src/components/editor-view.tsx`
  - `src/components/canvas-render.tsx`
  - `src/components/work-view.tsx`
  - `src/lib/canvas.ts`

---

## 16) 추가 원칙 (확정 발언 금지 강화)

- “완료/가능”으로 단정할 수 있는 것은 **코드·테스트·실행 증거가 있는 항목만**이다.
- 증거가 없는 항목은 **반드시 “미구현/불확실”로 명시**한다.
- 목표의 “그 이상” 주장 또한 **증거 기반으로만 인정**한다.
