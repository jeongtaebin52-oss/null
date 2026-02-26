import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { expireStalePages } from "@/lib/expire";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { resolvePlanFeatures } from "@/lib/plan";
import { apiErrorJson } from "@/lib/api-error";
import { getSystemNumber } from "@/lib/system-settings";
import type { Plan } from "@prisma/client";

type Params = { pageId: string };

type Spike = {
  start: string; // ISO
  end: string; // ISO
  clicks: number;
  leaves: number;
};

type BucketRow = { idx: number; count: number };

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

function applyBucketCounts(rows: BucketRow[], buckets: number[]) {
  let total = 0;
  for (const row of rows) {
    const idx = Number(row.idx);
    const count = Number(row.count);
    if (!Number.isFinite(idx) || !Number.isFinite(count)) continue;
    if (idx < 0 || idx >= buckets.length) continue;
    buckets[idx] = count;
    total += count;
  }
  return total;
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  // Pro-only: spikes require stored events
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const plan = await prisma.plan.findUnique({ where: { id: user.plan_id } });
  const fallbackPlan: Plan = {
    id: user.plan_id,
    name: "",
    price_cents: null,
    features: {},
    created_at: new Date(),
    updated_at: new Date(),
  };
  const features = resolvePlanFeatures(plan ?? fallbackPlan);
  if (!features.replayEnabled) {
    return apiErrorJson("pro_required", 402);
  }

  // Page existence (must be visible)
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, is_deleted: true, is_hidden: true },
  });
  if (!page || page.is_deleted || page.is_hidden) {
    return apiErrorJson("not_found", 404);
  }

  const windowHours = await getSystemNumber("spikes_window_hours", 24, { min: 1, max: 168, integer: true });
  const bucketMinutes = await getSystemNumber("spikes_bucket_minutes", 5, { min: 1, max: 60, integer: true });
  const highlightMinutes = await getSystemNumber("spikes_highlight_minutes", 30, { min: 5, max: 180, integer: true });
  const topK = await getSystemNumber("spikes_top_k", 3, { min: 1, max: 10, integer: true });

  // ---- Aggregation window
  const nowMs = Date.now();
  const windowMs = windowHours * 60 * 60 * 1000;
  const sinceMs = nowMs - windowMs;

  // Bucket by N minutes (cheap + stable)
  const bucketMs = bucketMinutes * 60 * 1000;
  const bucketCount = Math.ceil(windowMs / bucketMs);
  const bucketStartMs = startOfBucketMs(sinceMs, bucketMs);

  const clickBuckets = new Array<number>(bucketCount).fill(0);
  const leaveBuckets = new Array<number>(bucketCount).fill(0);

  const clickRows = await prisma.$queryRaw<BucketRow[]>`
    SELECT floor((extract(epoch from "ts") * 1000 - ${bucketStartMs}) / ${bucketMs})::int as idx,
           count(*)::int as count
    FROM "Event"
    WHERE "page_id" = ${pageId} AND "type" = 'click' AND "ts" >= ${new Date(sinceMs)}
    GROUP BY idx
  `;

  const leaveRows = await prisma.$queryRaw<BucketRow[]>`
    SELECT floor((extract(epoch from "ended_at") * 1000 - ${bucketStartMs}) / ${bucketMs})::int as idx,
           count(*)::int as count
    FROM "LiveSession"
    WHERE "page_id" = ${pageId} AND "ended_at" IS NOT NULL AND "ended_at" >= ${new Date(sinceMs)}
    GROUP BY idx
  `;

  const totalClicks = applyBucketCounts(clickRows, clickBuckets);
  const totalLeaves = applyBucketCounts(leaveRows, leaveBuckets);

  // ---- Pick top windows
  const windowSize = Math.max(1, Math.round(highlightMinutes / bucketMinutes));

  const topClicks = pickTopKWindows(clickBuckets, windowSize, topK);
  const topLeaves = pickTopKWindows(leaveBuckets, windowSize, topK);

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

  raw.sort((a, b) => b.clicks + b.leaves - (a.clicks + a.leaves));

  const seenKey = new Set<string>();
  for (const r of raw) {
    const key = `${r.start}_${r.end}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    spikes.push(r);
    if (spikes.length >= topK) break;
  }

  return NextResponse.json({
    ok: true,
    pageId,
    meta: {
      window_hours: windowHours,
      bucket_minutes: bucketMinutes,
      highlight_minutes: windowSize * bucketMinutes,
      sampled_clicks: totalClicks,
      sampled_leaves: totalLeaves,
    },
    series: {
      clicks: clickBuckets,
      leaves: leaveBuckets,
    },
    highlights: spikes,
  });
}
