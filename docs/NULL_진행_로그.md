# NULL 진행 로그

- 기준 문서: `docs/NULL_요구사항_정리.md`
- 원칙: **확정/완료 선언은 코드·테스트·실행 증거가 있을 때만** 가능
- 범위: 독립 설치/업그레이드/이관은 현재 제외

---

## 현재 상태 (2026-02-23)

- 진행 시작: 진행 중
- 코드 변경: 있음 (작업 기록 참조)
- 테스트 실행: 있음 (unit + e2e)
- 문서 갱신: 있음

---

## 1차 배치 (핵심 기반 구축)

목표: **“가능”을 “실제로 동작”으로 전환**

작업 항목 및 상태:

1. 워크플로 자동 트리거 연결 (record_created/updated/deleted) — **완료(테스트 미실행)**
2. 스키마 마이그레이션 체계 도입 — **완료(테스트 미실행)**
3. 플러그인 저장/검증 기반 — **완료(테스트 미실행)**
4. 스토리지 추상화 — **완료(테스트 미실행)**
5. 모바일/네이티브 경로 초벌 — **부분 구현** (nativeCall + 웹 fallback + 브리지 호스트 스크립트 + RN/Capacitor 호스트 샘플, 패키징/네이티브 플러그인 미구현)
6. 웹훅 트리거 + 시크릿 검증 — **완료(테스트 미실행)**
7. 크론 실행 엔드포인트 — **완료(테스트 미실행)**
8. PWA 기본 구성 — **완료(테스트 미실행)**
9. 호스팅 설정 API — **완료(테스트 미실행)**

---

## 증거 기록 규칙

완료/변경 보고 시 반드시 포함:

1. 변경 파일 목록
2. 테스트 실행 로그(있다면)
3. 한계/부족 사항
4. 재현 방법(있다면)

---

## 전체 로드맵

1. 완료 기준과 테스트 정의 고정
2. 배치 단위 구현 + 증거 수집
3. 미구현 항목 0개 달성까지 반복

---

## 전체 작업 목록 (요약 + 상세)

### 에디터/디자인
- 벡터 편집 고도화(outline/flatten/join/offset)
- 그리드/스냅 UX 개선
- 그라디언트 편집기 강화
- 텍스트 스타일/타이포 고급 기능
- 스타일 토큰/라이브러리 관리
- 컴포넌트 슬롯/속성 시스템
- 컴포넌트 버전/히스토리
- 오버레이/레이아웃 충돌 처리
- 오토레이아웃 wrap/spacing/align 완성
- 반응형 규칙 UI 고도화
- 변형(variants) 고급 편집
- 인터랙션 타임라인/애니메이션 편집
- 조건부 인터랙션 UI
- 상태 디버거/이벤트 추적
- 데이터 바인딩 UI 완성
- API 호출/워크플로 구성 UI
- 권한/역할 UI
- 자산 라이브러리(태그/검색/버전)
- 템플릿 카탈로그/관리
- 히스토리/버전 롤백
- 복잡한 그룹/레이어 조작 도구

### 고급 FE/런타임
- 렌더 성능 최적화(대규모 문서)
- 전역 상태/캐시/데이터 동기화
- 리스트/테이블 가상화
- 에러 UX/복구 흐름
- 접근성(ARIA/키보드)
- i18n/로케일링
- 테마/모드 전환
- 오프라인/캐시 모드
- 미디어(동영상) 컨트롤
- 런타임 성능 메트릭 수집
- SSR/CSR 하이브리드 최적화

### 데이터/BE
- 스키마 마이그레이션 검증/롤백
- 관계형 조인/인덱싱/제약
- 고급 쿼리 빌더
- 트랜잭션/락
- 데이터 검증 규칙
- 서버 사이드 계산/집계
- 데이터 버전/감사 로그
- 백업/복구
- Full-text 검색
- 데이터 캐시 레이어

### 인증/보안
- RBAC/ABAC 완성
- 조직/팀 구조
- SSO(OAuth/SAML)
- MFA/OTP
- 세션 정책/만료
- 비밀번호 정책
- 감사 로그/보안 이벤트
- WAF/보안 필터

### 워크플로/자동화
- 스케줄 트리거 내부화
- 재시도/백오프 정책
- 단계별 실패 처리
- 워크플로 로그/버전
- 조건/루프 최적화
- API 호출 스키마 검증
- 워크플로 권한 분리

