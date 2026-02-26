"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReplayPlayer from "@/components/replay-player";
import { DEFAULT_CANVAS, type CanvasDocument } from "@/lib/canvas";

type ReplayEvent = {
  id: string;
  ts: string;
  type: "enter" | "leave" | "move" | "click" | "scroll" | "error" | "custom";
  x: number | null;
  y: number | null;
  element_id: string | null;
  element_type: string | null;
  payload: Record<string, unknown> | null;
};

export type ReplayHighlight = {
  start_ts: string;
  end_ts: string;
  start_ms: number;
  end_ms: number;
  label: string;
  type: "click_spike" | "leave_spike" | "button_focus";
};

export default function ReplayView({ pageId }: { pageId: string }) {
  const [planChecked, setPlanChecked] = useState(false);
  const [replayEnabled, setReplayEnabled] = useState(false);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [highlights, setHighlights] = useState<ReplayHighlight[]>([]);
  const [doc, setDoc] = useState<CanvasDocument>({ ...DEFAULT_CANVAS, nodes: [...DEFAULT_CANVAS.nodes] });
  const [error, setError] = useState<string | null>(null);
  const [seekToMs, setSeekToMs] = useState<number | null>(null);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);
  const replayCaptureRef = useRef<HTMLDivElement | null>(null);
  const timeline = useMemo(() => computeTimeline(events), [events]);

  // 6.3.1 최초 plan 체크: 무료면 업그레이드 안내, Pro면 리플레이 로드
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setPlanChecked(true);
        if (data?.features?.replayEnabled) {
          setReplayEnabled(true);
        } else {
          setReplayEnabled(false);
          setError(null);
        }
      })
      .catch(() => setPlanChecked(true));
  }, []);

  useEffect(() => {
    if (!replayEnabled) return;
    fetch(`/api/pages/${pageId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.version?.content_json) return;
        const content = data.version.content_json;
        setDoc({
          width: content.width ?? DEFAULT_CANVAS.width,
          height: content.height ?? DEFAULT_CANVAS.height,
          nodes: Array.isArray(content.nodes) ? content.nodes : [],
        });
      })
      .catch(() => null);
  }, [pageId, replayEnabled]);

  useEffect(() => {
    if (!replayEnabled) return;
    fetch(`/api/pages/${pageId}/replay`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.error === "upgrade_required") {
            setReplayEnabled(false);
            setError("유료 플랜에서만 리플레이가 가능합니다.");
          } else {
            setError("리플레이 데이터를 불러오지 못했습니다.");
          }
          return;
        }
        setEvents(Array.isArray(data.events) ? data.events : []);
        setHighlights(Array.isArray(data.highlights) ? data.highlights : []);
      })
      .catch(() => {
        setError("리플레이 데이터를 불러오지 못했습니다.");
      });
  }, [pageId, replayEnabled]);

  const exportReplayVideo = useCallback(async () => {
    if (videoExporting) return;
    setVideoExporting(true);
    setVideoMessage(null);

    try {
      if (typeof window === "undefined") {
        setVideoMessage("브라우저 환경에서만 내보내기가 가능합니다.");
        return;
      }
      if (!("MediaRecorder" in window)) {
        setVideoMessage("이 브라우저는 영상 녹화를 지원하지 않습니다.");
        return;
      }
      if (!replayCaptureRef.current) {
        setVideoMessage("리플레이 영역을 찾지 못했습니다.");
        return;
      }
      if (events.length === 0 || timeline.duration <= 0) {
        setVideoMessage("내보낼 이벤트가 없습니다.");
        return;
      }

      const target = replayCaptureRef.current.querySelector("[data-replay-canvas]") as HTMLElement | null;
      if (!target) {
        setVideoMessage("캔버스 영역을 찾지 못했습니다.");
        return;
      }

      const rect = target.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = width;
      outputCanvas.height = height;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) {
        setVideoMessage("캔버스를 초기화하지 못했습니다.");
        return;
      }

      const { default: html2canvas } = await import("html2canvas");

      const fps = 10;
      const stepMs = Math.max(100, Math.floor(1000 / fps));
      const mime = pickRecorderMime();
      const stream = outputCanvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.start();

      for (let t = 0; t <= timeline.duration; t += stepMs) {
        setSeekToMs(t);
        await waitFrame();
        await sleep(15);
        const frame = await html2canvas(target, { backgroundColor: "#ffffff", scale: 1 });
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(frame, 0, 0, width, height);
      }

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      const blob = new Blob(chunks, { type: mime || "video/webm" });
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `replay-${pageId}-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setVideoMessage(ext === "mp4" ? "MP4로 저장되었습니다." : "WebM으로 저장되었습니다.");
    } catch (err) {
      setVideoMessage(err instanceof Error ? err.message : "동영상 내보내기에 실패했습니다.");
    } finally {
      setVideoExporting(false);
      setSeekToMs(null);
    }
  }, [events.length, pageId, timeline.duration, videoExporting]);

  if (!planChecked) {
    return (
      <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
        <div className="mx-auto max-w-5xl">로딩 중...</div>
      </div>
    );
  }

  if (!replayEnabled) {
    return (
      <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-lg font-semibold">리플레이</div>
            <a href="/upgrade" className="rounded-full border border-[#111111] bg-[#111111] px-4 py-2 text-xs font-semibold text-white">
              Pro 업그레이드
            </a>
          </header>
          <div className="rounded-[14px] border border-[#EAEAEA] bg-white p-6 text-[#666666]">
            <p className="font-medium text-[#111111]">리플레이는 유료 플랜에서만 제공됩니다.</p>
            <p className="mt-2 text-xs">최근 24시간 행동을 재생하려면 Pro 이상으로 업그레이드해 주세요.</p>
            <a href="/upgrade" className="mt-4 inline-block rounded-full bg-[#111111] px-4 py-2 text-xs font-medium text-white">
              업그레이드하기
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold">리플레이</div>
          <a href={`/p/${pageId}`} className="rounded-full border border-[#EAEAEA] px-4 py-2 text-xs font-medium text-[#111111]">
            페이지 보기
          </a>
        </header>
        {error ? (
          <div className="rounded-[14px] border border-[#EAEAEA] bg-white p-6 text-sm text-[#666666]">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-[14px] border border-[#EAEAEA] bg-white p-6 text-center text-sm text-[#666666]">
            이벤트가 없습니다.
          </div>
        ) : (
          <>
            <div ref={replayCaptureRef}>
              <ReplayPlayer
                events={events}
                doc={doc}
                highlights={highlights}
                seekToMs={seekToMs}
                onSeekDone={() => setSeekToMs(null)}
              />
            </div>
            {highlights.length > 0 && (
              <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-4">
                <div className="text-xs font-semibold text-[#666666]">하이라이트 구간</div>
                <ul className="mt-2 flex flex-col gap-1">
                  {highlights.map((h, i) => (
                    <li key={`${h.start_ts}-${i}`}>
                      <button
                        type="button"
                        className="w-full rounded-[10px] border border-[#EAEAEA] px-3 py-2 text-left text-xs text-[#111111] hover:bg-[#EAEAEA]/50"
                        onClick={() => setSeekToMs(h.start_ms)}
                      >
                        <span className="text-[#666666]">{h.label}</span>
                        <span className="ml-2 text-[10px] text-[#666666]">
                          {formatTs(h.start_ms)} ~ {formatTs(h.end_ms)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-4">
              <div className="text-xs font-semibold text-[#666666]">요약 리포트 (6.2.4)</div>
              <p className="mt-1 text-[11px] text-[#666666]">이벤트와 하이라이트 요약을 JSON으로 제공합니다. PDF는 Phase2.</p>
              <button
                type="button"
                className="mt-2 rounded-full border border-[#111111] bg-[#111111] px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => downloadSummaryReport(pageId, events, highlights)}
              >
                요약 리포트 다운로드 (JSON)
              </button>
            </section>
          </>
        )}
        <div className="rounded-[14px] border border-[#EAEAEA] bg-white p-4 text-xs text-[#666666]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>리플레이 영상 내보내기</span>
            <button
              type="button"
              onClick={exportReplayVideo}
              disabled={videoExporting || events.length === 0}
              className="rounded-full border border-[#111111] bg-[#111111] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {videoExporting ? "내보내는 중..." : "MP4/WebM 저장"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#666666]">
            브라우저가 MP4를 지원하면 MP4로 저장되며, 지원하지 않으면 WebM으로 저장됩니다.
          </p>
          {videoMessage ? <p className="mt-2 text-[11px] text-[#666666]">{videoMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}

function formatTs(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

function computeTimeline(events: ReplayEvent[]) {
  if (events.length === 0) return { start: 0, end: 0, duration: 0 };
  const times = events.map((e) => new Date(e.ts).getTime());
  const start = Math.min(...times);
  const end = Math.max(...times);
  return { start, end, duration: Math.max(end - start, 0) };
}

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function waitFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 6.2.4 요약 리포트 다운로드 (JSON). PDF는 Phase2. */
function downloadSummaryReport(
  pageId: string,
  events: ReplayEvent[],
  highlights: ReplayHighlight[],
) {
  const byType = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  const times = events.map((e) => new Date(e.ts).getTime());
  const startMs = times.length ? Math.min(...times) : 0;
  const endMs = times.length ? Math.max(...times) : 0;
  const summary = {
    page_id: pageId,
    generated_at: new Date().toISOString(),
    window: {
      start_iso: times.length ? new Date(startMs).toISOString() : null,
      end_iso: times.length ? new Date(endMs).toISOString() : null,
      duration_ms: endMs - startMs,
    },
    events: {
      total: events.length,
      by_type: byType,
    },
    highlights: highlights.map((h) => ({
      type: h.type,
      label: h.label,
      start_ms: h.start_ms,
      end_ms: h.end_ms,
      start_ts: h.start_ts,
      end_ts: h.end_ts,
    })),
  };
  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `replay-summary-${pageId}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
