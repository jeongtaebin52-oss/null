import { prisma } from "@/lib/db";
import { substituteAlertTemplate } from "@/lib/alert-template";

type PageRow = {
  id: string;
  discord_webhook_url: string | null;
  scheduled_report_enabled: boolean | null;
  auto_drop_alert: boolean | null;
  title: string | null;
  anon_number: number;
};

type DailyReportResult = {
  sent: number;
  errors: number;
  skipped: boolean;
  message?: string;
};

const LAST_RUN_KEY = "cron_daily_reports_last_run";

function dateKeyUtc(now: Date) {
  return now.toISOString().slice(0, 10);
}

async function readLastRunKey(): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: LAST_RUN_KEY },
    select: { value: true },
  });
  const value = row?.value;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { date?: string }).date === "string") {
    return (value as { date?: string }).date ?? null;
  }
  return null;
}

async function writeLastRunKey(key: string) {
  await prisma.systemSetting.upsert({
    where: { key: LAST_RUN_KEY },
    create: { key: LAST_RUN_KEY, value: key },
    update: { value: key },
  });
}

export async function runDailyReportsOnce(now = new Date()): Promise<DailyReportResult> {
  const key = dateKeyUtc(now);
  const last = await readLastRunKey();
  if (last === key) {
    return { sent: 0, errors: 0, skipped: true, message: "already_run" };
  }
  const result = await runDailyReports(now);
  await writeLastRunKey(key);
  return result;
}

export async function runDailyReports(now = new Date()): Promise<DailyReportResult> {
  let rows: PageRow[] = [];
  try {
    rows = await prisma.$queryRaw<PageRow[]>`
      SELECT id, "discord_webhook_url", "scheduled_report_enabled", "auto_drop_alert", title, anon_number
      FROM "Page"
      WHERE "is_deleted" = false AND "discord_webhook_url" IS NOT NULL AND "discord_webhook_url" != ''
        AND (COALESCE("scheduled_report_enabled", false) = true OR COALESCE("auto_drop_alert", false) = true)
    `;
  } catch {
    return {
      sent: 0,
      errors: 0,
      skipped: true,
      message: "settings_columns_missing",
    };
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let sent = 0;
  let errors = 0;

  for (const page of rows) {
    const webhookUrl = page.discord_webhook_url?.trim();
    if (!webhookUrl) continue;
    const title = page.title || `Anonymous page #${page.anon_number}`;

    if (page.auto_drop_alert) {
      const [visitsToday, visitsYesterday] = await Promise.all([
        prisma.liveSession.count({
          where: { page_id: page.id, started_at: { gte: todayStart } },
        }),
        prisma.liveSession.count({
          where: {
            page_id: page.id,
            started_at: { gte: yesterdayStart, lt: todayStart },
          },
        }),
      ]);
      const dropWarning = visitsYesterday > 2 && visitsToday < visitsYesterday * 0.5;
      if (dropWarning) {
        const description = substituteAlertTemplate(
          "Page **{title}**\n\nVisits today: **{visits_today}**, yesterday: **{visits_yesterday}**. Drop detected.",
          { title, visits_today: visitsToday, visits_yesterday: visitsYesterday }
        );
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: null,
            embeds: [
              {
                title: "NULL Traffic Drop Alert (Auto)",
                description,
                color: 0xff9800,
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
        if (res.ok) sent++;
        else errors++;
      }
    }

    if (page.scheduled_report_enabled) {
      const [visits, clicks] = await Promise.all([
        prisma.liveSession.count({
          where: { page_id: page.id, started_at: { gte: dayAgo } },
        }),
        prisma.event.count({
          where: { page_id: page.id, type: "click", ts: { gte: dayAgo } },
        }),
      ]);
      const description = substituteAlertTemplate(
        "Page **{title}**\n\nLast 24h: visits **{visits_today}**, clicks **{clicks}**.",
        { title, visits_today: visits, clicks }
      );
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: null,
          embeds: [
            {
              title: "NULL Daily Report",
              description,
              color: 0x5865f2,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (res.ok) sent++;
      else errors++;
    }
  }

  try {
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
    const pageIds = await prisma.liveSession.findMany({
      where: { started_at: { gte: yesterdayStart, lt: yesterdayEnd } },
      select: { page_id: true },
      distinct: ["page_id"],
    });
    for (const { page_id } of pageIds) {
      const [visits, clicks] = await Promise.all([
        prisma.liveSession.count({
          where: { page_id, started_at: { gte: yesterdayStart, lt: yesterdayEnd } },
        }),
        prisma.event.count({
          where: { page_id, type: "click", ts: { gte: yesterdayStart, lt: yesterdayEnd } },
        }),
      ]);
      await prisma.dailyPageStats.upsert({
        where: {
          page_id_date: { page_id, date: yesterdayStart },
        },
        create: { page_id, date: yesterdayStart, visits, clicks },
        update: { visits, clicks },
      });
    }
  } catch {
    // DailyPageStats table may not exist yet.
  }

  return { sent, errors, skipped: false };
}
