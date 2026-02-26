# NULL 프로젝트 — 해야 할 것 전체 정리 & 전체 완성도

> 전체 폴더·파일 분석 후 정리. (분석일 기준)

---

## 1. 폴더·파일 전체 목록 (빠짐없이)

### 루트
- `.gitignore`
- `docker-compose.yml`, `Dockerfile`
- `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`
- `package.json`, `package-lock.json`
- `README.md`, `server.ts`
- `vercel.json`
- `docs/PROJECT.md`, `docs/TODO_AND_COMPLETION.md` (본 문서)
- `FULL_OUTPUT_STEP3.txt`, `FULL_OUTPUT.txt`, `따라서`, `참고` (참고용 텍스트)
- `public/`: file.svg, globe.svg, next.svg, vercel.svg, window.svg

### prisma
- `schema.prisma` — User, Plan, Page, PageVersion, LiveSession, Event, GhostTrace, Upvote, Report, DataCollection, DataEntry, AdminUser, AdminSession, IpBlock, SystemSetting
- `seed.ts`
- `migrations/` — 0001_init, 0002_step7_abuse_admin, jw, null, data_collections, nulldb

### src/app
- `layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico`
- `account/page.tsx`
- `editor/page.tsx`, `editor/advanced/page.tsx`
- `library/page.tsx`
- `live/[pageId]/page.tsx`
- `ops/[slug]/page.tsx`, `ops/[slug]/actions.ts` — 어드민 (ADMIN_SECRET_SLUG 검증)
- `p/[pageId]/page.tsx` — 작품 보기
- `replay/[pageId]/page.tsx`
- `upgrade/page.tsx`
- `api/` (아래)

### src/app/api
- `admin/[reportId]/handle/route.ts`, `admin/ip-blocks/route.ts`, `admin/pages/[pageId]/force-expire|hide|report|upvote/route.ts`, `admin/pages/live/route.ts`, `admin/reports/route.ts`
- `anon/init/route.ts` — Rate limit 적용됨
- `auth/login|logout|signup/route.ts`
- `billing/upgrade/route.ts`, `billing/webhook/route.ts`
- `cron/expire/route.ts` — 24h 만료 Cron
- `data/collections/route.ts`, `data/collections/[collectionId]/route.ts`, `data/collections/[collectionId]/entries/route.ts`, `data/collections/[collectionId]/entries/[entryId]/route.ts`
- `feed/route.ts` — 신규/인기/시간순 (인기 공식 TODO)
- `library/route.ts`
- `me/route.ts`
- `pages/route.ts`, `pages/[pageId]/route.ts`, `pages/[pageId]/ghost|publish|replay|report|version|witness|spikes|upvote/route.ts`
- `publish/route.ts`

### src/components
- `account-view.tsx`, `admin-console.tsx`, `anon-init.tsx`, `canvas-render.tsx`, `countdown.tsx`
- `editor-view.tsx` — 심플 에디터
- `feed.tsx`, `library-view.tsx`, `live-overlays.tsx`, `live-view.tsx`, `page-actions.tsx`
- `replay-player.tsx`, `replay-view.tsx`, `upgrade-view.tsx`, `work-view.tsx`

### src/lib
- `admin-session.ts`, `admin.ts`, `anon.ts`, `auth.ts`, `billing.ts`, `canvas.ts`, `data-collections.ts`, `db.ts`, `expire.ts`, `ghost-utils.ts`, `ghost.ts`, `pages.ts`, `plan.ts`, `policy.ts`, `rate-limit.ts`, `request.ts`

### src/server
- `liveState.ts`, `socket.ts` — Socket.IO, Event PG 직접 INSERT, GhostTrace 저장

