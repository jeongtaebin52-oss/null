"use client";

type GhostPoint = { t: number; x: number; y: number };
type GhostClick = { t: number; x: number; y: number; el?: string };
export type GhostTrace = {
  trace_id: string;
  points: GhostPoint[];
  clicks: GhostClick[];
  meta: { dur: number; score: number };
};

export type Pulse = { id: string; x: number; y: number; createdAt: number };

export function GhostLayer({ traces, progress }: { traces: GhostTrace[]; progress: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {traces.map((trace, index) => {
        if (!trace?.points?.length) return null;
        const points = trace.points;
        const offset = (progress + index * 0.17) % 1;
        const duration =
          typeof trace.meta?.dur === "number" && trace.meta.dur > 0
            ? trace.meta.dur
            : points[points.length - 1]?.t ?? 0;
        const currentTime = duration > 0 ? offset * duration : 0;
        const pointIndex = Math.floor(offset * (points.length - 1));
        const current = points[pointIndex] ?? points[0];
        const opacity = index === 0 ? 0.2 : 0.12;
        const polyline = points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
        const activeClicks = trace.clicks?.filter((click) => Math.abs(click.t - currentTime) < 0.5) ?? [];

        return (
          <div key={trace.trace_id} className="absolute inset-0">
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <polyline
                points={polyline}
                fill="none"
                stroke="rgba(17,17,17,0.35)"
                strokeWidth="0.6"
                style={{ opacity }}
              />
            </svg>

            {activeClicks.map((click, clickIndex) => (
              <span
                key={`${trace.trace_id}-click-${clickIndex}`}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900/40 trace-pulse"
                style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }}
              />
            ))}

            <span
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900/60"
              style={{ left: `${current.x * 100}%`, top: `${current.y * 100}%`, opacity }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function PulseLayer({ pulses }: { pulses: Pulse[] }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {pulses.map((pulse) => (
        <span
          key={pulse.id}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/70 trace-pulse"
          style={{ left: `${pulse.x * 100}%`, top: `${pulse.y * 100}%` }}
        />
      ))}
    </div>
  );
}
