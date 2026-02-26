"use client";

import { useEffect, useState } from "react";
import ReplayPlayer from "@/components/replay-player";
import { DEFAULT_CANVAS, type CanvasDocument } from "@/lib/canvas";

type ReplayEvent = {
  id: string;
  ts: string;
  type: "enter" | "leave" | "move" | "click" | "scroll";
  x: number | null;
  y: number | null;
  element_id: string | null;
  element_type: string | null;
  payload: Record<string, unknown> | null;
};

export default function ReplayView({ pageId }: { pageId: string }) {
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [doc, setDoc] = useState<CanvasDocument>({ ...DEFAULT_CANVAS, nodes: [...DEFAULT_CANVAS.nodes] });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pages/${pageId}`)
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
  }, [pageId]);

  useEffect(() => {
    fetch(`/api/pages/${pageId}/replay`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.error === "upgrade_required") {
            setError("유료 플랜에서만 리플레이가 가능합니다.");
          } else {
            setError("리플레이 데이터를 불러오지 못했습니다.");
          }
          return;
        }
        setEvents(Array.isArray(data.events) ? data.events : []);
      })
      .catch(() => {
        setError("리플레이 데이터를 불러오지 못했습니다.");
      });
  }, [pageId]);

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-sm text-neutral-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold">리플레이</div>
          <a href="/upgrade" className="rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold">
            업그레이드
          </a>
        </header>
        {error ? (
          <div className="rounded-[14px] border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-[14px] border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            아직 저장된 리플레이가 없습니다.
          </div>
        ) : (
          <ReplayPlayer events={events} doc={doc} />
        )}
        <div className="rounded-[14px] border border-neutral-200 bg-white p-4 text-xs text-neutral-500">
          mp4 내보내기는 TODO(정책확정 필요)로 남깁니다.
        </div>
      </div>
    </div>
  );
}
