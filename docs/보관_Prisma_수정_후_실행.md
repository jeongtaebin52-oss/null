# Prisma 스키마 수정 후

스키마 변경(필드 추가 등) 후 **저장 실패**·`Unknown argument` 오류가 나면:

1. **개발 서버 중지** (Next.js 등이 `query_engine-windows.dll`을 잠그고 있음)
2. 터미널에서 실행:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
3. 개발 서버 다시 시작

`discord_webhook_url` 필드는 마이그레이션 `20260207000000_discord_webhook`에 포함되어 있습니다.