### 플러그인/확장
- 플러그인 매니페스트 스펙 확정
- 권한 모델/샌드박스
- 설치/업데이트/제거
- 마켓/스토어
- 플러그인 UI 주입
- SDK 문서/예제
- 버전/호환성 정책

### 외부 연동
- OAuth 커넥터 템플릿
- 커넥터 카탈로그
- API 키 관리 UI
- 데이터 동기화/스케줄링
- 스키마 매핑/검증

### 모바일/하드웨어
- 웹→앱 패키징 경로 확정
- 네이티브 브리지 스펙
- 카메라/갤러리/파일
- 위치/GPS
- BLE/NFC/센서
- 푸시 알림
- 백그라운드 작업
- 앱 스토어 배포 파이프라인

### 배포/운영/인프라
- 원클릭 배포 파이프라인
- 도메인 연결/SSL 발급 자동화
- CDN/캐시 정책
- 스케일링
- 로그/모니터링/알림
- 백업/복구
- 보안 업데이트

### 결제/상거래
- 상품/카탈로그 관리
- 장바구니/주문
- 결제/환불/세금
- 배송/재고
- 쿠폰/프로모션
- 구독/플랜/청구

### 관측/품질
- 성능 메트릭 수집
- 오류/예외 추적
- SLA/가용성
- 사용자 행동 분석
- 보안 이벤트 로그

### 테스트/검증
- 단위/통합/E2E 테스트 체계
- 성능 테스트
- 보안 테스트
- 마이그레이션 테스트

---

## 작업 기록 (2026-02-20)

### 1) 워크플로 자동 트리거 연결
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-workflow.ts`
  - `src/app/api/app/[pageId]/[model]/route.ts`
  - `src/app/api/app/[pageId]/[model]/[id]/route.ts`
- 요약: 레코드 생성/수정/삭제 시 워크플로 실행.

### 2) 스키마 마이그레이션 도입
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-data.ts`
  - `src/app/api/app/[pageId]/schema/route.ts`
- 요약: preserve/prune + rename/delete/defaults 적용.

### 3) 플러그인 저장/검증 API
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-plugins.ts`
  - `src/app/api/app/[pageId]/plugins/route.ts`
  - `src/advanced/ui/AdvancedEditorView.tsx`
- 요약: 플러그인 저장/검증 및 에디터 연동.

### 4) 스토리지 추상화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/storage.ts`
  - `src/app/api/app/[pageId]/upload/route.ts`
- 요약: 로컬 저장 기반 스토리지 추상화 도입.

### 5) nativeCall 액션 + 런타임 브리지
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/doc/scene.ts`
  - `src/advanced/runtime/player.tsx`
  - `src/advanced/ui/AdvancedEditorView.tsx`
- 요약: nativeCall 액션 및 런타임 호출 추가.

### 6) nativeCall 웹 fallback
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/runtime/player.tsx`
- 요약: 웹 환경 기본 명령 fallback 추가.

### 7) 워크플로 웹훅
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-workflow.ts`
  - `src/app/api/app/[pageId]/webhooks/[...path]/route.ts`
- 요약: 웹훅 트리거 엔드포인트 추가.

### 8) 웹훅 시크릿/서명 검증
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/webhooks/[...path]/route.ts`
  - `src/app/api/app/[pageId]/webhooks/secret/route.ts`
- 요약: HMAC 서명 검증 + 시크릿 관리 API.

### 9) 크론 실행 엔드포인트
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/cron/workflows/route.ts`
  - `src/lib/cron.ts`
- 요약: 5필드 크론 매칭 + 실행 엔드포인트 추가.

### 10) PWA 기본 구성
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `public/manifest.json`
  - `public/sw.js`
  - `src/components/sw-register.tsx`
  - `src/app/layout.tsx`
- 요약: 설치 가능한 PWA 기본 구성.

### 11) 호스팅 설정 API
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/hosting/route.ts`
- 요약: 도메인/HTTPS/WWW 설정 저장 API.

