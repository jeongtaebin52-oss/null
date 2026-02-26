"use client";

import React from "react";

export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#737373]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#525252]">{sub}</p>}
    </div>
  );
}

export function HeatmapGrid({ grid, size }: { grid: number[][]; size: number }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div
      className="inline-grid gap-0.5 rounded-lg border border-white/10 p-1"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(4px, 12px))` }}
    >
      {grid.map((row, i) =>
        row.map((count, j) => (
          <div
            key={`${i}-${j}`}
            className="h-3 w-3 min-w-[12px] rounded-sm bg-white/10 transition hover:bg-amber-400/80"
            style={{
              backgroundColor: `rgba(251, 191, 36, ${0.15 + (count / max) * 0.85})`,
            }}
            title={`(${i},${j}) ${count}번 클릭`}
          />
        ))
      )}
    </div>
  );
}

export function ScrollDepthBars({ buckets, size }: { buckets: number[]; size: number }) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="flex w-full max-w-md items-end gap-0.5 rounded-lg border border-white/10 p-2" style={{ height: 80 }}>
      {buckets.slice(0, size).map((count, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-amber-400/20 transition hover:bg-amber-400/50"
          style={{
            height: `${Math.max(4, (count / max) * 100)}%`,
            minHeight: count > 0 ? 4 : 0,
          }}
          title={`${Math.round((i / size) * 100)}~${Math.round(((i + 1) / size) * 100)}%: ${count}회`}
        />
      ))}
    </div>
  );
}