### src/advanced
- `doc/scene.ts`, `doc/scene.layout.patch.ts`
- `geom/geom.ts`
- `history/history.ts`
- `layout/engine.ts`, `layout/layout.ts`
- `runtime/bounds.ts`, `runtime/player.tsx`, `runtime/renderer.tsx`
- `ui/AdvancedEditor.tsx`, `AdvancedEditor.constants.ts`, `AdvancedEditor.layout.tsx`, `AdvancedEditor.nodes.ts`, `AdvancedEditor.presets.ts`, `AdvancedEditor.types.ts`, `AdvancedEditor.utils.ts`

### tests
- `policy.test.ts` (2 tests)

---

## 2. 해야 할 것 전체 정리 (우선순위·영역별)

### A. 서버·데이터 생존 (최우선)
| # | 항목 | 관련 파일/범위 | 비고 |
|---|------|----------------|------|
| A1 | Event + Redis 도입 | `src/lib/redis.ts`(신규), `src/server/socket.ts`, (선택) replay/route, library 등 | 고빈도 Event를 PG 직격 대신 Redis 버퍼 후 배치/동기화 |
| A2 | DataCollection·DataEntry 제거 | `prisma/schema.prisma`, `src/app/api/data/` 전부, `AdvancedEditor.tsx`·types·renderer 내 DataCollection 관련 | NULL 정체성과 무관 CMS 제거 |
| A3 | GhostTrace 정규화 | `prisma/schema.prisma`, `src/lib/ghost.ts`, ghost-utils | trace_json 덩어리 → DB 쿼리 가능 구조, 포맷 내 판단 |

### B. 어드밴스드 에디터 — 렌더링·성능 (figmaraw + 수정 예정 리스트)
| # | 항목 | 관련 파일/범위 | 비고 |
|---|------|----------------|------|
| B1 | 가상화(뷰포트 컬링) | `AdvancedEditor.tsx`, (선택) `runtime/renderer.tsx` | ViewportObserver, 겹치는 노드만 렌더 |
| B2 | LOD (줌 임계값 이하 단순화) | `AdvancedEditor.tsx`, renderer | scale ≤ 임계값 시 박스/저해상도 |
| B3 | 레이어 합성 | AdvancedEditor SVG 구조 | 배경·그리드·노드·오버레이 분리, will-change |
| B4 | React.memo + 커스텀 비교 | AdvancedEditor 노드 렌더 부분 | x,y,w,h,selected 비교, 스킵 |
| B5 | 드래그 시 ref 기반 좌표 | AdvancedEditor `updateDrag`·`beginMove` | useRef/직접 DOM, mouseUp에만 상태 반영 |
| B6 | 이벤트 위임 | AdvancedEditor 캔버스·노드 | 단일 리스너, e.target으로 노드 판별 |
| B7 | 위치 스타일: left/top → transform | `buildDevCss` 등 | Dev CSS 출력도 transform 기반(GPU)·일관성 |
| B8 | 비동기 텍스트 | AdvancedEditor·renderer 텍스트 렌더 | requestIdleCallback 또는 비편집 시 스냅샷 |

