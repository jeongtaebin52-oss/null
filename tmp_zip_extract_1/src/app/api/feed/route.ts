import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireStalePages } from "@/lib/expire";

/** PROJECT.md 2-5 인기 정렬: 체류·CTR·이탈·시간 감쇠·어뷰징 패널티 */
const POPULAR_K_DECAY = 8; // 시간 감쇠 k (6~12 권장)
const T_WINSORIZE_SEC = 600; // 체류 상한(초)

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function popularScore(page: {
  total_visits: number;
  unique_sessions: number;
  avg_duration_ms: number;
  total_clicks: number;
  bounce_rate: number;
  upvote_count: number;
  abuse_score: number;
  live_started_at: Date | null;
  live_expires_at: Date | null;
}, now: Date): number {
  const V = page.total_visits;
  const U = page.unique_sessions;
  const T_sec = Math.min(page.avg_duration_ms / 1000, T_WINSORIZE_SEC);
  const CTR = V > 0 ? page.total_clicks / V : 0;
  const B = page.bounce_rate;
  const R = page.upvote_count;
  const A = page.abuse_score;

  const quality =
    Math.log(1 + U) +
    0.6 * Math.log(1 + V) +
    0.04 * T_sec +
    2.5 * CTR -
    1.8 * B +
    0.2 * Math.log(1 + R);

  const abusePenalty = clamp(1 - A, 0.2, 1);

  let decay: number;
  if (page.live_expires_at && page.live_expires_at > now) {
    decay = 1; // LIVE 중 부스트(감쇠 없음)
  } else if (page.live_started_at) {
    const ageHours = (now.getTime() - page.live_started_at.getTime()) / (1000 * 60 * 60);
    decay = Math.exp(-ageHours / POPULAR_K_DECAY);
  } else {
    decay = 0.5;
  }

  return quality * decay * abusePenalty;
}

export async function GET(req: Request) {
  try {
    await expireStalePages();
  } catch (e) {
    console.error("feed: expireStalePages failed", e);
  }

  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") ?? "new";
    const now = new Date();

    const where = {
      status: "live" as const,
      is_hidden: false,
      is_deleted: false,
      live_expires_at: { gt: now },
    };

    let pages: Awaited<ReturnType<typeof prisma.page.findMany>>;

    if (tab === "popular") {
      pages = await prisma.page.findMany({
        where,
        take: 200,
      });
      const withScore = pages.map((p) => ({ page: p, score: popularScore(p, now) }));
      withScore.sort((a, b) => b.score - a.score);
      pages = withScore.slice(0, 60).map((x) => x.page);
    } else if (tab === "time") {
      pages = await prisma.page.findMany({
        where,
        orderBy: [
          { live_expires_at: "asc" as const },
          { live_started_at: "desc" as const },
        ],
        take: 60,
      });
    } else {
      pages = await prisma.page.findMany({
        where,
        orderBy: [{ live_started_at: "desc" as const }],
        take: 60,
      });
    }

    return NextResponse.json({
      items: pages.map((page) => ({
        id: page.id,
        title: page.title,
        anon_number: page.anon_number,
        live_started_at: page.live_started_at,
        live_expires_at: page.live_expires_at,
        total_visits: page.total_visits,
        avg_duration_ms: page.avg_duration_ms,
        total_clicks: page.total_clicks,
        upvote_count: page.upvote_count,
      })),
    });
  } catch (error) {
    console.error("feed GET failed", error);
    return NextResponse.json({ error: "feed_unavailable" }, { status: 500 });
  }
}
