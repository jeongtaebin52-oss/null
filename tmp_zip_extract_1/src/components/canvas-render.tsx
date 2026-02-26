"use client";

import React from "react";
import type { BuilderAction, CanvasDocument, CanvasNode } from "@/lib/canvas";

type Runtime = {
  state?: Record<string, unknown>;
  setState?: (patch: Record<string, unknown>) => void;
  onAction?: (action: BuilderAction, node: CanvasNode) => void;
};

type Props = {
  doc: CanvasDocument;
  className?: string;
  showGrid?: boolean;
  interactive?: boolean;
  runtime?: Runtime;
};

function nodeStyle(node: CanvasNode) {
  const opacity = typeof node.opacity === "number" ? node.opacity : 1;
  const rotation = typeof node.rotation === "number" ? node.rotation : 0;
  return {
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
    opacity,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transformOrigin: "center",
  } as const;
}

function s(v: unknown, fallback = "") {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t.length ? v : fallback;
}

function pickFill(props: Record<string, unknown>, fallback: string) {
  // editor-view often writes `background`, renderer reads `fill`.
  // accept both so style controls remain stable.
  return s(props.fill, s(props.background, fallback));
}
function n(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function b(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function safeArrayOfStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

function applyAction(runtime: Runtime | undefined, action: BuilderAction | undefined, node: CanvasNode) {
  if (!runtime || !action || action.type === "none") return;
  runtime.onAction?.(action, node);
}

export default function CanvasRender({ doc, className, showGrid = false, interactive = false, runtime }: Props) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[14px] border border-neutral-200 bg-white",
        showGrid
          ? "bg-[linear-gradient(#f7f7f7_1px,transparent_1px),linear-gradient(90deg,#f7f7f7_1px,transparent_1px)]"
          : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: doc.width,
        height: doc.height,
        backgroundSize: showGrid ? "8px 8px" : undefined,
      }}
    >
      {/* Vector layer: line/path */}
      <svg className="absolute inset-0" width={doc.width} height={doc.height} viewBox={`0 0 ${doc.width} ${doc.height}`} aria-hidden>
        {doc.nodes.map((node) => {
          if (node.hidden) return null;

          if (node.type === "line") {
            const stroke = s(node.props.stroke, "#111111");
            const strokeWidth = n(node.props.strokeWidth, 2);
            const dash = s(node.props.dash, "");
            const x1 = node.x + 0;
            const y1 = node.y + node.h / 2;
            const x2 = node.x + node.w;
            const y2 = node.y + node.h / 2;
            return (
              <line
                key={node.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dash || undefined}
                strokeLinecap="round"
              />
            );
          }

          if (node.type === "path") {
            const stroke = s(node.props.stroke, "#111111");
            const strokeWidth = n(node.props.strokeWidth, 2);
            const pts = Array.isArray(node.props.points) ? (node.props.points as unknown[]) : [];
            const mapped: Array<[number, number]> = [];
            for (const p of pts) {
              if (!Array.isArray(p) || p.length < 2) continue;
              const xn = n(p[0], NaN);
              const yn = n(p[1], NaN);
              if (!Number.isFinite(xn) || !Number.isFinite(yn)) continue;
              mapped.push([node.x + xn * node.w, node.y + yn * node.h]);
            }
            if (mapped.length < 2) return null;
            const d = mapped.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
            return <path key={node.id} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
          }

          return null;
        })}
      </svg>

      {doc.nodes.map((node) => {
        if (node.hidden) return null;
        const locked = !!node.locked;
        const pe = interactive && !locked ? "auto" : "none";

        if (node.type === "box" || node.type === "frame") {
          const fill = pickFill(node.props, node.type === "frame" ? "#FFFFFF" : "#F5F5F5");
          const radius = n(node.props.radius, 12);
          const stroke = s(node.props.stroke, "");
          const strokeWidth = n(node.props.strokeWidth, 0);
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                ...nodeStyle(node),
                pointerEvents: pe,
                background: fill,
                borderRadius: radius,
                border: strokeWidth > 0 ? `${strokeWidth}px solid ${stroke || "#111111"}` : undefined,
              }}
            />
          );
        }

        if (node.type === "shape_rect") {
          const fill = pickFill(node.props, "#EDEDED");
          const radius = n(node.props.radius, 16);
          const stroke = s(node.props.stroke, "#111111");
          const strokeWidth = n(node.props.strokeWidth, 0);
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                ...nodeStyle(node),
                pointerEvents: pe,
                background: fill,
                borderRadius: radius,
                border: strokeWidth > 0 ? `${strokeWidth}px solid ${stroke}` : undefined,
              }}
            />
          );
        }

        if (node.type === "shape_ellipse") {
          const fill = pickFill(node.props, "#EDEDED");
          const stroke = s(node.props.stroke, "#111111");
          const strokeWidth = n(node.props.strokeWidth, 0);
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                ...nodeStyle(node),
                pointerEvents: pe,
                background: fill,
                borderRadius: 9999,
                border: strokeWidth > 0 ? `${strokeWidth}px solid ${stroke}` : undefined,
              }}
            />
          );
        }

        if (node.type === "text") {
          const text = s(node.props.text, "");
          const color = s(node.props.color, "#111111");
          const fontSize = n(node.props.fontSize, 16);
          const fontWeight = n(node.props.fontWeight, 500);
          const align = s(node.props.align, "left");
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                ...nodeStyle(node),
                pointerEvents: pe,
                color,
                fontSize,
                fontWeight,
                display: "flex",
                alignItems: "center",
                justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
                textAlign: align as any,
                padding: 4,
                whiteSpace: "pre-wrap",
                wordBreak: "keep-all",
                lineBreak: "strict",
              }}
            >
              {text}
            </div>
          );
        }

        if (node.type === "image") {
          const url = s(node.props.url, "");
          const radius = n(node.props.radius, 12);
          return (
            <div
              key={node.id}
              className="absolute overflow-hidden border border-neutral-200 bg-neutral-100"
              style={{ ...nodeStyle(node), pointerEvents: pe, borderRadius: radius }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">Image</div>
              )}
            </div>
          );
        }

        if (node.type === "divider") {
          const color = s(node.props.color, "#EAEAEA");
          const thickness = n(node.props.thickness, 1);
          return (
            <div
              key={node.id}
              className="absolute"
              style={{ ...nodeStyle(node), pointerEvents: pe, height: thickness, background: color }}
            />
          );
        }

        if (node.type === "badge") {
          const label = s(node.props.label, "배지");
          const fill = pickFill(node.props, "#F1F1F1");
          const color = s(node.props.color, "#111111");
          const radius = n(node.props.radius, 999);
          return (
            <div
              key={node.id}
              className="absolute flex items-center justify-center px-2 text-[10px] font-medium"
              style={{ ...nodeStyle(node), pointerEvents: pe, background: fill, color, borderRadius: radius }}
            >
              {label}
            </div>
          );
        }

        if (node.type === "button") {
          const label = s(node.props.label, "버튼");
          const variant = s(node.props.variant, "primary");
          const fill = pickFill(node.props, "#111111");
          const color = s(node.props.color, "#FFFFFF");
          const radius = n(node.props.radius, 999);
          const fontSize = n(node.props.fontSize, 13);
          const fontWeight = n(node.props.fontWeight, 600);
          const outline = variant === "outline";
          return (
            <button
              key={node.id}
              type="button"
              className="absolute"
              style={{
                ...nodeStyle(node),
                pointerEvents: interactive && !locked ? "auto" : "none",
                background: outline ? "transparent" : fill,
                color: outline ? fill : color,
                borderRadius: radius,
                fontSize,
                fontWeight,
                border: outline ? `1px solid ${fill}` : undefined,
              }}
              onClick={() => applyAction(runtime, node.action, node)}
            >
              {label}
            </button>
          );
        }

        if (node.type === "link") {
          const label = s(node.props.label, "링크");
          const border = s(node.props.border, "#3B82F6");
          const background = s(node.props.background, "rgba(59,130,246,0.10)");
          return (
            <div
              key={node.id}
              className="absolute flex items-center justify-center text-[10px] font-medium"
              style={{
                ...nodeStyle(node),
                pointerEvents: pe,
                borderRadius: 12,
                border: `1px dashed ${border}`,
                background,
                color: border,
              }}
              onClick={() => applyAction(runtime, node.action, node)}
              role={interactive ? "button" : undefined}
            >
              {label}
            </div>
          );
        }

        // ---- Forms ----
        if (node.type === "input" || node.type === "textarea") {
          const placeholder = s(node.props.placeholder, "입력");
          const fill = s(node.props.fill, "#FFFFFF");
          const stroke = s(node.props.stroke, "#E5E5E5");
          const strokeWidth = n(node.props.strokeWidth, 1);
          const radius = n(node.props.radius, 12);

          const bindKey = node.bind?.key;
          const value = bindKey && runtime?.state ? String(runtime.state[bindKey] ?? "") : "";

          const commonStyle = {
            ...nodeStyle(node),
            pointerEvents: interactive && !locked ? "auto" : "none",
            background: fill,
            border: `${strokeWidth}px solid ${stroke}`,
            borderRadius: radius,
            padding: 10,
            fontSize: 13,
            outline: "none",
          } as const;

          const onChange = (nextValue: string) => {
            if (!interactive || locked) return;
            if (!bindKey || !runtime?.setState) return;
            runtime.setState({ [bindKey]: nextValue });
          };

          if (node.type === "textarea") {
            return (
              <textarea
                key={node.id}
                style={commonStyle as any}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
            );
          }

          return (
            <input
              key={node.id}
              style={commonStyle as any}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          );
        }

        if (node.type === "checkbox") {
          const label = s(node.props.label, "동의");
          const color = s(node.props.color, "#111111");
          const bindKey = node.bind?.key;
          const checked = bindKey && runtime?.state ? !!runtime.state[bindKey] : false;

          const onToggle = (v: boolean) => {
            if (!interactive || locked) return;
            if (!bindKey || !runtime?.setState) return;
            runtime.setState({ [bindKey]: v });
          };

          return (
            <label
              key={node.id}
              className="absolute flex items-center gap-2 text-sm"
              style={{ ...nodeStyle(node), pointerEvents: interactive && !locked ? "auto" : "none", color }}
            >
              <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
              <span>{label}</span>
            </label>
          );
        }

        if (node.type === "select") {
          const options = safeArrayOfStrings(node.props.options);
          const fill = s(node.props.fill, "#FFFFFF");
          const stroke = s(node.props.stroke, "#E5E5E5");
          const strokeWidth = n(node.props.strokeWidth, 1);
          const radius = n(node.props.radius, 12);
          const bindKey = node.bind?.key;
          const value = bindKey && runtime?.state ? String(runtime.state[bindKey] ?? "") : "";

          const onChange = (nextValue: string) => {
            if (!interactive || locked) return;
            if (!bindKey || !runtime?.setState) return;
            runtime.setState({ [bindKey]: nextValue });
          };

          return (
            <select
              key={node.id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute text-sm"
              style={{
                ...nodeStyle(node),
                pointerEvents: interactive && !locked ? "auto" : "none",
                background: fill,
                border: `${strokeWidth}px solid ${stroke}`,
                borderRadius: radius,
                padding: "0 10px",
              }}
            >
              <option value="">선택</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          );
        }

        if (node.type === "slider") {
          const min = n(node.props.min, 0);
          const max = n(node.props.max, 100);
          const step = n(node.props.step, 1);
          const bindKey = node.bind?.key;
          const value = bindKey && runtime?.state ? Number(runtime.state[bindKey] ?? min) : min;

          const onChange = (nextValue: number) => {
            if (!interactive || locked) return;
            if (!bindKey || !runtime?.setState) return;
            runtime.setState({ [bindKey]: nextValue });
          };

          return (
            <input
              key={node.id}
              type="range"
              min={min}
              max={max}
              step={step}
              value={Number.isFinite(value) ? value : min}
              onChange={(e) => onChange(Number(e.target.value))}
              className="absolute"
              style={{ ...nodeStyle(node), pointerEvents: interactive && !locked ? "auto" : "none" }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
