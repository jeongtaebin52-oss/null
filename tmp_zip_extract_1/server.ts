import http from "http";
import next from "next";
import { loadEnvConfig } from "@next/env";
import { parse } from "url";
import { initSocket } from "./src/server/socket";
import { startEventSyncToPg } from "./src/server/eventSync";
import { prisma } from "./src/lib/db";

/**
 * NOTE:
 * - Next는 dev=false(=production)일 때 `.next` production build를 요구합니다.
 * - 현재 환경에서 NODE_ENV가 의도치 않게 "production"으로 잡히면,
 *   `next({ dev:false })`가 되어 "production-start-no-build-id" 에러가 발생합니다.
 *
 * 따라서 v1에서는 "RUN_MODE"로 실행 모드를 명시할 수 있게 하고,
 * NODE_ENV는 보조로만 사용합니다.
 *
 * RUN_MODE:
 * - "dev" (default): 개발 모드. `.next` 빌드 없이 실행 가능
 * - "prod": 프로덕션 모드. 반드시 `next build` 선행 필요
 *
 * TODO(정책확정 필요): 배포/운영 표준에 맞춰 RUN_MODE 제거 여부 결정
 */

type RunMode = "dev" | "prod";

loadEnvConfig(process.cwd());

function resolveRunMode(): RunMode {
  const rm = (process.env.RUN_MODE ?? "").toLowerCase();
  if (rm === "prod" || rm === "production") return "prod";
  if (rm === "dev" || rm === "development") return "dev";

  // fallback: NODE_ENV 기준
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  if (nodeEnv === "production") return "prod";
  return "dev";
}

const runMode = resolveRunMode();
const dev = runMode === "dev";

const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  // Helpful startup logs (won't affect product UX)
  console.log(`[server] RUN_MODE=${process.env.RUN_MODE ?? "(unset)"} -> ${runMode}`);
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV ?? "(unset)"} dev=${dev}`);
  console.log(`[server] bind http://${hostname}:${port}`);

  await app.prepare();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  initSocket(server);
  startEventSyncToPg(prisma);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