### 12) 워크플로 로그 조회 API
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/workflows/logs/route.ts`
- 요약: 워크플로 로그 조회 엔드포인트 추가(소유자 전용, 커서 기반).

### 13) 네이티브 브리지 호스트 스크립트
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `public/native-bridge-host.js`
  - `src/components/native-bridge-host.tsx`
  - `src/app/layout.tsx`
  - `docs/NULL_요구사항_정리.md`
- 요약: 메시지 기반 네이티브 브리지 호스트 스크립트 추가(웹 fallback 포함).

---

## 작업 기록 (2026-02-22)

### 14) React Native WebView 호스트 샘플 (기록 보완)
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `mobile/react-native-host/App.tsx`
  - `mobile/react-native-host/package.json`
  - `mobile/react-native-host/README.md`
- 요약: React Native WebView 기반 호스트 샘플 추가(브리지 메시지 처리).

### 15) Capacitor 호스트 샘플 + 브리지 매핑
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `mobile/capacitor-host/package.json`
  - `mobile/capacitor-host/capacitor.config.ts`
  - `mobile/capacitor-host/www/index.html`
  - `mobile/capacitor-host/README.md`
  - `public/native-bridge-host.js`
- 요약: Capacitor 쉘 샘플 추가 + nativeCall → Capacitor 플러그인 매핑 확장(camera/filesystem/preferences/push/localNotifications/app/browser/statusBar/keyboard).

### 16) 인코딩 깨짐 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/runtime/player.tsx`
  - `src/advanced/ui/AdvancedEditorView.tsx`
  - `src/components/editor-view.tsx`
  - `src/components/work-view.tsx`
  - `src/app/not-found.tsx`
- 요약: 깨진 문자열/주석 정리 및 안전한 문구로 교체.

### 17) nativeCall 프리셋 + Web fallback 보강
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/runtime/native-commands.ts`
  - `src/advanced/ui/AdvancedEditorView.tsx`
  - `src/advanced/runtime/player.tsx`
- 요약: nativeCall 프리셋/예시 인자 UI 추가 + web fallback에 browser/app open, preferences 지원.

### 18) Web fallback 카메라/파일 선택
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `public/native-bridge-host.js`
  - `src/advanced/runtime/player.tsx`
- 요약: web 환경에서 camera.capture/camera.pick 입력 지원(파일 선택 기반).

### 19) Web fallback 파일시스템/알림 보강
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `public/native-bridge-host.js`
  - `src/advanced/runtime/player.tsx`
- 요약: web fallback에 filesystem read/write/delete + local/push 알림 기본 동작 추가.

### 20) PWA offline fallback + 기본 캐시
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `public/sw.js`
  - `public/offline.html`
- 요약: offline 페이지 + 정적/네비게이션 기본 캐시 정책 추가.

### 21) 내부 스케줄러(커스텀 서버) + 크론 실행 분리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/server/cron-scheduler.ts`
  - `src/lib/workflow-scheduler.ts`
  - `src/app/api/cron/workflows/route.ts`
  - `server.ts`
- 요약: 내부 스케줄러 추가 + 크론 실행 로직 분리(커스텀 서버에서 자동 실행 가능).

### 22) 워크플로 api_call 재시도/백오프/타임아웃
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-workflow.ts`
- 요약: api_call 단계에 재시도/백오프/타임아웃 옵션 추가.

### 23) 워크플로 트리거 연결 + 폼 제출 엔드포인트
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/auth/login/route.ts`
  - `src/app/api/app/[pageId]/auth/register/route.ts`
  - `src/app/api/app/[pageId]/forms/[formName]/route.ts`
- 요약: user_registered/user_logged_in 트리거 연결 + form_submitted 엔드포인트 추가.

### 24) 모바일 패키징 설정 API + 호스트 구성 출력
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/mobile-host.ts`
  - `src/app/api/app/[pageId]/mobile/route.ts`
  - `src/app/api/app/[pageId]/mobile/host-config/route.ts`
- 요약: 모바일 패키징 설정 저장/조회 + Capacitor/RN 호스트 구성 JSON 출력.

### 25) 모바일 호스트 설정 파일 + RN 브리지 확장
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `mobile/capacitor-host/host.config.json`
  - `mobile/capacitor-host/capacitor.config.ts`
  - `mobile/capacitor-host/README.md`
  - `mobile/react-native-host/host.config.json`
  - `mobile/react-native-host/App.tsx`
  - `mobile/react-native-host/package.json`
  - `mobile/react-native-host/README.md`
- 요약: 호스트 설정 파일 도입 + RN 호스트 브리지(네트워크/클립보드/설정/URL) 확장.

### 26) 로그인/회원가입 메시지 + 에디터 주석 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/auth/login/route.ts`
  - `src/app/api/app/[pageId]/auth/register/route.ts`
  - `src/components/editor-view.tsx`
