"use client";

import React, { useEffect, useMemo, useState } from "react";

/** N4: 이미지 로드 실패 시 placeholder·경고 표시 */
function MediaImageWithError({
  nodeId,
  href,
  fw,
  fh,
  offsetX,
  offsetY,
  scale,
  preserve,
  clipId,
  filterUrl,
}: {
  nodeId: string;
  href: string;
  fw: number;
  fh: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  preserve: string;
  clipId: string;
  filterUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <g>
        <rect
          x={0}
          y={0}
          width={fw}
          height={fh}
          fill="#F3F3F3"
          stroke="#E57373"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <line x1={0} y1={0} x2={fw} y2={fh} stroke="#E57373" strokeWidth={1} />
        <line x1={fw} y1={0} x2={0} y2={fh} stroke="#E57373" strokeWidth={1} />
        <text x={fw / 2} y={fh / 2} textAnchor="middle" dominantBaseline="middle" fill="#C62828" fontSize={12}>
          이미지 로드 실패
        </text>
      </g>
    );
  }
  return (
    <image
      href={href}
      x={offsetX}
      y={offsetY}
      width={fw * scale}
      height={fh * scale}
      preserveAspectRatio={preserve}
      clipPath={`url(#${clipId})`}
      filter={filterUrl}
      onError={() => setFailed(true)}
    />
  );
}
import { hydrateDoc } from "../doc/scene";
import { layoutDoc } from "../layout/engine";
import type { Doc, Node, SerializableDoc, Fill, Stroke, StyleToken, TextStyle, PrototypeAction, PrototypeTrigger, Variable } from "../doc/scene";
import { getPageContentBounds, getNodeChildrenBounds } from "./bounds";
import { getCustomNodeRenderer } from "./plugins";

function getEffectFilterId(prefix: string, nodeId: string) {
  return `${prefix}-${nodeId}`;
}

export type NavigateEvent = {
  pageId: string;
  nodeId: string;
  trigger: PrototypeTrigger;
  action: PrototypeAction;
};

const DEFAULT_FONT_FAMILY = "Space Grotesk, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

let textMeasureCanvas: HTMLCanvasElement | null = null;
function getTextMeasureContext() {
  if (typeof document === "undefined") return null;
  if (!textMeasureCanvas) textMeasureCanvas = document.createElement("canvas");
  return textMeasureCanvas.getContext("2d");
}

function measureTextWidth(text: string, style: TextStyle) {
  const fontSize = style.fontSize ?? 16;
  const fontWeight = style.fontWeight ?? 400;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  const ctx = getTextMeasureContext();
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const base = ctx.measureText(text).width;
  const spacing = style.letterSpacing ?? 0;
  const extra = text.length > 1 ? (text.length - 1) * spacing : 0;
  return base + extra;
}

function wrapTextLines(text: string, style: TextStyle, maxWidth: number) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return text.split("\n");
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (!current) {
        current = candidate;
        return;
      }
      if (measureTextWidth(candidate, style) <= maxWidth) {
        current = candidate;
        return;
      }
      lines.push(current);
      if (measureTextWidth(word, style) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          const nextChunk = chunk + char;
          if (measureTextWidth(nextChunk, style) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk = nextChunk;
          }
        }
        if (chunk) lines.push(chunk);
        current = "";
        return;
      }
      current = word;
    });
    if (current) lines.push(current);
  });
  return lines;
}

type Props = {
  doc: Doc | SerializableDoc;
  activePageId?: string;
  interactive?: boolean;
  onNavigate?: (event: NavigateEvent) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  fitToContent?: boolean;
  controlState?: Record<string, boolean>;
  onToggleControl?: (rootId: string) => void;
  controlTextState?: Record<string, string>;
  onChangeControlText?: (rootId: string, value: string) => void;
  variableRuntime?: VariableRuntime;
  /** 런타임 변형 오버라이드: instanceId -> variantId (프로토타입 setVariant 액션용) */
  instanceVariantOverrides?: Record<string, string>;
};

export type ControlRole =
  | { type: "checkbox"; role: "root" | "box"; rootId: string; boxId: string }
  | { type: "toggle"; role: "root" | "track" | "knob"; rootId: string; trackId: string; knobId: string; knobOnX: number; knobOffX: number }
  | {
      type: "input";
      role: "root" | "placeholder";
      rootId: string;
      placeholder: string;
      multiline: boolean;
      inputType: "text" | "email" | "password" | "number" | "tel" | "url" | "date";
      padding: { t: number; r: number; b: number; l: number };
      font: { family: string; size: number; weight: number; color: string; lineHeight: number };
    };

function findStyleToken(doc: Doc, id: string | undefined, type: StyleToken["type"]) {
  if (!id) return null;
  const token = doc.styles.find((item) => item.id === id && item.type === type);
  return token ?? null;
}

export type VariableRuntime = {
  mode?: string;
  variableOverrides?: Record<string, string | number | boolean>;
};

function resolveVariableValue(doc: Doc, variable: Variable, variableRuntime?: VariableRuntime) {
  if (variableRuntime?.variableOverrides && variable.id in variableRuntime.variableOverrides) {
    return variableRuntime.variableOverrides[variable.id];
  }
  const mode = variableRuntime?.mode ?? doc.variableMode;
  if (mode && variable.modes && mode in variable.modes) {
    return variable.modes[mode];
  }
  return variable.value;
}

