import { prisma } from "@/lib/db";

export const DEFAULT_LIVE_HOURS = 24;

export function computeLiveExpiry(now: Date, hours = DEFAULT_LIVE_HOURS) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/** 8.2.1 SystemSetting live_hours (admin setting). Defaults to DEFAULT_LIVE_HOURS. */
export async function getLiveHours(): Promise<number> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "live_hours" },
    });
    if (row?.value != null && typeof row.value === "number" && [12, 24, 48].includes(row.value)) {
      return row.value;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LIVE_HOURS;
}

export async function expireStalePages(now = new Date()) {
  // Called by internal scheduler or cron endpoint; safe to run idempotently.
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
