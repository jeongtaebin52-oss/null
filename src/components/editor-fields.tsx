"use client";

import React from "react";

export function PropertyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 rounded-[8px] border border-neutral-200 px-2 py-1 text-xs"
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[8px] border border-neutral-200 px-2 py-2 text-xs"
      />
    </label>
  );
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(trimmed)) return trimmed;
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/);
  if (rgbMatch) {
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const r = Math.min(255, Math.max(0, Number(rgbMatch[1])));
    const g = Math.min(255, Math.max(0, Number(rgbMatch[2])));
    const b = Math.min(255, Math.max(0, Number(rgbMatch[3])));
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return "#000000";
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const safe = normalizeHexColor(value || "#000000");
  return (
    <label className="flex flex-col gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 rounded-[8px] border border-neutral-200 bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 rounded-[8px] border border-neutral-200 px-2 py-2 text-xs"
          placeholder="#000000"
        />
      </div>
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[8px] border border-neutral-200 px-2 py-2 text-xs"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[8px] border border-neutral-200 px-2 py-2 text-xs"
      >
        {options.map((option) => {
          const optValue = typeof option === "string" ? option : option.value;
          const optLabel = typeof option === "string" ? option : option.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}
