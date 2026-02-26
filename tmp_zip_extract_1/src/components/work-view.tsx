"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";

import CanvasRender from "@/components/canvas-render";
import AdvancedRuntimePlayer from "@/advanced/runtime/player";
import PageActions from "@/components/page-actions";
import { GhostLayer, PulseLayer, type GhostTrace, type Pulse } from "@/components/live-overlays";

import type { CanvasDocument, CanvasContentV2 } from "@/lib/canvas";
import { DEFAULT_CANVAS, normalizeContentToV2, pickScene, toDocument } from "@/lib/canvas";
import { hydrateDoc, type SerializableDoc } from "@/advanced/doc/scene";
import { layoutDoc } from "@/advanced/layout/engine";
import { getPageContentBounds } from "@/advanced/runtime/bounds";

const LOOP_MS = 8000;
/** PROJECT.md 2-4: 라이브 이벤트 최근 3~5초만 유지 */
const PULSE_MS = 4000;
const TICK_MS = 80;
/** move 전송 주기: 서버 MOVE_THROTTLE_MS(80)와 맞춤. PROJECT.md 2-2 */
const MOVE_SEND_INTERVAL_MS = 80;

function safeNumber(value: unknown) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getAdvancedCanvasSize(doc: SerializableDoc | null, pageId?: string | null) {
  if (!doc) return null;
  const laidOut = layoutDoc(hydrateDoc(doc));
  const bounds = getPageContentBounds(laidOut, pageId);
  const page =
    Array.isArray(laidOut.pages) && laidOut.pages.length
      ? pageId
        ? laidOut.pages.find((p) => p.id === pageId) ?? laidOut.pages[0]
        : laidOut.pages[0]
      : null;
  const pageNode = page ? laidOut.nodes?.[page.rootId] : null;
  const pageWidth = pageNode?.frame?.w ? (pageNode.frame.w as number) : DEFAULT_CANVAS.width;
  const pageHeight = pageNode?.frame?.h ? (pageNode.frame.h as number) : DEFAULT_CANVAS.height;
  const isLargeCanvas = pageWidth >= 2400 || pageHeight >= 1800;
  if (bounds && bounds.w > 0 && bounds.h > 0) {
    if (isLargeCanvas) {
      return { width: Math.max(1, bounds.w), height: Math.max(1, bounds.h) };
    }
    const minX = Math.min(0, bounds.x);
    const minY = Math.min(0, bounds.y);
    const maxX = Math.max(pageWidth, bounds.x + bounds.w);
    const maxY = Math.max(pageHeight, bounds.y + bounds.h);
    return { width: maxX - minX, height: maxY - minY };
  }
  if (pageNode?.frame?.w && pageNode?.frame?.h) {
    return { width: pageWidth, height: pageHeight };
  }
  return { width: DEFAULT_CANVAS.width, height: DEFAULT_CANVAS.height };
}

type Spike = { start: string; end: string; clicks: number; leaves: number };
type SpikesResponse = { ok: true; highlights: Spike[] } | { ok: false; error: string };