### C. 어드밴스드 에디터 — 기능 갭 (figmaraw 기준)
| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| C1 | 툴바/도구 | 부분 | 선택·이동·프레임·섹션·슬라이스·도형·이미지·텍스트·핸드 있음. 펜/벡터 패스·리소스 패널·댓글 도구는 부족/없음 |
| C2 | 레이어 조작 | 부분 | 선택·순서·그룹·잠금·숨김 있음. Deep select, Select all/none/invert, Tidy up, 레이어 검색 부족 |
| C3 | 속성 패널 | 부분 | 기하·Fill/Stroke/Effects·불투명·블렌딩 있음. 스타일 per-side 등 세부 부족 |
| C4 | Constraints & Resizing | 있음 | layout/engine, constraints 반응형. Hug/Fill/Fixed 결합은 보강 여지 |
| C5 | Auto Layout | 있음 | layout/engine, Shift+A. stroke inclusion, baseline 등 고급 옵션 부족 |
| C6 | Text Details | 부분 | 폰트·웨이트·크기·행간·자간·정렬 있음. 줄바꿈/폰트 폴백/커닝 엔진 레벨 부족 |
| C7 | Vector Advanced | 거의 없음 | 노드 편집·Boolean·Flatten·Outline stroke·Mask/Clip 우선순위 미구현 |
| C8 | Image/Video Adjust | 부분 | Fit류 있음. Crop·마스크 결합·기본 조정 부족 |
| C9 | Components Basic | 있음 | Create/Instance/Detach, overrides. Swap/Push overrides UX 부족 |
| C10 | Components Advanced | 부족 | Variants·Component Properties·Nested instances·Interactive components 미구현 |
| C11 | Styles & Libraries | 부족 | 스타일 관리·팀 라이브러리·토큰 체계 미구현 |
| C12 | Variables | 부분 | Local Variables 타입 있음. Modes·프로토타입 연결 부족 |
| C13 | Prototype Tab | 부분 | Flow·Trigger/Action·변수/조건 있음. Smart animate 등 부족 |
| C14 | View Tools | 부분 | 줌·핏·그리드·룰러 있음. 레이아웃 그리드·아웃라인·픽셀 그리드·스페이스 패닝 부족 |
| C15 | Hidden Math & Input | 부분 | 비율 고정(Shift)·일부 리사이즈 있음. 수식 입력·멀티 패딩·Alt 중심 리사이즈 부족 |
| C16 | Export | 부분 | 내보내기 유무 코드 확인 필요. PNG/JPG/SVG/PDF·배율·contents only 등 |
| C17 | Dev Mode | 부족 | 측정/스펙/자산 추출·Ready for dev 플로우 미구현 |
| C18 | Pages/Sections/Organization | 부분 | 페이지 탭 있음. 정리·검색·템플릿성 문서 구조 부족 |
| C19 | Version History / Branching | 미구현 | 히스토리/복구는 Undo 등 일부. 브랜치 없음 |
| C20 | Plugins/Widgets | 미구현 | 플러그인/위젯 런타임 없음 |

### D. 피드·정책·운영
| # | 항목 | 관련 파일/범위 | 비고 |
|---|------|----------------|------|
| D1 | 인기 정렬 공식 | `src/app/api/feed/route.ts` | PROJECT.md 행동 기반 수식(체류·CTR·이탈·시간 감쇠·어뷰징) 적용 |
| D2 | 1인 1공개 강제 | publish route·policy | 코드에 이미 기존 live 만료 후 publish 있음. 정책 명확화만 필요 시 |

### E. 실시간·클라이언트
| # | 항목 | 관련 파일/범위 | 비고 |
|---|------|----------------|------|
| E1 | move 샘플링 Hz | `src/server/socket.ts`(80ms), `live-view.tsx`(60ms) | 문서 10~15Hz(66~100ms)에 맞춰 서버·클라이언트 통일·베스트 값으로 조정 |
| E2 | GhostTrace 클라이언트 전송 | live-view·socket | 1~3초 배치·압축 전송 검토(현재 60ms 쓰로틀만) |

### F. 인프라·배포
| # | 항목 | 관련 파일/범위 | 비고 |
|---|------|----------------|------|
| F1 | GCP 또는 AWS 배포 | Dockerfile·docker-compose·배포 스크립트·env | Vercel 대신 GCP/AWS용 구성·문서 |
| F2 | Socket.io 지속 연결 | server.ts·배포 방식 | GCP/AWS에서는 Node 서버 유지 또는 Pusher/Ably 등 대체 검토 |
| F3 | Redis 인프라 | 환경 변수·연결 모듈 | REDIS_URL 등, 없으면 no-op 또는 로컬 Redis 옵션 |