- 요약: 깨진 문자열/주석 교체 및 ASCII 문구로 정리.

### 27) E2E 타임아웃 완화(요청 제한/직렬화)
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `playwright.config.ts`
  - `e2e/route-health.spec.ts`
  - `e2e/smoke.spec.ts`
- 요약: E2E 기본 타임아웃 정의 + route-health 직렬 실행 및 요청 타임아웃 추가 + 깨진 테스트명 정리.

### 28) E2E 온보딩 오버레이 차단 제거
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/ui/AdvancedEditorView.tsx`
- 요약: E2E 모드에서 온보딩 오버레이 비활성화 + 문구 ASCII 정리.

### 29) 일일 리포트 로직 분리 + 크론 API 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/daily-reports.ts`
  - `src/app/api/cron/daily-reports/route.ts`
- 요약: 일일 리포트/드롭 알림 로직 분리 및 크론 API를 정리된 로직으로 교체.

### 30) 내부 스케줄러 만료/리포트 실행 추가
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/server/cron-scheduler.ts`
  - `src/lib/expire.ts`
- 요약: 내부 스케줄러가 만료 처리와 일일 리포트 실행을 수행하도록 확장.

### 31) 워크플로 단계 재시도 + 스텝 제한
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-workflow.ts`
- 요약: api_call 외 단계도 고정 지연 재시도 지원 + 실행 스텝 상한(기본 1000) 추가 + 오류 로그에 variables 포함.

### 32) SystemSetting 헬퍼 + 정책 설정
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/system-settings.ts`
  - `src/app/api/pages/[pageId]/report/route.ts`
  - `src/app/api/admin/pages/[pageId]/report/route.ts`
  - `src/app/api/pages/[pageId]/upvote/route.ts`
  - `src/app/api/admin/pages/[pageId]/upvote/route.ts`
  - `src/app/api/pages/[pageId]/witness/route.ts`
- 요약: SystemSetting 기반 boolean/number 설정 도입 + noip fallback 정책 및 witness cap 설정.

### 33) Spikes API DB 버킷 집계 + 설정화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/pages/[pageId]/spikes/route.ts`
  - `src/lib/system-settings.ts`
- 요약: 클릭/이탈 버킷 집계를 DB에서 수행하고 window/bucket/highlight/topK를 SystemSetting으로 제어.

### 34) RN 호스트 네이티브 브리지 확장
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `mobile/react-native-host/App.tsx`
  - `mobile/react-native-host/package.json`
  - `mobile/react-native-host/README.md`
- 요약: 지오로케이션/카메라/파일시스템/상태바/키보드 처리 추가 및 의존성 갱신.

### 35) anon_number 동시성 보호
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/pages.ts`
- 요약: pg_advisory_xact_lock 기반 할당 락 추가로 중복 번호 경쟁 조건 완화.

### 36) 인코딩/문구 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/ghost.ts`
  - `src/lib/daily-reports.ts`
- 요약: 깨진 문자열을 ASCII로 정리.

### 37) themeColor 메타 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/layout.tsx`
- 요약: metadata.themeColor → viewport.themeColor 이동.

### 38) 캔버스 기본 텍스트/라벨 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/canvas.ts`
- 요약: 기본 라벨/placeholder를 ASCII로 교체하고 주석 정리.

### 39) Feed 화면 텍스트 재정의
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/feed.tsx`
- 요약: 깨진 문자열 제거 및 영어 UI 텍스트로 재정의.

### 40) Live 화면 텍스트 재정의
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/live-view.tsx`
- 요약: 깨진 문자열 제거 및 영어 UI 텍스트로 재정의.

### 41) 인코딩 잔여 정리(부분)
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/work-view.tsx`
  - `src/components/editor-view.tsx`
  - `prisma/schema.prisma`
- 요약: U+FFFD 제거 완료. UI 라벨의 의미 복원/재작성은 추가 작업 필요.

### 42) Work/Editor UI 문자열 복원 완료
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/work-view.tsx`
  - `src/components/editor-view.tsx`