export default function WorkView({ pageId }: { pageId: string }) {
  const searchParams = useSearchParams();
  const sceneParam = searchParams.get("s");

  const [contentV2, setContentV2] = useState<CanvasContentV2 | null>(null);
  const [doc, setDoc] = useState<CanvasDocument>({ ...DEFAULT_CANVAS, nodes: [...DEFAULT_CANVAS.nodes] });
  const [advancedDoc, setAdvancedDoc] = useState<SerializableDoc | null>(null);
  const [advancedSize, setAdvancedSize] = useState<{ width: number; height: number } | null>(null);
  const [advancedPageId, setAdvancedPageId] = useState<string | null>(null);

  const onAdvancedPageChange = useCallback((newPageId: string) => {
    setAdvancedPageId(newPageId);
  }, []);

  const [viewerCount, setViewerCount] = useState(1);
  const [ghostTraces, setGhostTraces] = useState<GhostTrace[]>([]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [title, setTitle] = useState<string>("");
  const [anonNumber, setAnonNumber] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [summaryClicks, setSummaryClicks] = useState<number[]>([]);
  const [upvotes, setUpvotes] = useState<number>(0);
  const [metrics, setMetrics] = useState({ avgDurationMs: 0, totalClicks: 0, bounceRate: 0 });

  const [spikes, setSpikes] = useState<Spike[] | null>(null);
  const [spikesBlocked, setSpikesBlocked] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const lastMoveAt = useRef(0);

  const [tick, setTick] = useState(0);
  const progress = useMemo(() => ((tick * TICK_MS) % LOOP_MS) / LOOP_MS, [tick]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/pages/${pageId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;

        setTitle(typeof data?.page?.title === "string" ? data.page.title : "");
        setAnonNumber(typeof data?.page?.anon_number === "number" ? data.page.anon_number : null);
        setExpiresAt(data?.page?.live_expires_at ?? null);

        setUpvotes(typeof data?.page?.upvote_count === "number" ? data.page.upvote_count : 0);
        setMetrics({
          avgDurationMs: typeof data?.page?.avg_duration_ms === "number" ? data.page.avg_duration_ms : 0,
          totalClicks: typeof data?.page?.total_clicks === "number" ? data.page.total_clicks : 0,
          bounceRate: typeof data?.page?.bounce_rate === "number" ? data.page.bounce_rate : 0,
        });

        const rawContent = data?.version?.content_json;
        if (rawContent && rawContent.schema === "null_advanced_v1") {
          const advanced = rawContent as SerializableDoc;
          const startPageId = advanced.prototype?.startPageId ?? advanced.pages?.[0]?.id ?? null;
          setContentV2(null);
          setAdvancedDoc(advanced);
          setAdvancedPageId(startPageId);
          setAdvancedSize(getAdvancedCanvasSize(advanced, startPageId));
          return;
        }

        setAdvancedDoc(null);
        setAdvancedSize(null);
        setAdvancedPageId(null);
        const normalized = normalizeContentToV2(rawContent);
        setContentV2(normalized);

        const scene = pickScene(normalized, sceneParam);
        setDoc(toDocument(scene));
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [pageId, sceneParam]);

  useEffect(() => {
    if (!contentV2) return;
    const scene = pickScene(contentV2, sceneParam);
    setDoc(toDocument(scene));
  }, [contentV2, sceneParam]);

  useEffect(() => {
    if (!advancedDoc) return;
    setAdvancedSize(getAdvancedCanvasSize(advancedDoc, advancedPageId));
  }, [advancedDoc, advancedPageId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pages/${pageId}/ghost`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        if (Array.isArray(data.traces)) setGhostTraces(data.traces as GhostTrace[]);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;

    const fetchSpikes = async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}/spikes`);
        if (cancelled) return;

        if (res.status === 402) {
          setSpikesBlocked(true);
          setSpikes(null);
          return;
        }
        const data = (await res.json().catch(() => null)) as SpikesResponse | null;
        if (!data) return;

        if (data.ok) {
          setSpikes(Array.isArray(data.highlights) ? data.highlights : []);
          setSpikesBlocked(false);
        }
      } catch {
        // silent
      }
    };

    fetchSpikes();
    const interval = setInterval(fetchSpikes, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pageId]);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      query: {
        pageId,
        vw: typeof window !== "undefined" ? window.innerWidth : 0,
        vh: typeof window !== "undefined" ? window.innerHeight : 0,
      },
    });
    socketRef.current = socket;

    socket.on("presence", (payload) => {
      const count = safeNumber(payload?.count);
      if (count !== null) setViewerCount(count);
    });

    socket.on("live:click", (payload) => {
      const x = safeNumber(payload?.x);
      const y = safeNumber(payload?.y);
      if (x === null || y === null) return;

      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setPulses((prev) => [...prev, { id, x, y, createdAt: Date.now() }]);
      setSummaryClicks((prev) => [...prev, Date.now()]);
    });

    socket.on("ghost:update", (payload) => {
      if (Array.isArray(payload?.traces)) setGhostTraces(payload.traces as GhostTrace[]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pageId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPulses((prev) => prev.filter((pulse) => now - pulse.createdAt < PULSE_MS));
      setSummaryClicks((prev) => prev.filter((ts) => now - ts < 10000));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
  const displayTitle = title || (anonNumber ? `익명 작품 #${anonNumber}` : "익명 작품");
  const presenceLabel = viewerCount <= 1 ? "지금 이 순간, 다른 관객은 없습니다" : `지금 ${viewerCount}명 (본인 포함)`;
  const canvasWidth = advancedSize?.width ?? doc.width;
  const canvasHeight = advancedSize?.height ?? doc.height;

  const emitMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastMoveAt.current < MOVE_SEND_INTERVAL_MS) return;
    lastMoveAt.current = now;

    const target = canvasRef.current;
    const socket = socketRef.current;
    if (!target || !socket) return;

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    socket.emit("move", { x, y });
  };

  const emitClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = canvasRef.current;
    const socket = socketRef.current;
    if (!target || !socket) return;

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    socket.emit("click", { x, y });
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" aria-label="라이브" />
            <span className="text-xs font-semibold tracking-[0.2em] text-neutral-500">라이브</span>
            <div className="text-lg font-semibold">{displayTitle}</div>
            <span className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600">
              {formatDuration(remainingMs)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            <span className="mr-1">관객 {viewerCount}</span>
            <a
              href={`/replay/${pageId}`}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-white px-3 py-1 text-[11px] font-medium text-neutral-900"
            >
              리플레이(Pro)
            </a>
            <PageActions pageId={pageId} initialUpvotes={upvotes} />
          </div>
        </header>

        <section className="rounded-[14px] border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-700 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[11px] font-semibold text-neutral-900">관람 현황</div>
              <div className="text-[11px] text-neutral-600">{presenceLabel}</div>
              <div className="text-[11px] text-neutral-500">· 흔적은 행동으로만 남습니다</div>
            </div>
          </div>
        </section>

        <div className="grid w-full gap-6 lg:grid-cols-[1fr_260px]">
          <section className="relative w-full overflow-auto rounded-[14px] border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex w-full items-start justify-start bg-neutral-50 p-6">
              <div
                ref={canvasRef}
                className="relative"
                style={{ width: canvasWidth, height: canvasHeight }}
                onPointerMove={emitMove}
                onPointerDown={emitClick}
              >
                {advancedDoc ? (
                  <div className="absolute inset-0">
                    <AdvancedRuntimePlayer
                      doc={advancedDoc}
                      initialPageId={advancedPageId ?? undefined}
                      onPageChange={onAdvancedPageChange}
                      className="relative h-full w-full"
                      fitToContent
                    />
                  </div>
                ) : (
                  <CanvasRender
                    doc={doc}
                    interactive
                    className="absolute inset-0 shadow-none"
                  />
                )}
                <GhostLayer traces={ghostTraces} progress={progress} />
                <PulseLayer pulses={pulses} />
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <SummaryCard label="최근 10초 클릭 수" value={summaryClicks.length} />
            <SummaryCard label="현재 관객 수" value={viewerCount} />
            <SummaryCard label="평균 체류(초)" value={Math.round(metrics.avgDurationMs / 1000)} />
            <SummaryCard label="이탈률" value={`${Math.round(metrics.bounceRate * 100)}%`} />
            <SummaryCard label="클릭 수" value={metrics.totalClicks} />

            <div className="rounded-[14px] border border-neutral-200 bg-white p-4 text-xs text-neutral-700">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">이상 구간</div>

              {spikesBlocked ? (
                <div className="mt-2 text-[11px] text-neutral-400">
                  Pro에서 24h 사건 구간(스파이크)을 확인할 수 있습니다.
                </div>
              ) : spikes && spikes.length ? (
                <div className="mt-2 flex flex-col gap-2">
                  {spikes.slice(0, 3).map((s, idx) => (
                    <div
                      key={`${s.start}_${idx}`}
                      className="flex items-center justify-between rounded-[12px] border border-neutral-200 px-3 py-2 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-neutral-200 px-2 py-[2px] text-[10px] text-neutral-500">
                          #{idx + 1}
                        </span>
                        <span className="font-medium text-neutral-900">
                          {new Date(s.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ~{" "}
                          {new Date(s.end).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-neutral-600">클릭 {s.clicks} · 이탈 {s.leaves}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-neutral-400">최근 24시간 사건 구간이 없습니다.</div>
              )}
            </div>

            <div className="rounded-[14px] border border-neutral-200 bg-white p-4 text-xs text-neutral-600">
              유료 플랜은 24h 리플레이를 제공합니다.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-neutral-200 bg-white p-4 text-xs text-neutral-600">
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">라이브</div>
      <div className="mt-2 text-sm font-semibold text-neutral-900">{value}</div>
      <div className="mt-1 text-[11px]">{label}</div>
    </div>
  );
}
