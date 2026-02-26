"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { io } from "socket.io-client";
import PageActions from "@/components/page-actions";
import { GhostLayer, PulseLayer, type GhostTrace, type Pulse } from "@/components/live-overlays";

const LOOP_MS = 8000;
/** PROJECT.md 2-4: 라이브 이벤트 최근 3~5초만 유지 */
const PULSE_MS = 4000;
const TICK_MS = 80;
/** move 전송 주기: 서버 MOVE_THROTTLE_MS(80)와 맞춤. PROJECT.md 2-2 */
const MOVE_SEND_INTERVAL_MS = 80;

function safeNumber(value: unknown) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

export default function LiveView({ pageId }: { pageId: string }) {
  const [viewerCount, setViewerCount] = useState(1);
  const [ghostTraces, setGhostTraces] = useState<GhostTrace[]>([]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [title, setTitle] = useState<string>("");
  const [anonNumber, setAnonNumber] = useState<number | null>(null);
  const [upvotes, setUpvotes] = useState<number>(0);
  const [tick, setTick] = useState(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const lastMoveAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pages/${pageId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        setTitle(typeof data?.page?.title === "string" ? data.page.title : "");
        setAnonNumber(typeof data?.page?.anon_number === "number" ? data.page.anon_number : null);
        setUpvotes(typeof data?.page?.upvote_count === "number" ? data.page.upvote_count : 0);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pages/${pageId}/ghost`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        if (Array.isArray(data.traces)) {
          setGhostTraces(data.traces as GhostTrace[]);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
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
      if (count !== null) {
        setViewerCount(count);
      }
    });

    socket.on("live:click", (payload) => {
      const x = safeNumber(payload?.x);
      const y = safeNumber(payload?.y);
      if (x === null || y === null) return;

      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setPulses((prev) => [...prev, { id, x, y, createdAt: Date.now() }]);
    });

    socket.on("ghost:update", (payload) => {
      if (Array.isArray(payload?.traces)) {
        setGhostTraces(payload.traces as GhostTrace[]);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pageId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulses((prev) => prev.filter((pulse) => Date.now() - pulse.createdAt < PULSE_MS));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(() => ((tick * TICK_MS) % LOOP_MS) / LOOP_MS, [tick]);
  const displayTitle = title || (anonNumber ? `익명 작품 #${anonNumber}` : "익명 작품");

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500" aria-label="라이브" />
            <span className="text-xs font-semibold tracking-[0.2em] text-neutral-500">라이브</span>
            <div className="text-lg font-semibold">{displayTitle}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            <span className="mr-1">관객 {viewerCount}</span>
            <span className="rounded-full border border-neutral-200 px-2 py-1">라이브</span>
            <PageActions pageId={pageId} initialUpvotes={upvotes} />
          </div>
        </header>

        <section
          ref={canvasRef}
          className="relative w-full overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
          onPointerMove={emitMove}
          onPointerDown={emitClick}
        >
          <div className="aspect-[9/16] w-full bg-neutral-50" />

          <GhostLayer traces={ghostTraces} progress={progress} />
          <PulseLayer pulses={pulses} />
        </section>

        <div className="text-xs text-neutral-500">라이브 클릭/잔상은 텍스트 입력을 수집하지 않습니다.</div>
      </div>
    </div>
  );
}