function resolveVariableColor(doc: Doc, id: string | undefined, variableRuntime?: VariableRuntime) {
  if (!id) return null;
  const variable = doc.variables.find((item) => item.id === id && item.type === "color");
  if (!variable) return null;
  const value = resolveVariableValue(doc, variable, variableRuntime);
  return typeof value === "string" ? value : null;
}

function resolveFill(doc: Doc, node: Node): Fill[] {
  const token = findStyleToken(doc, node.style.fillStyleId, "fill");
  if (token && Array.isArray(token.value)) return token.value as Fill[];
  return node.style.fills;
}

function pickFill(doc: Doc, node: Node, variableRuntime?: VariableRuntime): string {
  const variableColor = resolveVariableColor(doc, node.style.fillRef, variableRuntime);
  if (variableColor) return variableColor;
  const fills = resolveFill(doc, node);
  if (!fills.length) return "transparent";
  const fill = fills[0];
  if (fill.type === "solid") return fill.color;
  if (fill.type === "linear") return `url(#${GRADIENT_PREFIX}-${node.id})`;
  return "#E5E7EB";
}

function pickStroke(doc: Doc, node: Node): {
  color: string;
  width: number;
  dash: number[];
  align?: Stroke["align"];
  cap?: "butt" | "round" | "square";
  join?: "miter" | "round" | "bevel";
  miter?: number;
} {
  const token = findStyleToken(doc, node.style.strokeStyleId, "stroke");
  const strokes = token && Array.isArray(token.value) ? (token.value as Stroke[]) : node.style.strokes;
  if (!strokes.length) return { color: "transparent", width: 0, dash: [] };
  const stroke = strokes[0];
  return {
    color: stroke.color,
    width: stroke.width,
    dash: stroke.dash ?? [],
    align: stroke.align,
    cap: node.style.strokeCap ?? "butt",
    join: node.style.strokeJoin ?? "miter",
    miter: node.style.strokeMiter ?? 4,
  };
}

function resolveTextStyle(doc: Doc, node: Node): TextStyle | null {
  const token = findStyleToken(doc, node.text?.styleRef, "text");
  if (token && token.value && typeof token.value === "object") return token.value as TextStyle;
  return node.text?.style ?? null;
}

function resolveTextTokens(doc: Doc, value: string, variableRuntime?: VariableRuntime) {
  if (!value || !doc.variables.length) return value;
  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, raw) => {
    const key = String(raw ?? "").trim();
    if (!key) return "";
    const variable =
      doc.variables.find((item) => item.id === key) ??
      doc.variables.find((item) => item.name.toLowerCase() === key.toLowerCase());
    if (!variable) return "";
    const val = resolveVariableValue(doc, variable, variableRuntime);
    if (val == null) return "";
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
    return JSON.stringify(val);
  });
}

function resolveEffects(doc: Doc, node: Node) {
  const token = findStyleToken(doc, node.style.effectStyleId, "effect");
  if (token && Array.isArray(token.value)) return token.value as NonNullable<Node["style"]>["effects"];
  return node.style.effects ?? [];
}