- 요약: 깨진 문자열과 라벨을 영어 UI로 복원하고 공유/복사/오류 메시지, 스파이크/리플레이/요약 카드 라벨을 정상화. BOM 제거 및 ASCII 정리.

### 43) 런타임 네트워크 배너 문구 복원
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/runtime/player.tsx`
- 요약: 네트워크 끊김 배너의 손상된 버튼 문구를 정상 텍스트로 복원.

### 44) Settings 화면 문구 복원
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/settings-view.tsx`
- 요약: 설정 화면의 깨진 문구를 영어 UI 텍스트로 복원.

### 45) 런타임 선택/페이징 문자열 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/runtime/player.tsx`
  - `src/advanced/runtime/renderer.tsx`
- 요약: 선택/탭/페이징/쿠키 배너/동의 라벨 매칭의 깨진 문자열을 정상 텍스트로 복원.

### 46) 에셋 프리셋 콘솔 문구 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/advanced/ui/AdvancedEditor.assetLibraryPresets.ts`
- 요약: 콘솔 프리셋의 깨진 문구를 정상 텍스트로 복원.

### 47) 모바일 호스트 패키지 다운로드 + 대시보드 설정 UI
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/zip.ts`
  - `src/lib/mobile-package.ts`
  - `src/app/api/app/[pageId]/mobile/package/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 요약: 모바일 호스트 템플릿을 ZIP으로 내려받는 API 추가(타입: Capacitor/RN) + 대시보드에서 모바일 설정 저장/패키지 다운로드 UI 제공.

### 48) 호스팅 설정 대시보드 UI
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/dashboard-work-view.tsx`
- 요약: 커스텀 도메인/HTTPS/WWW 정책을 저장하는 호스팅 설정 UI 추가(설정 저장은 기존 API 사용).

### 49) 배포/라이브 대시보드 제어
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/dashboard-work-view.tsx`
- 요약: 대시보드에서 라이브 시작(publish) 및 배포/배포 해제(deploy) 버튼 제공.

### 50) App 데이터 검증 규칙
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-data.ts`
  - `src/app/api/app/[pageId]/[model]/route.ts`
  - `src/app/api/app/[pageId]/[model]/[id]/route.ts`
- 요약: App 컬렉션 필드 기반 데이터 타입/필수/범위/패턴/enum 검증 + strict 모드(알 수 없는 필드 차단) 추가.

### 51) Prisma 스키마 수정(CalendarEvent)
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `prisma/schema.prisma`
- 요약: 누락된 `CalendarEvent` 모델 선언을 복구.

### 52) App 시크릿 관리 보강
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/secrets/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 요약: App 시크릿 API에 소유자 인증 추가 + 대시보드 시크릿 관리 UI 추가.

### 53) App 인증/관리 API 메시지 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-auth.ts`
  - `src/app/api/app/[pageId]/auth/me/route.ts`
  - `src/app/api/app/[pageId]/auth/users/route.ts`
- 요약: App 사용자 인증/관리 API의 깨진 메시지를 정리하고 ASCII 메시지로 통일.

### 54) App 컬렉션 strict 저장
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `prisma/schema.prisma`
  - `src/lib/app-data.ts`
- 요약: AppCollection에 strict 플래그 저장을 추가하고 조회에 포함.

### 55) App 첫 사용자 admin 자동 지정
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/lib/app-auth.ts`
- 요약: 특정 페이지에서 첫 AppUser를 자동 admin으로 지정.

### 56) App 사용자 관리 권한 보강
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/auth/users/route.ts`
- 요약: App 사용자 관리 API에 페이지 소유자(anon) 접근을 허용.

### 57) App 사용자 관리 UI
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/dashboard-work-view.tsx`
- 요약: 앱 사용자 목록/권한 변경/삭제 UI 추가.

---

## 작업 기록 (2026-02-23)

### 58) 메인 피드 한국어화 보강
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/feed.tsx`
- 요약: 메인 피드 필터 라벨을 한국어 표현으로 정리.

### 59) Live 화면 한국어화 + 메타 설명 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/live-view.tsx`
  - `src/app/layout.tsx`
- 요약: Live 화면의 UI/토스트/버튼 문구를 한국어로 전환하고 메타 설명을 한국어로 정리.

---

### 60) 리플레이 하이라이트 설정화 + 라벨 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/pages/[pageId]/replay/route.ts`
- 요약: 리플레이 하이라이트 윈도우/상위 개수 설정을 SystemSetting으로 제어하고 라벨/문구를 한국어로 정리.