### G. 테스트·품질
| # | 항목 | 관련 파일/범위 | 비고 |
|---|------|----------------|------|
| G1 | 단위 테스트 확대 | `tests/` | cron/expire·rate-limit·핵심 policy·ghost·expire 등 |
| G2 | (선택) E2E | - | 시간 되면 |

### H. 기타
| # | 항목 | 비고 |
|---|------|------|
| H1 | 심플 에디터 | 건드리지 않음 |
| H2 | 어드밴스드 제약 | 제약 없음(버튼/텍스트 개수 제한 제거) |
| H3 | 정체성 변경 | 하지 않음. 필요 시 사용자에게 말하고 허락 후에만 |

---

## 3. 영역별 완성도 (추정 %)

| 영역 | 완성도 | 설명 |
|------|--------|------|
| **DB·Prisma** | 78% | 스키마·마이그레이션·시드 완비. Event 직격·GhostTrace 구조·DataCollection 제거 미반영 |
| **API 라우트** | 82% | feed·library·pages·publish·ghost·replay·witness·admin·auth·billing·cron·anon 대부분 구현. 인기 공식·일부 정책 TODO |
| **실시간·Socket** | 72% | Socket.IO·liveState·enter/leave/click/move·GhostTrace 저장 동작. Redis 없음·Event PG 부하·move Hz 정리 필요 |
| **피드·라이브러리·작품보기·리플레이 UI** | 85% | feed·library-view·work-view·live-view·replay-view·countdown·live-overlays 등 구현. 세부 UX·리플레이 고도화 여지 |
| **어드밴스드 에디터** | 48% | 툴·레이어·속성·제약·Auto Layout·컴포넌트/인스턴스·프로토타입·Variables 등 골격 있음. 가상화·LOD·memo·이벤트 위임·ref 드래그 없음. figmaraw 기준 Vector 고급·Dev Mode·Styles·Variants·Export·문서 구조 등 부족 |
| **런타임 렌더러** | 62% | renderer·player·bounds·DataCollectionView. 가상화·LOD 없음 |
| **인프라·배포** | 58% | Dockerfile·docker-compose·vercel.json 있음. GCP/AWS·Redis·Socket 배포 방식 미정리 |
| **테스트** | 28% | policy.test.ts 2개. cron·rate-limit·ghost·expire 등 미포함 |
| **문서** | 88% | README·PROJECT.md·본 문서. API 명세·운영 Runbook 등은 선택 |

---

## 4. 전체 완성도 (추정)

**전체 완성도: 58%**

- 핵심 플로우(피드·작품 보기·라이브·편집·게시·24h 만료·리플레이·관리자)는 구현되어 있음.
- 완성도를 낮추는 요인:
  - 어드밴스드 에디터의 **성능·최적화**(가상화·memo·ref 드래그·이벤트 위임 등) 미적용
  - **figmaraw** 기준 기능 갭(벡터 고급·Dev Mode·스타일/라이브러리·Variants 등)
  - **서버·데이터** 측면(Event 직격·Redis·GhostTrace 정규화·DataCollection 제거)
  - **인프라**(GCP/AWS·Redis·Socket 배포 정리)
  - **테스트** 커버리지 부족

---

## 5. 진행 순서 제안

1. **A1** Event + Redis (서버 생존)
2. **A2** DataCollection 제거 (정체성·범위 정리)
3. **A3** GhostTrace 정규화
4. **B1~B8** 어드밴스드 렌더링·성능 (가상화·memo·ref 드래그·이벤트 위임·LOD·레이어·transform·비동기 텍스트)
5. **D1** 인기 정렬 공식
6. **E1·E2** move Hz·Ghost 전송 정리
7. **F1~F3** GCP/AWS·Socket·Redis 인프라
8. **C1~C20** figmaraw 갭 (우선순위 높은 것부터: Export·View·Vector·Dev Mode·Styles·Variants 등)
9. **G1** 단위 테스트 확대

이 문서는 분석 시점 기준이며, 진행에 따라 수정·갱신한다.
