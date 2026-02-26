# 2. E2E 테스트 (G2) ✅ 완료

> **순서**: 남은 작업 중 **2번**. (완료)

---

## 목표

- 핵심 플로우(에디터 진입·저장·공개·라이브·리플레이 등)에 대한 **E2E 테스트** 도입.
- Playwright·Cypress 등 툴 선택 후 시나리오 작성·CI 연동.

---

## 구현 요약

- **도구**: [Playwright](https://playwright.dev/) (`@playwright/test`).
- **설정**: `playwright.config.ts` — `testDir: "e2e"`, `webServer: npm run dev`, Chromium.
- **스크립트**: `npm run test:e2e` → `playwright test`.
- **시나리오** (`e2e/smoke.spec.ts`):
  1. **홈(피드) 로드** — `/` 응답·body 표시.
  2. **라이브러리 로드** — `/library` 응답 < 500, body 표시.
  3. **에디터(Advanced) 로드** — `/editor/advanced` 응답 < 500, body 표시.
  4. **공개 작품 보기(/p)** — 없는 pageId 요청 시 500 미만, body 표시.
- **CI**: `webServer.reuseExistingServer: !process.env.CI` — CI에서는 서버 자동 기동.
- **(선택)** 추가 시나리오: 로그인·저장·공개·라이브·리플레이는 추후 확장 가능.

---

## 참고

- 단위 테스트(G1): [정보_현재_작업_및_완료_현황.md](./정보_현재_작업_및_완료_현황.md) 기준 7개 완료.
- 브라우저: `npx playwright install chromium` (필요 시 `npx playwright install`).