function renderShape(
  doc: Doc,
  node: Node,
  options?: {
    frame?: Node["frame"];
    fill?: string;
    stroke?: {
      color: string;
      width: number;
      dash?: number[];
      align?: Stroke["align"];
      cap?: "butt" | "round" | "square";
      join?: "miter" | "round" | "bevel";
      miter?: number;
    };
    filterId?: string;
  },
  variableRuntime?: VariableRuntime,
) {
  const fill = options?.fill ?? pickFill(doc, node, variableRuntime);
  const baseStroke = options?.stroke ? { ...options.stroke, dash: options.stroke.dash ?? [] } : pickStroke(doc, node);
  const stroke = {
    ...baseStroke,
    cap: baseStroke.cap ?? node.style.strokeCap ?? "butt",
    join: baseStroke.join ?? node.style.strokeJoin ?? "miter",
    miter: baseStroke.miter ?? node.style.strokeMiter ?? 4,
  };
  const frame = options?.frame ?? node.frame;
  const filterId = options?.filterId;
  const strokeAlign = stroke.align ?? "center";
  const strokeInset =
    strokeAlign === "inside" ? stroke.width / 2 : strokeAlign === "outside" ? -stroke.width / 2 : 0;
  const strokeLinecap = stroke.cap ?? "butt";
  const strokeLinejoin = stroke.join ?? "miter";
  const strokeMiterlimit = stroke.miter ?? 4;

  switch (node.type) {
    case "rect":
    case "frame":
    case "section":
    case "component":
    case "instance":
    case "hotspot": {
      const radius = typeof node.style.radius === "number" ? node.style.radius : 0;
      const adjW = Math.max(0, frame.w - strokeInset * 2);
      const adjH = Math.max(0, frame.h - strokeInset * 2);
      return (
        <rect
          x={strokeInset}
          y={strokeInset}
          width={adjW}
          height={adjH}
          rx={Math.max(0, radius - strokeInset)}
          ry={Math.max(0, radius - strokeInset)}
          fill={fill}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "ellipse": {
      const adjW = Math.max(0, frame.w - strokeInset * 2);
      const adjH = Math.max(0, frame.h - strokeInset * 2);
      return (
        <ellipse
          cx={frame.w / 2}
          cy={frame.h / 2}
          rx={Math.max(0, adjW / 2)}
          ry={Math.max(0, adjH / 2)}
          fill={fill}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "polygon": {
      const sides = Math.max(3, Math.round(node.shape?.polygonSides ?? 6));
      const cx = frame.w / 2;
      const cy = frame.h / 2;
      const r = Math.max(0, Math.min(frame.w, frame.h) / 2 - strokeInset);
      const points = Array.from({ length: sides }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      });
      return (
        <polygon
          points={points.join(" ")}
          fill={fill}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "star": {
      const spikes = Math.max(3, Math.round(node.shape?.starPoints ?? 5));
      const cx = frame.w / 2;
      const cy = frame.h / 2;
      const outer = Math.max(0, Math.min(frame.w, frame.h) / 2 - strokeInset);
      const innerRatio = Math.max(0.1, Math.min(0.9, node.shape?.starInnerRatio ?? 0.5));
      const inner = outer * innerRatio;
      const points: string[] = [];
      for (let i = 0; i < spikes * 2; i += 1) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
      }
      return (
        <polygon
          points={points.join(" ")}
          fill={fill}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "path": {
      const w = frame.w;
      const h = frame.h;
      const defaultPath = `M 0 ${h * 0.8} C ${w * 0.2} ${h * 0.1}, ${w * 0.8} ${h * 0.9}, ${w} ${h * 0.2}`;
      const d = (node.shape?.pathData ?? "").trim() || defaultPath;
      return (
        <path
          d={d}
          fill="none"
          stroke={stroke.color}
          strokeWidth={Math.max(1, stroke.width)}
          strokeDasharray={stroke.dash.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "line": {
      return (
        <line
          x1={0}
          y1={0}
          x2={frame.w}
          y2={frame.h}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "arrow": {
      return (
        <line
          x1={0}
          y1={0}
          x2={frame.w}
          y2={frame.h}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          markerEnd="url(#adv-arrow)"
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "text": {
      const text = resolveTextTokens(doc, node.text?.value ?? "");
      const style = resolveTextStyle(doc, node) ?? {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0,
        align: "left",
      };
      const fontSize = style.fontSize ?? 16;
      const align = style.align ?? "left";
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const textX = align === "center" ? frame.w / 2 : align === "right" ? frame.w : 0;
      const lineHeightRatio = style.lineHeight ?? 1.4;
      const lineHeight = (Number.isFinite(lineHeightRatio) && lineHeightRatio > 0 ? lineHeightRatio : 1.4) * fontSize;
      const wrapEnabled = node.text?.wrap !== false;
      const lines = wrapEnabled ? wrapTextLines(text, style, Math.max(4, frame.w)) : text.split("\n");
      return (
        <text
          x={textX}
          y={fontSize}
          fill={fill}
          fontFamily={style.fontFamily ?? DEFAULT_FONT_FAMILY}
          fontSize={fontSize}
          fontWeight={style.fontWeight ?? 500}
          fontStyle={style.italic ? "italic" : "normal"}
          style={{
            textDecoration: [style.underline && "underline", style.lineThrough && "line-through"].filter(Boolean).join(" ") || undefined,
            textTransform: style.textCase === "upper" ? "uppercase" : style.textCase === "lower" ? "lowercase" : style.textCase === "capitalize" ? "capitalize" : undefined,
            letterSpacing: style.letterSpacing ?? 0,
            fontFeatureSettings: style.fontFeatureSettings?.trim() || undefined,
          }}
          textAnchor={anchor}
          filter={filterId ? `url(#${filterId})` : undefined}
        >
          {lines.map((line, index) => (
            <tspan key={`${node.id}-line-${index}`} x={textX} dy={index === 0 ? 0 : lineHeight}>
              {line || " "}
            </tspan>
          ))}
        </text>
      );
    }
    case "image":
    case "video": {
      const media = node.type === "video" ? node.video : node.image;
      const href = media?.src?.trim();
      const fit = media?.fit ?? "cover";
      const scale = media?.scale ?? 1;
      const offsetX = media?.offsetX ?? 0;
      const offsetY = media?.offsetY ?? 0;
      const preserve = fit === "contain" ? "xMidYMid meet" : fit === "fill" ? "none" : "xMidYMid slice";
      if (!href) {
        return (
          <g>
            <rect
              x={0}
              y={0}
              width={frame.w}
              height={frame.h}
              fill="#F3F3F3"
              stroke="#B8B8B8"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <line x1={0} y1={0} x2={frame.w} y2={frame.h} stroke="#B8B8B8" strokeWidth={1} />
            <line x1={frame.w} y1={0} x2={0} y2={frame.h} stroke="#B8B8B8" strokeWidth={1} />
          </g>
        );
      }
      const fw = frame.w;
      const fh = frame.h;
      const clipId = `rt-media-clip-${node.id}`;
      const radius = typeof node.style.radius === "number" ? node.style.radius : 0;
      const crop = media?.crop;
      const cropRect = crop && crop.w > 0 && crop.h > 0 ? { x: crop.x * fw, y: crop.y * fh, w: crop.w * fw, h: crop.h * fh } : null;
      const brightness = media?.brightness ?? 1;
      const contrast = media?.contrast ?? 1;
      const needBcFilter = Math.abs(brightness - 1) > 0.01 || Math.abs(contrast - 1) > 0.01;
      const bcFilterId = needBcFilter ? `rt-media-bc-${node.id}-${brightness}-${contrast}` : undefined;
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <rect x={cropRect?.x ?? 0} y={cropRect?.y ?? 0} width={cropRect?.w ?? fw} height={cropRect?.h ?? fh} rx={radius} ry={radius} />
            </clipPath>
            {needBcFilter ? (
              <filter id={bcFilterId}>
                <feComponentTransfer>
                  <feFuncR type="linear" slope={brightness * contrast} intercept={(1 - contrast) * 0.5} />
                  <feFuncG type="linear" slope={brightness * contrast} intercept={(1 - contrast) * 0.5} />
                  <feFuncB type="linear" slope={brightness * contrast} intercept={(1 - contrast) * 0.5} />
                </feComponentTransfer>
              </filter>
            ) : null}
          </defs>
          <MediaImageWithError
            nodeId={node.id}
            href={href}
            fw={fw}
            fh={fh}
            offsetX={offsetX}
            offsetY={offsetY}
            scale={scale}
            preserve={preserve}
            clipId={clipId}
            filterUrl={bcFilterId ? `url(#${bcFilterId})` : filterId ? `url(#${filterId})` : undefined}
          />
        </g>
      );
    }
    default: {
      return (
        <rect
          x={0}
          y={0}
          width={frame.w}
          height={frame.h}
          fill={fill}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeDasharray={stroke.dash.join(" ")}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
  }
}

function renderClipShape(node: Node, frame: Node["frame"]) {
  const radius = typeof node.style.radius === "number" ? node.style.radius : 0;
  switch (node.type) {
    case "ellipse":
      return <ellipse cx={frame.w / 2} cy={frame.h / 2} rx={Math.max(0, frame.w / 2)} ry={Math.max(0, frame.h / 2)} />;
    case "polygon": {
      const sides = Math.max(3, Math.round(node.shape?.polygonSides ?? 6));
      const cx = frame.w / 2;
      const cy = frame.h / 2;
      const r = Math.min(frame.w, frame.h) / 2;
      const points = Array.from({ length: sides }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      });
      return <polygon points={points.join(" ")} />;
    }
    case "star": {
      const spikes = Math.max(3, Math.round(node.shape?.starPoints ?? 5));
      const cx = frame.w / 2;
      const cy = frame.h / 2;
      const outer = Math.min(frame.w, frame.h) / 2;
      const innerRatio = Math.max(0.1, Math.min(0.9, node.shape?.starInnerRatio ?? 0.5));
      const inner = outer * innerRatio;
      const points: string[] = [];
      for (let i = 0; i < spikes * 2; i += 1) {
        const radiusVal = i % 2 === 0 ? outer : inner;
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        points.push(`${cx + radiusVal * Math.cos(angle)},${cy + radiusVal * Math.sin(angle)}`);
      }
      return <polygon points={points.join(" ")} />;
    }
    default:
      return <rect x={0} y={0} width={frame.w} height={frame.h} rx={radius} ry={radius} />;
  }
}

function buildEffectDefs(doc: Doc, prefix: string) {
  const defs: React.ReactElement[] = [];
  Object.values(doc.nodes).forEach((node) => {
    const effects = resolveEffects(doc, node);
    if (!effects.length) return;
    const filterId = getEffectFilterId(prefix, node.id);
    const primitives = effects.map((effect, index) => {
      if (effect.type === "shadow") {
        const opacity = typeof effect.opacity === "number" ? effect.opacity : 0.2;
        return (
          <feDropShadow
            key={`${filterId}-shadow-${index}`}
            dx={effect.x}
            dy={effect.y}
            stdDeviation={Math.max(0, effect.blur)}
            floodColor={effect.color}
            floodOpacity={opacity}
          />
        );
      }
      if (effect.type === "blur") {
        return <feGaussianBlur key={`${filterId}-blur-${index}`} stdDeviation={Math.max(0, effect.blur)} />;
      }
      if (effect.type === "noise") {
        const amount = typeof effect.amount === "number" ? effect.amount : 0.4;
        return (
          <feTurbulence
            key={`${filterId}-noise-${index}`}
            type="fractalNoise"
            baseFrequency={amount}
            numOctaves={2}
            result="noise"
          />
        );
      }
      return null;
    });
    defs.push(
      <filter key={filterId} id={filterId} x="-50%" y="-50%" width="200%" height="200%">
        {primitives}
      </filter>,
    );
  });
  return defs;
}

const GRADIENT_PREFIX = "rt-linear";

function buildGradientDefs(doc: Doc) {
  const defs: React.ReactElement[] = [];
  Object.values(doc.nodes).forEach((node) => {
    const fills = resolveFill(doc, node);
    const fill = fills[0];
    if (!fill || fill.type !== "linear") return;
    const rad = (fill.angle * Math.PI) / 180;
    const x1 = 0.5 - 0.5 * Math.cos(rad);
    const y1 = 0.5 - 0.5 * Math.sin(rad);
    const x2 = 0.5 + 0.5 * Math.cos(rad);
    const y2 = 0.5 + 0.5 * Math.sin(rad);
    const stops = fill.stops && fill.stops.length >= 2
      ? fill.stops
      : [{ offset: 0, color: fill.from }, { offset: 1, color: fill.to }];
    defs.push(
      <linearGradient
        key={`${GRADIENT_PREFIX}-${node.id}`}
        id={`${GRADIENT_PREFIX}-${node.id}`}
        gradientUnits="objectBoundingBox"
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
      >
        {stops.map((s, i) => (
          <stop key={i} offset={s.offset} stopColor={s.color} />
        ))}
      </linearGradient>,
    );
  });
  return defs;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function isCheckboxName(value: string) {
  const name = normalizeName(value);
  return name.includes("체크") || name.includes("checkbox");
}

function isToggleName(value: string) {
  const name = normalizeName(value);
  return name.includes("토글") || name.includes("toggle") || name.includes("switch");
}

function isInputName(value: string) {
  const name = normalizeName(value);
  return name.includes("입력") || name.includes("input") || name.includes("textfield") || name.includes("text field");
}

function isTextareaName(value: string) {
  const name = normalizeName(value);
  return name.includes("텍스트 영역") || name.includes("textarea") || name.includes("multi") || name.includes("메시지");
}

function resolveInputType(value: string) {
  const name = normalizeName(value);
  if (name.includes("password") || name.includes("비밀번호")) return "password";
  if (name.includes("email") || name.includes("이메일")) return "email";
  if (name.includes("url") || name.includes("링크")) return "url";
  if (name.includes("전화") || name.includes("phone") || name.includes("tel")) return "tel";
  if (name.includes("날짜") || name.includes("date")) return "date";
  if (name.includes("숫자") || name.includes("number")) return "number";
  return "text";
}

export function buildControlRoles(doc: Doc, variableRuntime?: VariableRuntime) {
  const roles: Record<string, ControlRole> = {};
  Object.values(doc.nodes).forEach((node) => {
    if (!["frame", "section", "component", "instance", "group", "slice"].includes(node.type)) return;
    if (roles[node.id]) return;
    const children = node.children.map((id) => doc.nodes[id]).filter(Boolean) as Node[];
    const name = node.name ?? "";
    const safeNumber = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
    const defaultPadding = { t: 8, r: 12, b: 8, l: 12 };

    const isTextarea = isTextareaName(name);
    const isInput = !isTextarea && isInputName(name);
    if (isTextarea || isInput) {
      const placeholderNode = children.find((child) => child.type === "text");
      const placeholder = placeholderNode?.text?.value ?? "";
      const inputType = resolveInputType(`${name} ${placeholder}`);
      const placeholderStyle = placeholderNode?.text?.style;
      const placeholderFill = placeholderNode ? pickFill(doc, placeholderNode, variableRuntime) : "#111111";
      const font = {
        family: placeholderStyle?.fontFamily ?? DEFAULT_FONT_FAMILY,
        size: placeholderStyle?.fontSize ?? 14,
        weight: placeholderStyle?.fontWeight ?? 400,
        color: placeholderFill,
        lineHeight: placeholderStyle?.lineHeight ?? 1.4,
      };
      let padding = defaultPadding;
      if (node.layout?.mode === "auto") {
        padding = {
          t: safeNumber(node.layout.padding.t, defaultPadding.t),
          r: safeNumber(node.layout.padding.r, defaultPadding.r),
          b: safeNumber(node.layout.padding.b, defaultPadding.b),
          l: safeNumber(node.layout.padding.l, defaultPadding.l),
        };
      } else if (placeholderNode) {
        const left = safeNumber(placeholderNode.frame.x, defaultPadding.l);
        const top = safeNumber(placeholderNode.frame.y, defaultPadding.t);
        const right = safeNumber(node.frame.w - (placeholderNode.frame.x + placeholderNode.frame.w), defaultPadding.r);
        const bottom = safeNumber(node.frame.h - (placeholderNode.frame.y + placeholderNode.frame.h), defaultPadding.b);
        padding = { t: top, r: Math.max(0, right), b: Math.max(0, bottom), l: Math.max(0, left) };
      }
      roles[node.id] = {
        type: "input",
        role: "root",
        rootId: node.id,
        placeholder,
        multiline: isTextarea,
        inputType,
        padding,
        font,
      };
      if (placeholderNode) {
        roles[placeholderNode.id] = {
          type: "input",
          role: "placeholder",
          rootId: node.id,
          placeholder,
          multiline: isTextarea,
          inputType,
          padding,
          font,
        };
      }
    }

    const rectChild = children.find((child) => child.type === "rect");
    const textChild = children.find((child) => child.type === "text");
    const smallRect = rectChild ? rectChild.frame.w <= 24 && rectChild.frame.h <= 24 : false;
    if (rectChild && (isCheckboxName(name) || (textChild && smallRect))) {
      roles[node.id] = { type: "checkbox", role: "root", rootId: node.id, boxId: rectChild.id };
      roles[rectChild.id] = { type: "checkbox", role: "box", rootId: node.id, boxId: rectChild.id };
    }

    const hasToggle = isToggleName(name) || children.some((child) => isToggleName(child.name ?? ""));
    if (!hasToggle) return;
    const switchGroup =
      children.find((child) => (child.type === "group" || child.type === "frame") && isToggleName(child.name ?? "")) ??
      children.find((child) => child.type === "group" || child.type === "frame");
    if (!switchGroup) return;
    const switchChildren = switchGroup.children.map((id) => doc.nodes[id]).filter(Boolean) as Node[];
    const track = switchChildren.find((child) => child.type === "rect");
    const knob = switchChildren.find((child) => child.type === "ellipse");
    if (!track || !knob) return;
    const knobOffX = knob.frame.x;
    const knobOnX = Math.max(knobOffX, track.frame.w - knob.frame.w - knobOffX);
    roles[node.id] = {
      type: "toggle",
      role: "root",
      rootId: node.id,
      trackId: track.id,
      knobId: knob.id,
      knobOnX,
      knobOffX,
    };
    roles[track.id] = {
      type: "toggle",
      role: "track",
      rootId: node.id,
      trackId: track.id,
      knobId: knob.id,
      knobOnX,
      knobOffX,
    };
    roles[knob.id] = {
      type: "toggle",
      role: "knob",
      rootId: node.id,
      trackId: track.id,
      knobId: knob.id,
      knobOnX,
      knobOffX,
    };
  });
  return roles;
}

function collectDescendants(doc: Doc, rootId: string, out: Set<string>) {
  if (out.has(rootId)) return;
  out.add(rootId);
  const node = doc.nodes[rootId];
  if (!node) return;
  node.children.forEach((childId) => collectDescendants(doc, childId, out));
}

function buildControlRootMap(doc: Doc, roles: Record<string, ControlRole>) {
  const map: Record<string, ControlRole> = {};
  Object.values(roles).forEach((role) => {
    if (role.role !== "root") return;
    const ids = new Set<string>();
    collectDescendants(doc, role.rootId, ids);
    ids.forEach((id) => {
      if (!map[id]) map[id] = role;
    });
  });
  return map;
}

function renderCheckboxMark(frame: Node["frame"], color: string) {
  const x1 = frame.w * 0.2;
  const y1 = frame.h * 0.55;
  const x2 = frame.w * 0.42;
  const y2 = frame.h * 0.75;
  const x3 = frame.w * 0.8;
  const y3 = frame.h * 0.3;
  return <path d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

function renderNodeTree(
  doc: Doc,
  nodeId: string,
  pageId: string,
  interactive?: boolean,
  onNavigate?: (event: NavigateEvent) => void,
  controlRoles?: Record<string, ControlRole>,
  controlRootMap?: Record<string, ControlRole>,
  controlState?: Record<string, boolean>,
  onToggleControl?: (rootId: string) => void,
  controlTextState?: Record<string, string>,
  onChangeControlText?: (rootId: string, value: string) => void,
  variableRuntime?: VariableRuntime,
  instanceVariantOverrides?: Record<string, string>,
): React.ReactNode {
  const node = doc.nodes[nodeId];
  if (!node || node.hidden) return null;

  const role = controlRoles?.[node.id];
  if (role?.type === "input" && role.role === "placeholder" && interactive && onChangeControlText) return null;
  const roleChecked = role ? Boolean(controlState?.[role.rootId]) : false;
  const clickRole = role ?? controlRootMap?.[node.id];
  const frameOverride =
    role && role.type === "toggle" && role.role === "knob" && roleChecked ? { ...node.frame, x: role.knobOnX } : undefined;
  const frame = frameOverride ?? node.frame;
  const x = frame.x;
  const y = frame.y;
  const cx = frame.w / 2;
  const cy = frame.h / 2;

  let effectiveChildIds = node.children;
  if (node.type === "instance" && node.instanceOf && instanceVariantOverrides) {
    const overrideVariantId = instanceVariantOverrides[node.id];
    if (overrideVariantId) {
      const component = doc.nodes[node.instanceOf];
      const variant = component?.variants?.find((v) => v.id === overrideVariantId);
      if (variant?.rootId) effectiveChildIds = [variant.rootId];
    }
  }

  const firstChildId = effectiveChildIds[0];
  const firstChild = firstChildId ? doc.nodes[firstChildId] : null;
  const useMask = effectiveChildIds.length >= 2 && firstChild?.isMask === true;

  const renderChild = (childId: string) =>
    renderNodeTree(
      doc,
      childId,
      pageId,
      interactive,
      onNavigate,
      controlRoles,
      controlRootMap,
      controlState,
      onToggleControl,
      controlTextState,
      onChangeControlText,
      variableRuntime,
      instanceVariantOverrides,
    );

  let childrenArray: React.ReactNode[];
  let childrenContent: React.ReactNode;
  if (useMask && firstChild) {
    const maskId = `rt-mask-${firstChildId}`;
    childrenArray = effectiveChildIds.slice(1).map(renderChild);
    childrenContent = (
      <>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <g transform={`translate(${firstChild.frame.x} ${firstChild.frame.y})`}>
              {renderShape(doc, firstChild, { frame: firstChild.frame, fill: "white" }, variableRuntime)}
            </g>
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>{childrenArray}</g>
      </>
    );
  } else {
    childrenArray = effectiveChildIds.map(renderChild);
    childrenContent = childrenArray;
  }

  const overflow = node.overflowScrolling ?? "none";
  const useOverflow = overflow !== "none" && effectiveChildIds.length > 0;
  if (useOverflow) {
    const bounds = getNodeChildrenBounds(doc, nodeId);
    const overflowX = overflow === "horizontal" || overflow === "both" ? "auto" : "hidden";
    const overflowY = overflow === "vertical" || overflow === "both" ? "auto" : "hidden";
    const safeW = Math.max(1, bounds.w);
    const safeH = Math.max(1, bounds.h);
    const hasSticky = effectiveChildIds.some((id) => doc.nodes[id]?.sticky);
    childrenContent = hasSticky ? (
      <foreignObject x={0} y={0} width={frame.w} height={frame.h}>
        <div
          {...({ xmlns: "http://www.w3.org/1999/xhtml" } as React.HTMLAttributes<HTMLDivElement>)}
          style={{
            overflowX,
            overflowY,
            width: frame.w,
            height: frame.h,
            margin: 0,
            padding: 0,
          }}
        >
          <div style={{ position: "relative", width: safeW, height: safeH }}>
            {effectiveChildIds.map((childId) => {
              const child = doc.nodes[childId];
              if (!child) return null;
              const cw = child.frame.w;
              const ch = child.frame.h;
              const cx = child.frame.x;
              const cy = child.frame.y;
              const childSvg = (
                <svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`} style={{ display: "block" }}>
                  <g transform={`translate(${-cx},${-cy})`}>
                    {renderChild(childId)}
                  </g>
                </svg>
              );
              if (child.sticky) {
                return (
                  <div
                    key={childId}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: cy,
                      width: safeW,
                      height: ch,
                    }}
                  >
                    <div
                      style={{
                        position: "sticky",
                        top: 0,
                        left: cx,
                        width: cw,
                        height: ch,
                        zIndex: 1,
                      }}
                    >
                      {childSvg}
                    </div>
                  </div>
                );
              }
              return (
                <div key={childId} style={{ position: "absolute", left: cx, top: cy, width: cw, height: ch }}>
                  {childSvg}
                </div>
              );
            })}
          </div>
        </div>
      </foreignObject>
    ) : (
      <foreignObject x={0} y={0} width={frame.w} height={frame.h}>
        <div
          {...({ xmlns: "http://www.w3.org/1999/xhtml" } as React.HTMLAttributes<HTMLDivElement>)}
          style={{
            overflowX,
            overflowY,
            width: frame.w,
            height: frame.h,
            margin: 0,
            padding: 0,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={safeW}
            height={safeH}
            viewBox={`${bounds.x} ${bounds.y} ${safeW} ${safeH}`}
            style={{ display: "block" }}
          >
            {childrenContent}
          </svg>
        </div>
      </foreignObject>
    );
  }
  const customRenderer = getCustomNodeRenderer(node.type);
  if (customRenderer) {
    const ctx = { doc, pageId, interactive: !!interactive, variableRuntime };
    const content = customRenderer({ node, ctx, children: childrenArray });
    if (content != null) {
      return (
        <g
          key={node.id}
          transform={`translate(${x} ${y}) rotate(${frame.rotation} ${cx} ${cy})`}
          opacity={node.style.opacity}
        >
          {content}
        </g>
      );
    }
  }
  const clickInteraction = interactive ? node.prototype?.interactions.find((i) => i.trigger === "click") : undefined;
  const hoverInteraction = interactive ? node.prototype?.interactions.find((i) => i.trigger === "hover") : undefined;
  const onPressInteraction = interactive ? node.prototype?.interactions.find((i) => i.trigger === "onPress") : undefined;
  const handleTrigger = (interaction: NonNullable<typeof clickInteraction>, trigger: PrototypeTrigger) => {
    if (!onNavigate) return;
    onNavigate({ pageId, nodeId: node.id, trigger, action: interaction.action });
  };
  const handleClick = clickInteraction || (interactive && clickRole)
    ? (event: React.MouseEvent<SVGGElement>) => {
        event.stopPropagation();
        if (clickRole && clickRole.type !== "input" && onToggleControl) onToggleControl(clickRole.rootId);
        if (clickInteraction) handleTrigger(clickInteraction, "click");
      }
    : undefined;
  const handleHover = hoverInteraction ? () => handleTrigger(hoverInteraction, "hover") : undefined;
  const handleMouseDown = onPressInteraction
    ? (event: React.MouseEvent<SVGGElement>) => {
        event.stopPropagation();
        handleTrigger(onPressInteraction, "onPress");
      }
    : undefined;
  const cursor =
    role?.type === "input"
      ? "text"
      : clickInteraction || hoverInteraction || onPressInteraction || (interactive && clickRole)
        ? "pointer"
        : undefined;
  const blendMode = node.style.blendMode && node.style.blendMode !== "normal" ? node.style.blendMode : undefined;
  const filterId = resolveEffects(doc, node).length ? getEffectFilterId("rt-effect", node.id) : undefined;
  const isCheckboxBox = role?.type === "checkbox" && role.role === "box";
  const isToggleTrack = role?.type === "toggle" && role.role === "track";
  const isToggleKnob = role?.type === "toggle" && role.role === "knob";
  const checkboxFill = isCheckboxBox && roleChecked ? "#111827" : undefined;
  const toggleTrackFill = isToggleTrack && roleChecked ? "#111827" : undefined;
  const renderBase = !(isToggleKnob && roleChecked);
  const inputRole = role && role.type === "input" && role.role === "root" ? role : null;
  const showInput = Boolean(inputRole && interactive && onChangeControlText);
  const inputValue = inputRole ? controlTextState?.[inputRole.rootId] ?? "" : "";
  const shouldClip = Boolean(node.clipContent) && node.children.length > 0;
  const clipId = shouldClip ? `rt-clip-${node.id}` : null;
  const content = (
    <>
      {showInput && inputRole ? (
        <foreignObject x={0} y={0} width={frame.w} height={frame.h}>
          <div
            style={{ width: "100%", height: "100%", display: "flex", alignItems: inputRole.multiline ? "flex-start" : "center" }}
          >
            {inputRole.multiline ? (
              <textarea
                value={inputValue}
                placeholder={inputRole.placeholder}
                onChange={(event) => onChangeControlText?.(inputRole.rootId, event.target.value)}
                style={{
                  width: "100%",
                  height: "100%",
                  padding: `${inputRole.padding.t}px ${inputRole.padding.r}px ${inputRole.padding.b}px ${inputRole.padding.l}px`,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  resize: "none",
                  color: inputRole.font.color,
                  fontFamily: inputRole.font.family,
                  fontSize: inputRole.font.size,
                  fontWeight: inputRole.font.weight,
                  lineHeight: String(inputRole.font.lineHeight),
                }}
              />
            ) : (
              <input
                type={inputRole.inputType}
                value={inputValue}
                placeholder={inputRole.placeholder}
                onChange={(event) => onChangeControlText?.(inputRole.rootId, event.target.value)}
                style={{
                  width: "100%",
                  height: "100%",
                  padding: `${inputRole.padding.t}px ${inputRole.padding.r}px ${inputRole.padding.b}px ${inputRole.padding.l}px`,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: inputRole.font.color,
                  fontFamily: inputRole.font.family,
                  fontSize: inputRole.font.size,
                  fontWeight: inputRole.font.weight,
                  lineHeight: String(inputRole.font.lineHeight),
                }}
              />
            )}
          </div>
        </foreignObject>
      ) : null}
      {childrenContent}
    </>
  );

  return (
    <g
      key={node.id}
      data-node-id={node.id}
      suppressHydrationWarning
      transform={`translate(${x} ${y}) rotate(${frame.rotation} ${cx} ${cy})`}
      opacity={node.style.opacity}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleHover}
      style={cursor || blendMode ? { ...(cursor ? { cursor } : {}), ...(blendMode ? { mixBlendMode: blendMode } : {}) } : undefined}
      pointerEvents={interactive ? "all" : undefined}
    >
      {node.type !== "group" && renderBase
        ? renderShape(doc, node, node.type === "hotspot" && interactive
            ? { frame, fill: "transparent", stroke: { color: "transparent", width: 0, dash: [], align: "center", cap: "butt", join: "miter", miter: 4 }, filterId }
            : { frame, fill: checkboxFill ?? toggleTrackFill ?? undefined, filterId },
          variableRuntime)
        : null}
      {isCheckboxBox && roleChecked ? renderCheckboxMark(frame, "#FFFFFF") : null}
      {isToggleKnob && roleChecked ? renderShape(doc, node, { frame, filterId }, variableRuntime) : null}
      {shouldClip && clipId ? (
        <>
          <defs>
            <clipPath id={clipId}>{renderClipShape(node, frame)}</clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>{content}</g>
        </>
      ) : (
        content
      )}
    </g>
  );
}

export default function RuntimeRenderer({
  doc,
  activePageId,
  interactive,
  onNavigate,
  svgRef,
  fitToContent,
  controlState,
  onToggleControl,
  controlTextState,
  onChangeControlText,
  variableRuntime,
  instanceVariantOverrides,
}: Props) {
  const hydrated = hydrateDoc(doc);
  const laidOut = layoutDoc(hydrated);

  const root = laidOut.nodes[laidOut.root];
  const preferredPageId = activePageId ?? laidOut.prototype?.startPageId;
  const page = preferredPageId ? laidOut.pages.find((p) => p.id === preferredPageId) ?? laidOut.pages[0] : laidOut.pages[0];
  const pageNode = page ? laidOut.nodes[page.rootId] : null;
  const width = pageNode?.frame.w ?? 1200;
  const height = pageNode?.frame.h ?? 800;
  const pageRootIds = pageNode ? [pageNode.id] : root.children;
  const bounds = getPageContentBounds(laidOut, page?.id ?? null);
  const resolvedBounds = bounds && bounds.w > 0 && bounds.h > 0 ? bounds : null;
  const hasContent = Boolean(pageNode?.children?.length);
  const isLargeCanvas = Boolean(pageNode && (pageNode.frame.w >= 2400 || pageNode.frame.h >= 1800));
  const fitContent = Boolean(resolvedBounds && (fitToContent || (isLargeCanvas && hasContent)));
  const minX = resolvedBounds ? Math.min(0, resolvedBounds.x) : 0;
  const minY = resolvedBounds ? Math.min(0, resolvedBounds.y) : 0;
  const maxX = resolvedBounds ? Math.max(width, resolvedBounds.x + resolvedBounds.w) : width;
  const maxY = resolvedBounds ? Math.max(height, resolvedBounds.y + resolvedBounds.h) : height;
  const extendedWidth = maxX - minX;
  const extendedHeight = maxY - minY;
  const svgWidth = fitContent && resolvedBounds ? resolvedBounds.w : extendedWidth;
  const svgHeight = fitContent && resolvedBounds ? resolvedBounds.h : extendedHeight;
  const viewBox = fitContent && resolvedBounds ? `${resolvedBounds.x} ${resolvedBounds.y} ${resolvedBounds.w} ${resolvedBounds.h}` : `${minX} ${minY} ${extendedWidth} ${extendedHeight}`;
  const controlRoles = useMemo(() => buildControlRoles(laidOut, variableRuntime), [laidOut, variableRuntime]);
  const controlRootMap = useMemo(() => buildControlRootMap(laidOut, controlRoles), [laidOut, controlRoles]);
  const effectDefs = useMemo(() => buildEffectDefs(laidOut, "rt-effect"), [laidOut]);
  const gradientDefs = useMemo(() => buildGradientDefs(laidOut), [laidOut]);

  return (
    <svg
      ref={svgRef}
      width={svgWidth}
      height={svgHeight}
      viewBox={viewBox}
      preserveAspectRatio="xMinYMin meet"
      style={{ display: "block" }}
    >
      <defs>
        <marker id="adv-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111111" />
        </marker>
        {gradientDefs}
        {effectDefs}
      </defs>
      {pageRootIds.map((childId) =>
        renderNodeTree(
          laidOut,
          childId,
          page?.id ?? "page",
          interactive,
          onNavigate,
          controlRoles,
          controlRootMap,
          controlState,
          onToggleControl,
          controlTextState,
          onChangeControlText,
          variableRuntime,
          instanceVariantOverrides,
        ),
      )}
    </svg>
  );
}
