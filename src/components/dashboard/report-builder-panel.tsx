"use client";

import React from "react";

type ReportBuilderProps = {
  open: boolean;
  blockIds: readonly string[];
  labels: Record<string, string>;
  selected: Set<string>;
  onToggle: () => void;
  onSelectedChange: (next: Set<string>) => void;
  onApply: () => void;
  onReset: () => void;
};

export function ReportBuilderPanel({
  open,
  blockIds,
  labels,
  selected,
  onToggle,
  onSelectedChange,
  onApply,
  onReset,
}: ReportBuilderProps) {
  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-widest text-[#737373]"
      >
        리포트 빌더 (표시할 블록 선택)
        <span className="text-[#525252]">{open ? "닫기" : "열기"}</span>
      </button>
      {open && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {blockIds.map((id) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(id);
                  else next.delete(id);
                  onSelectedChange(next);
                }}
                className="rounded border-white/20"
              />
              {labels[id]}
            </label>
          ))}
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
          >
            적용
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/5"
          >
            초기화
          </button>
        </div>
      )}
    </section>
  );
}