---

### 61) 작품 상세(Work) 리플레이 문구 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/work-view.tsx`
- 요약: 리플레이 CTA/설명 문구를 한국어로 정리.

---

### 62) 작품 상세(Work) UI 전반 한국어화 + 리플레이 플레이어 라벨 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/work-view.tsx`
  - `src/components/replay-player.tsx`
- 요약: Work 화면의 오류/버튼/라벨/요약/스파이크 문구를 한국어로 정리하고 리플레이 플레이어 필터 라벨을 한국어로 정리.

---

### 63) 시스템 설정(Admin) 확장
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/admin/settings/route.ts`
- 요약: 리플레이/스파이크/보안 관련 SystemSetting 키를 관리자 설정 API에서 저장 가능하도록 확장.

---

### 64) 관리자 콘솔 설정 UI 확장
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/admin-console.tsx`
- 요약: SystemSetting 확장 항목(리플레이/스파이크/보안/위트니스)을 관리자 콘솔에서 편집할 수 있도록 UI를 추가.

---

### 65) 설정 화면 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/settings-view.tsx`
- 요약: 설정 화면의 주요 문구/버튼을 한국어로 정리.

---

### 66) 계정 화면 기본 라벨 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/account-view.tsx`
- 요약: 계정 화면의 기본 라벨(익명 ID/플랜) 문구를 한국어로 정리.

---

### 67) 추천(Upvote) API 오류 문구 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/pages/[pageId]/upvote/route.ts`
- 요약: 추천 API의 인증/IP/차단 오류 메시지를 한국어로 정리.

---

### 68) 신고(Report) API 오류 문구 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/pages/[pageId]/report/route.ts`
- 요약: 신고 API의 인증/IP/차단 오류 메시지를 한국어로 정리.

---

### 69) App 인증 API 오류 문구 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/auth/login/route.ts`
  - `src/app/api/app/[pageId]/auth/register/route.ts`
- 요약: App 로그인/회원가입 API의 기본 오류 메시지를 한국어로 정리.

---

### 70) App 프로필/비밀번호 API 오류 문구 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/auth/me/route.ts`
- 요약: App 사용자 프로필/비밀번호 변경 API의 인증/요청 오류 메시지를 한국어로 정리.

---

### 71) App 사용자 관리 API 오류 문구 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/auth/users/route.ts`
- 요약: App 사용자 목록/권한/삭제 API의 권한/필수값 오류 메시지를 한국어로 정리.

---

### 72) 관리자 콘솔 헤더 라벨 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/admin-console.tsx`
- 요약: 관리자 콘솔 상단 헤더 라벨을 한국어로 정리.

---

### 73) 대시보드 워크 뷰 잔여 라벨 한국어화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/dashboard-work-view.tsx`
- 요약: OS 라벨/Discord 웹훅 입력 설명/앱 시크릿 키·값/앱 사용자 이메일 기본 표기/모바일 상태바 옵션 표시를 한국어로 정리.

---

### 74) API 오류/검증 메시지 한국어화 보강
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
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
- 요약: 필수 입력/검증 실패 메시지와 익명 세션/IP 차단 오류 문구를 한국어로 정리하고, Discord 웹훅 표기를 일관화.

---

### 75) 앱 API 오류 메시지 한국어화 보강 (프록시/워크플로/웹훅/피그마)
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/proxy/route.ts`
  - `src/app/api/app/[pageId]/workflows/route.ts`
  - `src/app/api/app/[pageId]/webhooks/[...path]/route.ts`
  - `src/app/api/pages/[pageId]/figma/import/route.ts`
- 요약: 앱 프록시·워크플로·웹훅 에러 메시지 한국어화, 피그마 import 미상 오류 문구 한국어화.

---

### 76) 리플레이 MP4 안내 문구 정리
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/replay-view.tsx`
- 요약: MP4 내보내기 TODO 표기를 제거하고 미지원 상태를 명시.

---

### 77) 호스팅 도메인 인증(DNS TXT) 추가
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/hosting/route.ts`
  - `src/app/api/app/[pageId]/hosting/verify/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 요약: DNS TXT 기반 도메인 인증 발급/검증 API와 대시보드 UI를 추가.

---

