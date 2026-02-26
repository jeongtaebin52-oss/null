import { prisma } from "@/lib/db";

const DEFAULT_LIVE_HOURS = 24;

export function computeLiveExpiry(now: Date, hours = DEFAULT_LIVE_HOURS) {
  // TODO(정책확정 필요): SystemSetting 기반으로 live 기간 조정.
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export async function expireStalePages(now = new Date()) {
  // TODO(정책확정 필요): cron/worker 기반 만료 처리로 이동.
  const result = await prisma.page.updateMany({
    where: {
      status: "live",
      live_expires_at: { lte: now },
    },
    data: {
      status: "expired",
    },
  });

  return result.count;
}
