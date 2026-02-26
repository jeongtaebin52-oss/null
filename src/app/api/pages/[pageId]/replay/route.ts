import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { resolvePlanFeatures } from "@/lib/plan";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { getSystemNumber } from "@/lib/system-settings";

const MAX_EVENT_WINDOW_HOURS = 24;
const HIGHLIGHT_WINDOW_MS = 30 * 1000; // 30초 구간
const TOP_CLICK_WINDOWS = 3;
const TOP_LEAVE_WINDOWS = 2;
const TOP_BUTTON_CLICKS = 1;

type HighlightConfig = {
  windowMs: number;
  topClickWindows: number;
  topLeaveWindows: number;
  topButtonClicks: number;
};

type Params = { pageId: string };

type SerialEvent = {
  id: string;
  ts: Date;
  type: string;
  x: number | null;
  y: number | null;
  element_id: string | null;
  element_type: string | null;
  payload: unknown;
};

function computeHighlights(
  events: SerialEvent[],
  config: HighlightConfig,
): { start_ts: string; end_ts: string; start_ms: number; end_ms: number; label: string; type: "click_spike" | "leave_spike" | "button_focus" }[] {
  if (events.length == 0) return [];
  const startTime = events[0].ts.getTime();
  const { windowMs, topClickWindows, topLeaveWindows, topButtonClicks } = config;

  const highlights: { start_ts: string; end_ts: string; start_ms: number; end_ms: number; label: string; type: "click_spike" | "leave_spike" | "button_focus" }[] = [];

  // 클릭 급증 구간
  const clickCountByWindow = new Map<number, number>();
  for (const e of events) {
    if (e.type !== "click") continue;
    const t = e.ts.getTime();
    const windowStart = Math.floor((t - startTime) / windowMs) * windowMs;
    clickCountByWindow.set(windowStart, (clickCountByWindow.get(windowStart) ?? 0) + 1);
  }
  const clickWindows = [...clickCountByWindow.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topClickWindows)
    .filter(([, c]) => c > 0);
  for (const [winStart, count] of clickWindows) {
    highlights.push({
      start_ts: new Date(startTime + winStart).toISOString(),
      end_ts: new Date(startTime + winStart + windowMs).toISOString(),
      start_ms: winStart,
      end_ms: winStart + windowMs,
      label: `클릭 급증 (${count}건)`,
      type: "click_spike",
    });
  }

  // 이탈 급증 구간
  const leaveCountByWindow = new Map<number, number>();
  for (const e of events) {
    if (e.type !== "leave") continue;
    const t = e.ts.getTime();
    const windowStart = Math.floor((t - startTime) / windowMs) * windowMs;
    leaveCountByWindow.set(windowStart, (leaveCountByWindow.get(windowStart) ?? 0) + 1);
  }
  const leaveWindows = [...leaveCountByWindow.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLeaveWindows)
    .filter(([, c]) => c > 0);
  for (const [winStart, count] of leaveWindows) {
    highlights.push({
      start_ts: new Date(startTime + winStart).toISOString(),
      end_ts: new Date(startTime + winStart + windowMs).toISOString(),
      start_ms: winStart,
      end_ms: winStart + windowMs,
      label: `이탈 급증 (${count}건)`,
      type: "leave_spike",
    });
  }

  // 버튼/요소 집중 구간
  const clicksByElement = new Map<string | null, { first: number; last: number; count: number }>();
  for (const e of events) {
    if (e.type !== "click") continue;
    const key = e.element_id ?? "unknown";
    const t = e.ts.getTime();
    const rel = t - startTime;
    const cur = clicksByElement.get(key);
    if (!cur) {
      clicksByElement.set(key, { first: rel, last: rel, count: 1 });
    } else {
      cur.first = Math.min(cur.first, rel);
      cur.last = Math.max(cur.last, rel);
      cur.count += 1;
    }
  }
  const topButtons = [...clicksByElement.entries()]
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topButtonClicks);
  for (const [, range] of topButtons) {
    if (range.count <= 0) continue;
    highlights.push({
      start_ts: new Date(startTime + range.first).toISOString(),
      end_ts: new Date(startTime + range.last).toISOString(),
      start_ms: range.first,
      end_ms: range.last,
      label: `버튼/요소 클릭 집중 (${range.count}건)`,
      type: "button_focus",
    });
  }

  return highlights.sort((a, b) => a.start_ms - b.start_ms);
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return apiErrorJson("anon_user_id_required", 401, "anon_id가 필요합니다.");
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return apiErrorJson("user_not_found", 404);
  }

  const { pageId } = await context.params;

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id },
  });
  if (!page) return apiErrorJson("not_found", 404);

  const features = resolvePlanFeatures(user.plan);
  if (!features.replayEnabled) {
    return apiErrorJson("upgrade_required", 402, "리플레이는 프로 플랜에서만 사용할 수 있습니다.");
  }

  const since = new Date(Date.now() - MAX_EVENT_WINDOW_HOURS * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { page_id: pageId, ts: { gte: since } },
    orderBy: { ts: "asc" },
  });

  const serialEvents: SerialEvent[] = events.map((e) => ({
    id: e.id,
    ts: e.ts,
    type: e.type,
    x: e.x,
    y: e.y,
    element_id: e.element_id,
    element_type: e.element_type,
    payload: e.payload,
  }));

  const highlightWindowMs = await getSystemNumber("replay_highlight_window_ms", HIGHLIGHT_WINDOW_MS, {
    min: 5000,
    max: 300000,
    integer: true,
  });
  const topClickWindows = await getSystemNumber("replay_top_click_windows", TOP_CLICK_WINDOWS, {
    min: 1,
    max: 10,
    integer: true,
  });
  const topLeaveWindows = await getSystemNumber("replay_top_leave_windows", TOP_LEAVE_WINDOWS, {
    min: 1,
    max: 10,
    integer: true,
  });
  const topButtonClicks = await getSystemNumber("replay_top_button_clicks", TOP_BUTTON_CLICKS, {
    min: 1,
    max: 10,
    integer: true,
  });

  const highlights = computeHighlights(serialEvents, {
    windowMs: highlightWindowMs,
    topClickWindows,
    topLeaveWindows,
    topButtonClicks,
  });

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      ts: event.ts,
      type: event.type,
      x: event.x,
      y: event.y,
      element_id: event.element_id,
      element_type: event.element_type,
      payload: event.payload,
    })),
    highlights: highlights.map((h) => ({
      ...h,
      start_ts: h.start_ts,
      end_ts: h.end_ts,
      start_ms: h.start_ms,
      end_ms: h.end_ms,
      label: h.label,
      type: h.type,
    })),
  });
}
