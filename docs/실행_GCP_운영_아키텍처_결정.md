# 실행: GCP 운영 아키텍처 결정

목표: 실시간(Socket.IO) 안정성을 확보하면서 비용을 최소화한다.

## 결정 요약
- **런타임**: GCP **Compute Engine VM** (실시간 WebSocket 안정성 최우선)
- **DB**: **Cloud SQL for PostgreSQL** (운영 안정성 확보)
- **Redis**: **VM 내 Redis 컨테이너**(비용 최소화)  
  - 추후 트래픽 증가 시 Memorystore로 이관 가능
- **배포 방식**: Docker Compose 기반 단일 VM 실행

## 구성
- VM에서 `server.ts` 기반 Node 서버 실행
- DB는 Cloud SQL 연결(`DATABASE_URL` 사용)
- Redis는 VM 내부에서 실행(`REDIS_URL` 사용)
- Cron은 **GCP Scheduler** 또는 **VM cron**으로 호출

## 필수 환경 변수(운영)
- `DATABASE_URL` (필수)
- `RUN_MODE=prod` (필수)
- `NODE_ENV=production` (권장)
- `PORT` (필수)
- `ADMIN_SECRET_SLUG` (필수)
- `ADMIN_KEY` (필수)
- `IP_HASH_SALT` (필수)
- `ADMIN_SESSION_SALT` (필수)
- `NEXT_PUBLIC_APP_URL` 또는 `APP_URL` (권장)
- `REDIS_URL` (권장)
- `CRON_SECRET` (권장: cron 보호용)

## 운영 전 확인
- `npm run build` 후 `npm run start`로 실행되는지 확인
- `GET /api/health` 정상 응답 확인
- Socket.IO 연결이 끊기지 않는지 확인

## Cron 호출(권장)
- `GET /api/cron/expire`
- `GET /api/cron/daily-reports` (Bearer `CRON_SECRET`)

## 비용/안정성 메모
- 가장 저렴한 VM 스펙으로 시작하고, CPU/메모리 부족 시만 상향
- Redis는 초기에는 로컬로 운용하여 비용 절감
- DB는 Cloud SQL로 운영 리스크 최소화
