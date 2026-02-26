"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CanvasRender from "@/components/canvas-render";
import type { CanvasDocument } from "@/lib/canvas";

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

type Filters = {
  move: boolean;
  click: boolean;
  enter: boolean;
  leave: boolean;
};

const SPEEDS = [1, 2, 10] as const;

export default function ReplayPlayer({ events, doc }: { events: ReplayEvent[]; doc: CanvasDocument }) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [filters, setFilters] = useState<Filters>({
    move: true,
    click: true,
    enter: false,
    leave: false,
  });
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTick = useRef<number | null>(null);

  const timeline = useMemo(() => {
    if (events.length === 0) {
      return { start: 0, end: 0, duration: 0 };
    }
    const times = events.map((event) => new Date(event.ts).getTime());
    const start = Math.min(...times);
    const end = Math.max(...times);
    return { start, end, duration: Math.max(end - start, 0) };
  }, [events]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTick.current = null;
      return;
    }

    const tick = (time: number) => {
      if (lastTick.current == null) lastTick.current = time;
      const delta = time - lastTick.current;
      lastTick.current = time;
      setCurrent((prev) => {
        const next = prev + delta * speed;
        if (next >= timeline.duration) {
          setPlaying(false);
          return timeline.duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed, timeline.duration]);

  const filtered = useMemo(() => {
    const now = timeline.start + current;
    return events.filter((event) => {
      if (event.type === "scroll") return false;
      if (!filters[event.type]) return false;
      return new Date(event.ts).getTime() <= now;
    });
  }, [current, events, filters, timeline.start]);

  const cursor = useMemo(() => {
    for (let i = filtered.length - 1; i >= 0; i -= 1) {
      const event = filtered[i];
      if (event.type === "move" && event.x != null && event.y != null) {
        return { x: event.x, y: event.y };
      }
    }
    return null;
  }, [filtered]);

  const clicks = useMemo(() => {
    const now = timeline.start + current;
    return filtered.filter((event) => {
      if (event.type !== "click" || event.x == null || event.y == null) return false;
      const age = now - new Date(event.ts).getTime();
      return age >= 0 && age < 700;
    });
  }, [current, filtered, timeline.start]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-600">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((prev) => !prev)}
            className="rounded-full border border-neutral-900 px-3 py-1 text-neutral-900"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <div className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-1">
            {SPEEDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSpeed(option)}
                className={`rounded-full px-2 py-1 ${speed === option ? "bg-neutral-900 text-white" : ""}`}
              >
                {option}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["click", "move", "enter", "leave"] as const).map((type) => (
            <label key={type} className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={filters[type]}
                onChange={(event) => setFilters((prev) => ({ ...prev, [type]: event.target.checked }))}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-center rounded-[14px] border border-neutral-200 bg-neutral-50 p-6">
        <div className="relative">
          <CanvasRender doc={doc} className="shadow-none" />
          {cursor ? (
            <span
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900"
              style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
            />
          ) : null}
          {clicks.map((event) => (
            <span
              key={event.id}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/70 trace-pulse"
              style={{ left: `${(event.x ?? 0) * 100}%`, top: `${(event.y ?? 0) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-neutral-600">
        <input
          type="range"
          min={0}
          max={timeline.duration}
          value={current}
          onChange={(event) => setCurrent(Number(event.target.value))}
        />
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <span>{formatMs(current)}</span>
          <span>{formatMs(timeline.duration)}</span>
        </div>
      </div>
    </div>
  );
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
