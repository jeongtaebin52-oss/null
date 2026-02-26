# NULL

Figma·Wix 초 상위호환 에디터 + 라이브·잔상·피드·리플레이.

## Stack
- Next.js App Router (TypeScript)
- Tailwind CSS
- PostgreSQL + Prisma
- Socket.IO (realtime, 같은 Node 프로세스에서 지속 연결)
- Redis (선택, Event 쓰기 버퍼; 없으면 PG 직격)

## 로컬 실행 요약
1. `npm install`
2. `.env.example`을 복사해 `.env` 생성 후 `DATABASE_URL` 등 설정
3. `docker compose up -d db` (필요 시 `redis` 추가)
4. `npm run prisma:generate` → `npm run db:migrate` → `npm run db:seed`
5. `npm run dev`

## Local setup (상세)
1) Install dependencies
```
npm install
```

2) Create env file
```
copy .env.example .env
```
필수: `DATABASE_URL`. 권장: `REDIS_URL`, `CRON_SECRET`, `ADMIN_SECRET_SLUG`, `IP_HASH_SALT`, `ADMIN_SESSION_SALT`. `.env.example` 참고.

3) PostgreSQL (+ Redis optional)
```
docker compose up -d db redis
```
또는 DB만: `docker compose up -d db` 후 `.env`에서 `REDIS_URL` 비워두면 Event는 PG 직격.

4) Generate Prisma client
```
npm run prisma:generate
```

5) Run migrations
```
npm run db:migrate
```

6) Seed baseline data
```
npm run db:seed
```

7) Run dev server
```
npm run dev
```
또는 `npm run start` (NODE_ENV=production으로 실행, RUN_MODE가 .env에 없으면 prod로 동작 시 **먼저 `next build` 필요**).

**문제 해결**
- `Failed to open database` / `Loading persistence directory failed` / `액세스가 거부되었습니다`: `next.config.ts`에 `turbopackFileSystemCacheForDev: false` 적용됨. 그래도 발생 시 서버 종료 후 `.next` 폴더 삭제 후 재시작.
- `.next` 삭제 시 "액세스 거부": **서버와 Cursor(또는 VS Code)를 완전히 종료**한 뒤, 새 터미널에서 `npm run clean` 또는 `rmdir /s /q .next`. 그래도 안 되면 Cursor를 끈 상태에서 관리자 명령 프롬프트로 `cd` 후 `rmdir /s /q .next` 실행.

## Step 5-1 acceptance criteria (UI)
- 홈/피드: 신규/인기/시간순 탭, LIVE 점 + 남은 시간, 카드 UI.
- 작품 보기: 캔버스 렌더 + ghost overlay + 라이브 클릭 + 요약 카드.
- 편집기: 3패널, Drag/Resize, Grid Snap, Undo/Redo. (버튼/텍스트/이미지 개수 제한 없음.)
- 내 라이브러리: 현재 LIVE + drafts/history + 재게시/편집.

## Step 5-2 acceptance criteria (plan & replay)
- Free: 라이브만 가능, 리플레이 접근 시 업그레이드 안내.
- Pro 이상: 24h 이벤트 조회/재생 가능.
- 저장 이벤트: enter/leave/click/move(샘플링), 텍스트 입력값 없음.

## Key routes
- / : 피드
- /p/:id : 작품 보기
- /editor : 편집기
- /library : 내 라이브러리
- /replay/:id : 리플레이
- /upgrade : 플랜 업그레이드

## 환경 변수 (요약)
- `DATABASE_URL`: PostgreSQL 연결 문자열 (필수)
- `REDIS_URL`: Redis 연결 문자열. **없으면** Event(enter/move/click/leave)는 PG 직격 저장. 있으면 Redis → 배치 동기화 → PG.
- `ADMIN_SECRET_SLUG`: 어드민 UI 숨김 슬러그 (`/ops/[slug]`)
- `CRON_SECRET`: 24h 만료 Cron(`/api/cron/expire`) 호출 시 `Authorization: Bearer <CRON_SECRET>` 인증용
- 그 외: `.env.example` 참고 (Admin, Billing, IP_HASH_SALT 등)

## 배포 (GCP / AWS)
- **실행 방식**: Node 커스텀 서버(`server.ts`)가 Next + Socket.IO를 한 프로세스에서 제공. **Socket은 같은 서버에서 지속 연결**되므로, 단일 인스턴스 또는 스티키 세션 없이 단일 Node 프로세스로 배포하면 됨.
- **Docker**: `Dockerfile`로 빌드 후 `docker run` 또는 `docker compose up app`. `RUN_MODE=prod`, `next build` 선행 필요.
- **docker-compose (전체 로컬/테스트)**:
  - `docker compose up -d` → db, redis, app 모두 기동. app은 `DATABASE_URL=...@db:5432/...`, `REDIS_URL=redis://redis:6379` 사용.
- **GCP/AWS**: DB·Redis는 매니지드 서비스(Cloud SQL / RDS, Memorystore / ElastiCache) 사용 권장. 앱은 Compute Engine / ECS 등에서 `npm run start` 또는 컨테이너로 실행. 환경 변수 `DATABASE_URL`, `REDIS_URL`(선택), `ADMIN_SECRET_SLUG`, `CRON_SECRET` 등 설정.
- **vercel.json**: Cron 스케줄 참고용. 프로덕션 배포는 GCP/AWS 등에서 Node 서버로 실행하는 것을 권장(Vercel은 서버리스로 Socket 지속 연결 유지 불가).

## Cron & 자동화
- **24h 만료**: `GET /api/cron/expire` — 라이브 만료(24h 초과) 페이지를 비공개 처리. `vercel.json`에서 매시 정각(`0 * * * *`) 호출

## Rate limiting
- **익명 초기화**: `POST /api/anon/init` — IP당 분당 20회 제한. 초과 시 429

## API quickstart
1) Draft create
```
POST /api/pages
{ "title": "My Page", "content": { "nodes": [] } }
```

2) Publish
```
POST /api/pages/:id/publish
```

3) Replay (Pro+)
```
GET /api/pages/:id/replay
```

## Acceptance criteria (Step 1)
- `npm install` -> `npm run db:migrate` -> `npm run db:seed` completes.
- Seed creates Free/Standard/Pro/Enterprise plan rows.
- Seed creates a sample anon user (anon_seed_1).

## TODO(정책확정 필요)
- Plan limits/pricing values.
- Admin bootstrap flow for AdminUser.
- Publish conflict policy (expire existing live vs reject).
- Stripe 테스트 모드 연동.
- 외부 이미지 allowlist.
- mp4 내보내기.
