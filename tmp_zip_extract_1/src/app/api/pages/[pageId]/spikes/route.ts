import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { expireStalePages } from "@/lib/expire";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { resolvePlanFeatures } from "@/lib/plan";

type Params = { pageId: string };

type Spike = {
  start: string; // ISO
  end: string;   // ISO
  clicks: number;
  leaves: number;
};

function startOfBucketMs(t: number, bucketMs: number) {
  return Math.floor(t / bucketMs) * bucketMs;
}

function formatISO(ms: number) {
  return new Date(ms).toISOString();
}

function pickTopKWindows(values: number[], windowSize: number, k: number) {
  // Greedy: pick highest-sum windows, disallow overlaps
  const n = values.length;
  const sums = new Array<number>(n).fill(0);

  // prefix sum
  const pref = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) pref[i + 1] = pref[i] + values[i];

  for (let i = 0; i < n; i++) {
    const j = Math.min(n, i + windowSize);
    sums[i] = pref[j] - pref[i];
  }

  const picked: { i: number; sum: number }[] = [];
  const blocked = new Array<boolean>(n).fill(false);

  for (let round = 0; round < k; round++) {
    let bestI = -1;
    let bestSum = -1;

    for (let i = 0; i < n; i++) {
      if (blocked[i]) continue;
      if (sums[i] > bestSum) {
        bestSum = sums[i];
        bestI = i;
      }
    }

    if (bestI < 0 || bestSum <= 0) break;

    picked.push({ i: bestI, sum: bestSum });

    // block overlap region
    const from = Math.max(0, bestI - (windowSize - 1));
    const to = Math.min(n - 1, bestI + (windowSize - 1));
    for (let x = from; x <= to; x++) blocked[x] = true;
  }

  return picked;
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  if (!pageId) return NextResponse.json({ ok: false, error: "bad_page_id" }, { status: 400 });

  // ✅ Pro-only: spikes require stored events
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const plan = await prisma.plan.findUnique({ where: { id: user.plan_id } });
  const features = resolvePlanFeatures(
    plan ?? ({ id: user.plan_id, name: "", price_cents: null, features: {} } as any)
  );
  if (!features.replayEnabled) {
    return NextResponse.json({ ok: false, error: "pro_required" }, { status: 402 });
  }

  // Page existence (must be visible)
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, is_deleted: true, is_hidden: true },
  });
  if (!page || page.is_deleted || page.is_hidden) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // ---- Aggregation window
  const nowMs = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const sinceMs = nowMs - windowMs;

  // Bucket by 5 minutes (cheap + stable)
  const bucketMs = 5 * 60 * 1000;
  const bucketCount = Math.ceil(windowMs / bucketMs); // 288
  const bucketStartMs = startOfBucketMs(sinceMs, bucketMs);

  const clickBuckets = new Array<number>(bucketCount).fill(0);
  const leaveBuckets = new Array<number>(bucketCount).fill(0);

  // ---- Click events (cap to prevent overload)
  // TODO(정책확정 필요): DB-side time-bucket aggregation for heavy traffic.
  const clicks = await prisma.event.findMany({
    where: {
      page_id: pageId,
      type: "click",
      ts: { gte: new Date(sinceMs) },
    },
    select: { ts: true },
    orderBy: { ts: "desc" },
    take: 20000,
  });

  for (const e of clicks) {
    const t = e.ts.getTime();
    const idx = Math.floor((t - bucketStartMs) / bucketMs);
    if (idx >= 0 && idx < bucketCount) clickBuckets[idx] += 1;
  }

  // ---- Leaves (use LiveSession.ended_at; free/pro 모두 있지만 spikes는 Pro에만 노출)
  const leaves = await prisma.liveSession.findMany({
    where: {
      page_id: pageId,
      ended_at: { not: null, gte: new Date(sinceMs) },
    },
    select: { ended_at: true },
    orderBy: { ended_at: "desc" },
    take: 20000,
  });

  for (const s of leaves) {
    const t = s.ended_at!.getTime();
    const idx = Math.floor((t - bucketStartMs) / bucketMs);
    if (idx >= 0 && idx < bucketCount) leaveBuckets[idx] += 1;
  }

  // ---- Pick top 3 non-overlapping windows (30 minutes = 6 buckets)
  const windowSize = 6;

  const topClicks = pickTopKWindows(clickBuckets, windowSize, 3);
  const topLeaves = pickTopKWindows(leaveBuckets, windowSize, 3);

  const spikes: Spike[] = [];

  // merge click spikes + leave spikes, then keep top 3 by (clicks + leaves) to avoid spam
  const raw: Spike[] = [];

  for (const w of topClicks) {
    const start = bucketStartMs + w.i * bucketMs;
    const end = start + windowSize * bucketMs;
    const clicksSum = w.sum;
    const leavesSum = leaveBuckets.slice(w.i, w.i + windowSize).reduce((a, b) => a + b, 0);
    raw.push({ start: formatISO(start), end: formatISO(end), clicks: clicksSum, leaves: leavesSum });
  }

  for (const w of topLeaves) {
    const start = bucketStartMs + w.i * bucketMs;
    const end = start + windowSize * bucketMs;
    const leavesSum = w.sum;
    const clicksSum = clickBuckets.slice(w.i, w.i + windowSize).reduce((a, b) => a + b, 0);
    raw.push({ start: formatISO(start), end: formatISO(end), clicks: clicksSum, leaves: leavesSum });
  }

  raw.sort((a, b) => (b.clicks + b.leaves) - (a.clicks + a.leaves));

  const seenKey = new Set<string>();
  for (const r of raw) {
    const key = `${r.start}_${r.end}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    spikes.push(r);
    if (spikes.length >= 3) break;
  }

  return NextResponse.json({
    ok: true,
    pageId,
    meta: {
      window_hours: 24,
      bucket_minutes: 5,
      highlight_minutes: 30,
      sampled_clicks: clicks.length,
      sampled_leaves: leaves.length,
      // TODO(정책확정 필요): 보관 정책/샘플 제한을 설정 파일로 외부화
    },
    series: {
      clicks: clickBuckets,
      leaves: leaveBuckets,
    },
    highlights: spikes,
  });
}