### 78) 네이티브 브리지 기능 목록 제공
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `public/native-bridge-host.js`
- 요약: `capabilities.list`/`capabilities.version` 지원으로 브리지 기능 목록을 확인 가능.

---

## 테스트 기록 (2026-02-22)

1. `npm test` (vitest)
2. 결과: 11 파일, 53 테스트 **통과**
3. 비고: unit 테스트만 실행됨

1. `npm run test:e2e` (playwright)
2. 사전 조건: 로컬 서버 `PORT=3100` 실행, `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3100`
3. 결과: **타임아웃(10분)**, 상세 로그 없음
4. 비고: 실행 중 hang/대기 상태로 보이며 원인 추가 조사 필요

1. `npm run test:e2e` (playwright, 개선 반영 후 재실행)
2. 결과: **123 passed, 20 skipped, 0 failed (2.5m)**  
3. 비고: route-health 직렬화 + E2E 온보딩 비활성화로 UI 차단 제거

---

## 추가 원칙 (확정 발언 금지)

- “완료/가능”은 **증거가 있을 때만** 선언한다.
- 증거가 없으면 **미구현/불확실**로 기록한다.

### 79) 호스팅 도메인 레지스트리 + 서버 라우팅/리디렉션
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `prisma/schema.prisma`
  - `src/server/domain-router.ts`
  - `server.ts`
- 요약: PageDomain 모델 도입, 커스텀 도메인 요청을 `/p/{pageId}`로 리라이트하고 HTTPS/WWW 리디렉션을 적용.

### 80) 호스팅 도메인 상태 점검 API + 대시보드 UI
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/hosting/status/route.ts`
  - `src/components/dashboard-work-view.tsx`
- 요약: DNS(A/AAAA/CNAME/TXT) 및 SSL 상태 점검 API 추가, 대시보드에서 상태 확인 UI 제공.

### 81) 호스팅 설정/인증과 PageDomain 동기화
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/app/[pageId]/hosting/route.ts`
  - `src/app/api/app/[pageId]/hosting/verify/route.ts`
  - `src/lib/hosting-domain.ts`
- 요약: 커스텀 도메인 중복 방지, 도메인 변경 시 인증 초기화, 검증 결과를 PageDomain에 반영.

### 82) 공개 페이지 메타/리플레이 라벨 문구 복원
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/p/[pageId]/page.tsx`
  - `src/app/api/pages/[pageId]/replay/route.ts`
- 요약: 공개 페이지 메타/로딩 문구 및 리플레이 하이라이트 라벨을 한국어로 정상화.

### 83) 백업/복구에 커스텀 도메인 포함
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/pages/[pageId]/backup/route.ts`
- 요약: PageDomain을 백업/복구에 포함하고, 복구 시 도메인 충돌을 검사.

### 84) 운영 헬스/메트릭/로그 API 추가
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/app/api/ops/health/route.ts`
  - `src/app/api/ops/metrics/route.ts`
  - `src/app/api/ops/logs/route.ts`
  - `src/lib/system-log.ts`
  - `server.ts`
- 요약: 관리자 세션 기반 운영 헬스/메트릭/로그 조회 API 추가, 서버 시작/오류 로깅 파일 기록 도입.

### 85) 기본 에디터 디자인 확장 (요소 타입/속성/폼 바인딩/액션)
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/editor-fields.tsx`
  - `src/components/editor-view.tsx`
  - `src/components/canvas-render.tsx`
  - `src/components/work-view.tsx`
  - `src/lib/canvas.ts`
- 요약: 기본 에디터에 frame/link/shape/line/path/form 요소 추가 + 인스펙터 속성 편집 확장, 이미지 fit/경로 points 파싱, 폼 바인딩 런타임 상태 연결, 버튼/링크 액션 런타임 실행 지원.

---

## 작업 기록 (2026-02-26)

### 86) 에디터 디자인 고급 컨트롤 확장
- 상태: 코드 변경됨, 테스트 미실행
- 변경 파일:
  - `src/components/editor-view.tsx`
  - `src/components/canvas-render.tsx`
  - `src/lib/canvas.ts`
- 요약: 캔버스 정렬/크기 맞춤 도구 추가, 타이포그래피/테두리/효과(그림자/블러/블렌드) 속성 확장, line/path 스타일 옵션과 렌더 적용, 입력/링크/배지 스타일 편집 강화.
