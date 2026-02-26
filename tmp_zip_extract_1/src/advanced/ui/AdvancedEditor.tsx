"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addNode,
  cloneDoc,
  createDoc,
  createNode,
  makeId,
  hydrateDoc,
  serializeDoc,
  DEFAULT_TEXT_STYLE,
  type Doc,
  type Constraints,
  type Effect,
  type Fill,
  type Frame,
  type Node,
  type NodeText,
  type NodeImage,
  type NodeStyle,
  type NodeType,
  type DocPage,
  type PrototypeInteraction,
  type PrototypeAction,
  type PrototypeTrigger,
  type PrototypeTransitionType,
  type PrototypeCondition,
  type LayoutMode,
  type Stroke,
  type StyleToken,
  type TextStyle,
  type Variable,
  type VariableType,
  type LayoutGridItem,
  type BlendMode,
  type ScrollTriggerConfig,
} from "../doc/scene";

const BLEND_MODE_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "일반" },
  { value: "multiply", label: "곱하기" },
  { value: "screen", label: "스크린" },
  { value: "overlay", label: "오버레이" },
  { value: "darken", label: "어둡게" },
  { value: "lighten", label: "밝게" },
];
import AdvancedRuntimeRenderer from "../runtime/renderer";
import AdvancedRuntimePlayer from "../runtime/player";
import { applyConstraintsOnResize, layoutDoc } from "../layout/engine";
import { getPageContentBounds } from "../runtime/bounds";
import {
  anchorsToPathData,
  pathDataToAnchors,
  pathDataToBounds,
  rectToPath,
  ellipseToPath,
  pathDataToPolygon,
  translatePathD,
  snapDirection45,
  type PathAnchor,
} from "../geom/pathData";
import { runBooleanMultiple, type BooleanOp } from "../geom/boolean";
import type {
  Tool,
  DragState,
  Rect,
  Status,
  ClipboardPayload,
  NodeOverride,
  PresetDefinition,
  ContextMenuState,
} from "./AdvancedEditor.types";
import {
  GRID,
  DEFAULT_FONT_FAMILY,
  DEFAULT_AUTO_LAYOUT,
  NODE_TYPE_LABELS,
  MESSAGE_LABELS,
  TOOL_OPTIONS,
  TOOL_GROUPS,
} from "./AdvancedEditor.constants";
import {
  makeFrameNode,
  makeRectNode,
  makeEllipseNode,
  makeGroupNode,
  makeTextNode,
  fieldPlaceholder,
} from "./AdvancedEditor.nodes";
import { PRESET_GROUPS } from "./AdvancedEditor.presets";
import { makeRuntimeId, snap, snapToPixel, clamp, getRulerStep } from "./AdvancedEditor.utils";

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
  if (!ctx) {
    return text.length * fontSize * 0.6;
  }
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

function measureTextBlock(text: string, style: TextStyle, maxWidth?: number, wrap?: boolean) {
  const safeText = text ?? "";
  const wrapEnabled = wrap !== false && Number.isFinite(maxWidth) && (maxWidth ?? 0) > 0;
  const lines = wrapEnabled ? wrapTextLines(safeText, style, maxWidth as number) : safeText.split("\n");
  const widths = lines.map((line) => measureTextWidth(line || " ", style));
  const width = widths.length ? Math.max(...widths) : 0;
  const fontSize = style.fontSize ?? 16;
  const lineHeightRatio = style.lineHeight ?? 1.4;
  const lineHeight = (Number.isFinite(lineHeightRatio) && lineHeightRatio > 0 ? lineHeightRatio : 1.4) * fontSize;
  const height = Math.max(1, lineHeight * Math.max(lines.length, 1));
  return { width, height, lines };
}

function isEditableTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null;
  if (!node) return false;
  if (node.closest?.("input, textarea, select, [contenteditable='true']")) return true;
  const tag = (node.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (node.isContentEditable) return true;
  return false;
}

function rectsIntersect(a: Rect, b: Rect) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

function findEditableTextNodeId(doc: Doc, nodeId: string) {
  const node = doc.nodes[nodeId];
  if (!node) return null;
  if (node.type === "text") return nodeId;
  if (!node.children?.length) return null;
  const queue = [...node.children];
  let found: string | null = null;
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    const child = doc.nodes[id];
    if (!child) continue;
    if (child.type === "text") {
      if (found) return null;
      found = child.id;
    }
    if (child.children?.length) queue.push(...child.children);
  }
  return found;
}

function findPrimaryTextNodeId(doc: Doc, nodeId: string) {
  const node = doc.nodes[nodeId];
  if (!node) return null;
  if (node.type === "text") return nodeId;
  if (!node.children?.length) return null;
  const queue = [...node.children];
  let best: { id: string; area: number } | null = null;
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    const child = doc.nodes[id];
    if (!child) continue;
    if (child.type === "text") {
      const area = Math.max(1, child.frame.w * child.frame.h);
      if (!best || area > best.area) {
        best = { id: child.id, area };
      }
    }
    if (child.children?.length) queue.push(...child.children);
  }
  return best?.id ?? null;
}

function getParentOffset(doc: Doc, nodeId: string) {
  let x = 0;
  let y = 0;
  let current = doc.nodes[nodeId]?.parentId ? doc.nodes[doc.nodes[nodeId].parentId as string] : null;
  while (current) {
    x += current.frame.x;
    y += current.frame.y;
    current = current.parentId ? doc.nodes[current.parentId] : null;
  }
  return { x, y };
}

function getAbsoluteFrame(doc: Doc, nodeId: string): Rect | null {
  const node = doc.nodes[nodeId];
  if (!node) return null;
  let x = node.frame.x;
  let y = node.frame.y;
  let current = node.parentId ? doc.nodes[node.parentId] : null;
  while (current) {
    x += current.frame.x;
    y += current.frame.y;
    current = current.parentId ? doc.nodes[current.parentId] : null;
  }
  return { x, y, w: node.frame.w, h: node.frame.h };
}

function getSelectionBounds(doc: Doc, ids: string[]) {
  if (!ids.length) return null;
  const rects = ids.map((id) => getAbsoluteFrame(doc, id)).filter(Boolean) as Rect[];
  if (!rects.length) return null;
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Step 8: 포인터 위치에서 가장 위에 있는 노드 id (이벤트 위임용) */
function getNodeIdAtPoint(doc: Doc, pageRoot: string, point: { x: number; y: number }, excludeIds: Set<string>): string | null {
  const ids = flattenNodes(doc, pageRoot).filter((id) => id !== pageRoot && !excludeIds.has(id));
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    const node = doc.nodes[id];
    if (!node || node.hidden) continue;
    const abs = getAbsoluteFrame(doc, id);
    if (!abs) continue;
    if (point.x >= abs.x && point.x < abs.x + abs.w && point.y >= abs.y && point.y < abs.y + abs.h) return id;
  }
  return null;
}

/** Step 8: 노드 하나 렌더 (React.memo + 커스텀 비교) */
type CanvasNodeProps = {
  id: string;
  doc: Doc;
  node: Node;
  displayX: number;
  displayY: number;
  isSelected: boolean;
  useLod: boolean;
  outlineMode: boolean;
  effectId: string | undefined;
  blendMode: React.CSSProperties["mixBlendMode"];
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
};

function CanvasNodeView({
  id,
  doc,
  node,
  displayX,
  displayY,
  isSelected,
  useLod,
  outlineMode,
  effectId,
  blendMode,
  onContextMenu,
  onDoubleClick,
}: CanvasNodeProps) {
  const cx = node.frame.w / 2;
  const cy = node.frame.h / 2;
  return (
    <g
      data-nodeid={id}
      transform={`translate(${displayX} ${displayY}) rotate(${node.frame.rotation} ${cx} ${cy})`}
      onContextMenu={(e) => onContextMenu(e, id)}
      onDoubleClick={onDoubleClick}
      opacity={node.style.opacity}
      style={blendMode ? { mixBlendMode: blendMode } : undefined}
    >
      {useLod ? (
        <rect x={0} y={0} width={node.frame.w} height={node.frame.h} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1} />
      ) : (
        renderNodeShape(doc, node, { outline: outlineMode, filterId: effectId })
      )}
      {isSelected ? (
        <rect x={0} y={0} width={node.frame.w} height={node.frame.h} fill="none" stroke="#2563EB" strokeWidth={1} />
      ) : null}
      {isSelected
        ? (["nw", "ne", "sw", "se"] as const).map((handle) => {
            const size = 8;
            const hx = handle.includes("w") ? 0 : node.frame.w;
            const hy = handle.includes("n") ? 0 : node.frame.h;
            return (
              <rect
                key={`${id}-${handle}`}
                data-nodeid={id}
                data-handle={handle}
                x={hx - size / 2}
                y={hy - size / 2}
                width={size}
                height={size}
                fill="#2563EB"
              />
            );
          })
        : null}
    </g>
  );
}

const CanvasNode = React.memo(
  CanvasNodeView,
  (prev, next) =>
    prev.id === next.id &&
    prev.displayX === next.displayX &&
    prev.displayY === next.displayY &&
    prev.node.frame.w === next.node.frame.w &&
    prev.node.frame.h === next.node.frame.h &&
    prev.node.frame.rotation === next.node.frame.rotation &&
    prev.isSelected === next.isSelected &&
    prev.useLod === next.useLod &&
    prev.node.style.opacity === next.node.style.opacity,
);

function flattenNodes(doc: Doc, parentId: string): string[] {
  const parent = doc.nodes[parentId];
  if (!parent) return [];
  const out: string[] = [];
  parent.children.forEach((id) => {
    out.push(id);
    out.push(...flattenNodes(doc, id));
  });
  return out;
}

function ensurePageRoot(doc: Doc, activePageId: string | null) {
  const page = activePageId ? doc.pages.find((item) => item.id === activePageId) : null;
  return page?.rootId ?? doc.pages[0]?.rootId ?? doc.root;
}

function ensureRootNode(doc: Doc) {
  const existing = doc.nodes[doc.root];
  if (existing) return existing;
  const rootId = doc.root || makeRuntimeId("root");
  const root = createNode("frame", { id: rootId, name: "ROOT", parentId: null });
  root.children = [];
  root.frame = { x: 0, y: 0, w: 0, h: 0, rotation: 0 };
  root.style = { ...root.style, fills: [] };
  root.layout = { mode: "fixed" };
  root.locked = true;
  root.hidden = true;
  doc.root = rootId;
  doc.nodes[rootId] = root;
  return root;
}

function ensureBasePage(doc: Doc) {
  if (doc.pages.length) return doc.pages[0];
  const root = ensureRootNode(doc);
  const pageId = makeRuntimeId("page");
  const pageName = getNextPageName([]);
  const pageNode = createNode("frame", { id: pageId, name: pageName, parentId: doc.root });
  doc.nodes[pageId] = pageNode;
  root.children = [...root.children, pageId];
  const page = { id: pageId, name: pageName, rootId: pageId };
  doc.pages = [page];
  doc.prototype = { ...(doc.prototype ?? {}), startPageId: pageId };
  return page;
}

function getNextPageName(pages: Doc["pages"]) {
  const used = new Set<number>();
  pages.forEach((page) => {
    const match = page.name.match(/^페이지\s*(\d+)$/);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) used.add(value);
    }
  });
  let index = 1;
  while (used.has(index)) index += 1;
  return `페이지 ${index}`;
}

function toLabel(node: Node) {
  if (!node.name || node.name === node.type) return NODE_TYPE_LABELS[node.type] ?? node.type;
  return node.name;
}

function findStyleToken(doc: Doc, id: string | undefined, type: StyleToken["type"]) {
  if (!id) return null;
  const token = doc.styles.find((item) => item.id === id && item.type === type);
  return token ?? null;
}

function resolveVariableColor(doc: Doc, id: string | undefined) {
  if (!id) return null;
  const variable = doc.variables.find((item) => item.id === id && item.type === "color");
  if (!variable) return null;
  const value = resolveVariableValue(doc, variable);
  return typeof value === "string" ? value : null;
}

function resolveFill(doc: Doc, node: Node): Fill[] {
  const token = findStyleToken(doc, node.style.fillStyleId, "fill");
  if (token && Array.isArray(token.value)) return token.value as Fill[];
  return node.style.fills;
}

function resolveStrokes(doc: Doc, node: Node): Stroke[] {
  const token = findStyleToken(doc, node.style.strokeStyleId, "stroke");
  if (token && Array.isArray(token.value)) return token.value as Stroke[];
  return node.style.strokes;
}

function resolveFillColor(doc: Doc, node: Node) {
  const variableColor = resolveVariableColor(doc, node.style.fillRef);
  if (variableColor) return variableColor;
  const fill = resolveFill(doc, node)[0];
  if (!fill) return "#EDEDED";
  if (fill.type === "solid") return fill.color;
  if (fill.type === "linear") return fill.from;
  return "#EDEDED";
}

function resolveStroke(doc: Doc, node: Node) {
  const strokes = resolveStrokes(doc, node);
  const stroke = strokes[0];
  return {
    color: stroke?.color ?? "#111111",
    width: stroke?.width ?? 0,
    dash: stroke?.dash ?? [],
    align: stroke?.align ?? "center",
    cap: node.style.strokeCap ?? "butt",
    join: node.style.strokeJoin ?? "miter",
    miter: node.style.strokeMiter ?? 4,
  };
}

function resolveEffects(doc: Doc, node: Node): Effect[] {
  const token = findStyleToken(doc, node.style.effectStyleId, "effect");
  if (token && Array.isArray(token.value)) return token.value as Effect[];
  return node.style.effects ?? [];
}

function resolveVariableValue(doc: Doc, variable: Variable) {
  const mode = doc.variableMode;
  if (mode && variable.modes && mode in variable.modes) {
    return variable.modes[mode];
  }
  return variable.value;
}

function resolveTextStyle(doc: Doc, node: Node) {
  const token = findStyleToken(doc, node.text?.styleRef, "text");
  if (token && token.value && typeof token.value === "object") return token.value as TextStyle;
  return node.text?.style ?? null;
}

function resolveTextTokens(doc: Doc, value: string) {
  if (!value || !doc.variables.length) return value;
  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, raw) => {
    const key = String(raw ?? "").trim();
    if (!key) return "";
    const variable =
      doc.variables.find((item) => item.id === key) ??
      doc.variables.find((item) => item.name.toLowerCase() === key.toLowerCase());
    if (!variable) return "";
    const val = resolveVariableValue(doc, variable);
    if (val == null) return "";
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
    return JSON.stringify(val);
  });
}

function formatPx(value: number, round = true) {
  return round ? `${Math.round(value)}px` : `${value}px`;
}

function buildDevCss(doc: Doc, node: Node, options?: { roundPx?: boolean }) {
  const roundPx = options?.roundPx !== false;
  const px = (v: number) => formatPx(v, roundPx);
  const fill = resolveFillColor(doc, node);
  const stroke = resolveStroke(doc, node);
  const radius = node.style.radius;
  const lines = [
    "position: absolute;",
    "left: 0;",
    "top: 0;",
    `transform: translate(${px(node.frame.x)}, ${px(node.frame.y)});`,
    `width: ${px(node.frame.w)};`,
    `height: ${px(node.frame.h)};`,
    `opacity: ${node.style.opacity};`,
  ];

  if (fill && fill !== "transparent") lines.push(`background: ${fill};`);
  if (stroke.width > 0 && stroke.color !== "transparent") {
    lines.push(`border: ${Math.max(1, stroke.width)}px solid ${stroke.color};`);
  }
  if (typeof radius === "number" && radius > 0) {
    lines.push(`border-radius: ${px(radius)};`);
  } else if (radius && typeof radius === "object") {
    lines.push(
      `border-radius: ${px(radius.tl)} ${px(radius.tr)} ${px(radius.br)} ${px(radius.bl)};`,
    );
  }

  if (node.type === "text") {
    const style = resolveTextStyle(doc, node);
    if (style?.fontFamily) lines.push(`font-family: ${style.fontFamily};`);
    if (style?.fontSize) lines.push(`font-size: ${px(style.fontSize)};`);
    if (style?.fontWeight) lines.push(`font-weight: ${style.fontWeight};`);
    if (style?.letterSpacing != null) lines.push(`letter-spacing: ${style.letterSpacing}px;`);
    if (style?.lineHeight) lines.push(`line-height: ${style.lineHeight};`);
    if (style?.align) lines.push(`text-align: ${style.align};`);
    if (style?.textCase && style.textCase !== "none") {
      const transform = style.textCase === "upper" ? "uppercase" : style.textCase === "lower" ? "lowercase" : "capitalize";
      lines.push(`text-transform: ${transform};`);
    }
    if (style?.underline || style?.lineThrough) {
      const deco = [style.underline && "underline", style.lineThrough && "line-through"].filter(Boolean).join(" ");
      if (deco) lines.push(`text-decoration: ${deco};`);
    }
    if (style?.fontFeatureSettings?.trim()) lines.push(`font-feature-settings: ${style.fontFeatureSettings};`);
    lines.push(`color: ${fill};`);
  }

  return lines.join("\n");
}

function findStyleName(doc: Doc, id: string | undefined, type: StyleToken["type"]) {
  if (!id) return null;
  return findStyleToken(doc, id, type)?.name ?? id;
}

function findVariableName(doc: Doc, id: string | undefined) {
  if (!id) return null;
  const variable = doc.variables.find((item) => item.id === id);
  return variable?.name ?? id;
}

function buildSpecPayload(doc: Doc, node: Node) {
  const fill = resolveFillColor(doc, node);
  const stroke = resolveStroke(doc, node);
  const textStyle = node.type === "text" ? resolveTextStyle(doc, node) : null;
  const abs = getAbsoluteFrame(doc, node.id);
  const componentName = node.instanceOf ? doc.nodes[node.instanceOf]?.name ?? node.instanceOf : null;
  return {
    meta: {
      id: node.id,
      name: node.name,
      type: node.type,
    },
    component: {
      componentId: node.componentId ?? null,
      instanceOf: node.instanceOf ?? null,
      instanceName: componentName,
    },
    frame: { ...node.frame },
    absolute: abs ? { x: abs.x, y: abs.y, w: abs.w, h: abs.h } : null,
    style: {
      fill,
      stroke,
      opacity: node.style.opacity,
      radius: node.style.radius ?? 0,
      blendMode: node.style.blendMode,
      effects: node.style.effects ?? [],
      strokeCap: node.style.strokeCap ?? "butt",
      strokeJoin: node.style.strokeJoin ?? "miter",
      strokeMiter: node.style.strokeMiter ?? 4,
    },
    text:
      node.type === "text"
        ? {
            value: node.text?.value ?? "",
            style: textStyle,
          }
        : null,
    layout: {
      mode: node.layout?.mode ?? "fixed",
      auto:
        node.layout?.mode === "auto"
          ? {
              dir: node.layout.dir,
              gap: node.layout.gap,
              padding: node.layout.padding,
              align: node.layout.align,
              wrap: node.layout.wrap,
            }
          : null,
      sizing: node.layoutSizing ?? null,
      constraints: node.constraints ?? null,
    },
    tokens: {
      fillStyle: findStyleName(doc, node.style.fillStyleId, "fill"),
      strokeStyle: findStyleName(doc, node.style.strokeStyleId, "stroke"),
      textStyle: findStyleName(doc, node.text?.styleRef, "text"),
      fillVariable: findVariableName(doc, node.style.fillRef),
    },
  };
}

function buildSpecLines(doc: Doc, node: Node) {
  const fill = resolveFillColor(doc, node);
  const stroke = resolveStroke(doc, node);
  const fillStyleName = findStyleName(doc, node.style.fillStyleId, "fill");
  const strokeStyleName = findStyleName(doc, node.style.strokeStyleId, "stroke");
  const textStyleName = findStyleName(doc, node.text?.styleRef, "text");
  const fillVarName = findVariableName(doc, node.style.fillRef);
  const componentName = node.instanceOf ? doc.nodes[node.instanceOf]?.name ?? node.instanceOf : null;
  const lines = [
    `W ${Math.round(node.frame.w)} H ${Math.round(node.frame.h)}`,
    `Fill ${fill}`,
    `Stroke ${stroke.width}px ${stroke.color}`,
    `Opacity ${Math.round(node.style.opacity * 100)}%`,
  ];
  if (typeof node.style.radius === "number") {
    lines.push(`Radius ${Math.round(node.style.radius)}px`);
  } else if (node.style.radius) {
    lines.push(
      `Radius ${Math.round(node.style.radius.tl)}/${Math.round(node.style.radius.tr)}/${Math.round(node.style.radius.br)}/${Math.round(node.style.radius.bl)}`,
    );
  }
  if (node.type === "text") {
    const style = resolveTextStyle(doc, node);
    if (style) {
      lines.push(`Font ${style.fontFamily} ${style.fontSize}px ${style.fontWeight}`);
      lines.push(`Line ${style.lineHeight} Letter ${style.letterSpacing}`);
    }
  }
  if (node.layout?.mode === "auto") {
    lines.push(
      `Auto ${node.layout.dir} gap ${node.layout.gap} pad ${node.layout.padding.t}/${node.layout.padding.r}/${node.layout.padding.b}/${node.layout.padding.l} ${node.layout.align} ${node.layout.wrap ? "wrap" : "nowrap"}`,
    );
  } else {
    lines.push("Layout fixed");
  }
  if (node.layoutSizing) {
    lines.push(`Sizing W ${node.layoutSizing.width} H ${node.layoutSizing.height}`);
  }
  const constraintLabels: Array<[keyof NonNullable<Node["constraints"]>, string]> = [
    ["left", "L"],
    ["right", "R"],
    ["top", "T"],
    ["bottom", "B"],
    ["hCenter", "HC"],
    ["vCenter", "VC"],
    ["scaleX", "SX"],
    ["scaleY", "SY"],
  ];
  const activeConstraints = constraintLabels
    .filter(([key]) => node.constraints?.[key])
    .map(([, label]) => label);
  if (activeConstraints.length) lines.push(`Constraints ${activeConstraints.join(" ")}`);
  if (fillStyleName) lines.push(`FillStyle ${fillStyleName}`);
  if (fillVarName) lines.push(`FillVar ${fillVarName}`);
  if (strokeStyleName) lines.push(`StrokeStyle ${strokeStyleName}`);
  if (textStyleName) lines.push(`TextStyle ${textStyleName}`);
  if (node.type === "component") lines.push("Component Master");
  if (node.type === "instance" && componentName) lines.push(`Instance ${componentName}`);
  return lines;
}

function renderNodeShape(doc: Doc, node: Node, options?: { outline?: boolean; filterId?: string }) {
  const outline = Boolean(options?.outline);
  const filterId = outline ? undefined : options?.filterId;
  const baseFill = resolveFillColor(doc, node);
  const baseStroke = resolveStroke(doc, node);
  const strokeColor =
    outline && (!baseStroke.width || baseStroke.color === "transparent") ? "#94A3B8" : baseStroke.color;
  const strokeWidth = outline ? Math.max(1, baseStroke.width || 1) : baseStroke.width;
  const fill = outline && node.type !== "text" ? "transparent" : baseFill;
  const strokeAlign = baseStroke.align ?? "center";
  const strokeInset = strokeAlign === "inside" ? strokeWidth / 2 : strokeAlign === "outside" ? -strokeWidth / 2 : 0;
  const strokeLinecap = baseStroke.cap ?? "butt";
  const strokeLinejoin = baseStroke.join ?? "miter";
  const strokeMiterlimit = baseStroke.miter ?? 4;

  switch (node.type) {
    case "rect":
    case "frame":
    case "section":
    case "component":
    case "instance": {
      const radius = typeof node.style.radius === "number" ? node.style.radius : 0;
      const adjW = Math.max(0, node.frame.w - strokeInset * 2);
      const adjH = Math.max(0, node.frame.h - strokeInset * 2);
      return (
        <rect
          x={strokeInset}
          y={strokeInset}
          width={adjW}
          height={adjH}
          rx={Math.max(0, radius - strokeInset)}
          ry={Math.max(0, radius - strokeInset)}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={baseStroke.dash?.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "ellipse": {
      const adjW = Math.max(0, node.frame.w - strokeInset * 2);
      const adjH = Math.max(0, node.frame.h - strokeInset * 2);
      return (
        <ellipse
          cx={node.frame.w / 2}
          cy={node.frame.h / 2}
          rx={Math.max(0, adjW / 2)}
          ry={Math.max(0, adjH / 2)}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={baseStroke.dash?.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "polygon": {
      const sides = Math.max(3, Math.round(node.shape?.polygonSides ?? 6));
      const cx = node.frame.w / 2;
      const cy = node.frame.h / 2;
      const r = Math.max(0, Math.min(node.frame.w, node.frame.h) / 2 - strokeInset);
      const points = Array.from({ length: sides }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      });
      return (
        <polygon
          points={points.join(" ")}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={baseStroke.dash?.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "star": {
      const spikes = Math.max(3, Math.round(node.shape?.starPoints ?? 5));
      const cx = node.frame.w / 2;
      const cy = node.frame.h / 2;
      const outer = Math.max(0, Math.min(node.frame.w, node.frame.h) / 2 - strokeInset);
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
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={baseStroke.dash?.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "path": {
      const w = node.frame.w;
      const h = node.frame.h;
      const defaultPath = `M 0 ${h * 0.8} C ${w * 0.2} ${h * 0.1}, ${w * 0.8} ${h * 0.9}, ${w} ${h * 0.2}`;
      const path = (node.shape?.pathData ?? "").trim() || defaultPath;
      return (
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={Math.max(1, strokeWidth)}
          strokeDasharray={baseStroke.dash?.join(" ")}
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
          x2={node.frame.w}
          y2={node.frame.h}
          stroke={strokeColor}
          strokeWidth={Math.max(1, strokeWidth)}
          strokeDasharray={baseStroke.dash?.join(" ")}
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
          x2={node.frame.w}
          y2={node.frame.h}
          stroke={strokeColor}
          strokeWidth={Math.max(1, strokeWidth)}
          markerEnd="url(#adv-editor-arrow)"
          strokeDasharray={baseStroke.dash?.join(" ")}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterlimit={strokeMiterlimit}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
    case "text": {
      const text = resolveTextTokens(doc, node.text?.value ?? "텍스트");
      const style = resolveTextStyle(doc, node) ?? DEFAULT_TEXT_STYLE;
      const fontSize = style.fontSize ?? 16;
      const align = style.align ?? "left";
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const textX = align === "center" ? node.frame.w / 2 : align === "right" ? node.frame.w : 0;
      const lineHeightRatio = style.lineHeight ?? 1.4;
      const lineHeight = (Number.isFinite(lineHeightRatio) && lineHeightRatio > 0 ? lineHeightRatio : 1.4) * fontSize;
      const wrapEnabled = node.text?.wrap !== false;
      const lines = wrapEnabled ? wrapTextLines(text, style, Math.max(4, node.frame.w)) : text.split("\n");
      return (
        <text
          x={textX}
          y={fontSize}
          fill={baseFill}
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
      if (outline) {
        return (
          <g>
            <rect
              x={0}
              y={0}
              width={node.frame.w}
              height={node.frame.h}
              fill="transparent"
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <line x1={0} y1={0} x2={node.frame.w} y2={node.frame.h} stroke="#94A3B8" strokeWidth={1} />
            <line x1={node.frame.w} y1={0} x2={0} y2={node.frame.h} stroke="#94A3B8" strokeWidth={1} />
          </g>
        );
      }
      if (!href) {
        return (
          <g>
            <rect
              x={0}
              y={0}
              width={node.frame.w}
              height={node.frame.h}
              fill="#F3F3F3"
              stroke="#B8B8B8"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <line x1={0} y1={0} x2={node.frame.w} y2={node.frame.h} stroke="#B8B8B8" strokeWidth={1} />
            <line x1={node.frame.w} y1={0} x2={0} y2={node.frame.h} stroke="#B8B8B8" strokeWidth={1} />
          </g>
        );
      }
      const fw = node.frame.w;
      const fh = node.frame.h;
      const clipId = `adv-media-clip-${node.id}`;
      const radius = typeof node.style.radius === "number" ? node.style.radius : 0;
      const crop = media?.crop;
      const cropRect = crop && (crop.w > 0 && crop.h > 0) ? { x: crop.x * fw, y: crop.y * fh, w: crop.w * fw, h: crop.h * fh } : null;
      const brightness = media?.brightness ?? 1;
      const contrast = media?.contrast ?? 1;
      const needBcFilter = Math.abs(brightness - 1) > 0.01 || Math.abs(contrast - 1) > 0.01;
      const bcFilterId = needBcFilter ? `adv-media-bc-${node.id}-${brightness}-${contrast}` : undefined;
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
          <image
            href={href || undefined}
            x={offsetX}
            y={offsetY}
            width={fw * scale}
            height={fh * scale}
            preserveAspectRatio={preserve}
            clipPath={`url(#${clipId})`}
            filter={bcFilterId ? `url(#${bcFilterId})` : filterId ? `url(#${filterId})` : undefined}
          />
        </g>
      );
    }
    default: {
      return (
        <rect
          x={0}
          y={0}
          width={node.frame.w}
          height={node.frame.h}
          fill={fill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={baseStroke.dash?.join(" ")}
          filter={filterId ? `url(#${filterId})` : undefined}
        />
      );
    }
  }
}

function getEffectFilterId(prefix: string, nodeId: string) {
  return `${prefix}-${nodeId}`;
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

function makeSafeFilename(value: string) {
  const trimmed = value.trim();
  const base = trimmed.length ? trimmed : "advanced_export";
  return base.replace(/[\\/:*?"<>|]+/g, "_");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function serializeSvgElement(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function serializeSvgElementWithBounds(svg: SVGSVGElement, bounds?: Rect | null) {
  if (!bounds) return serializeSvgElement(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
  clone.setAttribute("width", `${bounds.w}`);
  clone.setAttribute("height", `${bounds.h}`);
  return new XMLSerializer().serializeToString(clone);
}

function cloneStyle(style: Node["style"]) {
  return {
    ...style,
    fills: [...style.fills],
    strokes: [...style.strokes],
    effects: [...style.effects],
    radius: typeof style.radius === "object" && style.radius ? { ...style.radius } : style.radius,
  };
}

function cloneText(text?: Node["text"]) {
  return text
    ? {
        value: text.value,
        style: { ...text.style },
        styleRef: text.styleRef,
        wrap: text.wrap,
        autoSize: text.autoSize,
      }
    : undefined;
}

function cloneLayout(layout?: Node["layout"]): LayoutMode | undefined {
  if (!layout) return undefined;
  if (layout.mode === "auto" && "dir" in layout && "padding" in layout)
    return { ...layout, padding: { ...layout.padding } };
  return { mode: "fixed" };
}

function clonePrototype(prototype?: Node["prototype"]) {
  if (!prototype) return undefined;
  return {
    interactions: prototype.interactions.map((interaction) => ({
      ...interaction,
      action: {
        ...interaction.action,
        ...("transition" in interaction.action && interaction.action.transition
          ? { transition: { ...interaction.action.transition } }
          : {}),
      },
    })),
  };
}

function cloneNodeOverrides(overrides: NodeOverride): NodeOverride {
  return {
    ...overrides,
    frame: overrides.frame ? { ...overrides.frame } : undefined,
    style: overrides.style ? cloneStyle(overrides.style) : undefined,
    text: overrides.text ? cloneText(overrides.text) : undefined,
    image: overrides.image ? { ...overrides.image } : undefined,
    video: overrides.video ? { ...overrides.video } : undefined,
    shape: overrides.shape ? { ...overrides.shape } : undefined,
    layout: overrides.layout ? cloneLayout(overrides.layout) : undefined,
    layoutSizing: overrides.layoutSizing ? { ...overrides.layoutSizing } : undefined,
    constraints: overrides.constraints ? { ...overrides.constraints } : undefined,
    data: overrides.data ? { ...overrides.data } : undefined,
    prototype: overrides.prototype ? clonePrototype(overrides.prototype) : undefined,
  };
}

function cloneNodeData(node: Node): Node {
  return {
    ...node,
    frame: { ...node.frame },
    style: cloneStyle(node.style),
    text: cloneText(node.text),
    image: node.image ? { ...node.image } : undefined,
    video: node.video ? { ...node.video } : undefined,
    shape: node.shape ? { ...node.shape } : undefined,
    layout: cloneLayout(node.layout),
    layoutSizing: node.layoutSizing ? { ...node.layoutSizing } : undefined,
    constraints: node.constraints ? { ...node.constraints } : undefined,
    data: node.data ? { ...node.data } : undefined,
    overrides: node.overrides ? cloneNodeOverrides(node.overrides) : undefined,
    prototype: clonePrototype(node.prototype),
    children: [...node.children],
  };
}

function isDeepEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildNodeOverride(master: Node, instance: Node, options?: { ignoreFrameXY?: boolean }) {
  const override: NodeOverride = {};
  const instanceClone = cloneNodeData(instance);
  const masterFrame = options?.ignoreFrameXY ? { ...master.frame, x: 0, y: 0 } : master.frame;
  const instanceFrame = options?.ignoreFrameXY ? { ...instance.frame, x: 0, y: 0 } : instance.frame;

  if (!isDeepEqual(masterFrame, instanceFrame)) override.frame = instanceClone.frame;
  if (instance.name !== master.name) override.name = instanceClone.name;
  if (instance.hidden !== master.hidden) override.hidden = typeof instanceClone.hidden === "boolean" ? instanceClone.hidden : undefined;
  if (instance.locked !== master.locked) override.locked = typeof instanceClone.locked === "boolean" ? instanceClone.locked : undefined;
  if (instance.clipContent !== master.clipContent) override.clipContent = typeof instanceClone.clipContent === "boolean" ? instanceClone.clipContent : undefined;
  if (!isDeepEqual(master.shape, instance.shape)) override.shape = instanceClone.shape;
  if (!isDeepEqual(master.style, instance.style)) override.style = instanceClone.style;
  if (!isDeepEqual(master.text, instance.text)) override.text = instanceClone.text;
  if (!isDeepEqual(master.image, instance.image)) override.image = instanceClone.image;
  if (!isDeepEqual(master.video, instance.video)) override.video = instanceClone.video;
  if (!isDeepEqual(master.layout, instance.layout)) override.layout = instanceClone.layout;
  if (!isDeepEqual(master.layoutSizing, instance.layoutSizing)) override.layoutSizing = instanceClone.layoutSizing;
  if (!isDeepEqual(master.constraints, instance.constraints)) override.constraints = instanceClone.constraints;
  if (!isDeepEqual(master.data, instance.data)) override.data = instanceClone.data;
  if (!isDeepEqual(master.prototype, instance.prototype)) override.prototype = instanceClone.prototype;
  if (instance.sticky !== master.sticky) override.sticky = instanceClone.sticky;
  if (instance.widthPercent !== master.widthPercent) override.widthPercent = instanceClone.widthPercent;
  if (instance.heightPercent !== master.heightPercent) override.heightPercent = instanceClone.heightPercent;

  return Object.keys(override).length ? override : null;
}

function toSafeNodeOverride(o: NodeOverride): NodeOverride {
  const r: NodeOverride = {};
  for (const k of Object.keys(o) as (keyof NodeOverride)[]) {
    const v = (o as Record<string, unknown>)[k];
    if (k === "hidden" || k === "locked" || k === "clipContent") {
      if (v === true || v === false) (r as Record<string, unknown>)[k] = v;
    } else {
      (r as Record<string, unknown>)[k] = v;
    }
  }
  return r;
}

function applyNodeOverride(node: Node, override: NodeOverride, options?: { preservePosition?: boolean }) {
  const prevPosition = { x: node.frame.x, y: node.frame.y };
  if (override.name !== undefined) node.name = override.name;
  if ("hidden" in override) node.hidden = override.hidden;
  if ("locked" in override) node.locked = override.locked;
  if ("clipContent" in override) node.clipContent = override.clipContent;
  if ("shape" in override) node.shape = override.shape ? { ...override.shape } : undefined;
  if (override.frame) {
    node.frame = { ...override.frame };
    if (options?.preservePosition) {
      node.frame.x = prevPosition.x;
      node.frame.y = prevPosition.y;
    }
  }
  if (override.style) node.style = cloneStyle(override.style);
  if ("text" in override) node.text = override.text ? cloneText(override.text) : undefined;
  if ("image" in override) node.image = override.image ? { ...override.image } : undefined;
  if ("video" in override) node.video = override.video ? { ...override.video } : undefined;
  if ("layout" in override) node.layout = override.layout ? cloneLayout(override.layout) : undefined;
  if ("layoutSizing" in override) node.layoutSizing = override.layoutSizing ? { ...override.layoutSizing } : undefined;
  if ("constraints" in override) node.constraints = override.constraints ? { ...override.constraints } : undefined;
  if ("data" in override) node.data = override.data ? { ...override.data } : undefined;
  if ("prototype" in override) node.prototype = override.prototype ? clonePrototype(override.prototype) : undefined;
  if ("sticky" in override) node.sticky = override.sticky;
  if ("widthPercent" in override) node.widthPercent = override.widthPercent;
  if ("heightPercent" in override) node.heightPercent = override.heightPercent;
  node.overrides = cloneNodeOverrides(override);
}

function hasAncestorInstance(doc: Doc, nodeId: string) {
  let currentId = doc.nodes[nodeId]?.parentId ?? null;
  while (currentId) {
    const node = doc.nodes[currentId];
    if (!node) return false;
    if (node.type === "instance") return true;
    currentId = node.parentId ?? null;
  }
  return false;
}

function collectInstanceOverrides(doc: Doc, instanceId: string, componentNodeIds: Set<string>) {
  const overrides: Record<string, NodeOverride> = {};
  const instance = doc.nodes[instanceId];
  if (instance?.sourceId && componentNodeIds.has(instance.sourceId) && instance.overrides) {
    overrides[instance.sourceId] = cloneNodeOverrides(instance.overrides);
  }

  flattenNodes(doc, instanceId).forEach((id) => {
    const node = doc.nodes[id];
    if (!node?.sourceId || !componentNodeIds.has(node.sourceId) || !node.overrides) return;
    overrides[node.sourceId] = cloneNodeOverrides(node.overrides);
  });

  return overrides;
}

function refreshOverridesForSubtree(doc: Doc, rootId: string) {
  const ids = [rootId, ...flattenNodes(doc, rootId)];
  ids.forEach((id) => {
    const node = doc.nodes[id];
    if (!node?.sourceId) return;
    const master = doc.nodes[node.sourceId];
    if (!master) return;
    const ignoreFrameXY = !!(node.type === "instance" && node.instanceOf && !hasAncestorInstance(doc, node.id));
    const override = buildNodeOverride(master, node, { ignoreFrameXY });
    if (override) node.overrides = toSafeNodeOverride(override);
    else delete node.overrides;
  });
}

function getTopLevelSelection(doc: Doc, ids: string[]) {
  const selected = new Set(ids);
  return ids.filter((id) => {
    const parentId = doc.nodes[id]?.parentId ?? null;
    return !parentId || !selected.has(parentId);
  });
}

function snapshotSubtree(doc: Doc, nodeId: string, nodes: Record<string, Node>) {
  if (nodes[nodeId]) return;
  const node = doc.nodes[nodeId];
  if (!node) return;
  nodes[nodeId] = cloneNodeData(node);
  node.children.forEach((childId) => snapshotSubtree(doc, childId, nodes));
}

function collectSubtreeIds(doc: Doc, nodeId: string, out: Set<string>) {
  if (out.has(nodeId)) return;
  const node = doc.nodes[nodeId];
  if (!node) return;
  out.add(nodeId);
  node.children.forEach((childId) => collectSubtreeIds(doc, childId, out));
}

function buildClipboardPayload(doc: Doc, ids: string[]): ClipboardPayload | null {
  if (!ids.length) return null;
  const rootIds = getTopLevelSelection(doc, ids);
  const nodes: Record<string, Node> = {};
  const rootParents: Record<string, string | null> = {};
  rootIds.forEach((id) => {
    const node = doc.nodes[id];
    if (!node) return;
    rootParents[id] = node.parentId ?? null;
    snapshotSubtree(doc, id, nodes);
  });
  return { rootIds, nodes, rootParents };
}

function cloneClipboardPayload(
  payload: ClipboardPayload,
  options: { offset: number; parentOverride?: string | null; sourceMap?: Record<string, string> },
) {
  const idMap: Record<string, string> = {};
  Object.keys(payload.nodes).forEach((id) => {
    idMap[id] = makeRuntimeId("node");
  });
  const nodes: Record<string, Node> = {};
  Object.entries(payload.nodes).forEach(([oldId, node]) => {
    const newId = idMap[oldId];
    const clone = cloneNodeData(node);
    clone.id = newId;
    clone.parentId = node.parentId ? idMap[node.parentId] ?? null : null;
    clone.children = node.children.map((childId) => idMap[childId]).filter(Boolean);
    const sourceId = node.sourceId ?? options.sourceMap?.[oldId];
    if (sourceId) clone.sourceId = sourceId;
    nodes[newId] = clone;
  });

  const rootIds = payload.rootIds.map((id) => idMap[id]).filter(Boolean) as string[];
  rootIds.forEach((newId, index) => {
    const oldRootId = payload.rootIds[index];
    const rootNode = nodes[newId];
    if (!rootNode) return;
    rootNode.parentId = options.parentOverride ?? payload.rootParents[oldRootId] ?? null;
    rootNode.frame = { ...rootNode.frame, x: rootNode.frame.x + options.offset, y: rootNode.frame.y + options.offset };
  });

  return { nodes, rootIds };
}

function renderLayoutGridLines(items: LayoutGridItem[], w: number, h: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  items.forEach((item, idx) => {
    const color = item.color ?? "rgba(0, 122, 255, 0.2)";
    const opacity = item.opacity ?? 1;
    const stroke = `${color}`.startsWith("rgba") ? color : `rgba(0,0,0,${opacity * 0.2})`;
    if (item.type === "columns") {
      const count = Math.max(1, item.count ?? 1);
      const gutter = item.gutter ?? 0;
      const offset = item.offset ?? 0;
      const width = item.width ?? Math.max(1, (w - offset * 2 - gutter * (count - 1)) / count);
      for (let i = 0; i <= count; i++) {
        const x = offset + i * (width + gutter);
        if (x <= w) out.push(<line key={`col-${idx}-${i}`} x1={x} y1={0} x2={x} y2={h} stroke={stroke} strokeWidth={1} />);
      }
    } else if (item.type === "rows") {
      const count = Math.max(1, item.count ?? 1);
      const gutter = item.gutter ?? 0;
      const offset = item.offset ?? 0;
      const height = item.height ?? Math.max(1, (h - offset * 2 - gutter * (count - 1)) / count);
      for (let i = 0; i <= count; i++) {
        const y = offset + i * (height + gutter);
        if (y <= h) out.push(<line key={`row-${idx}-${i}`} x1={0} y1={y} x2={w} y2={y} stroke={stroke} strokeWidth={1} />);
      }
    } else if (item.type === "grid") {
      const size = Math.max(1, item.cellSize ?? 8);
      for (let x = 0; x <= w; x += size) {
        out.push(<line key={`gv-${idx}-${x}`} x1={x} y1={0} x2={x} y2={h} stroke={stroke} strokeWidth={1} />);
      }
      for (let y = 0; y <= h; y += size) {
        out.push(<line key={`gh-${idx}-${y}`} x1={0} y1={y} x2={w} y2={y} stroke={stroke} strokeWidth={1} />);
      }
    }
  });
  return out;
}

export default function AdvancedEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPageId = searchParams.get("pageId");

  const [pageId, setPageId] = useState<string | null>(initialPageId);
  const [doc, setDoc] = useState<Doc>(() => createDoc());
  const [activePageId, setActivePageId] = useState<string | null>(null);
  /** SSR 시 doc ID가 서버/클라이언트에서 달라 하이드레이션 오류가 나지 않도록, 런타임 렌더러는 마운트 후에만 렌더 */
  const [canvasMounted, setCanvasMounted] = useState(false);
  useEffect(() => {
    setCanvasMounted(true);
  }, []);
  const docRef = useRef(doc);
  const toolRef = useRef<Tool>("select");
  const spacePanRef = useRef<{ active: boolean; prev: Tool | null }>({ active: false, prev: null });
  const activePageIdRef = useRef<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [gridSnap, setGridSnap] = useState(true);
  const gridSnapRef = useRef(gridSnap);
  const [pixelSnap, setPixelSnap] = useState(false);
  const pixelSnapRef = useRef(pixelSnap);
  useEffect(() => {
    gridSnapRef.current = gridSnap;
  }, [gridSnap]);
  useEffect(() => {
    pixelSnapRef.current = pixelSnap;
  }, [pixelSnap]);
  const [layerQuery, setLayerQuery] = useState<string>("");
  const [layerExpandedIds, setLayerExpandedIds] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  /** 우클릭 메뉴 서브메뉴: "더 보기" 열림 여부 (8번) */
  const [contextMenuSubMenu, setContextMenuSubMenu] = useState<"more" | null>(null);
  const [newStyleName, setNewStyleName] = useState<string>("");
  const [newVariableName, setNewVariableName] = useState<string>("");
  const [newVariableType, setNewVariableType] = useState<VariableType>("color");
  const [newVariableValue, setNewVariableValue] = useState<string>("#111111");
  const [newVariableBool, setNewVariableBool] = useState<boolean>(false);
  const [newVariableModeName, setNewVariableModeName] = useState<string>("");
  const [swapComponentId, setSwapComponentId] = useState<string>("");
  const [panelMode, setPanelMode] = useState<"design" | "prototype" | "dev" | "export">("design");
  const [prototypePreview, setPrototypePreview] = useState(false);
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState(false);
  const [livePageId, setLivePageId] = useState<string | null>(null);
  const [exportPageId, setExportPageId] = useState<string | null>(null);
  const [exportScale, setExportScale] = useState(1);
  const [exportScope, setExportScope] = useState<"page" | "selection">("page");
  const [exportContentOnly, setExportContentOnly] = useState(false);
  const [radiusExpanded, setRadiusExpanded] = useState(false);
  const [devMeasure, setDevMeasure] = useState(true);
  const [devSpecOverlay, setDevSpecOverlay] = useState(true);
  const [devGuides, setDevGuides] = useState(true);
  const [devRoundPx, setDevRoundPx] = useState(true);
  const [versionListOpen, setVersionListOpen] = useState(false);
  const [versionList, setVersionList] = useState<{ id: string; created_at: string }[]>([]);
  const [versionListLoading, setVersionListLoading] = useState(false);
  const [versionRestoring, setVersionRestoring] = useState<string | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [infiniteCanvasPages, setInfiniteCanvasPages] = useState<Record<string, boolean>>({});
  const pageSizeCacheRef = useRef<Record<string, { w: number; h: number }>>({});
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [previewScaleAuto, setPreviewScaleAuto] = useState(1);
  const [previewScaleMode, setPreviewScaleMode] = useState<"auto" | "manual">("auto");
  const [previewScaleManual, setPreviewScaleManual] = useState(1);
  const [leftSections, setLeftSections] = useState({ pages: true, elements: true, resources: true, layers: true });
  /** 좌측 패널 탭: 페이지 | 레이어 | 자산 (8번 에디터 UI) */
  const [leftPanelTab, setLeftPanelTab] = useState<"pages" | "layers" | "assets">("layers");
  /** 자산 탭 카테고리별 접이식(아코디언) 열림 상태. 키: PRESET_GROUPS[].title */
  const [assetsAccordionOpen, setAssetsAccordionOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PRESET_GROUPS.map((g) => [g.title, true])),
  );
  const toggleAssetsAccordion = useCallback((title: string) => {
    setAssetsAccordionOpen((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);
  /** 우측 패널(디자인) 섹션 접기: 기하 | 채우기·테두리 | 레이아웃 | 텍스트 | 프로토타입 | 변수 */
  const [rightPanelSections, setRightPanelSections] = useState({
    geometry: true,
    fillStroke: true,
    layout: true,
    text: true,
    prototype: true,
    variables: true,
  });
  /** 툴바 그룹별 드롭다운 열림 (8번) */
  const [toolbarDropdown, setToolbarDropdown] = useState<string | null>(null);
  const toolbarDropdownRef = useRef<HTMLButtonElement | null>(null);
  const [toolbarDropdownRect, setToolbarDropdownRect] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!toolbarDropdown) return;
    const el = toolbarDropdownRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setToolbarDropdownRect({ left: r.left, top: r.bottom + 4 });
  }, [toolbarDropdown]);
  /** 툴바 오버플로우(…) 팝오버 열림 */
  const [toolbarOverflowOpen, setToolbarOverflowOpen] = useState(false);
  const toolbarOverflowRef = useRef<HTMLButtonElement | null>(null);
  const [toolbarOverflowRect, setToolbarOverflowRect] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!toolbarOverflowOpen) return;
    const el = toolbarOverflowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setToolbarOverflowRect({ left: r.right - 180, top: r.bottom + 4 });
  }, [toolbarOverflowOpen]);
  const [elementQuery, setElementQuery] = useState("");
  const [resourceQuery, setResourceQuery] = useState("");
  const [layerTypeFilter, setLayerTypeFilter] = useState<string>("all");
  const [layerSort, setLayerSort] = useState<"tree" | "name">("tree");
  const [showGrid, setShowGrid] = useState(true);
  const [showPixelGrid, setShowPixelGrid] = useState(false);
  const [showLayoutGrid, setShowLayoutGrid] = useState(true);
  const [outlineMode, setOutlineMode] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [comments, setComments] = useState<Array<{
    id: string;
    pageId: string;
    nodeId: string | null;
    userId: string;
    author: string;
    x: number;
    y: number;
    content: string;
    parentId: string | null;
    resolved: boolean;
    createdAt: string;
    updatedAt: string;
    replies: Array<{
      id: string;
      pageId: string;
      nodeId: string | null;
      userId: string;
      author: string;
      x: number;
      y: number;
      content: string;
      parentId: string | null;
      resolved: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  }>>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [pendingComment, setPendingComment] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [pendingCommentContent, setPendingCommentContent] = useState("");
  const [commentReplyDraft, setCommentReplyDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [textEditingId, setTextEditingId] = useState<string | null>(null);
  const [textEditingValue, setTextEditingValue] = useState("");
  const [textEditingRect, setTextEditingRect] = useState<Rect | null>(null);
  const textEditingRef = useRef<HTMLTextAreaElement | null>(null);
  const textEditingIdRef = useRef<string | null>(null);
  const prototypePreviewRef = useRef(false);
  const livePreviewRef = useRef(false);

  const dragRef = useRef<DragState | null>(null);
  /** Step 8: move 드래그 중 임시 오프셋만 반영, mouseUp 시점에만 commit */
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null);
  const dragDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [marquee, setMarquee] = useState<Rect | null>(null);
  /** 펜 도구: 패스 편집 중인 노드·앵커. addStart 있으면 다음 pointer up에서 새 앵커 추가(클릭=직선, 드래그=곡선) */
  const [pathEditState, setPathEditState] = useState<{
    nodeId: string;
    anchors: PathAnchor[];
    closed: boolean;
    addStart?: { x: number; y: number };
  } | null>(null);
  const pathEditStateRef = useRef(pathEditState);
  useEffect(() => {
    pathEditStateRef.current = pathEditState;
  }, [pathEditState]);
  const MAX_UNDO_STACK = 50;
  const undoRef = useRef<Doc[]>([]);
  const redoRef = useRef<Doc[]>([]);
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const pasteOffsetRef = useRef(0);
  const messageTimerRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const exportSvgRef = useRef<SVGSVGElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const canvasSizeRef = useRef(canvasSize);

  const pushMessage = useCallback((next: string) => {
    setMessage(next);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage(null);
    }, 2400);
  }, []);

  useEffect(() => {
    prototypePreviewRef.current = prototypePreview;
  }, [prototypePreview]);

  useEffect(() => {
    livePreviewRef.current = livePreview;
  }, [livePreview]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  useEffect(() => {
    if (!textEditingId) return;
    const current = docRef.current;
    const node = current.nodes[textEditingId];
    if (!node || node.type !== "text") {
      setTextEditingId(null);
      return;
    }
    const abs = getAbsoluteFrame(current, textEditingId);
    if (!abs) return;
    const zoom = current.view.zoom;
    setTextEditingRect({
      x: (abs.x - current.view.panX) * zoom,
      y: (abs.y - current.view.panY) * zoom,
      w: Math.max(20, abs.w * zoom),
      h: Math.max(20, abs.h * zoom),
    });
  }, [canvasSize.height, canvasSize.width, doc, textEditingId]);

  useEffect(() => {
    if (!textEditingId) return;
    const handle = window.requestAnimationFrame(() => {
      if (textEditingRef.current) {
        textEditingRef.current.focus();
        textEditingRef.current.select();
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [textEditingId]);

  useEffect(() => {
    textEditingIdRef.current = textEditingId;
  }, [textEditingId]);

  const ensureAnonId = useCallback(async () => {
    if (typeof localStorage === "undefined") return null;
    const existing = localStorage.getItem("anon_user_id");
    if (existing) return existing;
    try {
      const res = await fetch("/api/anon/init", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => null);
      if (data?.anonUserId) {
        localStorage.setItem("anon_user_id", data.anonUserId);
        return data.anonUserId as string;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setCanvasSize({ width: Math.max(200, width), height: Math.max(200, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pageId) return;
    fetch(`/api/pages/${pageId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setTitle(typeof data?.page?.title === "string" ? data.page.title : "");
        const rawContent = data?.version?.content_json;
        if (rawContent && rawContent.schema === "null_advanced_v1") {
          const nextDoc = hydrateDoc(rawContent);
          setDoc(nextDoc);
          setActivePageId(nextDoc.prototype?.startPageId ?? nextDoc.pages[0]?.id ?? null);
        }
      })
      .catch(() => null);
  }, [pageId]);

  const fetchComments = useCallback(() => {
    if (!pageId) return;
    fetch(`/api/pages/${pageId}/comments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.comments) setComments(data.comments);
      })
      .catch(() => null);
  }, [pageId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (!pageId || (!(tool === "comment") && !selectedCommentId)) return;
    const t = setInterval(fetchComments, 5000);
    return () => clearInterval(t);
  }, [pageId, tool, selectedCommentId, fetchComments]);

  useEffect(() => {
    if (!versionListOpen || !pageId) return;
    setVersionListLoading(true);
    ensureAnonId()
      .then((anonId) =>
        fetch(`/api/pages/${pageId}/versions`, { headers: anonId ? { "x-anon-user-id": anonId } : undefined })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.versions) setVersionList(data.versions);
        else setVersionList([]);
      })
      .catch(() => setVersionList([]))
      .finally(() => setVersionListLoading(false));
  }, [versionListOpen, pageId, ensureAnonId]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      if (!pageId) return;
      setVersionRestoring(versionId);
      try {
        const anonId = await ensureAnonId();
        const res = await fetch(`/api/pages/${pageId}/version/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(anonId ? { "x-anon-user-id": anonId } : {}) },
          body: JSON.stringify({ versionId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setMessage(data?.error ?? "restore_failed");
          return;
        }
        const pageRes = await fetch(`/api/pages/${pageId}`, { headers: anonId ? { "x-anon-user-id": anonId } : undefined });
        const pageData = await pageRes.json().catch(() => null);
        const rawContent = pageData?.version?.content_json;
        if (rawContent && rawContent.schema === "null_advanced_v1") {
          const nextDoc = hydrateDoc(rawContent);
          setDoc(nextDoc);
          setActivePageId(nextDoc.prototype?.startPageId ?? nextDoc.pages[0]?.id ?? null);
        }
        setVersionListOpen(false);
      } catch {
        setMessage("restore_failed");
      } finally {
        setVersionRestoring(null);
      }
    },
    [pageId]
  );

  const submitPendingComment = useCallback(() => {
    if (!pageId || !pendingComment || !pendingCommentContent.trim()) return;
    setCommentSubmitting(true);
    fetch(`/api/pages/${pageId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x: pendingComment.x,
        y: pendingComment.y,
        nodeId: pendingComment.nodeId,
        content: pendingCommentContent.trim(),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(() => {
        setPendingComment(null);
        setPendingCommentContent("");
        fetchComments();
      })
      .finally(() => setCommentSubmitting(false));
  }, [pageId, pendingComment, pendingCommentContent, fetchComments]);

  const selectedIds = useMemo(() => Array.from(doc.selection), [doc.selection]);
  const selectedNode = selectedIds.length === 1 ? doc.nodes[selectedIds[0]] : null;
  const pageRoot = ensurePageRoot(doc, activePageId);
  const pageNode = doc.nodes[pageRoot];
  const prototypeStartPageId = doc.prototype?.startPageId ?? doc.pages[0]?.id ?? null;
  const activePreviewPageId = previewPageId ?? prototypeStartPageId;
  const activeExportPageId = exportPageId ?? prototypeStartPageId;

  const viewBox = `${doc.view.panX} ${doc.view.panY} ${canvasSize.width / doc.view.zoom} ${canvasSize.height / doc.view.zoom}`;
  const rulerTicks = useMemo(() => {
    if (!showRulers) return { x: [] as Array<{ value: number; pos: number }>, y: [] as Array<{ value: number; pos: number }> };
    const zoom = doc.view.zoom;
    const step = getRulerStep(zoom);
    const viewW = canvasSize.width / zoom;
    const viewH = canvasSize.height / zoom;
    const startX = Math.floor(doc.view.panX / step) * step;
    const endX = doc.view.panX + viewW;
    const startY = Math.floor(doc.view.panY / step) * step;
    const endY = doc.view.panY + viewH;
    const xs: Array<{ value: number; pos: number }> = [];
    const ys: Array<{ value: number; pos: number }> = [];
    for (let x = startX; x <= endX; x += step) {
      const pos = (x - doc.view.panX) * zoom;
      if (pos < -step || pos > canvasSize.width + step) continue;
      xs.push({ value: Math.round(x), pos });
    }
    for (let y = startY; y <= endY; y += step) {
      const pos = (y - doc.view.panY) * zoom;
      if (pos < -step || pos > canvasSize.height + step) continue;
      ys.push({ value: Math.round(y), pos });
    }
    return { x: xs, y: ys };
  }, [canvasSize.height, canvasSize.width, doc.view.panX, doc.view.panY, doc.view.zoom, showRulers]);

  /** 뷰포트(문서 좌표) + 여유: 컬링·LOD용. EXECUTION_ORDER 7 */
  const viewportRect = useMemo(() => {
    const { panX, panY, zoom } = doc.view;
    const margin = 200;
    const w = canvasSize.width / zoom + 2 * margin;
    const h = canvasSize.height / zoom + 2 * margin;
    return { x: panX - margin, y: panY - margin, w, h };
  }, [canvasSize.width, canvasSize.height, doc.view.panX, doc.view.panY, doc.view.zoom]);

  /** 뷰포트와 겹치는 노드 id + 선택 노드(항상 표시). 가상화(컬링) */
  const visibleNodeIds = useMemo(() => {
    const all = flattenNodes(doc, pageRoot).filter((id) => id !== pageRoot);
    const inViewport = all.filter((id) => {
      const node = doc.nodes[id];
      if (!node || node.hidden) return false;
      const abs = getAbsoluteFrame(doc, id);
      return abs !== null && rectsIntersect(viewportRect, abs);
    });
    const selectedSet = new Set(inViewport);
    doc.selection.forEach((id) => selectedSet.add(id));
    return all.filter((id) => selectedSet.has(id));
  }, [doc, pageRoot, viewportRect]);

  useEffect(() => {
    const fallback = doc.prototype?.startPageId ?? doc.pages[0]?.id ?? null;
    if (!activePageId || !doc.pages.some((page) => page.id === activePageId)) {
      setActivePageId(fallback);
    }
  }, [activePageId, doc.pages, doc.prototype?.startPageId]);

  useEffect(() => {
    if (previewPageId && !doc.pages.some((page) => page.id === previewPageId)) {
      setPreviewPageId(prototypeStartPageId);
    }
  }, [doc.pages, previewPageId, prototypeStartPageId]);

  useEffect(() => {
    if (livePageId && !doc.pages.some((page) => page.id === livePageId)) {
      const fallback = activePageIdRef.current ?? docRef.current.prototype?.startPageId ?? docRef.current.pages[0]?.id ?? null;
      setLivePageId(fallback);
    }
  }, [doc.pages, livePageId]);

  useEffect(() => {
    if (panelMode !== "prototype" && prototypePreview) setPrototypePreview(false);
  }, [panelMode, prototypePreview]);

  useEffect(() => {
    if (prototypePreview && livePreview) setLivePreview(false);
  }, [prototypePreview, livePreview]);

  const commit = useCallback((next: Doc) => {
    const laidOut = layoutDoc(next);
    if (undoRef.current.length >= MAX_UNDO_STACK) undoRef.current.shift();
    undoRef.current.push(docRef.current);
    redoRef.current = [];
    setDoc(laidOut);
  }, []);

  const replace = useCallback((next: Doc) => {
    setDoc(next);
  }, []);

  const onPreviewPageChange = useCallback((nextId: string) => {
    setPreviewPageId(nextId);
  }, []);
  const onLivePageChange = useCallback((nextId: string) => {
    setLivePageId(nextId);
  }, []);

  function updateNodes(frames: Record<string, Frame>, commitChange: boolean) {
    const current = docRef.current;
    const nodes = { ...current.nodes };
    Object.entries(frames).forEach(([id, frame]) => {
      const node = nodes[id];
      if (!node) return;
      const prevFrame = node.frame;
      const nextFrame = { ...node.frame, ...frame };
      const nextNode = { ...node, frame: nextFrame };
      const sizeChangedW = frame.w !== undefined && frame.w !== prevFrame.w;
      const sizeChangedH = frame.h !== undefined && frame.h !== prevFrame.h;
      const parent = node.parentId ? nodes[node.parentId] : null;
      if (sizeChangedW || sizeChangedH) {
        const parentIsAuto = parent?.layout?.mode === "auto";
        const selfIsAuto = node.layout?.mode === "auto";
        if (parentIsAuto || selfIsAuto) {
          const sizing = node.layoutSizing ?? { width: "fixed", height: "fixed" };
          const nextSizing = { ...sizing };
          if (sizeChangedW) nextSizing.width = "fixed";
          if (sizeChangedH) nextSizing.height = "fixed";
          nextNode.layoutSizing = nextSizing;
        }
      }
      if (nextNode.sourceId) {
        const master = current.nodes[nextNode.sourceId];
        if (master) {
          const ignoreFrameXY = !!(nextNode.type === "instance" && nextNode.instanceOf && !hasAncestorInstance(current, nextNode.id));
          const override = buildNodeOverride(master, nextNode as Node, { ignoreFrameXY });
          if (override) nextNode.overrides = toSafeNodeOverride(override);
          else delete nextNode.overrides;
        }
      }
      nodes[id] = nextNode;
    });
    const next = { ...current, nodes } as Doc;
    if (commitChange) commit(next);
    else replace(next);
  }

  function updateNode(id: string, patch: Partial<Node>, commitChange = true) {
    const current = docRef.current;
    const node = current.nodes[id];
    if (!node) return;
    const prevFrame = node.frame;
    const nextLayout = patch.layout
      ? patch.layout.mode === "fixed"
        ? { mode: "fixed" }
        : { ...(node.layout?.mode === "auto" ? node.layout : DEFAULT_AUTO_LAYOUT), ...patch.layout }
      : node.layout;
    const applyPixelSnap = (f: Frame): Frame => {
      if (!pixelSnapRef.current) return f;
      return {
        ...f,
        x: snapToPixel(f.x),
        y: snapToPixel(f.y),
        w: Math.max(1, snapToPixel(f.w)),
        h: Math.max(1, snapToPixel(f.h)),
      };
    };
    const nextNode = {
      ...node,
      ...patch,
      frame: patch.frame ? applyPixelSnap({ ...node.frame, ...patch.frame }) : node.frame,
      style: patch.style ? { ...node.style, ...patch.style } : node.style,
      text: patch.text ? { ...node.text, ...patch.text } : node.text,
      image: patch.image ? { ...node.image, ...patch.image } : node.image,
      video: patch.video ? { ...node.video, ...patch.video } : node.video,
      layout: nextLayout,
      layoutSizing: patch.layoutSizing
        ? { ...(node.layoutSizing ?? { width: "fixed", height: "fixed" }), ...patch.layoutSizing }
        : node.layoutSizing,
      constraints: patch.constraints ? { ...(node.constraints ?? {}), ...patch.constraints } : node.constraints,
    };
    const sizeChangedW = patch.frame?.w !== undefined && patch.frame.w !== prevFrame.w;
    const sizeChangedH = patch.frame?.h !== undefined && patch.frame.h !== prevFrame.h;
    const parent = node.parentId ? current.nodes[node.parentId] : null;
    const textPatch = patch.text ?? null;
    const textChanged =
      textPatch !== null &&
      ("value" in textPatch || "style" in textPatch || "styleRef" in textPatch || "autoSize" in textPatch || "wrap" in textPatch);
    if (nextNode.type === "text" && nextNode.text?.autoSize && (textChanged || (textPatch !== null && "autoSize" in textPatch && (textPatch as { autoSize?: boolean }).autoSize))) {
      const resolvedStyle = resolveTextStyle(current, nextNode as Node) ?? nextNode.text?.style ?? DEFAULT_TEXT_STYLE;
      const textValue = resolveTextTokens(current, nextNode.text?.value ?? "");
      const measured = measureTextBlock(textValue, resolvedStyle, undefined, false);
      nextNode.frame = {
        ...nextNode.frame,
        w: Math.max(20, Math.round(measured.width + 4)),
        h: Math.max(20, Math.round(measured.height + 2)),
      };
    }
    if (sizeChangedW || sizeChangedH) {
      const parentIsAuto = parent?.layout?.mode === "auto";
      const selfIsAuto = nextNode.layout?.mode === "auto";
      if (parentIsAuto || selfIsAuto) {
        const sizing = nextNode.layoutSizing ?? { width: "fixed", height: "fixed" };
        const nextSizing = { ...sizing };
        if (sizeChangedW) nextSizing.width = "fixed";
        if (sizeChangedH) nextSizing.height = "fixed";
        nextNode.layoutSizing = nextSizing;
      }
    }
    if (nextNode.sourceId) {
      const master = current.nodes[nextNode.sourceId];
      if (master) {
        const ignoreFrameXY = !!(nextNode.type === "instance" && nextNode.instanceOf && !hasAncestorInstance(current, nextNode.id));
        const override = buildNodeOverride(master, nextNode as Node, { ignoreFrameXY });
        if (override) {
          const h = typeof override.hidden === "boolean" ? override.hidden : undefined;
          const l = typeof override.locked === "boolean" ? override.locked : undefined;
          const c = typeof override.clipContent === "boolean" ? override.clipContent : undefined;
          const { hidden: _h, locked: _l, clipContent: _c, ...rest } = override;
          nextNode.overrides = { ...rest, ...(h !== undefined && { hidden: h }), ...(l !== undefined && { locked: l }), ...(c !== undefined && { clipContent: c }) } as unknown as NodeOverride;
        } else delete nextNode.overrides;
      }
    }
    const next = {
      ...current,
      nodes: {
        ...current.nodes,
        [id]: nextNode as Node,
      },
    } as Doc;
    if (commitChange) {
      if (patch.frame && (patch.frame.w !== undefined || patch.frame.h !== undefined) && node.children.length) {
        const resized = next.nodes[id]?.frame ?? prevFrame;
        if (nextNode.layout?.mode === "auto") {
          const laidOut = layoutDoc(next);
          refreshOverridesForSubtree(laidOut, id);
          commit(laidOut);
        } else {
          const constrained = applyConstraintsOnResize(next, id, prevFrame, resized);
          refreshOverridesForSubtree(constrained, id);
          commit(constrained);
        }
        return;
      }
      commit(next);
      return;
    }
    replace(next);
  }

  const startTextEditing = useCallback((nodeId: string) => {
    const current = docRef.current;
    const node = current.nodes[nodeId];
    if (!node || node.type !== "text") return;
    const abs = getAbsoluteFrame(current, nodeId);
    if (!abs) return;
    const zoom = current.view.zoom;
    setTextEditingId(nodeId);
    setTextEditingValue(node.text?.value ?? "");
    setTextEditingRect({
      x: (abs.x - current.view.panX) * zoom,
      y: (abs.y - current.view.panY) * zoom,
      w: Math.max(20, abs.w * zoom),
      h: Math.max(20, abs.h * zoom),
    });
  }, []);

  const commitTextEditing = useCallback(() => {
    if (!textEditingId) return;
    const node = docRef.current.nodes[textEditingId];
    if (!node || node.type !== "text") {
      setTextEditingId(null);
      return;
    }
    const baseText = node.text ?? { value: "", style: DEFAULT_TEXT_STYLE };
    updateNode(
      textEditingId,
      {
        text: {
          ...baseText,
          value: textEditingValue,
        },
      },
      true,
    );
    setTextEditingId(null);
  }, [textEditingId, textEditingValue]);

  const fitTextNodeToContent = useCallback(
    (nodeId: string, enableAuto = false) => {
      const current = docRef.current;
      const node = current.nodes[nodeId];
      if (!node || node.type !== "text") return;
      const style = resolveTextStyle(current, node) ?? node.text?.style ?? DEFAULT_TEXT_STYLE;
      const textValue = resolveTextTokens(current, node.text?.value ?? "");
      const wrapEnabled = node.text?.wrap !== false;
      const measured = measureTextBlock(textValue, style, wrapEnabled ? node.frame.w : undefined, wrapEnabled);
      const nextFrame = {
        ...node.frame,
        w: wrapEnabled ? node.frame.w : Math.max(20, Math.round(measured.width + 4)),
        h: Math.max(20, Math.round(measured.height + 2)),
      };
      const baseText = node.text ?? { value: "", style: DEFAULT_TEXT_STYLE };
      updateNode(
        nodeId,
        {
          frame: nextFrame,
          text: {
            ...baseText,
            autoSize: enableAuto ? true : node.text?.autoSize,
            wrap: enableAuto ? false : node.text?.wrap,
          },
        },
        true,
      );
    },
    [updateNode],
  );

  function beginMove(e: React.PointerEvent, id: string) {
    const docCurrent = docRef.current;
    const node = docCurrent.nodes[id];
    if (!node || node.locked) return;

    const ids = docCurrent.selection.has(id) ? Array.from(docCurrent.selection) : [id];
    const origins: Record<string, Frame> = {};
    ids.forEach((nid) => {
      const n = docCurrent.nodes[nid];
      if (n) origins[nid] = { ...n.frame };
    });

    const pt = svgPoint(e);
    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);

    dragRef.current = {
      mode: "move",
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      ids,
      origins,
      capture,
    };
  }

  function beginResize(e: React.PointerEvent, id: string, handle: "nw" | "ne" | "sw" | "se") {
    const node = docRef.current.nodes[id];
    if (!node || node.locked) return;

    const pt = svgPoint(e);
    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);

    dragRef.current = {
      mode: "resize",
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      id,
      handle,
      origin: { ...node.frame },
      capture,
    };
    e.stopPropagation();
  }

  function beginDraw(e: React.PointerEvent, type: NodeType) {
    const docCurrent = cloneDoc(docRef.current);
    const pt = svgPoint(e);

    const node = createNode(type);
    node.frame.x = snap(pt.x, gridSnap);
    node.frame.y = snap(pt.y, gridSnap);
    node.frame.w = 1;
    node.frame.h = 1;

    addNode(docCurrent, node, pageRoot);
    docCurrent.selection = new Set([node.id]);
    replace(docCurrent);

    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "draw",
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      id: node.id,
      capture,
    };
  }

  function beginPan(e: React.PointerEvent) {
    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "pan",
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: docRef.current.view.panX,
      startPanY: docRef.current.view.panY,
      capture,
    };
  }

  function svgPoint(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const res = pt.matrixTransform(ctm.inverse());
    return { x: res.x, y: res.y };
  }

  function updateDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (drag.mode === "pan") {
      const dx = (e.clientX - drag.startX) / docRef.current.view.zoom;
      const dy = (e.clientY - drag.startY) / docRef.current.view.zoom;
      replace({
        ...docRef.current,
        view: {
          ...docRef.current.view,
          panX: drag.startPanX - dx,
          panY: drag.startPanY - dy,
        },
      });
      return;
    }

    const pt = svgPoint(e);
    const dx = pt.x - drag.startX;
    const dy = pt.y - drag.startY;

    if (drag.mode === "move") {
      const lockAxis = e.shiftKey;
      let moveX = dx;
      let moveY = dy;
      if (lockAxis) {
        if (Math.abs(dx) > Math.abs(dy)) moveY = 0;
        else moveX = 0;
      }
      const snapEnabled = gridSnapRef.current;
      if (!snapEnabled && drag.ids.length === 1 && !e.altKey) {
        const id = drag.ids[0];
        const current = docRef.current;
        const abs = getAbsoluteFrame(current, id);
        if (abs) {
          const moving = { x: abs.x + moveX, y: abs.y + moveY, w: abs.w, h: abs.h };
          const pageRootId = ensurePageRoot(current, activePageIdRef.current);
          const otherIds = flattenNodes(current, pageRootId)
            .filter((cid) => cid !== pageRootId && cid !== id)
            .filter((cid) => {
              const node = current.nodes[cid];
              return Boolean(node) && !node.hidden;
            });
          const targetX: number[] = [];
          const targetY: number[] = [];
          otherIds.forEach((cid) => {
            const rect = getAbsoluteFrame(current, cid);
            if (!rect) return;
            targetX.push(rect.x, rect.x + rect.w / 2, rect.x + rect.w);
            targetY.push(rect.y, rect.y + rect.h / 2, rect.y + rect.h);
          });
          const parentId = current.nodes[id]?.parentId;
          if (parentId) {
            const parentRect = getAbsoluteFrame(current, parentId);
            if (parentRect) {
              targetX.push(parentRect.x, parentRect.x + parentRect.w / 2, parentRect.x + parentRect.w);
              targetY.push(parentRect.y, parentRect.y + parentRect.h / 2, parentRect.y + parentRect.h);
            }
          }
          const movingX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
          const movingY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
          const threshold = 6 / Math.max(current.view.zoom, 0.1);
          let bestDx = 0;
          let bestDxAbs = threshold + 1;
          targetX.forEach((target) => {
            movingX.forEach((line) => {
              const diff = target - line;
              const absDiff = Math.abs(diff);
              if (absDiff < bestDxAbs) {
                bestDxAbs = absDiff;
                bestDx = diff;
              }
            });
          });
          if (bestDxAbs <= threshold) moveX += bestDx;
          let bestDy = 0;
          let bestDyAbs = threshold + 1;
          targetY.forEach((target) => {
            movingY.forEach((line) => {
              const diff = target - line;
              const absDiff = Math.abs(diff);
              if (absDiff < bestDyAbs) {
                bestDyAbs = absDiff;
                bestDy = diff;
              }
            });
          });
          if (bestDyAbs <= threshold) moveY += bestDy;
        }
      }
      const o = drag.origins[drag.ids[0]];
      if (o) {
        const dx = snap(o.x + moveX, snapEnabled) - o.x;
        const dy = snap(o.y + moveY, snapEnabled) - o.y;
        dragDeltaRef.current = { dx, dy };
        setDragDelta({ dx, dy });
      }
    }

    if (drag.mode === "resize") {
      const origin = drag.origin;
      let x = origin.x;
      let y = origin.y;
      let w = origin.w;
      let h = origin.h;

      if (drag.handle.includes("e")) w = snap(Math.max(20, origin.w + dx), gridSnap);
      if (drag.handle.includes("s")) h = snap(Math.max(20, origin.h + dy), gridSnap);
      if (drag.handle.includes("w")) {
        x = snap(origin.x + dx, gridSnap);
        w = snap(Math.max(20, origin.w - dx), gridSnap);
      }
      if (drag.handle.includes("n")) {
        y = snap(origin.y + dy, gridSnap);
        h = snap(Math.max(20, origin.h - dy), gridSnap);
      }

      const keepRatio = e.shiftKey;
      const fromCenter = e.altKey;
      if (keepRatio && origin.h !== 0) {
        const ratio = origin.w / origin.h;
        if (drag.handle.includes("e") || drag.handle.includes("w")) {
          h = snap(Math.max(20, w / ratio), gridSnap);
          y = snap(origin.y + (origin.h - h) / 2, gridSnap);
        }
        if (drag.handle.includes("n") || drag.handle.includes("s")) {
          w = snap(Math.max(20, h * ratio), gridSnap);
          x = snap(origin.x + (origin.w - w) / 2, gridSnap);
        }
      }

      if (fromCenter) {
        const cx = origin.x + origin.w / 2;
        const cy = origin.y + origin.h / 2;
        x = snap(cx - w / 2, gridSnap);
        y = snap(cy - h / 2, gridSnap);
      }

      updateNodes({ [drag.id]: { x, y, w, h, rotation: origin.rotation } }, false);
    }

    if (drag.mode === "draw") {
      const originX = drag.startX;
      const originY = drag.startY;
      const keepRatio = e.shiftKey;
      const fromCenter = e.altKey;
      let x = Math.min(originX, pt.x);
      let y = Math.min(originY, pt.y);
      let w = Math.abs(pt.x - originX);
      let h = Math.abs(pt.y - originY);
      if (keepRatio) {
        const size = Math.max(w, h);
        w = size;
        h = size;
        if (pt.x < originX) x = originX - size;
        if (pt.y < originY) y = originY - size;
      }
      if (fromCenter) {
        w = Math.abs(pt.x - originX) * 2;
        h = Math.abs(pt.y - originY) * 2;
        if (keepRatio) {
          const size = Math.max(w, h);
          w = size;
          h = size;
        }
        x = originX - w / 2;
        y = originY - h / 2;
      }
      updateNodes(
        {
          [drag.id]: {
            ...docRef.current.nodes[drag.id].frame,
            x: snap(x, gridSnap),
            y: snap(y, gridSnap),
            w: snap(Math.max(4, w), gridSnap),
            h: snap(Math.max(4, h), gridSnap),
          },
        },
        false,
      );
    }

    if (drag.mode === "pathAdd") {
      // Preview only: no state update during move; point is added on pointer up.
    }

    if (drag.mode === "pathEdit") {
      const state = pathEditStateRef.current;
      if (!state) return;
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      const orig = drag.originAnchors[drag.anchorIndex];
      if (!orig) return;
      const anchors = state.anchors.map((a, i) => {
        if (i !== drag.anchorIndex) return a;
        const anchor: PathAnchor = { ...a };
        if (drag.kind === "anchor") {
          anchor.x = orig.x + dx;
          anchor.y = orig.y + dy;
          if (orig.handle1X != null) anchor.handle1X = orig.handle1X + dx;
          if (orig.handle1Y != null) anchor.handle1Y = orig.handle1Y + dy;
          if (orig.handle2X != null) anchor.handle2X = orig.handle2X + dx;
          if (orig.handle2Y != null) anchor.handle2Y = orig.handle2Y + dy;
        } else if (drag.kind === "handle1" && orig.handle1X != null && orig.handle1Y != null) {
          let hx = orig.handle1X + dx;
          let hy = orig.handle1Y + dy;
          if (e.shiftKey) {
            const dir = snapDirection45(hx - orig.x, hy - orig.y);
            const len = Math.hypot(hx - orig.x, hy - orig.y);
            hx = orig.x + dir.x * len;
            hy = orig.y + dir.y * len;
          }
          if (e.altKey) {
            anchor.handle1X = hx;
            anchor.handle1Y = hy;
          } else if (orig.handle2X != null && orig.handle2Y != null && !anchor.isSmooth) {
            const ax = orig.x;
            const ay = orig.y;
            const d1x = hx - ax;
            const d1y = hy - ay;
            const len = Math.hypot(d1x, d1y) || 1;
            const d2len = Math.hypot(orig.handle2X - ax, orig.handle2Y - ay) || len;
            anchor.handle1X = hx;
            anchor.handle1Y = hy;
            anchor.handle2X = ax - (d1x / len) * d2len;
            anchor.handle2Y = ay - (d1y / len) * d2len;
          } else {
            anchor.handle1X = hx;
            anchor.handle1Y = hy;
          }
        } else if (drag.kind === "handle2" && orig.handle2X != null && orig.handle2Y != null) {
          let hx = orig.handle2X + dx;
          let hy = orig.handle2Y + dy;
          if (e.shiftKey) {
            const dir = snapDirection45(hx - orig.x, hy - orig.y);
            const len = Math.hypot(hx - orig.x, hy - orig.y);
            hx = orig.x + dir.x * len;
            hy = orig.y + dir.y * len;
          }
          if (e.altKey) {
            anchor.handle2X = hx;
            anchor.handle2Y = hy;
          } else if (orig.handle1X != null && orig.handle1Y != null && !anchor.isSmooth) {
            const ax = orig.x;
            const ay = orig.y;
            const d2x = hx - ax;
            const d2y = hy - ay;
            const len = Math.hypot(d2x, d2y) || 1;
            const d1len = Math.hypot(orig.handle1X - ax, orig.handle1Y - ay) || len;
            anchor.handle2X = hx;
            anchor.handle2Y = hy;
            anchor.handle1X = ax - (d2x / len) * d1len;
            anchor.handle1Y = ay - (d2y / len) * d1len;
          } else {
            anchor.handle2X = hx;
            anchor.handle2Y = hy;
          }
        }
        return anchor;
      });
      setPathEditState({ ...state, anchors });
    }
  }

  function endDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.capture?.releasePointerCapture(drag.pointerId);
    dragRef.current = null;

    if (drag.mode === "resize") {
      const current = docRef.current;
      const node = current.nodes[drag.id];
      if (node && node.children.length) {
        if (node.layout?.mode === "auto") {
          const laidOut = layoutDoc(current);
          refreshOverridesForSubtree(laidOut, drag.id);
          commit(laidOut);
        } else {
          const constrained = applyConstraintsOnResize(current, drag.id, drag.origin, node.frame);
          refreshOverridesForSubtree(constrained, drag.id);
          commit(constrained);
        }
      } else {
        commit(cloneDoc(current));
      }
      return;
    }
    if (drag.mode === "move") {
      const delta = dragDeltaRef.current ?? { dx: 0, dy: 0 };
      const frames: Record<string, Frame> = {};
      drag.ids.forEach((id) => {
        const origin = drag.origins[id];
        if (origin) frames[id] = { ...origin, x: origin.x + delta.dx, y: origin.y + delta.dy };
      });
      updateNodes(frames, true);
      setDragDelta(null);
      return;
    }
    if (drag.mode === "draw") {
      commit(cloneDoc(docRef.current));
      return;
    }
    if (drag.mode === "pathAdd") {
      const pt = svgPoint(e);
      const state = pathEditStateRef.current;
      if (state && state.anchors.length > 0) {
        const snapEnabled = gridSnapRef.current ?? false;
        let x = snap(pt.x, snapEnabled);
        let y = snap(pt.y, snapEnabled);
        if (e.shiftKey) {
          const last = state.anchors[state.anchors.length - 1];
          const dx = pt.x - last.x;
          const dy = pt.y - last.y;
          const len = Math.hypot(dx, dy);
          if (len > 1e-6) {
            const dir = snapDirection45(dx, dy);
            const snappedLen = Math.max(len, 1);
            x = last.x + dir.x * snappedLen;
            y = last.y + dir.y * snappedLen;
          }
        }
        const dist = Math.hypot(pt.x - drag.startX, pt.y - drag.startY);
        const isCurve = dist > 6;
        const newAnchors = state.anchors.slice(0, -1);
        const last = { ...state.anchors[state.anchors.length - 1] };
        const newAnchor: PathAnchor = { x, y };
        if (isCurve) {
          const dx = x - last.x;
          const dy = y - last.y;
          const k = 1 / 3;
          last.handle2X = last.x + dx * k;
          last.handle2Y = last.y + dy * k;
          newAnchor.handle1X = x - dx * k;
          newAnchor.handle1Y = y - dy * k;
        }
        newAnchors.push(last);
        newAnchors.push(newAnchor);
        setPathEditState({ ...state, anchors: newAnchors, addStart: undefined });
      }
      return;
    }
    if (drag.mode === "pathEdit") {
      return;
    }
  }

  function beginMarquee(e: React.PointerEvent) {
    const pt = svgPoint(e);
    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);
    setMarquee({ x: pt.x, y: pt.y, w: 0, h: 0 });
  }

  function updateMarquee(e: React.PointerEvent) {
    if (!marquee) return;
    const pt = svgPoint(e);
    const box = {
      x: Math.min(marquee.x, pt.x),
      y: Math.min(marquee.y, pt.y),
      w: Math.abs(pt.x - marquee.x),
      h: Math.abs(pt.y - marquee.y),
    };
    setMarquee(box);

    const ids = flattenNodes(docRef.current, pageRoot)
      .filter((id) => id !== pageRoot)
      .filter((id) => {
        const node = docRef.current.nodes[id];
        if (!node || node.hidden || node.locked) return false;
        const rect = getAbsoluteFrame(docRef.current, id);
        return rect ? rectsIntersect(rect, box) : false;
      });

    replace({ ...docRef.current, selection: new Set(ids) });
  }

  function endMarquee(e: React.PointerEvent) {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    setMarquee(null);
    commit(cloneDoc(docRef.current));
  }

  const PATH_HIT_RADIUS = 10;
  const PATH_HANDLE_RADIUS = 8;

  function hitPathAnchorOrHandle(
    pt: { x: number; y: number },
    anchors: PathAnchor[]
  ): { kind: "anchor" | "handle1" | "handle2"; index: number } | null {
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (Math.hypot(pt.x - a.x, pt.y - a.y) <= PATH_HIT_RADIUS) return { kind: "anchor", index: i };
      if (a.handle1X != null && a.handle1Y != null) {
        if (Math.hypot(pt.x - a.handle1X, pt.y - a.handle1Y) <= PATH_HANDLE_RADIUS) return { kind: "handle1", index: i };
      }
      if (a.handle2X != null && a.handle2Y != null) {
        if (Math.hypot(pt.x - a.handle2X, pt.y - a.handle2Y) <= PATH_HANDLE_RADIUS) return { kind: "handle2", index: i };
      }
    }
    return null;
  }

  function commitPathEdit(closePath: boolean) {
    const state = pathEditStateRef.current;
    if (!state) return;
    const closed = closePath || state.closed;
    const d = anchorsToPathData(state.anchors, closed);
    const bounds = pathDataToBounds(d, 0);
    const next = cloneDoc(docRef.current);
    const node = next.nodes[state.nodeId];
    if (!node) {
      setPathEditState(null);
      return;
    }
    const parentId = node.parentId;
    const parentRect = parentId ? getAbsoluteFrame(next, parentId) : null;
    const relX = parentRect ? bounds.x - parentRect.x : bounds.x;
    const relY = parentRect ? bounds.y - parentRect.y : bounds.y;
    node.shape = { ...node.shape, pathData: translatePathD(d, -bounds.x, -bounds.y) };
    node.frame = { ...node.frame, x: relX, y: relY, w: bounds.w, h: bounds.h };
    next.selection = new Set([state.nodeId]);
    commit(next);
    setPathEditState(null);
  }

  function beginPathDraw(e: React.PointerEvent) {
    const pt = svgPoint(e);
    const pageRoot = ensurePageRoot(docRef.current, activePageIdRef.current);
    const node = createNode("path");
    const snapPt = { x: snap(pt.x, gridSnapRef.current ?? false), y: snap(pt.y, gridSnapRef.current ?? false) };
    node.frame.x = snapPt.x;
    node.frame.y = snapPt.y;
    node.frame.w = 1;
    node.frame.h = 1;
    addNode(docRef.current, node, pageRoot);
    const next = cloneDoc(docRef.current);
    next.selection = new Set([node.id]);
    replace(next);
    setPathEditState({ nodeId: node.id, anchors: [{ x: snapPt.x, y: snapPt.y }], closed: false, addStart: { x: snapPt.x, y: snapPt.y } });
    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);
    dragRef.current = { mode: "pathAdd", pointerId: e.pointerId, startX: pt.x, startY: pt.y, nodeId: node.id, capture };
  }

  function beginPathEditDrag(
    e: React.PointerEvent,
    hit: { kind: "anchor" | "handle1" | "handle2"; index: number }
  ) {
    if (!pathEditState) return;
    const pt = svgPoint(e);
    const capture = e.currentTarget as Element;
    capture.setPointerCapture(e.pointerId);
    const originAnchors = pathEditState.anchors.map((a) => ({
      x: a.x,
      y: a.y,
      handle1X: a.handle1X,
      handle1Y: a.handle1Y,
      handle2X: a.handle2X,
      handle2Y: a.handle2Y,
    }));
    dragRef.current = {
      mode: "pathEdit",
      pointerId: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      nodeId: pathEditState.nodeId,
      anchorIndex: hit.index,
      kind: hit.kind,
      originAnchors,
      capture,
    };
    e.stopPropagation();
  }

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if (textEditingId) {
      commitTextEditing();
    }
    if (e.button === 1) {
      e.preventDefault();
      beginPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (contextMenu) { setContextMenuSubMenu(null); setContextMenu(null); }

    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest?.("[data-handle]")) {
      const el = target.closest("[data-handle]");
      const nodeId = el?.getAttribute("data-nodeid");
      const handle = el?.getAttribute("data-handle");
      if (nodeId && handle && ["nw", "ne", "sw", "se"].includes(handle)) {
        beginResize(e, nodeId, handle as "nw" | "ne" | "sw" | "se");
        return;
      }
    }

    const pt = svgPoint(e);
    const pageRoot = ensurePageRoot(docRef.current, activePageIdRef.current);
    const hitId = getNodeIdAtPoint(docRef.current, pageRoot, pt, new Set());
    const activeTool = tool;

    if (activeTool === "path") {
      if (pathEditState) {
        if (pathEditState.anchors.length >= 2 && !pathEditState.closed) {
          const first = pathEditState.anchors[0];
          if (Math.hypot(pt.x - first.x, pt.y - first.y) <= PATH_HIT_RADIUS) {
            commitPathEdit(true);
            return;
          }
        }
        const hit = hitPathAnchorOrHandle(pt, pathEditState.anchors);
        if (hit) {
          beginPathEditDrag(e, hit);
          return;
        }
        setPathEditState((prev) =>
          prev ? { ...prev, addStart: { x: snap(pt.x, gridSnapRef.current ?? false), y: snap(pt.y, gridSnapRef.current ?? false) } } : null
        );
        const capture = e.currentTarget as Element;
        capture.setPointerCapture(e.pointerId);
        dragRef.current = { mode: "pathAdd", pointerId: e.pointerId, startX: pt.x, startY: pt.y, nodeId: pathEditState.nodeId, capture };
        return;
      }
      if (hitId) {
        const node = docRef.current.nodes[hitId];
        const pathD = node?.shape?.pathData?.trim();
        if (node?.type === "path" && pathD) {
          const abs = getAbsoluteFrame(docRef.current, hitId);
          const { anchors, closed } = pathDataToAnchors(pathD);
          const anchorsAbs: PathAnchor[] = abs
            ? anchors.map((a) => ({
                ...a,
                x: a.x + abs.x,
                y: a.y + abs.y,
                handle1X: a.handle1X != null ? a.handle1X + abs.x : undefined,
                handle1Y: a.handle1Y != null ? a.handle1Y + abs.y : undefined,
                handle2X: a.handle2X != null ? a.handle2X + abs.x : undefined,
                handle2Y: a.handle2Y != null ? a.handle2Y + abs.y : undefined,
              }))
            : anchors;
          setPathEditState({ nodeId: hitId, anchors: anchorsAbs, closed });
          replace({ ...docRef.current, selection: new Set([hitId]) });
          return;
        }
      }
      beginPathDraw(e);
      return;
    }

    if (activeTool === "comment") {
      if (!pageId) {
        pushMessage("missing_page_id");
        return;
      }
      setPendingComment({
        x: pt.x,
        y: pt.y,
        nodeId: hitId ?? null,
        screenX: e.clientX,
        screenY: e.clientY,
      });
      setPendingCommentContent("");
      e.stopPropagation();
      return;
    }

    if (hitId) {
      handleNodePointerDown(e, hitId);
      return;
    }

    if (activeTool === "hand") {
      beginPan(e);
      return;
    }
    if (activeTool === "select") {
      beginMarquee(e);
      return;
    }
    const nodeType = activeTool === "frame" || activeTool === "section" || activeTool === "slice" ? activeTool : activeTool;
    beginDraw(e, nodeType as NodeType);
  }

  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeType: NodeType) => {
      const targetId =
        nodeType === "text" ? nodeId : findEditableTextNodeId(docRef.current, nodeId);
      if (targetId) {
        e.stopPropagation();
        startTextEditing(targetId);
        return;
      }
      const node = docRef.current.nodes[nodeId];
      if (node?.children?.length) {
        e.stopPropagation();
        replace({ ...docRef.current, selection: new Set(node.children) });
      }
    },
    [startTextEditing, replace],
  );

  function handleNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    if (textEditingId && textEditingId !== id) {
      commitTextEditing();
    }
    if (contextMenu) { setContextMenuSubMenu(null); setContextMenu(null); }

    if (tool !== "select") return;

    const append = e.shiftKey;
    const isSelected = docRef.current.selection.has(id);

    if (append) {
      const next = new Set(docRef.current.selection);
      if (isSelected) next.delete(id);
      else next.add(id);
      replace({ ...docRef.current, selection: next });
    } else if (!isSelected || docRef.current.selection.size > 1) {
      replace({ ...docRef.current, selection: new Set([id]) });
    }

    beginMove(e, id);
  }

  function openContextMenu(e: React.MouseEvent, targetId?: string) {
    e.preventDefault();
    e.stopPropagation();
    const bounds = canvasRef.current?.getBoundingClientRect();
    const x = e.clientX - (bounds?.left ?? 0);
    const y = e.clientY - (bounds?.top ?? 0);

    if (targetId) {
      const selected = docRef.current.selection;
      if (!selected.has(targetId) || selected.size > 1) {
        replace({ ...docRef.current, selection: new Set([targetId]) });
      }
    }

    setContextMenuSubMenu(null);
    setContextMenu({ x, y, targetId: targetId ?? null });
  }

  const removeSelected = useCallback(() => {
    if (!docRef.current.selection.size) return;
    const next = cloneDoc(docRef.current);
    next.selection.forEach((id) => {
      const node = next.nodes[id];
      if (!node || !node.parentId) return;
      const parent = next.nodes[node.parentId];
      if (parent) parent.children = parent.children.filter((cid) => cid !== id);
      delete next.nodes[id];
    });
    next.selection = new Set();
    commit(next);
  }, [commit, activePageId]);

  const copySelected = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    const payload = buildClipboardPayload(docRef.current, ids);
    if (!payload) return;
    clipboardRef.current = payload;
    pasteOffsetRef.current = 0;
  }, []);

  const cutSelected = useCallback(() => {
    copySelected();
    removeSelected();
  }, [copySelected, removeSelected]);

  const duplicateSelected = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) return;
    const payload = buildClipboardPayload(docRef.current, ids);
    if (!payload) return;
    const { nodes, rootIds } = cloneClipboardPayload(payload, { offset: GRID * 2 });
    const next = cloneDoc(docRef.current);
    Object.assign(next.nodes, nodes);
    rootIds.forEach((id) => {
      const node = next.nodes[id];
      if (!node) return;
      const parentId = node.parentId ?? ensurePageRoot(next, activePageId);
      const parent = next.nodes[parentId];
      if (parent) parent.children = [...parent.children, id];
      node.parentId = parentId;
    });
    next.selection = new Set(rootIds);
    commit(next);
  }, [commit, activePageId]);

  const pasteClipboard = useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload) return;
    const current = cloneDoc(docRef.current);
    const rootId = ensurePageRoot(current, activePageId);
    const selection = Array.from(docRef.current.selection);
    const targetParent = selection.length ? current.nodes[selection[0]]?.parentId ?? rootId : rootId;
    const offset = GRID * 2 + pasteOffsetRef.current;
    pasteOffsetRef.current += GRID * 2;
    const { nodes, rootIds } = cloneClipboardPayload(payload, { offset, parentOverride: targetParent });
    Object.assign(current.nodes, nodes);
    const parent = current.nodes[targetParent];
    if (parent) parent.children = [...parent.children, ...rootIds];
    rootIds.forEach((id) => {
      const node = current.nodes[id];
      if (node) node.parentId = targetParent;
    });
    current.selection = new Set(rootIds);
    commit(current);
  }, [commit, activePageId]);

  const wrapAutoLayoutSelection = useCallback(() => {
    const selection = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (selection.length < 2) return;

    const current = cloneDoc(docRef.current);
    const rootId = ensurePageRoot(docRef.current, activePageId);
    const parentId = docRef.current.nodes[selection[0]]?.parentId ?? rootId;
    const parentAbs = parentId ? getParentOffset(current, parentId) : { x: 0, y: 0 };

    const absMap = new Map<string, Rect>();
    selection.forEach((id) => {
      const rect = getAbsoluteFrame(docRef.current, id);
      if (rect) absMap.set(id, rect);
    });
    if (!absMap.size) return;

    const rects = Array.from(absMap.values());
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));
    const width = maxX - minX;
    const height = maxY - minY;
    const dir = width >= height ? "row" : "column";

    const wrapper = makeFrameNode(
      "오토 레이아웃",
      { x: minX - parentAbs.x, y: minY - parentAbs.y, w: width, h: height, rotation: 0 },
      {
        fill: "#FFFFFF",
        stroke: { color: "#E5E7EB", width: 1 },
        radius: 12,
        layout: { ...DEFAULT_AUTO_LAYOUT, dir, gap: 12, padding: { t: 12, r: 12, b: 12, l: 12 } },
        layoutSizing: { width: "hug", height: "hug" },
      },
    );
    addNode(current, wrapper, parentId);

    const sorted = [...selection].sort((a, b) => {
      const ra = absMap.get(a);
      const rb = absMap.get(b);
      if (!ra || !rb) return 0;
      return dir === "row" ? ra.x - rb.x : ra.y - rb.y;
    });

    sorted.forEach((id) => {
      const node = current.nodes[id];
      const abs = absMap.get(id);
      if (!node || !abs) return;
      node.parentId = wrapper.id;
      node.frame.x = abs.x - minX;
      node.frame.y = abs.y - minY;
    });

    const parent = current.nodes[parentId];
    if (parent) parent.children = parent.children.filter((cid) => !sorted.includes(cid)).concat(wrapper.id);

    wrapper.children = sorted;
    current.selection = new Set([wrapper.id]);
    commit(current);
  }, [commit, activePageId]);

  const toggleAutoLayoutSelection = useCallback(() => {
    const selection = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!selection.length) return;
    if (selection.length > 1) {
      wrapAutoLayoutSelection();
      return;
    }

    const id = selection[0];
    const node = docRef.current.nodes[id];
    if (!node || !["frame", "section", "component", "instance"].includes(node.type)) return;

    const next = cloneDoc(docRef.current);
    const target = next.nodes[id];
    if (!target) return;

    if (target.layout?.mode === "auto") {
      target.layout = { mode: "fixed" };
    } else {
      const childRects = target.children
        .map((childId) => getAbsoluteFrame(docRef.current, childId))
        .filter((rect): rect is Rect => Boolean(rect));
      const dir =
        childRects.length > 1
          ? Math.max(...childRects.map((r) => r.x + r.w)) - Math.min(...childRects.map((r) => r.x)) >=
            Math.max(...childRects.map((r) => r.y + r.h)) - Math.min(...childRects.map((r) => r.y))
            ? "row"
            : "column"
          : "column";
      target.layout = { ...DEFAULT_AUTO_LAYOUT, dir };
    }

    commit(next);
  }, [commit, wrapAutoLayoutSelection]);

  const groupSelected = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    if (ids.length < 2) return;

    const current = cloneDoc(docRef.current);
    const rootId = ensurePageRoot(docRef.current, activePageId);
    const parentId = docRef.current.nodes[ids[0]]?.parentId ?? rootId;
    const parentAbs = parentId ? getParentOffset(current, parentId) : { x: 0, y: 0 };

    const rects = ids.map((id) => getAbsoluteFrame(docRef.current, id)).filter(Boolean) as Rect[];
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));

    const group = createNode("group", {
      name: "그룹",
      frame: { x: minX - parentAbs.x, y: minY - parentAbs.y, w: maxX - minX, h: maxY - minY, rotation: 0 },
    });

    addNode(current, group, parentId);

    ids.forEach((id) => {
      const node = current.nodes[id];
      if (!node) return;
      const abs = getAbsoluteFrame(docRef.current, id);
      if (!abs) return;
      node.parentId = group.id;
      node.frame.x = abs.x - minX;
      node.frame.y = abs.y - minY;
    });

    const parent = current.nodes[parentId];
    if (parent) parent.children = parent.children.filter((cid) => !ids.includes(cid)).concat(group.id);

    group.children = ids;
    current.selection = new Set([group.id]);
    commit(current);
  }, [commit, activePageId]);

  const ungroupSelected = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    const next = cloneDoc(docRef.current);
    const toSelect: string[] = [];
    const rootId = ensurePageRoot(docRef.current, activePageId);

    ids.forEach((id) => {
      const group = next.nodes[id];
      if (!group || group.type !== "group") return;
      const parentId = group.parentId ?? rootId;
      const parent = next.nodes[parentId];
      const baseX = group.frame.x;
      const baseY = group.frame.y;

      group.children.forEach((cid) => {
        const child = next.nodes[cid];
        if (!child) return;
        child.parentId = parentId;
        child.frame.x += baseX;
        child.frame.y += baseY;
        if (parent) parent.children = [...parent.children, cid];
        toSelect.push(cid);
      });

      if (parent) parent.children = parent.children.filter((cid) => cid !== id);
      delete next.nodes[id];
    });

    next.selection = new Set(toSelect);
    commit(next);
  }, [commit, activePageId]);

  const runBooleanSelection = useCallback(
    (op: BooleanOp) => {
      const ids = Array.from(docRef.current.selection);
      if (ids.length < 2) return;
      const current = docRef.current;
      const rootId = ensurePageRoot(current, activePageId);
      const parentId = current.nodes[ids[0]]?.parentId ?? rootId;
      const sameParent = ids.every((id) => current.nodes[id]?.parentId === parentId);
      if (!sameParent) {
        pushMessage("같은 부모에 있는 도형만 Boolean 연산할 수 있습니다.");
        return;
      }
      const BOOLEAN_TYPES = ["rect", "ellipse", "path"] as const;
      const nodes = ids
        .map((id) => current.nodes[id])
        .filter((n): n is Node => Boolean(n) && BOOLEAN_TYPES.includes(n.type as (typeof BOOLEAN_TYPES)[number]));
      if (nodes.length < 2) {
        pushMessage("사각형·원·벡터(path)만 Boolean 연산할 수 있습니다.");
        return;
      }
      const rings: number[][][] = [];
      for (const id of ids) {
        const node = current.nodes[id];
        if (!node) continue;
        const abs = getAbsoluteFrame(current, id);
        if (!abs) continue;
        let d: string;
        if (node.type === "rect") d = rectToPath(abs);
        else if (node.type === "ellipse") d = ellipseToPath(abs);
        else {
          const raw = (node.shape?.pathData ?? "").trim();
          d = raw ? translatePathD(raw, abs.x, abs.y) : rectToPath(abs);
        }
        const ring = pathDataToPolygon(d);
        if (!ring || ring.length < 3) {
          pushMessage("일부 도형을 폴리곤으로 변환할 수 없습니다.");
          return;
        }
        rings.push(ring);
      }
      const resultD = runBooleanMultiple(rings, op);
      if (!resultD) {
        pushMessage("Boolean 연산 결과가 없습니다.");
        return;
      }
      const bounds = pathDataToBounds(resultD, 0);
      const parentRect = parentId ? getAbsoluteFrame(current, parentId) : null;
      const relX = parentRect ? bounds.x - parentRect.x : bounds.x;
      const relY = parentRect ? bounds.y - parentRect.y : bounds.y;
      const pathDataLocal = translatePathD(resultD, -bounds.x, -bounds.y);
      const pathNode = createNode("path", {
        name: `Boolean ${op}`,
        frame: { x: relX, y: relY, w: bounds.w, h: bounds.h, rotation: 0 },
        shape: { pathData: pathDataLocal },
      });
      const next = cloneDoc(current);
      next.nodes[pathNode.id] = pathNode;
      pathNode.parentId = parentId;
      const parent = next.nodes[parentId];
      if (parent) {
        parent.children = parent.children.filter((cid) => !ids.includes(cid));
        parent.children.push(pathNode.id);
      }
      ids.forEach((id) => delete next.nodes[id]);
      next.selection = new Set([pathNode.id]);
      commit(next);
    },
    [activePageId, commit, pushMessage],
  );

  const useMaskSelection = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    if (ids.length !== 1) return;
    const current = cloneDoc(docRef.current);
    const node = current.nodes[ids[0]];
    if (!node?.parentId) return;
    const parent = current.nodes[node.parentId];
    if (!parent || !["group", "frame", "section"].includes(parent.type)) return;
    const siblings = parent.children.filter((id) => id !== node.id);
    if (!siblings.length) return;
    parent.children = [node.id, ...siblings];
    node.isMask = true;
    commit(current);
  }, [commit]);

  const releaseMaskSelection = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    if (ids.length !== 1) return;
    const current = cloneDoc(docRef.current);
    const node = current.nodes[ids[0]];
    if (!node || !node.isMask) return;
    node.isMask = false;
    commit(current);
  }, [commit]);

  const createComponentFromSelection = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) return;

    const current = cloneDoc(docRef.current);
    const rootId = ensurePageRoot(current, activePageId);
    const parentId = current.nodes[ids[0]]?.parentId ?? rootId;
    const sameParent = ids.every((id) => current.nodes[id]?.parentId === parentId);
    if (!sameParent) {
      setMessage("같은 부모에 있는 레이어만 컴포넌트로 묶을 수 있습니다.");
      return;
    }

    const rects = ids.map((id) => getAbsoluteFrame(current, id)).filter(Boolean) as Rect[];
    if (!rects.length) return;
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const maxX = Math.max(...rects.map((r) => r.x + r.w));
    const maxY = Math.max(...rects.map((r) => r.y + r.h));
    const parentAbs = parentId ? getParentOffset(current, parentId) : { x: 0, y: 0 };

    const component = createNode("component", {
      name: "컴포넌트",
      frame: { x: minX - parentAbs.x, y: minY - parentAbs.y, w: maxX - minX, h: maxY - minY, rotation: 0 },
    });
    component.componentId = component.id;

    current.nodes[component.id] = component;
    component.parentId = parentId;

    ids.forEach((id) => {
      const node = current.nodes[id];
      if (!node) return;
      const abs = getAbsoluteFrame(current, id);
      if (!abs) return;
      node.parentId = component.id;
      node.frame.x = abs.x - minX;
      node.frame.y = abs.y - minY;
    });

    const parent = current.nodes[parentId];
    if (parent) {
      parent.children = parent.children.filter((cid) => !ids.includes(cid));
      parent.children = [...parent.children, component.id];
    }

    component.children = ids;
    component.variants = [{ id: makeId("variant"), name: "Default", rootId: ids[0] }];
    current.components = { ...current.components, [component.id]: component.id };
    current.selection = new Set([component.id]);
    commit(current);
  }, [commit, activePageId]);

  const addComponentVariant = useCallback(
    (componentId: string) => {
      const current = cloneDoc(docRef.current);
      const component = current.nodes[componentId];
      if (!component || component.type !== "component") return;
      const newRoot = createNode("frame", {
        name: "변형",
        frame: { x: 0, y: 0, w: component.frame.w, h: component.frame.h, rotation: 0 },
      });
      current.nodes[newRoot.id] = newRoot;
      newRoot.parentId = componentId;
      component.children = [...component.children, newRoot.id];
      const variants = component.variants ?? [];
      component.variants = [...variants, { id: makeId("variant"), name: `변형 ${variants.length + 1}`, rootId: newRoot.id }];
      commit(current);
    },
    [commit],
  );

  const createInstanceFromComponent = useCallback((componentId: string, variantId?: string) => {
    const current = cloneDoc(docRef.current);
    const component = current.nodes[componentId];
    if (!component) return;

    const variant = variantId && component.variants?.length
      ? component.variants.find((v) => v.id === variantId)
      : null;
    const rootsToClone =
      variant && current.nodes[variant.rootId]
        ? [variant.rootId]
        : component.children;

    const parentId = component.parentId ?? ensurePageRoot(current, activePageId);
    const instance = cloneNodeData(component);
    instance.id = makeRuntimeId("instance");
    instance.type = "instance";
    instance.name = `${component.name} 인스턴스`;
    instance.instanceOf = componentId;
    instance.sourceId = componentId;
    instance.componentId = undefined;
    instance.variantId = variantId ?? undefined;
    delete instance.overrides;
    instance.parentId = parentId;
    const srcRoot = rootsToClone.length === 1 ? current.nodes[rootsToClone[0]] : null;
    instance.frame = {
      ...instance.frame,
      x: component.frame.x + GRID * 2,
      y: component.frame.y + GRID * 2,
      w: srcRoot ? srcRoot.frame.w : component.frame.w,
      h: srcRoot ? srcRoot.frame.h : component.frame.h,
    };
    instance.children = [];

    const payload: ClipboardPayload = { rootIds: [...rootsToClone], nodes: {}, rootParents: {} };
    rootsToClone.forEach((childId) => {
      payload.rootParents[childId] = componentId;
      snapshotSubtree(current, childId, payload.nodes);
    });

    const sourceMap: Record<string, string> = {};
    Object.entries(payload.nodes).forEach(([id, node]) => {
      if (!node.sourceId) sourceMap[id] = id;
    });

    const cloned = cloneClipboardPayload(payload, { offset: 0, parentOverride: instance.id, sourceMap });
    instance.children = cloned.rootIds;

    current.nodes[instance.id] = instance;
    Object.assign(current.nodes, cloned.nodes);

    const parent = current.nodes[parentId];
    if (parent) parent.children = [...parent.children, instance.id];

    current.selection = new Set([instance.id]);
    commit(current);
  }, [commit, activePageId]);

  const detachInstance = useCallback((instanceId: string) => {
    const current = cloneDoc(docRef.current);
    const instance = current.nodes[instanceId];
    if (!instance || instance.type !== "instance") return;
    instance.type = "group";
    instance.instanceOf = undefined;
    instance.sourceId = undefined;
    instance.variantId = undefined;
    delete instance.overrides;
    instance.name = instance.name ? `${instance.name} (분리됨)` : "그룹";
    commit(current);
  }, [commit]);

  const setInstanceVariant = useCallback(
    (instanceId: string, variantId: string) => {
      const current = cloneDoc(docRef.current);
      const instance = current.nodes[instanceId];
      const component = instance?.instanceOf ? current.nodes[instance.instanceOf] : null;
      if (!instance || instance.type !== "instance" || !component?.variants?.length) return;
      const variant = component.variants.find((v) => v.id === variantId);
      if (!variant || !current.nodes[variant.rootId]) return;

      const payload: ClipboardPayload = { rootIds: [variant.rootId], nodes: {}, rootParents: {} };
      payload.rootParents[variant.rootId] = component.id;
      snapshotSubtree(current, variant.rootId, payload.nodes);

      const sourceMap: Record<string, string> = {};
      Object.entries(payload.nodes).forEach(([id, node]) => {
        if (!node.sourceId) sourceMap[id] = id;
      });

      const toRemove = flattenNodes(current, instanceId);
      toRemove.forEach((id) => {
        if (id !== instanceId) delete current.nodes[id];
      });

      instance.children = [];
      instance.variantId = variantId;
      const srcRoot = current.nodes[variant.rootId];
      instance.frame = { ...instance.frame, w: srcRoot?.frame.w ?? instance.frame.w, h: srcRoot?.frame.h ?? instance.frame.h };

      const cloned = cloneClipboardPayload(payload, { offset: 0, parentOverride: instance.id, sourceMap });
      instance.children = cloned.rootIds;
      Object.assign(current.nodes, cloned.nodes);
      commit(current);
    },
    [commit],
  );

  const syncInstancesForComponent = useCallback(
    (componentId: string, options?: { preserveOverrides?: boolean; instanceId?: string }) => {
      const current = cloneDoc(docRef.current);
      const component = current.nodes[componentId];
      if (!component) return;

      const payload: ClipboardPayload = { rootIds: [...component.children], nodes: {}, rootParents: {} };
      component.children.forEach((childId) => {
        payload.rootParents[childId] = componentId;
        snapshotSubtree(current, childId, payload.nodes);
      });

      const sourceMap: Record<string, string> = {};
      Object.entries(payload.nodes).forEach(([id, node]) => {
        if (!node.sourceId) sourceMap[id] = id;
      });

      const componentNodeIds = new Set([componentId, ...flattenNodes(current, componentId)]);

      Object.values(current.nodes)
        .filter((node) => node.type === "instance" && node.instanceOf === componentId)
        .filter((instance) => (options?.instanceId ? instance.id === options.instanceId : true))
        .forEach((instance) => {
          const overridesBySourceId =
            options?.preserveOverrides === false ? {} : collectInstanceOverrides(current, instance.id, componentNodeIds);
          const toRemove = flattenNodes(current, instance.id);
          toRemove.forEach((id) => {
            delete current.nodes[id];
          });

          instance.children = [];
          instance.sourceId = componentId;
          delete instance.overrides;
          instance.frame = { ...component.frame, x: instance.frame.x, y: instance.frame.y };
          instance.style = cloneStyle(component.style);
          instance.layout = cloneLayout(component.layout);
          instance.layoutSizing = component.layoutSizing ? { ...component.layoutSizing } : undefined;
          instance.constraints = component.constraints ? { ...component.constraints } : undefined;
          instance.prototype = clonePrototype(component.prototype);
          instance.hidden = component.hidden;
          instance.locked = component.locked;

          const cloned = cloneClipboardPayload(payload, { offset: 0, parentOverride: instance.id, sourceMap });
          instance.children = cloned.rootIds;
          Object.assign(current.nodes, cloned.nodes);

          const rootOverride = overridesBySourceId[componentId];
          if (rootOverride) {
            applyNodeOverride(instance, rootOverride, { preservePosition: true });
          }

          Object.values(cloned.nodes).forEach((node) => {
            if (!node.sourceId) return;
            const override = overridesBySourceId[node.sourceId];
            if (override) applyNodeOverride(node, override);
          });
        });

      commit(current);
    },
    [commit],
  );

  const swapInstanceComponent = useCallback(
    (instanceId: string, componentId: string) => {
      const current = cloneDoc(docRef.current);
      const instance = current.nodes[instanceId];
      const component = current.nodes[componentId];
      if (!instance || instance.type !== "instance" || !component || component.type !== "component") return;

      const payload: ClipboardPayload = { rootIds: [...component.children], nodes: {}, rootParents: {} };
      component.children.forEach((childId) => {
        payload.rootParents[childId] = componentId;
        snapshotSubtree(current, childId, payload.nodes);
      });

      const sourceMap: Record<string, string> = {};
      Object.entries(payload.nodes).forEach(([id, node]) => {
        if (!node.sourceId) sourceMap[id] = id;
      });

      const toRemove = flattenNodes(current, instance.id);
      toRemove.forEach((id) => {
        if (id === instance.id) return;
        delete current.nodes[id];
      });

      instance.children = [];
      instance.instanceOf = componentId;
      instance.sourceId = componentId;
      instance.name = `${component.name} 인스턴스`;
      delete instance.overrides;
      instance.frame = { ...component.frame, x: instance.frame.x, y: instance.frame.y };
      instance.style = cloneStyle(component.style);
      instance.layout = cloneLayout(component.layout);
      instance.layoutSizing = component.layoutSizing ? { ...component.layoutSizing } : undefined;
      instance.constraints = component.constraints ? { ...component.constraints } : undefined;
      instance.prototype = clonePrototype(component.prototype);
      instance.hidden = component.hidden;
      instance.locked = component.locked;

      const cloned = cloneClipboardPayload(payload, { offset: 0, parentOverride: instance.id, sourceMap });
      instance.children = cloned.rootIds;
      Object.assign(current.nodes, cloned.nodes);

      current.selection = new Set([instance.id]);
      commit(current);
    },
    [commit],
  );

  const pushInstanceOverridesToComponent = useCallback(
    (instanceId: string) => {
      const current = cloneDoc(docRef.current);
      const instance = current.nodes[instanceId];
      if (!instance || instance.type !== "instance" || !instance.instanceOf) return;
      refreshOverridesForSubtree(current, instanceId);
      const ids = [instanceId, ...flattenNodes(current, instanceId)];
      ids.forEach((id) => {
        const node = current.nodes[id];
        if (!node?.sourceId || !node.overrides) return;
        const master = current.nodes[node.sourceId];
        if (!master) return;
        applyNodeOverride(master, node.overrides, { preservePosition: true });
        delete master.overrides;
      });
      ids.forEach((id) => {
        const node = current.nodes[id];
        if (node) delete node.overrides;
      });
      refreshOverridesForSubtree(current, instanceId);
      commit(current);
      pushMessage("component_pushed");
    },
    [commit, pushMessage],
  );

  const resetInstanceNodeToMaster = useCallback(
    (nodeId: string) => {
      const node = docRef.current.nodes[nodeId];
      if (!node?.sourceId) return;
      const master = docRef.current.nodes[node.sourceId];
      if (!master) return;
      const patch: Partial<Node> = {};
      if (node.type === "text") {
        patch.text = master.text ? cloneText(master.text) : undefined;
      }
      if (node.type === "image") {
        patch.image = master.image ? { ...master.image } : undefined;
      }
      if (node.type === "video") {
        patch.video = master.video ? { ...master.video } : undefined;
      }
      if (Object.keys(patch).length) updateNode(nodeId, patch, true);
    },
    [updateNode],
  );

  const addStyleToken = useCallback((type: StyleToken["type"], value: StyleToken["value"]) => {
    const current = cloneDoc(docRef.current);
    const baseName = newStyleName.trim();
    const fallback = `${type === "fill" ? "채우기" : type === "stroke" ? "테두리" : type === "text" ? "텍스트" : "효과"} 스타일 ${current.styles.length + 1}`;
    const token: StyleToken = {
      id: makeRuntimeId("style"),
      name: baseName || fallback,
      type,
      value,
    };
    current.styles = [...current.styles, token];
    commit(current);
    setNewStyleName("");
  }, [commit, newStyleName]);

  const updateStyleToken = useCallback((id: string, patch: Partial<StyleToken>) => {
    const current = cloneDoc(docRef.current);
    current.styles = current.styles.map((style) => (style.id === id ? { ...style, ...patch } : style));
    commit(current);
  }, [commit]);

  const removeStyleToken = useCallback((id: string) => {
    const current = cloneDoc(docRef.current);
    current.styles = current.styles.filter((style) => style.id !== id);
    Object.values(current.nodes).forEach((node) => {
      if (node.style.fillStyleId === id) node.style.fillStyleId = undefined;
      if (node.style.strokeStyleId === id) node.style.strokeStyleId = undefined;
      if (node.style.effectStyleId === id) node.style.effectStyleId = undefined;
      if (node.text?.styleRef === id) node.text.styleRef = undefined;
    });
    commit(current);
  }, [commit]);

  const addVariable = useCallback(() => {
    const current = cloneDoc(docRef.current);
    const name = newVariableName.trim() || `${newVariableType === "color" ? "색상" : newVariableType === "number" ? "숫자" : newVariableType === "string" ? "문자" : "불리언"} 변수 ${current.variables.length + 1}`;
    let value: Variable["value"] = newVariableValue;
    if (newVariableType === "number") {
      const parsed = Number(newVariableValue);
      value = Number.isFinite(parsed) ? parsed : 0;
    }
    if (newVariableType === "boolean") value = newVariableBool;
    const modes = current.variableModes?.length ? current.variableModes : ["기본"];
    const modeValues = modes.length ? Object.fromEntries(modes.map((mode) => [mode, value])) : undefined;
    const variable: Variable = { id: makeRuntimeId("var"), name, type: newVariableType, value, modes: modeValues };
    current.variables = [...current.variables, variable];
    commit(current);
    setNewVariableName("");
  }, [commit, newVariableName, newVariableType, newVariableValue, newVariableBool]);

  const addVariableMode = useCallback(() => {
    const name = newVariableModeName.trim();
    if (!name) return;
    const current = cloneDoc(docRef.current);
    const modes = current.variableModes?.length ? [...current.variableModes] : ["기본"];
    if (modes.includes(name)) return;
    modes.push(name);
    current.variableModes = modes;
    if (!current.variableMode) current.variableMode = name;
    current.variables = current.variables.map((variable) => ({
      ...variable,
      modes: { ...(variable.modes ?? {}), [name]: resolveVariableValue(current, variable) },
    }));
    commit(current);
    setNewVariableModeName("");
    pushMessage("mode_added");
  }, [commit, newVariableModeName, pushMessage]);

  const renameVariableMode = useCallback(
    (prevName: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === prevName) return;
      const current = cloneDoc(docRef.current);
      const modes = current.variableModes?.length ? [...current.variableModes] : ["기본"];
      if (!modes.includes(prevName) || modes.includes(trimmed)) return;
      current.variableModes = modes.map((mode) => (mode === prevName ? trimmed : mode));
      if (current.variableMode === prevName) current.variableMode = trimmed;
      current.variables = current.variables.map((variable) => {
        if (!variable.modes || !(prevName in variable.modes)) return variable;
        const nextModes = { ...variable.modes, [trimmed]: variable.modes[prevName] };
        delete nextModes[prevName];
        return { ...variable, modes: nextModes };
      });
      commit(current);
      pushMessage("mode_renamed");
    },
    [commit, pushMessage],
  );

  const removeVariableMode = useCallback(
    (name: string) => {
      const current = cloneDoc(docRef.current);
      const modes = current.variableModes?.length ? [...current.variableModes] : ["기본"];
      if (modes.length <= 1) return;
      const nextModes = modes.filter((mode) => mode !== name);
      if (!nextModes.length) return;
      current.variableModes = nextModes;
      if (current.variableMode === name) current.variableMode = nextModes[0];
      current.variables = current.variables.map((variable) => {
        if (!variable.modes) return variable;
        const next = { ...variable.modes };
        delete next[name];
        return { ...variable, modes: next };
      });
      commit(current);
      pushMessage("mode_removed");
    },
    [commit, pushMessage],
  );

  const setActiveVariableMode = useCallback(
    (mode: string) => {
      const current = cloneDoc(docRef.current);
      current.variableMode = mode;
      commit(current);
    },
    [commit],
  );

  const updateVariableModeValue = useCallback(
    (id: string, mode: string, value: Variable["value"]) => {
      const current = cloneDoc(docRef.current);
      current.variables = current.variables.map((variable) => {
        if (variable.id !== id) return variable;
        return { ...variable, modes: { ...(variable.modes ?? {}), [mode]: value } };
      });
      commit(current);
    },
    [commit],
  );

  const updateVariable = useCallback((id: string, patch: Partial<Variable>) => {
    const current = cloneDoc(docRef.current);
    current.variables = current.variables.map((variable) => (variable.id === id ? { ...variable, ...patch } : variable));
    commit(current);
  }, [commit]);

  const removeVariable = useCallback((id: string) => {
    const current = cloneDoc(docRef.current);
    current.variables = current.variables.filter((variable) => variable.id !== id);
    Object.values(current.nodes).forEach((node) => {
      if (node.style.fillRef === id) node.style.fillRef = undefined;
    });
    commit(current);
  }, [commit]);

  const updateDocPrototype = useCallback((patch: Partial<Doc["prototype"]>) => {
    const current = cloneDoc(docRef.current);
    current.prototype = { ...(current.prototype ?? {}), ...patch };
    commit(current);
  }, [commit]);

  const selectPage = useCallback((nextPageId: string) => {
    setActivePageId(nextPageId);
    setPreviewPageId(nextPageId);
    setExportPageId(nextPageId);
    setDoc((prev) => {
      const pageDescendantIds = new Set(flattenNodes(prev, nextPageId));
      const kept = new Set([...prev.selection].filter((id) => pageDescendantIds.has(id)));
      return { ...prev, selection: kept };
    });
  }, []);

  const enableInfiniteCanvas = useCallback(
    (current: Doc, pageId: string) => {
      const pageNode = current.nodes[pageId];
      if (!pageNode) return;
      if (!pageSizeCacheRef.current[pageId]) {
        pageSizeCacheRef.current[pageId] = { w: pageNode.frame.w, h: pageNode.frame.h };
      }
      pageNode.frame = { ...pageNode.frame, w: 8000, h: 6000 };
    },
    [],
  );

  const toggleInfiniteCanvas = useCallback(() => {
    if (!activePageId) return;
    const current = cloneDoc(docRef.current);
    const pageNode = current.nodes[activePageId];
    if (!pageNode) return;
    const isOn = Boolean(infiniteCanvasPages[activePageId]);
    if (!isOn) {
      enableInfiniteCanvas(current, activePageId);
      current.view = { ...current.view, panX: -1200, panY: -900, zoom: Math.min(current.view.zoom, 1) };
    } else {
      const cached = pageSizeCacheRef.current[activePageId];
      pageNode.frame = { ...pageNode.frame, w: cached?.w ?? 1200, h: cached?.h ?? 800 };
    }
    commit(current);
    setInfiniteCanvasPages((prev) => ({ ...prev, [activePageId]: !isOn }));
  }, [activePageId, commit, enableInfiniteCanvas, infiniteCanvasPages]);

  const toggleInfiniteAll = useCallback(() => {
    const current = cloneDoc(docRef.current);
    const enableAll = !current.pages.every((page) => Boolean(infiniteCanvasPages[page.id]));
    const nextMap: Record<string, boolean> = { ...infiniteCanvasPages };
    current.pages.forEach((page) => {
      const node = current.nodes[page.id];
      if (!node) return;
      if (enableAll) {
        enableInfiniteCanvas(current, page.id);
        nextMap[page.id] = true;
        return;
      }
      const cached = pageSizeCacheRef.current[page.id];
      node.frame = { ...node.frame, w: cached?.w ?? 1200, h: cached?.h ?? 800 };
      nextMap[page.id] = false;
    });
    commit(current);
    setInfiniteCanvasPages(nextMap);
  }, [commit, enableInfiniteCanvas, infiniteCanvasPages]);

  const togglePrototypePreview = useCallback(() => {
    setPanelMode("prototype");
    setPrototypePreview((prev) => {
      const next = !prev;
      if (next) {
        const pageId = activePageIdRef.current ?? docRef.current.prototype?.startPageId ?? docRef.current.pages[0]?.id ?? null;
        if (pageId) setPreviewPageId(pageId);
      }
      return next;
    });
  }, []);

  const toggleLivePreview = useCallback(() => {
    setLivePreview((prev) => {
      const next = !prev;
      if (next) {
        const pageId = activePageIdRef.current ?? docRef.current.prototype?.startPageId ?? docRef.current.pages[0]?.id ?? null;
        if (pageId) setLivePageId(pageId);
      }
      return next;
    });
  }, []);

  const addPage = useCallback(() => {
    try {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const pageName = getNextPageName(current.pages);
      const pageId = makeRuntimeId("page");
      const pageNode = createNode("frame", { id: pageId, name: pageName, parentId: current.root });
      current.nodes[pageId] = pageNode;
      const root = ensureRootNode(current);
      if (!root) {
        pushMessage("page_action_failed");
        return;
      }
      root.children = [...root.children, pageId];
      current.pages = [...current.pages, { id: pageId, name: pageName, rootId: pageId }];
      if (!current.prototype?.startPageId) {
        current.prototype = { ...(current.prototype ?? {}), startPageId: pageId };
      }
      enableInfiniteCanvas(current, pageId);
      current.view = { ...current.view, panX: -1200, panY: -900, zoom: Math.min(current.view.zoom, 1) };
      commit(current);
      setInfiniteCanvasPages((prev) => ({ ...prev, [pageId]: true }));
      selectPage(pageId);
      pushMessage("page_added");
    } catch {
      pushMessage("page_action_failed");
    }
  }, [commit, enableInfiniteCanvas, pushMessage, selectPage]);

  const createPageFromSelection = useCallback(() => {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) {
      pushMessage("selection_required");
      return;
    }
    try {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) {
        pushMessage("page_action_failed");
        return;
      }
      const payload = buildClipboardPayload(current, ids);
      if (!payload) {
        pushMessage("page_action_failed");
        return;
      }
      const pageName = getNextPageName(current.pages);
      const pageId = makeRuntimeId("page");
      const pageNode = createNode("frame", { id: pageId, name: pageName, parentId: current.root });
      current.nodes[pageId] = pageNode;
      root.children = [...root.children, pageId];
      current.pages = [...current.pages, { id: pageId, name: pageName, rootId: pageId }];
      if (!current.prototype?.startPageId) {
        current.prototype = { ...(current.prototype ?? {}), startPageId: pageId };
      }
      enableInfiniteCanvas(current, pageId);
      current.view = { ...current.view, panX: -1200, panY: -900, zoom: Math.min(current.view.zoom, 1) };

      const cloned = cloneClipboardPayload(payload, { offset: 0, parentOverride: pageId });
      Object.assign(current.nodes, cloned.nodes);
      pageNode.children = cloned.rootIds;
      cloned.rootIds.forEach((id) => {
        const node = current.nodes[id];
        if (node) node.parentId = pageId;
      });

      commit(current);
      setInfiniteCanvasPages((prev) => ({ ...prev, [pageId]: true }));
      selectPage(pageId);
      pushMessage("page_from_selection");
    } catch {
      pushMessage("page_action_failed");
    }
  }, [commit, enableInfiniteCanvas, pushMessage, selectPage]);

  const addFormStep = useCallback(() => {
    try {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) {
        pushMessage("form_step_failed");
        return;
      }

      const formPages = current.pages
        .map((page) => {
          const match = page.name.match(/^폼\s*(\d+)$/);
          if (!match) return null;
          return { page, index: Number(match[1]) };
        })
        .filter(Boolean) as Array<{ page: DocPage; index: number }>;
      formPages.sort((a, b) => a.index - b.index);

      const nextIndex = formPages.length ? formPages[formPages.length - 1].index + 1 : 1;
      const prevPage = formPages.length ? formPages[formPages.length - 1].page : null;

      const pageName = `폼 ${nextIndex}`;
      const pageId = makeRuntimeId("page");
      const pageNode = createNode("frame", { id: pageId, name: pageName, parentId: current.root });
      current.nodes[pageId] = pageNode;
      root.children = [...root.children, pageId];
      current.pages = [...current.pages, { id: pageId, name: pageName, rootId: pageId }];
      if (!current.prototype?.startPageId) {
        current.prototype = { ...(current.prototype ?? {}), startPageId: pageId };
      }

      enableInfiniteCanvas(current, pageId);
      current.view = { ...current.view, panX: -1200, panY: -900, zoom: Math.min(current.view.zoom, 1) };

      const buildFormStep = (name: string, origin: { x: number; y: number }, prevPageId?: string, nextPageId?: string) => {
        const frame = makeFrameNode(
          `${name} 폼`,
          { x: origin.x, y: origin.y, w: 420, h: 420, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 12,
            layout: { mode: "auto", dir: "column", gap: 12, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", name, { x: 0, y: 0, w: 200, h: 24, rotation: 0 }, { size: 18, weight: 700 });
        const input = makeFrameNode(
          "입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const placeholder = makeTextNode("플레이스홀더", `${name} 입력`, { x: 0, y: 0, w: 200, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        input.children = [placeholder.id];
        placeholder.parentId = input.id;

        const buttons = makeFrameNode(
          "폼 네비게이션",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: null,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "center", wrap: false },
          },
        );

        const nodes: Record<string, Node> = {
          [frame.id]: frame,
          [title.id]: title,
          [input.id]: input,
          [placeholder.id]: placeholder,
          [buttons.id]: buttons,
        };

        const nextBtn = makeFrameNode(
          "다음 버튼",
          { x: 0, y: 0, w: 120, h: 40, rotation: 0 },
          {
            fill: "#111827",
            stroke: null,
            radius: 10,
            layout: { mode: "auto", dir: "row", gap: 6, padding: { t: 8, r: 12, b: 8, l: 12 }, align: "center", wrap: false },
          },
        );
        const nextLabel = makeTextNode("버튼 텍스트", "다음", { x: 0, y: 0, w: 60, h: 20, rotation: 0 }, { size: 13, weight: 600, color: "#FFFFFF", align: "center" });
        nextBtn.children = [nextLabel.id];
        nextLabel.parentId = nextBtn.id;
        nextBtn.prototype = {
          interactions: [
            {
              id: makeRuntimeId("proto"),
              trigger: "click",
              action: { type: "navigate", targetPageId: nextPageId ?? pageId },
            },
          ],
        };
        nodes[nextBtn.id] = nextBtn;
        nodes[nextLabel.id] = nextLabel;
        buttons.children = [nextBtn.id];
        nextBtn.parentId = buttons.id;

        if (prevPageId) {
          const prevBtn = makeFrameNode(
            "이전 버튼",
            { x: 0, y: 0, w: 120, h: 40, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 10, layout: { mode: "auto", dir: "row", gap: 6, padding: { t: 8, r: 12, b: 8, l: 12 }, align: "center", wrap: false } },
          );
          const prevLabel = makeTextNode("버튼 텍스트", "이전", { x: 0, y: 0, w: 60, h: 20, rotation: 0 }, { size: 13, weight: 600, align: "center" });
          prevBtn.children = [prevLabel.id];
          prevLabel.parentId = prevBtn.id;
          prevBtn.prototype = { interactions: [{ id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId: prevPageId } }] };
          nodes[prevBtn.id] = prevBtn;
          nodes[prevLabel.id] = prevLabel;
          buttons.children = [prevBtn.id, nextBtn.id];
          prevBtn.parentId = buttons.id;
        }

        frame.children = [title.id, input.id, buttons.id];
        title.parentId = frame.id;
        input.parentId = frame.id;
        buttons.parentId = frame.id;

        return { rootId: frame.id, nodes };
      };

      const origin = { x: 120, y: 120 };
      const built = buildFormStep(pageName, origin, prevPage?.id);
      Object.assign(current.nodes, built.nodes);
      pageNode.children = [built.rootId];
      const rootNode = current.nodes[built.rootId];
      if (rootNode) rootNode.parentId = pageId;

      if (prevPage) {
        const ids = flattenNodes(current, prevPage.rootId);
        ids.forEach((id) => {
          const node = current.nodes[id];
          const interactions = node?.prototype?.interactions ?? [];
          if (!node || !interactions.length) return;
          if (node.name !== "다음 버튼") return;
          node.prototype = {
            interactions: interactions.map((interaction) =>
              interaction.action.type === "navigate"
                ? { ...interaction, action: { ...interaction.action, targetPageId: pageId } }
                : interaction,
            ),
          };
        });
      }

      commit(current);
      setInfiniteCanvasPages((prev) => ({ ...prev, [pageId]: true }));
      selectPage(pageId);
      pushMessage("form_step_added");
    } catch {
      pushMessage("form_step_failed");
    }
  }, [commit, enableInfiniteCanvas, pushMessage, selectPage]);

  const previewTargetPageId = livePreview ? livePageId ?? activePreviewPageId : activePreviewPageId;
  const previewDims = useMemo(() => {
    const laidOut = layoutDoc(doc);
    const pageId = previewTargetPageId ?? laidOut.pages[0]?.id ?? null;
    const page = pageId ? laidOut.pages.find((p) => p.id === pageId) ?? laidOut.pages[0] : laidOut.pages[0];
    const pageNode: Node | null = page ? laidOut.nodes[page.rootId] ?? null : null;
    const pageWidth = pageNode?.frame?.w ?? 1200;
    const pageHeight = pageNode?.frame?.h ?? 800;
    const bounds: Rect | null = getPageContentBounds(laidOut, pageId);
    const isInfinite = Boolean(pageId && infiniteCanvasPages[pageId]);
    if (bounds && bounds.w > 0 && bounds.h > 0) {
      if (isInfinite) {
        return { width: Math.max(1, bounds.w), height: Math.max(1, bounds.h) };
      }
      return { width: Math.max(pageWidth, bounds.w), height: Math.max(pageHeight, bounds.h) };
    }
    if (isInfinite) {
      return { width: Math.max(1, Math.min(pageWidth, 2400)), height: Math.max(1, Math.min(pageHeight, 1600)) };
    }
    return { width: Math.max(1, pageWidth), height: Math.max(1, pageHeight) };
  }, [doc, infiniteCanvasPages, previewTargetPageId]);

  useEffect(() => {
    if (!doc.pages.length) return;
    const missing = doc.pages.filter((page) => infiniteCanvasPages[page.id] === undefined);
    if (!missing.length) return;
    const current = cloneDoc(docRef.current);
    let touched = false;
    missing.forEach((page) => {
      if (!current.nodes[page.id]) return;
      enableInfiniteCanvas(current, page.id);
      touched = true;
    });
    if (!touched) return;
    commit(current);
    setInfiniteCanvasPages((prev) => {
      const next = { ...prev };
      missing.forEach((page) => {
        next[page.id] = true;
      });
      return next;
    });
  }, [doc.pages, commit, enableInfiniteCanvas, infiniteCanvasPages]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    let raf = 0;
    const updateScale = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      const scale = Math.min(1, (width - 48) / previewDims.width, (height - 48) / previewDims.height);
      setPreviewScaleAuto(Number.isFinite(scale) ? Math.max(0.05, scale) : 1);
    };
    const observer = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateScale);
    });
    observer.observe(container);
    updateScale();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [previewDims]);

  useEffect(() => {
    if (!prototypePreview && !livePreview) return;
    const container = previewContainerRef.current;
    if (!container) return;
    container.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, [livePreview, previewTargetPageId, prototypePreview]);

  const effectivePreviewScale = previewScaleMode === "manual" ? previewScaleManual : previewScaleAuto;

  const renamePage = useCallback(
    (pageId: string, name: string, commitChange: boolean) => {
      const current = cloneDoc(docRef.current);
      current.pages = current.pages.map((page) => (page.id === pageId ? { ...page, name } : page));
      const page = current.pages.find((item) => item.id === pageId);
      if (page) {
        const root = current.nodes[page.rootId];
        if (root) root.name = name;
      }
      if (commitChange) commit(current);
      else replace(current);
    },
    [commit, replace],
  );

  const duplicatePage = useCallback(
    (pageId: string) => {
      try {
        const current = cloneDoc(docRef.current);
        const page = current.pages.find((item) => item.id === pageId);
        if (!page) {
          pushMessage("page_action_failed");
          return;
        }
        const wasInfinite = Boolean(infiniteCanvasPages[page.rootId]);
        const payload = buildClipboardPayload(current, [page.rootId]);
        if (!payload) {
          pushMessage("page_action_failed");
          return;
        }
        const cloned = cloneClipboardPayload(payload, { offset: 0, parentOverride: current.root });
        const newRootId = cloned.rootIds[0];
        if (!newRootId) {
          pushMessage("page_action_failed");
          return;
        }
        const pageNameBase = `${page.name} 복제`;
        const existing = new Set(current.pages.map((item) => item.name));
        let name = pageNameBase;
        let count = 2;
        while (existing.has(name)) {
          name = `${pageNameBase} ${count}`;
          count += 1;
        }
        Object.assign(current.nodes, cloned.nodes);
        const root = current.nodes[current.root];
        if (!root) {
          pushMessage("page_action_failed");
          return;
        }
        root.children = [...root.children, newRootId];
        current.pages = [...current.pages, { id: newRootId, name, rootId: newRootId }];
        const pageRootNode = current.nodes[newRootId];
        if (pageRootNode) pageRootNode.name = name;
        if (wasInfinite) {
          const cached = pageSizeCacheRef.current[page.rootId];
          if (cached) pageSizeCacheRef.current[newRootId] = { ...cached };
        }
        commit(current);
        if (wasInfinite) {
          setInfiniteCanvasPages((prev) => ({ ...prev, [newRootId]: true }));
        }
        selectPage(newRootId);
        pushMessage("page_duplicated");
      } catch {
        pushMessage("page_action_failed");
      }
    },
    [commit, infiniteCanvasPages, pushMessage, selectPage],
  );

  const movePage = useCallback(
    (pageId: string, direction: -1 | 1) => {
      const current = cloneDoc(docRef.current);
      const index = current.pages.findIndex((page) => page.id === pageId);
      if (index < 0) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.pages.length) return;
      const nextPages = [...current.pages];
      const [moved] = nextPages.splice(index, 1);
      nextPages.splice(nextIndex, 0, moved);
      current.pages = nextPages;
      const root = current.nodes[current.root];
      if (root) {
        const orderedRoots = nextPages.map((page) => page.rootId);
        const extras = root.children.filter((id) => !orderedRoots.includes(id));
        root.children = [...orderedRoots, ...extras];
      }
      commit(current);
      selectPage(pageId);
    },
    [commit, selectPage],
  );

  const removePage = useCallback(
    (pageId: string) => {
      const current = cloneDoc(docRef.current);
      if (current.pages.length <= 1) {
        pushMessage("page_delete_blocked");
        return;
      }
      const page = current.pages.find((item) => item.id === pageId);
      if (!page) {
        pushMessage("page_action_failed");
        return;
      }
      const idsToRemove = new Set<string>();
      collectSubtreeIds(current, page.rootId, idsToRemove);
      idsToRemove.forEach((id) => {
        delete current.nodes[id];
      });
      const root = current.nodes[current.root];
      if (root) root.children = root.children.filter((id) => id !== page.rootId);
      current.pages = current.pages.filter((item) => item.id !== pageId);
      if (current.prototype?.startPageId === pageId) {
        current.prototype = { ...(current.prototype ?? {}), startPageId: current.pages[0]?.id ?? undefined };
      }
      current.selection = new Set(Array.from(current.selection).filter((id) => !idsToRemove.has(id)));
      commit(current);
      setInfiniteCanvasPages((prev) => {
        if (!prev[pageId]) return prev;
        const next = { ...prev };
        delete next[pageId];
        return next;
      });
      delete pageSizeCacheRef.current[pageId];
      if (activePageId === pageId) {
        const fallback = current.pages[0]?.id ?? null;
        if (fallback) selectPage(fallback);
      }
      pushMessage("page_deleted");
    },
    [activePageId, commit, pushMessage, selectPage],
  );

  const addPrototypeInteraction = useCallback((nodeId: string) => {
    const current = cloneDoc(docRef.current);
    const node = current.nodes[nodeId];
    if (!node) return;
    const fallbackPageId = current.prototype?.startPageId ?? current.pages[0]?.id ?? "";
    const interaction: PrototypeInteraction = {
      id: makeRuntimeId("proto"),
      trigger: "click",
      action: { type: "navigate", targetPageId: fallbackPageId },
    };
    const interactions = node.prototype?.interactions ?? [];
    node.prototype = { interactions: [...interactions, interaction] };
    commit(current);
  }, [commit]);

  const updatePrototypeInteraction = useCallback((nodeId: string, interactionId: string, patch: Partial<PrototypeInteraction>) => {
    const current = cloneDoc(docRef.current);
    const node = current.nodes[nodeId];
    if (!node) return;
    const interactions = node.prototype?.interactions ?? [];
    node.prototype = {
      interactions: interactions.map((interaction) => {
        if (interaction.id !== interactionId) return interaction;
        return {
          ...interaction,
          ...patch,
          action: patch.action ? patch.action : interaction.action,
        };
      }),
    };
    commit(current);
  }, [commit]);

  const removePrototypeInteraction = useCallback((nodeId: string, interactionId: string) => {
    const current = cloneDoc(docRef.current);
    const node = current.nodes[nodeId];
    if (!node) return;
    const interactions = node.prototype?.interactions ?? [];
    node.prototype = { interactions: interactions.filter((interaction) => interaction.id !== interactionId) };
    commit(current);
  }, [commit]);

  const moveLayerInDoc = useCallback((draggedId: string, targetNodeId: string, asChild: boolean) => {
    const current = cloneDoc(docRef.current);
    const dragged = current.nodes[draggedId];
    const target = current.nodes[targetNodeId];
    const pageRootId = ensurePageRoot(current, activePageIdRef.current);
    if (!dragged || !target || !dragged.parentId || draggedId === targetNodeId) return;
    const oldParent = current.nodes[dragged.parentId];
    if (!oldParent) return;
    let newParentId: string;
    let newIndex: number;
    const canContain = ["frame", "section", "group", "component", "instance"].includes(target.type);
    if (asChild && canContain && targetNodeId !== draggedId) {
      newParentId = targetNodeId;
      const newParent = current.nodes[newParentId];
      newIndex = newParent?.children?.length ?? 0;
    } else {
      if (!target.parentId) return;
      newParentId = target.parentId;
      newIndex = current.nodes[newParentId].children.indexOf(targetNodeId) + 1;
    }
    if (dragged.parentId === newParentId && current.nodes[newParentId].children.indexOf(draggedId) < newIndex) newIndex -= 1;
    const oldSibs = [...(oldParent.children ?? [])];
    const idx = oldSibs.indexOf(draggedId);
    if (idx >= 0) oldSibs.splice(idx, 1);
    oldParent.children = oldSibs;
    dragged.parentId = newParentId;
    const newSibs = [...(current.nodes[newParentId].children ?? [])];
    newSibs.splice(newIndex, 0, draggedId);
    current.nodes[newParentId].children = newSibs;
    commit(current);
  }, [commit]);

  const insertPreset = useCallback((preset: PresetDefinition) => {
    if (preset.id === "test-stage") {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) return;

      const touchedPages = new Set<string>();
      const markInfinite = (pageId: string) => {
        if (!current.nodes[pageId]) return;
        enableInfiniteCanvas(current, pageId);
        touchedPages.add(pageId);
      };

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) {
          markInfinite(existing.id);
          return existing;
        }
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        markInfinite(pageId);
        return page;
      };

      const stagePage = ensurePage("테스트 스테이지");
      const accountPage = ensurePage("계정");
      current.prototype = { ...(current.prototype ?? {}), startPageId: stagePage.id };

      const findPreset = (id: string) =>
        PRESET_GROUPS.flatMap((group) => group.items).find((item) => item.id === id);
      const pageHasNode = (pageId: string, nodeName: string) => {
        const ids = flattenNodes(current, pageId);
        return ids.some((id) => current.nodes[id]?.name === nodeName);
      };

      const base = { x: 120, y: 120 };
      const placements = [
        { id: "auth-login", offset: { x: 0, y: 0 } },
        { id: "auth-signup", offset: { x: 420, y: 0 } },
        { id: "payment-form", offset: { x: 0, y: 520 } },
        { id: "test-interaction-panel", offset: { x: 460, y: 520 } },
        { id: "auth-logout", offset: { x: 0, y: 1080 } },
        { id: "test-link-account", offset: { x: 180, y: 1080 } },
        { id: "test-link-upgrade", offset: { x: 420, y: 1080 } },
        { id: "checkbox", offset: { x: 0, y: 1160 } },
        { id: "toggle", offset: { x: 200, y: 1160 } },
        { id: "test-responsive-stack", offset: { x: 0, y: 1260 } },
        { id: "card", offset: { x: 560, y: 1260 } },
        { id: "list", offset: { x: 880, y: 1260 } },
        { id: "hero", offset: { x: 0, y: 1600 } },
        { id: "navbar", offset: { x: 0, y: 2020 } },
        { id: "footer", offset: { x: 0, y: 2140 } },
      ];

      const insertedRoots: string[] = [];
      placements.forEach((placement) => {
        const def = findPreset(placement.id);
        if (!def) return;
        const built = def.build({ x: base.x + placement.offset.x, y: base.y + placement.offset.y });
        Object.values(built.nodes).forEach((node) => {
          if ((node.name === "로그인 버튼" || node.name === "로그인 테스트 버튼") && node.prototype?.interactions?.length) {
            node.prototype = {
              interactions: node.prototype.interactions.map((interaction) =>
                interaction.action.type === "submit"
                  ? { ...interaction, action: { ...interaction.action, nextPageId: accountPage.id } }
                  : interaction,
              ),
            };
          }
          if (node.name === "회원가입 버튼" && node.prototype?.interactions?.length) {
            node.prototype = {
              interactions: node.prototype.interactions.map((interaction) =>
                interaction.action.type === "submit"
                  ? { ...interaction, action: { ...interaction.action, nextPageId: accountPage.id } }
                  : interaction,
              ),
            };
          }
          if (node.name === "로그아웃 버튼" && node.prototype?.interactions?.length) {
            node.prototype = {
              interactions: node.prototype.interactions.map((interaction) =>
                interaction.action.type === "submit"
                  ? { ...interaction, action: { ...interaction.action, nextPageId: stagePage.id } }
                  : interaction,
              ),
            };
          }
        });
        Object.assign(current.nodes, built.nodes);
        const parent = current.nodes[stagePage.rootId];
        const rootNode = current.nodes[built.rootId];
        if (parent) parent.children = [...parent.children, built.rootId];
        if (rootNode) rootNode.parentId = stagePage.rootId;
        insertedRoots.push(built.rootId);
      });

      if (!pageHasNode(accountPage.rootId, "관리자 패널")) {
        const adminPreset = findPreset("admin-panel");
        if (adminPreset) {
          const builtAdmin = adminPreset.build({ x: 120, y: 120 });
          Object.assign(current.nodes, builtAdmin.nodes);
          const parent = current.nodes[accountPage.rootId];
          const rootNode = current.nodes[builtAdmin.rootId];
          if (parent) parent.children = [...parent.children, builtAdmin.rootId];
          if (rootNode) rootNode.parentId = accountPage.rootId;
        }
      }

      if (insertedRoots.length) {
        current.selection = new Set(insertedRoots);
      }

      commit(current);
      if (touchedPages.size) {
        setInfiniteCanvasPages((prev) => {
          const next = { ...prev };
          touchedPages.forEach((pageId) => {
            next[pageId] = true;
          });
          return next;
        });
      }
      selectPage(stagePage.id);
      pushMessage("preset_added");
      return;
    }

    if (preset.id === "form-flow-3") {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) return;

      const touchedPages = new Set<string>();
      const markInfinite = (pageId: string) => {
        if (!current.nodes[pageId]) return;
        enableInfiniteCanvas(current, pageId);
        touchedPages.add(pageId);
      };

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) {
          markInfinite(existing.id);
          return existing;
        }
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        markInfinite(pageId);
        return page;
      };

      const loginPage = ensurePage("로그인");
      const form1Page = ensurePage("폼 1");
      const form2Page = ensurePage("폼 2");
      const form3Page = ensurePage("폼 3");

      current.prototype = { ...(current.prototype ?? {}), startPageId: loginPage.id };

      const pageHasNode = (pageId: string, nodeName: string) => {
        const ids = flattenNodes(current, pageId);
        return ids.some((id) => current.nodes[id]?.name === nodeName);
      };

      const placeOnPage = (pageId: string, nodes: Record<string, Node>, rootId: string) => {
        Object.assign(current.nodes, nodes);
        const pageRoot = current.nodes[pageId];
        const rootNode = current.nodes[rootId];
        if (pageRoot) pageRoot.children = [...pageRoot.children, rootId];
        if (rootNode) rootNode.parentId = pageId;
      };

      const buildLoginFlow = (origin: { x: number; y: number }, nextPageId: string) => {
        const frame = makeFrameNode(
          "로그인 폼 (플로우)",
          { x: origin.x, y: origin.y, w: 360, h: 360, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 12,
            layout: {
              mode: "auto",
              dir: "column",
              gap: 12,
              padding: { t: 20, r: 20, b: 20, l: 20 },
              align: "stretch",
              wrap: false,
            },
          },
        );
        const title = makeTextNode("타이틀", "로그인", { x: 0, y: 0, w: 200, h: 28, rotation: 0 }, { size: 20, weight: 700 });
        const email = makeFrameNode(
          "이메일 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const emailPlaceholder = makeTextNode(
          "플레이스홀더",
          fieldPlaceholder("email", "이메일"),
          { x: 0, y: 0, w: 160, h: 20, rotation: 0 },
          { color: "#9CA3AF", size: 14 },
        );
        email.children = [emailPlaceholder.id];
        emailPlaceholder.parentId = email.id;
        const password = makeFrameNode(
          "비밀번호 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const passwordPlaceholder = makeTextNode(
          "플레이스홀더",
          fieldPlaceholder("password", "비밀번호"),
          { x: 0, y: 0, w: 170, h: 20, rotation: 0 },
          { color: "#9CA3AF", size: 14 },
        );
        password.children = [passwordPlaceholder.id];
        passwordPlaceholder.parentId = password.id;
        const button = makeFrameNode(
          "로그인 버튼",
          { x: 0, y: 0, w: 160, h: 44, rotation: 0 },
          {
            fill: "#111827",
            stroke: null,
            radius: 10,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 18, b: 10, l: 18 }, align: "center", wrap: false },
          },
        );
        const buttonLabel = makeTextNode("버튼 텍스트", "로그인", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
        button.children = [buttonLabel.id];
        buttonLabel.parentId = button.id;
        button.prototype = {
          interactions: [
            {
              id: makeRuntimeId("proto"),
              trigger: "click",
              action: { type: "navigate", targetPageId: nextPageId },
            },
          ],
        };
        frame.children = [title.id, email.id, password.id, button.id];
        title.parentId = frame.id;
        email.parentId = frame.id;
        password.parentId = frame.id;
        button.parentId = frame.id;
        return {
          rootId: frame.id,
          nodes: {
            [frame.id]: frame,
            [title.id]: title,
            [email.id]: email,
            [emailPlaceholder.id]: emailPlaceholder,
            [password.id]: password,
            [passwordPlaceholder.id]: passwordPlaceholder,
            [button.id]: button,
            [buttonLabel.id]: buttonLabel,
          },
        };
      };

      const buildFormStep = (name: string, origin: { x: number; y: number }, nextPageId?: string, prevPageId?: string) => {
        const frame = makeFrameNode(
          `${name} 폼`,
          { x: origin.x, y: origin.y, w: 420, h: 420, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 12,
            layout: { mode: "auto", dir: "column", gap: 12, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", name, { x: 0, y: 0, w: 200, h: 24, rotation: 0 }, { size: 18, weight: 700 });
        const input = makeFrameNode(
          "입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const placeholder = makeTextNode("플레이스홀더", `${name} 입력`, { x: 0, y: 0, w: 200, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        input.children = [placeholder.id];
        placeholder.parentId = input.id;

        const buttons = makeFrameNode(
          "폼 네비게이션",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: null,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "center", wrap: false },
          },
        );

        const nodes: Record<string, Node> = {
          [frame.id]: frame,
          [title.id]: title,
          [input.id]: input,
          [placeholder.id]: placeholder,
          [buttons.id]: buttons,
        };

        if (prevPageId) {
          const prevBtn = makeFrameNode(
            "이전 버튼",
            { x: 0, y: 0, w: 120, h: 40, rotation: 0 },
            { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 10, layout: { mode: "auto", dir: "row", gap: 6, padding: { t: 8, r: 12, b: 8, l: 12 }, align: "center", wrap: false } },
          );
          const prevLabel = makeTextNode("버튼 텍스트", "이전", { x: 0, y: 0, w: 60, h: 20, rotation: 0 }, { size: 13, weight: 600, align: "center" });
          prevBtn.children = [prevLabel.id];
          prevLabel.parentId = prevBtn.id;
          prevBtn.prototype = { interactions: [{ id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId: prevPageId } }] };
          nodes[prevBtn.id] = prevBtn;
          nodes[prevLabel.id] = prevLabel;
          buttons.children = [...buttons.children, prevBtn.id];
          prevBtn.parentId = buttons.id;
        }

        if (nextPageId) {
          const nextBtn = makeFrameNode(
            "다음 버튼",
            { x: 0, y: 0, w: 120, h: 40, rotation: 0 },
            { fill: "#111827", stroke: null, radius: 10, layout: { mode: "auto", dir: "row", gap: 6, padding: { t: 8, r: 12, b: 8, l: 12 }, align: "center", wrap: false } },
          );
          const nextLabel = makeTextNode("버튼 텍스트", "다음", { x: 0, y: 0, w: 60, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 13, weight: 600, align: "center" });
          nextBtn.children = [nextLabel.id];
          nextLabel.parentId = nextBtn.id;
          nextBtn.prototype = { interactions: [{ id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId: nextPageId } }] };
          nodes[nextBtn.id] = nextBtn;
          nodes[nextLabel.id] = nextLabel;
          buttons.children = [...buttons.children, nextBtn.id];
          nextBtn.parentId = buttons.id;
        }

        frame.children = [title.id, input.id, buttons.id];
        title.parentId = frame.id;
        input.parentId = frame.id;
        buttons.parentId = frame.id;

        return { rootId: frame.id, nodes };
      };

      const origin = { x: 120, y: 120 };

      if (!pageHasNode(loginPage.rootId, "로그인 폼 (플로우)")) {
        const built = buildLoginFlow(origin, form1Page.id);
        placeOnPage(loginPage.rootId, built.nodes, built.rootId);
      }
      if (!pageHasNode(form1Page.rootId, "폼 1 폼")) {
        const built = buildFormStep("폼 1", origin, form2Page.id, loginPage.id);
        placeOnPage(form1Page.rootId, built.nodes, built.rootId);
      }
      if (!pageHasNode(form2Page.rootId, "폼 2 폼")) {
        const built = buildFormStep("폼 2", origin, form3Page.id, form1Page.id);
        placeOnPage(form2Page.rootId, built.nodes, built.rootId);
      }
      if (!pageHasNode(form3Page.rootId, "폼 3 폼")) {
        const built = buildFormStep("폼 3", origin, undefined, form2Page.id);
        placeOnPage(form3Page.rootId, built.nodes, built.rootId);
      }

      commit(current);
      if (touchedPages.size) {
        setInfiniteCanvasPages((prev) => {
          const next = { ...prev };
          touchedPages.forEach((pageId) => {
            next[pageId] = true;
          });
          return next;
        });
      }
      selectPage(loginPage.id);
      pushMessage("preset_added");
      return;
    }

    if (preset.id === "page-nav-demo") {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) return;

      const touchedPages = new Set<string>();
      const markInfinite = (pageId: string) => {
        if (!current.nodes[pageId]) return;
        enableInfiniteCanvas(current, pageId);
        touchedPages.add(pageId);
      };

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) {
          markInfinite(existing.id);
          return existing;
        }
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        markInfinite(pageId);
        return page;
      };

      const pageA = ensurePage("데모 A");
      const pageB = ensurePage("데모 B");
      current.prototype = { ...(current.prototype ?? {}), startPageId: pageA.id };

      const pageHasNode = (pageId: string, nodeName: string) => {
        const ids = flattenNodes(current, pageId);
        return ids.some((id) => current.nodes[id]?.name === nodeName);
      };

      const placeOnPage = (pageId: string, nodes: Record<string, Node>, rootId: string) => {
        Object.assign(current.nodes, nodes);
        const pageRoot = current.nodes[pageId];
        const rootNode = current.nodes[rootId];
        if (pageRoot) pageRoot.children = [...pageRoot.children, rootId];
        if (rootNode) rootNode.parentId = pageId;
      };

      const buildNavCard = (titleText: string, targetPageId: string) => {
        const frame = makeFrameNode(
          `${titleText} 카드`,
          { x: 120, y: 120, w: 360, h: 240, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 16,
            layout: { mode: "auto", dir: "column", gap: 12, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", titleText, { x: 0, y: 0, w: 200, h: 24, rotation: 0 }, { size: 18, weight: 700 });
        const desc = makeTextNode(
          "설명",
          "버튼을 눌러 다른 페이지로 이동합니다.",
          { x: 0, y: 0, w: 260, h: 40, rotation: 0 },
          { size: 12, color: "#6B7280" },
        );
        const button = makeFrameNode(
          "이동 버튼",
          { x: 0, y: 0, w: 140, h: 40, rotation: 0 },
          {
            fill: "#111827",
            radius: 10,
            layout: { mode: "auto", dir: "row", gap: 6, padding: { t: 8, r: 12, b: 8, l: 12 }, align: "center", wrap: false },
          },
        );
        const buttonLabel = makeTextNode("버튼 텍스트", "다른 페이지로", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 12, weight: 600, align: "center" });
        button.children = [buttonLabel.id];
        buttonLabel.parentId = button.id;
        button.prototype = {
          interactions: [{ id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId } }],
        };
        frame.children = [title.id, desc.id, button.id];
        title.parentId = frame.id;
        desc.parentId = frame.id;
        button.parentId = frame.id;
        return {
          rootId: frame.id,
          nodes: {
            [frame.id]: frame,
            [title.id]: title,
            [desc.id]: desc,
            [button.id]: button,
            [buttonLabel.id]: buttonLabel,
          },
        };
      };

      if (!pageHasNode(pageA.rootId, "데모 A 카드")) {
        const built = buildNavCard("데모 A", pageB.id);
        placeOnPage(pageA.rootId, built.nodes, built.rootId);
      }
      if (!pageHasNode(pageB.rootId, "데모 B 카드")) {
        const built = buildNavCard("데모 B", pageA.id);
        placeOnPage(pageB.rootId, built.nodes, built.rootId);
      }

      commit(current);
      if (touchedPages.size) {
        setInfiniteCanvasPages((prev) => {
          const next = { ...prev };
          touchedPages.forEach((pageId) => {
            next[pageId] = true;
          });
          return next;
        });
      }
      selectPage(pageA.id);
      return;
    }

    if (preset.id === "hover-overlay-demo") {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) return;

      const touchedPages = new Set<string>();
      const markInfinite = (pageId: string) => {
        if (!current.nodes[pageId]) return;
        enableInfiniteCanvas(current, pageId);
        touchedPages.add(pageId);
      };

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) {
          markInfinite(existing.id);
          return existing;
        }
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        markInfinite(pageId);
        return page;
      };

      const basePage = ensurePage("오버레이 데모");
      const overlayPage = ensurePage("툴팁 오버레이");
      current.prototype = { ...(current.prototype ?? {}), startPageId: basePage.id };

      const pageHasNode = (pageId: string, nodeName: string) => {
        const ids = flattenNodes(current, pageId);
        return ids.some((id) => current.nodes[id]?.name === nodeName);
      };

      const placeOnPage = (pageId: string, nodes: Record<string, Node>, rootId: string) => {
        Object.assign(current.nodes, nodes);
        const pageRoot = current.nodes[pageId];
        const rootNode = current.nodes[rootId];
        if (pageRoot) pageRoot.children = [...pageRoot.children, rootId];
        if (rootNode) rootNode.parentId = pageId;
      };

      if (!pageHasNode(basePage.rootId, "호버 카드")) {
        const card = makeFrameNode(
          "호버 카드",
          { x: 140, y: 160, w: 320, h: 200, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 16,
            layout: { mode: "auto", dir: "column", gap: 10, padding: { t: 16, r: 16, b: 16, l: 16 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", "호버 오버레이", { x: 0, y: 0, w: 200, h: 24, rotation: 0 }, { size: 16, weight: 700 });
        const desc = makeTextNode("설명", "카드 위에 마우스를 올리면 오버레이가 열립니다.", { x: 0, y: 0, w: 260, h: 40, rotation: 0 }, { size: 12, color: "#6B7280" });
        const hint = makeTextNode("힌트", "Hover me", { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { size: 12, color: "#111827", weight: 600 });
        card.children = [title.id, desc.id, hint.id];
        title.parentId = card.id;
        desc.parentId = card.id;
        hint.parentId = card.id;
        card.prototype = {
          interactions: [
            {
              id: makeRuntimeId("proto"),
              trigger: "hover",
              action: { type: "overlay", targetPageId: overlayPage.id, transition: { type: "fade" } },
            },
          ],
        };
        placeOnPage(basePage.rootId, { [card.id]: card, [title.id]: title, [desc.id]: desc, [hint.id]: hint }, card.id);
      }

      if (!pageHasNode(overlayPage.rootId, "툴팁 카드")) {
        const tooltip = makeFrameNode(
          "툴팁 카드",
          { x: 180, y: 120, w: 280, h: 140, rotation: 0 },
          {
            fill: "#111827",
            stroke: null,
            radius: 14,
            layout: { mode: "auto", dir: "column", gap: 8, padding: { t: 14, r: 14, b: 14, l: 14 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", "오버레이", { x: 0, y: 0, w: 160, h: 22, rotation: 0 }, { size: 14, weight: 700, color: "#FFFFFF" });
        const body = makeTextNode("본문", "배경을 클릭하면 닫힙니다.", { x: 0, y: 0, w: 200, h: 32, rotation: 0 }, { size: 12, color: "#E5E7EB" });
        const close = makeFrameNode(
          "닫기 버튼",
          { x: 0, y: 0, w: 120, h: 32, rotation: 0 },
          { fill: "#FFFFFF", radius: 10, layout: { mode: "auto", dir: "row", gap: 6, padding: { t: 6, r: 10, b: 6, l: 10 }, align: "center", wrap: false } },
        );
        const closeLabel = makeTextNode("버튼 텍스트", "닫기", { x: 0, y: 0, w: 80, h: 18, rotation: 0 }, { size: 12, weight: 600, color: "#111827", align: "center" });
        close.children = [closeLabel.id];
        closeLabel.parentId = close.id;
        close.prototype = { interactions: [{ id: makeRuntimeId("proto"), trigger: "click", action: { type: "closeOverlay" } }] };
        tooltip.children = [title.id, body.id, close.id];
        title.parentId = tooltip.id;
        body.parentId = tooltip.id;
        close.parentId = tooltip.id;
        placeOnPage(overlayPage.rootId, { [tooltip.id]: tooltip, [title.id]: title, [body.id]: body, [close.id]: close, [closeLabel.id]: closeLabel }, tooltip.id);
      }

      commit(current);
      if (touchedPages.size) {
        setInfiniteCanvasPages((prev) => {
          const next = { ...prev };
          touchedPages.forEach((pageId) => {
            next[pageId] = true;
          });
          return next;
        });
      }
      selectPage(basePage.id);
      return;
    }

    if (preset.id === "auth-flow") {
      const current = cloneDoc(docRef.current);
      ensureBasePage(current);
      const root = ensureRootNode(current);
      if (!root) return;

      const touchedPages = new Set<string>();
      const markInfinite = (pageId: string) => {
        if (!current.nodes[pageId]) return;
        enableInfiniteCanvas(current, pageId);
        touchedPages.add(pageId);
      };

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) {
          markInfinite(existing.id);
          return existing;
        }
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        markInfinite(pageId);
        return page;
      };

      const loginPage = ensurePage("로그인");
      const signupPage = ensurePage("회원가입");
      const accountPage = ensurePage("계정");
      current.prototype = { ...(current.prototype ?? {}), startPageId: loginPage.id };

      const pageHasNode = (pageId: string, nodeName: string) => {
        const ids = flattenNodes(current, pageId);
        return ids.some((id) => current.nodes[id]?.name === nodeName);
      };

      const placeOnPage = (pageId: string, nodes: Record<string, Node>, rootId: string) => {
        Object.assign(current.nodes, nodes);
        const pageRoot = current.nodes[pageId];
        const rootNode = current.nodes[rootId];
        if (pageRoot) pageRoot.children = [...pageRoot.children, rootId];
        if (rootNode) rootNode.parentId = pageId;
      };

      const buildLoginFlow = (origin: { x: number; y: number }, signupTargetId: string, nextPageId: string) => {
        const frame = makeFrameNode(
          "로그인 폼 (플로우)",
          { x: origin.x, y: origin.y, w: 360, h: 380, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 12,
            layout: { mode: "auto", dir: "column", gap: 12, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", "로그인", { x: 0, y: 0, w: 200, h: 28, rotation: 0 }, { size: 20, weight: 700 });
        const email = makeFrameNode(
          "이메일 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const emailPlaceholder = makeTextNode("플레이스홀더", fieldPlaceholder("email", "이메일"), { x: 0, y: 0, w: 160, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        email.children = [emailPlaceholder.id];
        emailPlaceholder.parentId = email.id;
        const password = makeFrameNode(
          "비밀번호 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const passwordPlaceholder = makeTextNode("플레이스홀더", fieldPlaceholder("password", "비밀번호"), { x: 0, y: 0, w: 170, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        password.children = [passwordPlaceholder.id];
        passwordPlaceholder.parentId = password.id;
        const button = makeFrameNode(
          "로그인 버튼",
          { x: 0, y: 0, w: 180, h: 44, rotation: 0 },
          {
            fill: "#111827",
            stroke: null,
            radius: 10,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 18, b: 10, l: 18 }, align: "center", wrap: false },
          },
        );
        const buttonLabel = makeTextNode("버튼 텍스트", "로그인", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
        button.children = [buttonLabel.id];
        buttonLabel.parentId = button.id;
        button.prototype = {
          interactions: [
            {
              id: makeRuntimeId("proto"),
              trigger: "click",
              action: { type: "submit", url: "/api/auth/login", method: "POST", nextPageId },
            },
          ],
        };
        const helper = makeTextNode("회원가입 안내", "아직 계정이 없나요? 회원가입", { x: 0, y: 0, w: 220, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
        helper.prototype = {
          interactions: [
            { id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId: signupTargetId } },
          ],
        };
        frame.children = [title.id, email.id, password.id, button.id, helper.id];
        title.parentId = frame.id;
        email.parentId = frame.id;
        password.parentId = frame.id;
        button.parentId = frame.id;
        helper.parentId = frame.id;
        return {
          rootId: frame.id,
          nodes: {
            [frame.id]: frame,
            [title.id]: title,
            [email.id]: email,
            [emailPlaceholder.id]: emailPlaceholder,
            [password.id]: password,
            [passwordPlaceholder.id]: passwordPlaceholder,
            [button.id]: button,
            [buttonLabel.id]: buttonLabel,
            [helper.id]: helper,
          },
        };
      };

      const buildSignupFlow = (origin: { x: number; y: number }, loginTargetId: string, nextPageId: string) => {
        const frame = makeFrameNode(
          "회원가입 폼 (플로우)",
          { x: origin.x, y: origin.y, w: 360, h: 460, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: { color: "#E5E7EB", width: 1 },
            radius: 12,
            layout: { mode: "auto", dir: "column", gap: 12, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "stretch", wrap: false },
          },
        );
        const title = makeTextNode("타이틀", "회원가입", { x: 0, y: 0, w: 200, h: 28, rotation: 0 }, { size: 20, weight: 700 });
        const name = makeFrameNode(
          "이름 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const namePlaceholder = makeTextNode("플레이스홀더", fieldPlaceholder("name", "이름"), { x: 0, y: 0, w: 160, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        name.children = [namePlaceholder.id];
        namePlaceholder.parentId = name.id;
        const email = makeFrameNode(
          "이메일 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const emailPlaceholder = makeTextNode("플레이스홀더", fieldPlaceholder("email", "이메일"), { x: 0, y: 0, w: 170, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        email.children = [emailPlaceholder.id];
        emailPlaceholder.parentId = email.id;
        const password = makeFrameNode(
          "비밀번호 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const passwordPlaceholder = makeTextNode("플레이스홀더", fieldPlaceholder("password", "비밀번호"), { x: 0, y: 0, w: 180, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        password.children = [passwordPlaceholder.id];
        passwordPlaceholder.parentId = password.id;
        const confirm = makeFrameNode(
          "비밀번호 확인 입력",
          { x: 0, y: 0, w: 320, h: 44, rotation: 0 },
          {
            fill: "#FFFFFF",
            radius: 10,
            stroke: { color: "#D1D5DB", width: 1 },
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "center", wrap: false },
          },
        );
        const confirmPlaceholder = makeTextNode("플레이스홀더", fieldPlaceholder("passwordConfirm", "비밀번호 확인"), { x: 0, y: 0, w: 220, h: 20, rotation: 0 }, { color: "#9CA3AF", size: 14 });
        confirm.children = [confirmPlaceholder.id];
        confirmPlaceholder.parentId = confirm.id;
        const terms = makeFrameNode(
          "약관 체크박스",
          { x: 0, y: 0, w: 200, h: 28, rotation: 0 },
          {
            fill: "#FFFFFF",
            stroke: null,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 4, r: 0, b: 4, l: 0 }, align: "center", wrap: false },
          },
        );
        const termsBox = makeRectNode("체크", { x: 0, y: 0, w: 16, h: 16, rotation: 0 }, { fill: "#FFFFFF", stroke: { color: "#111827", width: 1 }, radius: 4 });
        const termsLabel = makeTextNode("라벨", fieldPlaceholder("terms", "약관에 동의합니다"), { x: 0, y: 0, w: 220, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
        terms.children = [termsBox.id, termsLabel.id];
        termsBox.parentId = terms.id;
        termsLabel.parentId = terms.id;
        const button = makeFrameNode(
          "회원가입 버튼",
          { x: 0, y: 0, w: 180, h: 44, rotation: 0 },
          {
            fill: "#111827",
            stroke: null,
            radius: 10,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 18, b: 10, l: 18 }, align: "center", wrap: false },
          },
        );
        const buttonLabel = makeTextNode("버튼 텍스트", "가입하기", { x: 0, y: 0, w: 80, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
        button.children = [buttonLabel.id];
        buttonLabel.parentId = button.id;
        button.prototype = {
          interactions: [
            {
              id: makeRuntimeId("proto"),
              trigger: "click",
              action: { type: "submit", url: "/api/auth/signup", method: "POST", nextPageId },
            },
          ],
        };
        const helper = makeTextNode("로그인 안내", "이미 계정이 있나요? 로그인", { x: 0, y: 0, w: 220, h: 18, rotation: 0 }, { size: 12, color: "#6B7280" });
        helper.prototype = {
          interactions: [
            { id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId: loginTargetId } },
          ],
        };
        frame.children = [title.id, name.id, email.id, password.id, confirm.id, terms.id, button.id, helper.id];
        title.parentId = frame.id;
        name.parentId = frame.id;
        email.parentId = frame.id;
        password.parentId = frame.id;
        confirm.parentId = frame.id;
        terms.parentId = frame.id;
        button.parentId = frame.id;
        helper.parentId = frame.id;
        return {
          rootId: frame.id,
          nodes: {
            [frame.id]: frame,
            [title.id]: title,
            [name.id]: name,
            [namePlaceholder.id]: namePlaceholder,
            [email.id]: email,
            [emailPlaceholder.id]: emailPlaceholder,
            [password.id]: password,
            [passwordPlaceholder.id]: passwordPlaceholder,
            [confirm.id]: confirm,
            [confirmPlaceholder.id]: confirmPlaceholder,
            [terms.id]: terms,
            [termsBox.id]: termsBox,
            [termsLabel.id]: termsLabel,
            [button.id]: button,
            [buttonLabel.id]: buttonLabel,
            [helper.id]: helper,
          },
        };
      };

      const origin = { x: 120, y: 120 };
      if (!pageHasNode(loginPage.rootId, "로그인 폼 (플로우)")) {
        const built = buildLoginFlow(origin, signupPage.id, accountPage.id);
        placeOnPage(loginPage.rootId, built.nodes, built.rootId);
      }
      if (!pageHasNode(signupPage.rootId, "회원가입 폼 (플로우)")) {
        const built = buildSignupFlow(origin, loginPage.id, accountPage.id);
        placeOnPage(signupPage.rootId, built.nodes, built.rootId);
      }

      if (!pageHasNode(accountPage.rootId, "관리자 패널")) {
        const adminPreset = PRESET_GROUPS.flatMap((group) => group.items).find((item) => item.id === "admin-panel");
        if (adminPreset) {
          const built = adminPreset.build(origin);
          placeOnPage(accountPage.rootId, built.nodes, built.rootId);
        }
      }

      if (!pageHasNode(accountPage.rootId, "로그아웃 버튼")) {
        const logoutPreset = PRESET_GROUPS.flatMap((group) => group.items).find((item) => item.id === "auth-logout");
        if (logoutPreset) {
          const built = logoutPreset.build({ x: origin.x, y: origin.y + 520 });
          Object.values(built.nodes).forEach((node) => {
            const interactions = node.prototype?.interactions ?? [];
            if (!interactions.length) return;
            node.prototype = {
              interactions: interactions.map((interaction) =>
                interaction.action.type === "submit"
                  ? { ...interaction, action: { ...interaction.action, nextPageId: loginPage.id } }
                  : interaction,
              ),
            };
          });
          placeOnPage(accountPage.rootId, built.nodes, built.rootId);
        }
      }

      commit(current);
      if (touchedPages.size) {
        setInfiniteCanvasPages((prev) => {
          const next = { ...prev };
          touchedPages.forEach((pageId) => {
            next[pageId] = true;
          });
          return next;
        });
      }
      selectPage(loginPage.id);
      pushMessage("preset_added");
      return;
    }

    if (preset.id === "page-nav-demo") {
      const current = cloneDoc(docRef.current);
      const root = current.nodes[current.root];
      if (!root) return;

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) return existing;
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        return page;
      };

      const pageA = ensurePage("페이지 A");
      const pageB = ensurePage("페이지 B");
      current.prototype = { ...(current.prototype ?? {}), startPageId: pageA.id };

      const addNavButtons = (pageId: string, targetId: string) => {
        const button = makeFrameNode(
          "페이지 이동 버튼",
          { x: 120, y: 140, w: 200, h: 44, rotation: 0 },
          {
            fill: "#111827",
            stroke: null,
            radius: 10,
            layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 10, r: 18, b: 10, l: 18 }, align: "center", wrap: false },
          },
        );
        const label = makeTextNode("버튼 텍스트", `→ ${current.pages.find((p) => p.id === targetId)?.name ?? "다음"}`, { x: 0, y: 0, w: 120, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 14, weight: 600, align: "center" });
        button.children = [label.id];
        label.parentId = button.id;
        button.prototype = { interactions: [{ id: makeRuntimeId("proto"), trigger: "click", action: { type: "navigate", targetPageId: targetId } }] };
        current.nodes[button.id] = button;
        current.nodes[label.id] = label;
        const pageRoot = current.nodes[pageId];
        if (pageRoot) pageRoot.children = [...pageRoot.children, button.id];
        button.parentId = pageId;
      };

      const pageHasButton = (pageId: string) => {
        const ids = flattenNodes(current, pageId);
        return ids.some((id) => current.nodes[id]?.name === "페이지 이동 버튼");
      };

      if (!pageHasButton(pageA.rootId)) addNavButtons(pageA.rootId, pageB.id);
      if (!pageHasButton(pageB.rootId)) addNavButtons(pageB.rootId, pageA.id);

      commit(current);
      selectPage(pageA.id);
      pushMessage("preset_added");
      return;
    }

    if (preset.id === "hover-overlay-demo") {
      const current = cloneDoc(docRef.current);
      const root = current.nodes[current.root];
      if (!root) return;

      const ensurePage = (name: string) => {
        const existing = current.pages.find((page) => page.name === name);
        if (existing) return existing;
        const pageId = makeRuntimeId("page");
        const pageNode = createNode("frame", { id: pageId, name, parentId: current.root });
        current.nodes[pageId] = pageNode;
        root.children = [...root.children, pageId];
        const page = { id: pageId, name, rootId: pageId };
        current.pages = [...current.pages, page];
        return page;
      };

      const basePage = ensurePage("호버 데모");
      const overlayPage = ensurePage("툴팁 오버레이");
      current.prototype = { ...(current.prototype ?? {}), startPageId: basePage.id };

      const baseRoot = current.nodes[basePage.rootId];
      const overlayRoot = current.nodes[overlayPage.rootId];
      if (!baseRoot || !overlayRoot) return;

      const target = makeFrameNode(
        "호버 타겟",
        { x: 140, y: 160, w: 220, h: 80, rotation: 0 },
        {
          fill: "#111827",
          stroke: null,
          radius: 12,
          layout: { mode: "auto", dir: "row", gap: 8, padding: { t: 12, r: 16, b: 12, l: 16 }, align: "center", wrap: false },
        },
      );
      const targetLabel = makeTextNode("라벨", "마우스를 올려보세요", { x: 0, y: 0, w: 160, h: 20, rotation: 0 }, { color: "#FFFFFF", size: 13, weight: 600, align: "center" });
      target.children = [targetLabel.id];
      targetLabel.parentId = target.id;
      target.prototype = {
        interactions: [
          { id: makeRuntimeId("proto"), trigger: "hover", action: { type: "overlay", targetPageId: overlayPage.id } },
        ],
      };

      const tooltip = makeFrameNode(
        "툴팁",
        { x: 220, y: 110, w: 220, h: 70, rotation: 0 },
        {
          fill: "#FFFFFF",
          stroke: { color: "#E5E7EB", width: 1 },
          radius: 10,
          layout: { mode: "auto", dir: "column", gap: 6, padding: { t: 10, r: 12, b: 10, l: 12 }, align: "start", wrap: false },
        },
      );
      const tooltipTitle = makeTextNode("타이틀", "호버 오버레이", { x: 0, y: 0, w: 160, h: 18, rotation: 0 }, { size: 12, weight: 700 });
      const tooltipDesc = makeTextNode("설명", "클릭하면 닫힙니다", { x: 0, y: 0, w: 160, h: 16, rotation: 0 }, { size: 11, color: "#6B7280" });
      tooltip.children = [tooltipTitle.id, tooltipDesc.id];
      tooltipTitle.parentId = tooltip.id;
      tooltipDesc.parentId = tooltip.id;

      current.nodes[target.id] = target;
      current.nodes[targetLabel.id] = targetLabel;
      current.nodes[tooltip.id] = tooltip;
      current.nodes[tooltipTitle.id] = tooltipTitle;
      current.nodes[tooltipDesc.id] = tooltipDesc;

      baseRoot.children = [...baseRoot.children, target.id];
      target.parentId = baseRoot.id;

      overlayRoot.children = [...overlayRoot.children, tooltip.id];
      tooltip.parentId = overlayRoot.id;

      commit(current);
      selectPage(basePage.id);
      pushMessage("preset_added");
      return;
    }

    const current = cloneDoc(docRef.current);
    ensureBasePage(current);
    const rootId = ensurePageRoot(current, activePageId);
    const view = current.view;
    const viewWidth = canvasSize.width / view.zoom;
    const viewHeight = canvasSize.height / view.zoom;
    const origin = {
      x: snap(view.panX + (viewWidth - preset.size.w) / 2, gridSnap),
      y: snap(view.panY + (viewHeight - preset.size.h) / 2, gridSnap),
    };
    const built = preset.build(origin);
    const resolveSubmitTarget = () => {
      if (preset.id === "payment-form") {
        return (
          current.pages.find((page) => page.name === "결제 완료") ??
          current.pages.find((page) => page.name === "완료") ??
          current.pages.find((page) => page.name === "성공") ??
          null
        );
      }
      if (preset.id === "auth-login" || preset.id === "auth-signup") {
        return (
          current.pages.find((page) => page.name === "계정") ??
          current.pages.find((page) => page.name === "대시보드") ??
          current.pages.find((page) => page.name === "홈") ??
          null
        );
      }
      if (preset.id === "auth-logout") {
        return (
          current.pages.find((page) => page.name === "로그인") ??
          current.pages.find((page) => page.name === "홈") ??
          null
        );
      }
      return null;
    };
    const submitTarget = resolveSubmitTarget();
    if (submitTarget) {
      Object.values(built.nodes).forEach((node) => {
        const interactions = node.prototype?.interactions ?? [];
        if (!interactions.length) return;
        node.prototype = {
          interactions: interactions.map((interaction) => {
            if (interaction.action.type !== "submit") return interaction;
            if ("nextPageId" in interaction.action && interaction.action.nextPageId) return interaction;
            return {
              ...interaction,
              action: { ...interaction.action, nextPageId: submitTarget.id },
            };
          }),
        };
      });
    }
    Object.assign(current.nodes, built.nodes);
    const parent = current.nodes[rootId];
    const rootNode = current.nodes[built.rootId];
    if (parent) parent.children = [...parent.children, built.rootId];
    if (rootNode) rootNode.parentId = rootId;
    current.selection = new Set([built.rootId]);
    commit(current);
    pushMessage("preset_added");
  }, [canvasSize.width, canvasSize.height, gridSnap, commit, activePageId, selectPage, enableInfiniteCanvas, pushMessage]);

  const insertPresetById = useCallback(
    (presetId: string) => {
      const preset = PRESET_GROUPS.flatMap((group) => group.items).find((item) => item.id === presetId);
      if (!preset) {
        pushMessage("preset_failed");
        return;
      }
      insertPreset(preset);
    },
    [insertPreset, pushMessage],
  );

  function bringToFront() {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) return;

    const next = cloneDoc(docRef.current);
    const byParent: Record<string, string[]> = {};
    ids.forEach((id) => {
      const parent = next.nodes[id]?.parentId ?? pageRoot;
      byParent[parent] = byParent[parent] ? [...byParent[parent], id] : [id];
    });

    Object.entries(byParent).forEach(([parentId, childIds]) => {
      const parent = next.nodes[parentId];
      if (!parent) return;
      parent.children = parent.children.filter((cid) => !childIds.includes(cid)).concat(childIds);
    });

    commit(next);
  }

  function sendToBack() {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) return;

    const next = cloneDoc(docRef.current);
    const byParent: Record<string, string[]> = {};
    ids.forEach((id) => {
      const parent = next.nodes[id]?.parentId ?? pageRoot;
      byParent[parent] = byParent[parent] ? [...byParent[parent], id] : [id];
    });

    Object.entries(byParent).forEach(([parentId, childIds]) => {
      const parent = next.nodes[parentId];
      if (!parent) return;
      parent.children = childIds.concat(parent.children.filter((cid) => !childIds.includes(cid)));
    });

    commit(next);
  }

  function bringForward() {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) return;

    const next = cloneDoc(docRef.current);
    const byParent: Record<string, string[]> = {};
    ids.forEach((id) => {
      const parent = next.nodes[id]?.parentId ?? pageRoot;
      byParent[parent] = byParent[parent] ? [...byParent[parent], id] : [id];
    });

    Object.entries(byParent).forEach(([parentId, childIds]) => {
      const parent = next.nodes[parentId];
      if (!parent) return;
      const set = new Set(childIds);
      const ordered = [...parent.children];
      for (let i = ordered.length - 2; i >= 0; i -= 1) {
        if (set.has(ordered[i]) && !set.has(ordered[i + 1])) {
          const tmp = ordered[i];
          ordered[i] = ordered[i + 1];
          ordered[i + 1] = tmp;
        }
      }
      parent.children = ordered;
    });

    commit(next);
  }

  function sendBackward() {
    const ids = Array.from(docRef.current.selection);
    if (!ids.length) return;

    const next = cloneDoc(docRef.current);
    const byParent: Record<string, string[]> = {};
    ids.forEach((id) => {
      const parent = next.nodes[id]?.parentId ?? pageRoot;
      byParent[parent] = byParent[parent] ? [...byParent[parent], id] : [id];
    });

    Object.entries(byParent).forEach(([parentId, childIds]) => {
      const parent = next.nodes[parentId];
      if (!parent) return;
      const set = new Set(childIds);
      const ordered = [...parent.children];
      for (let i = 1; i < ordered.length; i += 1) {
        if (set.has(ordered[i]) && !set.has(ordered[i - 1])) {
          const tmp = ordered[i];
          ordered[i] = ordered[i - 1];
          ordered[i - 1] = tmp;
        }
      }
      parent.children = ordered;
    });

    commit(next);
  }

  function nudgeSelection(dx: number, dy: number) {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!ids.length) return;
    const frames: Record<string, Frame> = {};
    ids.forEach((id) => {
      const node = docRef.current.nodes[id];
      if (!node || node.locked) return;
      const snapEnabled = gridSnapRef.current;
      frames[id] = {
        ...node.frame,
        x: snap(node.frame.x + dx, snapEnabled),
        y: snap(node.frame.y + dy, snapEnabled),
      };
    });
    updateNodes(frames, true);
  }

  function align(kind: "l" | "r" | "hc" | "t" | "b" | "vc") {
    const ids = Array.from(docRef.current.selection);
    if (ids.length < 2) return;

    const rects = ids
      .map((id) => ({ id, rect: getAbsoluteFrame(docRef.current, id), parent: getParentOffset(docRef.current, id) }))
      .filter((r) => r.rect) as Array<{ id: string; rect: Rect; parent: { x: number; y: number } }>;

    if (!rects.length) return;

    let target = 0;
    if (kind === "l") target = Math.min(...rects.map((r) => r.rect.x));
    if (kind === "r") target = Math.max(...rects.map((r) => r.rect.x + r.rect.w));
    if (kind === "hc") {
      target = (Math.min(...rects.map((r) => r.rect.x)) + Math.max(...rects.map((r) => r.rect.x + r.rect.w))) / 2;
    }
    if (kind === "t") target = Math.min(...rects.map((r) => r.rect.y));
    if (kind === "b") target = Math.max(...rects.map((r) => r.rect.y + r.rect.h));
    if (kind === "vc") {
      target = (Math.min(...rects.map((r) => r.rect.y)) + Math.max(...rects.map((r) => r.rect.y + r.rect.h))) / 2;
    }

    const frames: Record<string, Frame> = {};
    rects.forEach(({ id, rect, parent }) => {
      const current = docRef.current.nodes[id];
      if (kind === "l") frames[id] = { ...current.frame, x: target - parent.x, rotation: current.frame.rotation };
      if (kind === "r") frames[id] = { ...current.frame, x: target - rect.w - parent.x, rotation: current.frame.rotation };
      if (kind === "hc") frames[id] = { ...current.frame, x: target - rect.w / 2 - parent.x, rotation: current.frame.rotation };
      if (kind === "t") frames[id] = { ...current.frame, y: target - parent.y, rotation: current.frame.rotation };
      if (kind === "b") frames[id] = { ...current.frame, y: target - rect.h - parent.y, rotation: current.frame.rotation };
      if (kind === "vc") frames[id] = { ...current.frame, y: target - rect.h / 2 - parent.y, rotation: current.frame.rotation };
    });

    updateNodes(frames, true);
  }

  function alignToParent(kind: "l" | "r" | "hc" | "t" | "b" | "vc") {
    const ids = Array.from(docRef.current.selection);
    if (ids.length !== 1) return;
    const node = docRef.current.nodes[ids[0]];
    if (!node || !node.parentId) return;
    const parent = docRef.current.nodes[node.parentId];
    if (!parent) return;
    const frame = { ...node.frame };
    if (kind === "l") frame.x = 0;
    if (kind === "r") frame.x = parent.frame.w - node.frame.w;
    if (kind === "hc") frame.x = (parent.frame.w - node.frame.w) / 2;
    if (kind === "t") frame.y = 0;
    if (kind === "b") frame.y = parent.frame.h - node.frame.h;
    if (kind === "vc") frame.y = (parent.frame.h - node.frame.h) / 2;
    updateNode(node.id, { frame }, true);
  }

  function distribute(axis: "h" | "v") {
    const ids = Array.from(docRef.current.selection);
    if (ids.length < 3) return;

    const rects = ids
      .map((id) => ({ id, rect: getAbsoluteFrame(docRef.current, id), parent: getParentOffset(docRef.current, id) }))
      .filter((r) => r.rect) as Array<{ id: string; rect: Rect; parent: { x: number; y: number } }>;

    if (rects.length < 3) return;

    const sorted = [...rects].sort((a, b) => (axis === "h" ? a.rect.x - b.rect.x : a.rect.y - b.rect.y));
    const first = sorted[0].rect;
    const last = sorted[sorted.length - 1].rect;
    const span = axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
    const total = sorted.reduce((acc, item) => acc + (axis === "h" ? item.rect.w : item.rect.h), 0);
    const gap = (span - total) / (sorted.length - 1);

    let cursor = axis === "h" ? first.x : first.y;
    const frames: Record<string, Frame> = {};

    sorted.forEach((item, index) => {
      if (index === 0) {
        cursor = axis === "h" ? item.rect.x + item.rect.w : item.rect.y + item.rect.h;
        return;
      }
      const nextPos = cursor + gap;
      const node = docRef.current.nodes[item.id];
      if (axis === "h") {
        frames[item.id] = { ...node.frame, x: nextPos - item.parent.x, rotation: node.frame.rotation };
        cursor = nextPos + item.rect.w;
      } else {
        frames[item.id] = { ...node.frame, y: nextPos - item.parent.y, rotation: node.frame.rotation };
        cursor = nextPos + item.rect.h;
      }
    });

    updateNodes(frames, true);
  }

  function snapSelectionToGrid() {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!ids.length) return;
    const frames: Record<string, Frame> = {};
    ids.forEach((id) => {
      const node = docRef.current.nodes[id];
      if (!node || node.locked) return;
      frames[id] = {
        ...node.frame,
        x: snap(node.frame.x, true),
        y: snap(node.frame.y, true),
        w: snap(node.frame.w, true),
        h: snap(node.frame.h, true),
      };
    });
    updateNodes(frames, true);
    pushMessage("snap_done");
  }

  function matchSelectionSize(axis: "w" | "h") {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (ids.length < 2) return;
    const sizes = ids
      .map((id) => docRef.current.nodes[id])
      .filter(Boolean)
      .map((node) => (axis === "w" ? node.frame.w : node.frame.h));
    if (!sizes.length) return;
    const target = Math.max(...sizes);
    const frames: Record<string, Frame> = {};
    ids.forEach((id) => {
      const node = docRef.current.nodes[id];
      if (!node || node.locked) return;
      frames[id] = { ...node.frame, [axis === "w" ? "w" : "h"]: target } as Frame;
    });
    updateNodes(frames, true);
  }

  const toggleSelectionHidden = useCallback(() => {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!ids.length) return;
    const current = docRef.current;
    const allHidden = ids.every((id) => current.nodes[id]?.hidden);
    const next = cloneDoc(current);
    let updated = false;
    ids.forEach((id) => {
      const node = next.nodes[id];
      if (!node) return;
      const nextNode = { ...node, hidden: !allHidden };
      if (nextNode.sourceId) {
        const master = current.nodes[nextNode.sourceId];
        if (master) {
          const ignoreFrameXY = !!(nextNode.type === "instance" && nextNode.instanceOf && !hasAncestorInstance(current, nextNode.id));
          const override = buildNodeOverride(master, nextNode as Node, { ignoreFrameXY });
          if (override) nextNode.overrides = toSafeNodeOverride(override);
          else delete nextNode.overrides;
        }
      }
      next.nodes[id] = nextNode;
      updated = true;
    });
    if (!updated) return;
    ids.forEach((id) => refreshOverridesForSubtree(next, id));
    commit(next);
    pushMessage(allHidden ? "show_applied" : "hide_applied");
  }, [commit, pushMessage]);

  const toggleSelectionLocked = useCallback(() => {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!ids.length) return;
    const current = docRef.current;
    const allLocked = ids.every((id) => current.nodes[id]?.locked);
    const next = cloneDoc(current);
    let updated = false;
    ids.forEach((id) => {
      const node = next.nodes[id];
      if (!node) return;
      const nextNode = { ...node, locked: !allLocked };
      if (nextNode.sourceId) {
        const master = current.nodes[nextNode.sourceId];
        if (master) {
          const ignoreFrameXY = !!(nextNode.type === "instance" && nextNode.instanceOf && !hasAncestorInstance(current, nextNode.id));
          const override = buildNodeOverride(master, nextNode as Node, { ignoreFrameXY });
          if (override) nextNode.overrides = toSafeNodeOverride(override);
          else delete nextNode.overrides;
        }
      }
      next.nodes[id] = nextNode;
      updated = true;
    });
    if (!updated) return;
    ids.forEach((id) => refreshOverridesForSubtree(next, id));
    commit(next);
    pushMessage(allLocked ? "unlock_applied" : "lock_applied");
  }, [commit, pushMessage]);

  const fitSelectionToContent = useCallback(() => {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!ids.length) return;
    const current = docRef.current;
    const next = cloneDoc(current);
    let updated = false;
    ids.forEach((id) => {
      const node = next.nodes[id];
      if (!node || node.locked) return;
      if (node.layout?.mode === "auto") {
        const sizing = node.layoutSizing ?? { width: "fixed", height: "fixed" };
        node.layoutSizing = { ...sizing, width: "hug", height: "hug" };
        updated = true;
        return;
      }
      if (!node.children?.length) return;
      const childRects = node.children
        .map((childId) => getAbsoluteFrame(next, childId))
        .filter((rect): rect is Rect => Boolean(rect));
      if (!childRects.length) return;
      const minX = Math.min(...childRects.map((rect) => rect.x));
      const minY = Math.min(...childRects.map((rect) => rect.y));
      const maxX = Math.max(...childRects.map((rect) => rect.x + rect.w));
      const maxY = Math.max(...childRects.map((rect) => rect.y + rect.h));
      const parentOffset = getParentOffset(next, id);
      const nextFrame = {
        ...node.frame,
        x: minX - parentOffset.x,
        y: minY - parentOffset.y,
        w: maxX - minX,
        h: maxY - minY,
      };
      node.frame = nextFrame;
      node.children.forEach((childId) => {
        const child = next.nodes[childId];
        const abs = getAbsoluteFrame(next, childId);
        if (!child || !abs) return;
        child.frame = { ...child.frame, x: abs.x - minX, y: abs.y - minY };
      });
      updated = true;
    });
    if (!updated) return;
    ids.forEach((id) => refreshOverridesForSubtree(next, id));
    commit(next);
    pushMessage("fit_content_done");
  }, [commit, pushMessage]);

  function flipSelection(axis: "h" | "v") {
    const ids = getTopLevelSelection(docRef.current, Array.from(docRef.current.selection));
    if (!ids.length) return;
    const bounds = getSelectionBounds(docRef.current, ids);
    if (!bounds) return;
    const frames: Record<string, Frame> = {};
    ids.forEach((id) => {
      const rect = getAbsoluteFrame(docRef.current, id);
      if (!rect) return;
      const parentOffset = getParentOffset(docRef.current, id);
      if (axis === "h") {
        const nextX = bounds.x + bounds.w - (rect.x + rect.w);
        frames[id] = { ...docRef.current.nodes[id].frame, x: nextX - parentOffset.x };
      } else {
        const nextY = bounds.y + bounds.h - (rect.y + rect.h);
        frames[id] = { ...docRef.current.nodes[id].frame, y: nextY - parentOffset.y };
      }
    });
    updateNodes(frames, true);
  }

  function selectAll() {
    const rootId = ensurePageRoot(docRef.current, activePageIdRef.current);
    const ids = flattenNodes(docRef.current, rootId).filter((id) => id !== rootId);
    replace({ ...docRef.current, selection: new Set(ids) });
  }

  function clearSelection() {
    replace({ ...docRef.current, selection: new Set() });
  }

  function invertSelection() {
    const rootId = ensurePageRoot(docRef.current, activePageIdRef.current);
    const all = new Set(flattenNodes(docRef.current, rootId).filter((id) => id !== rootId));
    const next = new Set<string>();
    all.forEach((id) => {
      if (!docRef.current.selection.has(id)) next.add(id);
    });
    replace({ ...docRef.current, selection: next });
  }

  function selectParent() {
    const ids = Array.from(docRef.current.selection);
    if (ids.length !== 1) return;
    const node = docRef.current.nodes[ids[0]];
    if (node?.parentId) replace({ ...docRef.current, selection: new Set([node.parentId]) });
  }

  function selectChildren() {
    const ids = Array.from(docRef.current.selection);
    if (ids.length !== 1) return;
    const node = docRef.current.nodes[ids[0]];
    if (node?.children?.length) replace({ ...docRef.current, selection: new Set(node.children) });
  }

  function selectSiblings() {
    const ids = Array.from(docRef.current.selection);
    if (ids.length !== 1) return;
    const node = docRef.current.nodes[ids[0]];
    const parentId = node?.parentId ?? null;
    if (!parentId) return;
    const parent = docRef.current.nodes[parentId];
    if (!parent?.children?.length) return;
    replace({ ...docRef.current, selection: new Set(parent.children) });
  }

  function tidyUpSelection() {
    const ids = Array.from(docRef.current.selection);
    if (ids.length < 2) return;
    const parents = new Set(ids.map((id) => docRef.current.nodes[id]?.parentId ?? null));
    if (parents.size > 1) {
      pushMessage("tidy_parent_required");
      return;
    }
    const nodes = ids.map((id) => docRef.current.nodes[id]).filter(Boolean) as Node[];
    const maxW = Math.max(...nodes.map((node) => node.frame.w));
    const maxH = Math.max(...nodes.map((node) => node.frame.h));
    const minX = Math.min(...nodes.map((node) => node.frame.x));
    const minY = Math.min(...nodes.map((node) => node.frame.y));
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const gap = 16;
    const sorted = [...nodes].sort((a, b) => (a.frame.y === b.frame.y ? a.frame.x - b.frame.x : a.frame.y - b.frame.y));
    const frames: Record<string, Frame> = {};
    sorted.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      frames[node.id] = {
        ...node.frame,
        x: minX + col * (maxW + gap),
        y: minY + row * (maxH + gap),
      };
    });
    updateNodes(frames, true);
    pushMessage("tidy_done");
  }

  function zoomToRect(rect: Rect) {
    if (!rect.w || !rect.h) return;
    const size = canvasSizeRef.current;
    const padding = 80;
    const availableW = Math.max(160, size.width - padding * 2);
    const availableH = Math.max(160, size.height - padding * 2);
    const zoom = clamp(Math.min(availableW / rect.w, availableH / rect.h), 0.1, 4);
    const viewW = size.width / zoom;
    const viewH = size.height / zoom;
    const panX = rect.x - (viewW - rect.w) / 2;
    const panY = rect.y - (viewH - rect.h) / 2;
    replace({ ...docRef.current, view: { ...docRef.current.view, zoom, panX, panY } });
  }

  function zoomToSelection() {
    const bounds = getSelectionBounds(docRef.current, Array.from(docRef.current.selection));
    if (!bounds) {
      pushMessage("zoom_no_selection");
      return;
    }
    zoomToRect(bounds);
  }

  function zoomToContent() {
    const pageId = activePageIdRef.current;
    const bounds: Rect | null = getPageContentBounds(docRef.current, pageId);
    if (bounds && bounds.w > 0 && bounds.h > 0) {
      zoomToRect(bounds);
      return;
    }
    zoomToPage();
  }

  function zoomToPage() {
    const currentDoc = docRef.current;
    const pageId = activePageIdRef.current;
    const isInfinite = Boolean(pageId && infiniteCanvasPages[pageId]);
    if (isInfinite && pageId) {
      const bounds: Rect | null = getPageContentBounds(currentDoc, pageId);
      if (bounds && bounds.w > 0 && bounds.h > 0) {
        zoomToRect(bounds);
        return;
      }
    }
    const rootId = ensurePageRoot(currentDoc, pageId);
    const rect = getAbsoluteFrame(currentDoc, rootId) ?? { x: 0, y: 0, w: 1200, h: 800 };
    zoomToRect(rect);
  }

  function zoomReset() {
    replace({ ...docRef.current, view: { ...docRef.current.view, zoom: 1, panX: 0, panY: 0 } });
  }

  const addGuideVertical = useCallback(() => {
    const current = cloneDoc(docRef.current);
    const viewW = canvasSizeRef.current.width / current.view.zoom;
    const gx = current.view.panX + viewW / 2;
    current.view.guides = {
      x: [...(current.view.guides?.x ?? []), gx],
      y: current.view.guides?.y ?? [],
    };
    commit(current);
  }, [commit]);

  const addGuideHorizontal = useCallback(() => {
    const current = cloneDoc(docRef.current);
    const viewH = canvasSizeRef.current.height / current.view.zoom;
    const gy = current.view.panY + viewH / 2;
    current.view.guides = {
      x: current.view.guides?.x ?? [],
      y: [...(current.view.guides?.y ?? []), gy],
    };
    commit(current);
  }, [commit]);

  const clearGuides = useCallback(() => {
    const current = cloneDoc(docRef.current);
    current.view.guides = { x: [], y: [] };
    commit(current);
  }, [commit]);

  function zoomBy(delta: number) {
    const view = docRef.current.view;
    const size = canvasSizeRef.current;
    const centerX = view.panX + size.width / (2 * view.zoom);
    const centerY = view.panY + size.height / (2 * view.zoom);
    const nextZoom = clamp(view.zoom + delta, 0.1, 4);
    const panX = centerX - size.width / (2 * nextZoom);
    const panY = centerY - size.height / (2 * nextZoom);
    replace({ ...docRef.current, view: { ...view, zoom: nextZoom, panX, panY } });
  }

  async function saveDraft() {
    if (status !== "idle") return pageId;
    setStatus("saving");
    setMessage(null);

    try {
      const anonId = await ensureAnonId();
      const content = serializeDoc(layoutDoc(docRef.current));
      content.selection = [];
      const payload = {
        title: title.trim() ? title.trim() : null,
        content,
      };

      if (!pageId) {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(anonId ? { "x-anon-user-id": anonId } : {}) },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setMessage(data?.error ?? "save_failed");
          return null;
        }
        const createdId = data?.page?.id ?? data?.pageId ?? data?.id;
        if (!createdId) {
          setMessage("missing_page_id");
          return null;
        }
        setPageId(createdId);
        router.replace(`/editor/advanced?pageId=${createdId}`);
        return createdId;
      }

      const res = await fetch(`/api/pages/${pageId}/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(anonId ? { "x-anon-user-id": anonId } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error ?? "save_failed");
        return null;
      }

      return pageId;
    } catch {
      setMessage("save_failed");
      return null;
    } finally {
      setStatus("idle");
    }
  }

  async function publish() {
    if (status !== "idle") return;
    setMessage(null);

    try {
      const anonId = await ensureAnonId();
      const targetId = await saveDraft();
      if (!targetId) return;
      setStatus("publishing");

      const res = await fetch(`/api/pages/${targetId}/publish`, {
        method: "POST",
        headers: anonId ? { "x-anon-user-id": anonId } : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error ?? "publish_failed");
        return;
      }

      const liveId = data?.page?.id ?? data?.pageId ?? targetId;
      router.push(`/p/${liveId}`);
    } catch {
      setMessage("publish_failed");
    } finally {
      setStatus("idle");
    }
  }

  const exportDocJson = useCallback(() => {
    const content = serializeDoc(layoutDoc(docRef.current));
    content.selection = [];
    const payload = JSON.stringify(content, null, 2);
    const name = makeSafeFilename(title || "advanced_export");
    downloadBlob(new Blob([payload], { type: "application/json;charset=utf-8" }), `${name}.json`);
  }, [title]);

  const getExportBounds = useCallback(() => {
    const doc = docRef.current;
    if (exportScope === "selection") return getSelectionBounds(doc, Array.from(doc.selection));
    if (exportContentOnly && exportScope === "page") {
      const pageId = exportPageId ?? doc.prototype?.startPageId ?? doc.pages[0]?.id ?? null;
      return pageId ? getPageContentBounds(doc, pageId) : null;
    }
    return null;
  }, [exportContentOnly, exportPageId, exportScope]);

  const exportSvg = useCallback(() => {
    const svg = exportSvgRef.current;
    if (!svg) return;
    const name = makeSafeFilename(title || "advanced_export");
    const bounds = getExportBounds();
    const serialized = serializeSvgElementWithBounds(svg, bounds);
    downloadBlob(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }), `${name}.svg`);
  }, [title, getExportBounds]);

  const exportPng = useCallback(() => {
    const svg = exportSvgRef.current;
    if (!svg) return;
    const name = makeSafeFilename(title || "advanced_export");
    const bounds = getExportBounds();
    const serialized = serializeSvgElementWithBounds(svg, bounds);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const viewBox = svg.viewBox.baseVal;
      const baseWidth = bounds?.w ?? viewBox?.width ?? svg.width.baseVal.value ?? 1200;
      const baseHeight = bounds?.h ?? viewBox?.height ?? svg.height.baseVal.value ?? 800;
      const width = baseWidth * exportScale;
      const height = baseHeight * exportScale;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${name}.png`);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [exportScale, title, getExportBounds]);

  const exportJpg = useCallback(() => {
    const svg = exportSvgRef.current;
    if (!svg) return;
    const name = makeSafeFilename(title || "advanced_export");
    const bounds = getExportBounds();
    const serialized = serializeSvgElementWithBounds(svg, bounds);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const viewBox = svg.viewBox.baseVal;
      const baseWidth = bounds?.w ?? viewBox?.width ?? svg.width.baseVal.value ?? 1200;
      const baseHeight = bounds?.h ?? viewBox?.height ?? svg.height.baseVal.value ?? 800;
      const width = baseWidth * exportScale;
      const height = baseHeight * exportScale;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) downloadBlob(blob, `${name}.jpg`);
          URL.revokeObjectURL(url);
        },
        "image/jpeg",
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [exportScale, title, getExportBounds]);

  const exportSelectionPng = useCallback(() => {
    const svg = exportSvgRef.current;
    const doc = docRef.current;
    if (!svg || !doc.selection.size) return;
    const bounds = getSelectionBounds(doc, Array.from(doc.selection));
    const name = makeSafeFilename(title || "advanced_export");
    const serialized = serializeSvgElementWithBounds(svg, bounds);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const viewBox = svg.viewBox.baseVal;
      const baseWidth = bounds?.w ?? viewBox?.width ?? 1200;
      const baseHeight = bounds?.h ?? viewBox?.height ?? 800;
      const width = baseWidth * exportScale;
      const height = baseHeight * exportScale;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${name}.png`);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [exportScale, title]);

  const exportSelectionSvg = useCallback(() => {
    const svg = exportSvgRef.current;
    const doc = docRef.current;
    if (!svg || !doc.selection.size) return;
    const bounds = getSelectionBounds(doc, Array.from(doc.selection));
    const name = makeSafeFilename(title || "advanced_export");
    const serialized = serializeSvgElementWithBounds(svg, bounds);
    downloadBlob(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }), `${name}.svg`);
  }, [title]);

  const exportPdf = useCallback(async () => {
    const svg = exportSvgRef.current;
    if (!svg) return;
    const name = makeSafeFilename(title || "advanced_export");
    const bounds = getExportBounds();
    const serialized = serializeSvgElementWithBounds(svg, bounds);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = async () => {
      const viewBox = svg.viewBox.baseVal;
      const baseWidth = bounds?.w ?? viewBox?.width ?? svg.width.baseVal.value ?? 1200;
      const baseHeight = bounds?.h ?? viewBox?.height ?? svg.height.baseVal.value ?? 800;
      const width = baseWidth * exportScale;
      const height = baseHeight * exportScale;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "px", format: [width, height] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, height);
        pdf.save(`${name}.pdf`);
      } catch {
        pushMessage("export_pdf_unsupported");
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [exportScale, title, getExportBounds, pushMessage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (textEditingIdRef.current || isEditableTarget(e.target) || isEditableTarget(active)) return;
      if (e.key === "Escape") {
        if (versionListOpen) { e.preventDefault(); setVersionListOpen(false); return; }
        if (shortcutHelpOpen) { e.preventDefault(); setShortcutHelpOpen(false); return; }
      }
      if ((e.key === "?" || e.key === "/") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShortcutHelpOpen((prev) => !prev);
        return;
      }
      if (livePreviewRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          setLivePreview(false);
        }
        return;
      }
      if (prototypePreviewRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPrototypePreview(false);
        }
        return;
      }
      if (pathEditStateRef.current) {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          commitPathEdit(false);
        }
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) {
        const k = e.key.toLowerCase();
        if (k === "v") { e.preventDefault(); setTool("select"); return; }
        if (k === "f") { e.preventDefault(); setTool("frame"); return; }
        if (k === "r") { e.preventDefault(); setTool("rect"); return; }
        if (k === "o") { e.preventDefault(); setTool("ellipse"); return; }
        if (k === "l") { e.preventDefault(); setTool("line"); return; }
        if (k === "t") { e.preventDefault(); setTool("text"); return; }
        if (k === "p") { e.preventDefault(); setTool("path"); return; }
        if (k === "h") { e.preventDefault(); setTool("hand"); return; }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePrototypePreview();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addPage();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const pageId = activePageIdRef.current;
        if (pageId) duplicatePage(pageId);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "PageDown" || e.key === "PageUp")) {
        e.preventDefault();
        const pages = docRef.current.pages;
        if (!pages.length) return;
        const currentId = activePageIdRef.current ?? pages[0]?.id;
        const index = pages.findIndex((page) => page.id === currentId);
        const nextIndex = e.key === "PageDown" ? index + 1 : index - 1;
        const target = pages[nextIndex];
        if (target) selectPage(target.id);
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const step = gridSnapRef.current ? GRID : 1;
        const delta = e.shiftKey ? step * 5 : step;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nudgeSelection(-delta, 0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nudgeSelection(delta, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeSelection(0, -delta);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeSelection(0, delta);
          return;
        }
        const ids = Array.from(docRef.current.selection);
        if (ids.length === 1) {
          const targetId =
            findEditableTextNodeId(docRef.current, ids[0]) ??
            findPrimaryTextNodeId(docRef.current, ids[0]);
          const node = targetId ? docRef.current.nodes[targetId] : null;
          if (node?.type === "text") {
            const currentText = node.text?.value ?? "";
            let nextText: string | null = null;
            if (e.key === "Backspace" || e.key === "Delete") {
              nextText = currentText.slice(0, -1);
            } else if (e.key === "Enter") {
              nextText = `${currentText}\n`;
            } else if (e.key.length === 1) {
              nextText = `${currentText}${e.key}`;
            }
            if (nextText !== null) {
              e.preventDefault();
              updateNode(node.id, { text: { ...(node.text ?? { value: "", style: DEFAULT_TEXT_STYLE }), value: nextText } as NodeText }, true);
              return;
            }
          }
        }
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        removeSelected();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setUiHidden((prev) => !prev);
        return;
      }
      if (e.key === " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (!spacePanRef.current.active) {
          spacePanRef.current.active = true;
          spacePanRef.current.prev = toolRef.current;
          setTool("hand");
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (e.shiftKey) clearSelection();
        else selectAll();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomBy(0.1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomBy(-0.1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        zoomToPage();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        zoomReset();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        zoomToSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "3") {
        e.preventDefault();
        zoomToContent();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        if (contextMenu) { setContextMenuSubMenu(null); setContextMenu(null); }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        cutSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const next = redoRef.current.pop();
          if (next) {
            undoRef.current.push(docRef.current);
            setDoc(next);
          }
        } else {
          const prev = undoRef.current.pop();
          if (prev) {
            redoRef.current.push(docRef.current);
            setDoc(prev);
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        toggleSelectionHidden();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleSelectionLocked();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "]") {
        e.preventDefault();
        bringToFront();
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "[") {
        e.preventDefault();
        sendToBack();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "]") {
        e.preventDefault();
        bringForward();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "[") {
        e.preventDefault();
        sendBackward();
      }
      if (e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        toggleAutoLayoutSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else if (Array.from(docRef.current.selection).length >= 2) groupSelected();
        else setShowLayoutGrid((prev) => !prev);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && spacePanRef.current.active) {
        e.preventDefault();
        const prev = spacePanRef.current.prev ?? "select";
        spacePanRef.current.active = false;
        spacePanRef.current.prev = null;
        setTool(prev);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [versionListOpen, shortcutHelpOpen]);

  function handleWheel(e: React.WheelEvent) {
    if (contextMenu) { setContextMenuSubMenu(null); setContextMenu(null); }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const nextZoom = clamp(docRef.current.view.zoom + delta, 0.2, 4);
      replace({ ...docRef.current, view: { ...docRef.current.view, zoom: nextZoom } });
      return;
    }
    e.preventDefault();
    const zoom = docRef.current.view.zoom;
    replace({
      ...docRef.current,
      view: {
        ...docRef.current.view,
        panX: docRef.current.view.panX - e.deltaX / zoom,
        panY: docRef.current.view.panY - e.deltaY / zoom,
      },
    });
  }

  const layers = useMemo(() => {
    const base = flattenNodes(doc, pageRoot)
      .map((id) => doc.nodes[id])
      .filter((node): node is Node => Boolean(node) && node.id !== pageRoot);
    const typeFiltered = layerTypeFilter === "all"
      ? base
      : base.filter((node) => {
          if (layerTypeFilter === "shape") return ["rect", "ellipse", "line", "arrow", "polygon", "star", "path"].includes(node.type);
          return node.type === layerTypeFilter;
        });
    const queryFiltered = layerQuery ? typeFiltered.filter((node) => toLabel(node).toLowerCase().includes(layerQuery.toLowerCase())) : typeFiltered;
    if (layerSort === "name") {
      return [...queryFiltered].sort((a, b) => toLabel(a).localeCompare(toLabel(b), "ko"));
    }
    return queryFiltered;
  }, [doc, pageRoot, layerQuery, layerTypeFilter, layerSort]);

  const layersWithDepth = useMemo(() => {
    if (layerSort !== "tree") return layers.map((node) => ({ node, depth: 0 }));
    const out: { node: Node; depth: number }[] = [];
    const pageNode = doc.nodes[pageRoot];
    if (!pageNode?.children) return out;
    const typeOk = (n: Node) => layerTypeFilter === "all" || (layerTypeFilter === "shape" ? ["rect", "ellipse", "line", "arrow", "polygon", "star", "path"].includes(n.type) : n.type === layerTypeFilter);
    const queryOk = (n: Node) => !layerQuery || toLabel(n).toLowerCase().includes(layerQuery.toLowerCase());
    const walk = (parentId: string, depth: number) => {
      const parent = doc.nodes[parentId];
      if (!parent?.children) return;
      parent.children.forEach((id) => {
        const node = doc.nodes[id];
        if (!node || !typeOk(node) || !queryOk(node)) return;
        out.push({ node, depth });
        if (node.children?.length && layerExpandedIds.has(node.id)) walk(node.id, depth + 1);
      });
    };
    walk(pageRoot, 0);
    return out;
  }, [doc, pageRoot, layerSort, layerTypeFilter, layerQuery, layerExpandedIds]);

  const layerTreeExpandAllIds = useMemo(() => {
    const set = new Set<string>();
    const walk = (parentId: string) => {
      doc.nodes[parentId]?.children?.forEach((id) => {
        const node = doc.nodes[id];
        if (node?.children?.length) { set.add(node.id); walk(node.id); }
      });
    };
    walk(pageRoot);
    return set;
  }, [doc, pageRoot]);
  const filteredPresetGroups = useMemo(() => {
    const query = elementQuery.trim().toLowerCase();
    if (!query) return PRESET_GROUPS;
    return PRESET_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(query)),
    })).filter((group) => group.items.length > 0);
  }, [elementQuery]);
  const filteredResourceGroups = useMemo(() => {
    const query = resourceQuery.trim().toLowerCase();
    if (!query) return PRESET_GROUPS;
    return PRESET_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query),
      ),
    })).filter((group) => group.items.length > 0);
  }, [resourceQuery]);

  const hasSelection = selectedIds.length > 0;
  const hasMultipleSelection = selectedIds.length > 1;
  const hasGroupSelection = selectedIds.some((id) => doc.nodes[id]?.type === "group");
  const selectionHidden = hasSelection && selectedIds.every((id) => doc.nodes[id]?.hidden);
  const selectionLocked = hasSelection && selectedIds.every((id) => doc.nodes[id]?.locked);
  const canPaste = Boolean(clipboardRef.current);
  const allInfinite = doc.pages.length > 0 && doc.pages.every((page) => Boolean(infiniteCanvasPages[page.id]));
  const messageText = message ? MESSAGE_LABELS[message] ?? message : null;
  const zoomPercent = Math.round(doc.view.zoom * 100);
  const editingNode = textEditingId ? doc.nodes[textEditingId] : null;
  const editingTextStyle = editingNode ? resolveTextStyle(doc, editingNode) : null;
  const editingFill = editingNode ? resolveFillColor(doc, editingNode) : "#111827";
  const componentNodes = Object.values(doc.nodes).filter((node) => node.type === "component");
  const fillStyles = doc.styles.filter((style) => style.type === "fill");
  const strokeStyles = doc.styles.filter((style) => style.type === "stroke");
  const textStyles = doc.styles.filter((style) => style.type === "text");
  const effectStyles = doc.styles.filter((style) => style.type === "effect");
  const colorVariables = doc.variables.filter((variable) => variable.type === "color");
  const variableModes = doc.variableModes?.length ? doc.variableModes : ["기본"];
  const activeVariableMode = doc.variableMode ?? variableModes[0];
  const selectedIsComponent = selectedNode?.type === "component";
  const selectedIsInstance = selectedNode?.type === "instance";
  const instanceSource = selectedIsInstance && selectedNode?.instanceOf ? doc.nodes[selectedNode.instanceOf] : null;
  const instanceTextOverrides = useMemo(() => {
    if (!selectedIsInstance || !selectedNode) return [];
    return flattenNodes(doc, selectedNode.id)
      .map((id) => doc.nodes[id])
      .filter((node): node is Node => Boolean(node) && node.type === "text")
      .map((node) => ({
        id: node.id,
        label: node.name,
        value: node.text?.value ?? "",
        sourceName: node.sourceId ? doc.nodes[node.sourceId]?.name ?? null : null,
      }));
  }, [doc, selectedIsInstance, selectedNode?.id]);
  const instanceImageOverrides = useMemo(() => {
    if (!selectedIsInstance || !selectedNode) return [];
    return flattenNodes(doc, selectedNode.id)
      .map((id) => doc.nodes[id])
      .filter((node): node is Node => Boolean(node) && (node.type === "image" || node.type === "video"))
      .map((node) => ({
        id: node.id,
        label: node.name,
        type: node.type,
        src: node.type === "video" ? node.video?.src ?? "" : node.image?.src ?? "",
        sourceName: node.sourceId ? doc.nodes[node.sourceId]?.name ?? null : null,
      }));
  }, [doc, selectedIsInstance, selectedNode?.id]);

  useEffect(() => {
    if (exportScope === "selection" && !hasSelection) setExportScope("page");
  }, [exportScope, hasSelection]);

  useEffect(() => {
    if (selectedIsInstance && selectedNode?.type === "instance") {
      const nextId = selectedNode.instanceOf ?? componentNodes[0]?.id ?? "";
      setSwapComponentId(nextId);
    } else {
      setSwapComponentId("");
    }
  }, [componentNodes.length, selectedIsInstance, selectedNode?.id, selectedNode?.instanceOf]);

  type ContextItem = { id: string; label: string; hint?: string; disabled?: boolean; onClick: () => void } | { id: string; divider: true };
  const runAndCloseContext = (fn: () => void) => {
    fn();
    setContextMenu(null);
    setContextMenuSubMenu(null);
  };
  /** 8번: 1단계 — 잘라내기, 복사, 붙여넣기, 삭제, 그룹, 잠금 등 5~8개 */
  const contextPrimaryItems: ContextItem[] = [
    { id: "cut", label: "잘라내기", hint: "Ctrl+X", disabled: !hasSelection, onClick: cutSelected },
    { id: "copy", label: "복사", hint: "Ctrl+C", disabled: !hasSelection, onClick: copySelected },
    { id: "paste", label: "붙여넣기", hint: "Ctrl+V", disabled: !canPaste, onClick: pasteClipboard },
    { id: "divider-1", divider: true },
    { id: "duplicate", label: "복제", hint: "Ctrl+D", disabled: !hasSelection, onClick: duplicateSelected },
    { id: "delete", label: "삭제", hint: "Del", disabled: !hasSelection, onClick: removeSelected },
    { id: "divider-2", divider: true },
    { id: "group", label: "그룹", hint: "Ctrl+G", disabled: selectedIds.length < 2, onClick: groupSelected },
    { id: "ungroup", label: "그룹 해제", hint: "Ctrl+Shift+G", disabled: !hasGroupSelection, onClick: ungroupSelected },
    { id: "toggle-lock", label: selectionLocked ? "잠금 해제" : "잠금", hint: "Ctrl+Shift+L", disabled: !hasSelection, onClick: toggleSelectionLocked },
    { id: "toggle-hide", label: selectionHidden ? "숨김 해제" : "숨김", hint: "Ctrl+Shift+H", disabled: !hasSelection, onClick: toggleSelectionHidden },
  ];
  /** 8번: 2단계 — "더 보기" 서브메뉴: 정렬, Boolean, 컴포넌트, 마스크 등 */
  const contextMoreItems: ContextItem[] = [
    { id: "selection-page", label: "선택→페이지", disabled: !hasSelection, onClick: createPageFromSelection },
    { id: "fit-content", label: "내용에 맞춤", disabled: !hasSelection, onClick: fitSelectionToContent },
    { id: "divider-sel", divider: true },
    { id: "select-all", label: "전체 선택", hint: "Ctrl+A", onClick: selectAll },
    { id: "select-none", label: "선택 해제", hint: "Ctrl+Shift+A", onClick: clearSelection },
    { id: "select-invert", label: "선택 반전", onClick: invertSelection },
    { id: "select-parent", label: "부모 선택", disabled: selectedIds.length !== 1, onClick: selectParent },
    { id: "select-children", label: "자식 선택", disabled: selectedIds.length !== 1, onClick: selectChildren },
    { id: "select-siblings", label: "형제 선택", disabled: selectedIds.length !== 1, onClick: selectSiblings },
    { id: "divider-lay", divider: true },
    { id: "auto-layout", label: "오토 레이아웃", hint: "Shift+A", disabled: !hasSelection, onClick: toggleAutoLayoutSelection },
    { id: "component", label: "컴포넌트 만들기", disabled: !hasSelection, onClick: createComponentFromSelection },
    { id: "instance", label: "인스턴스 생성", disabled: !selectedIsComponent || !selectedNode, onClick: () => selectedNode && createInstanceFromComponent(selectedNode.id, selectedNode.variants?.[0]?.id) },
    { id: "detach", label: "인스턴스 분리", disabled: !selectedIsInstance || !selectedNode, onClick: () => selectedNode && detachInstance(selectedNode.id) },
    { id: "divider-3", divider: true },
    { id: "front", label: "맨 앞으로", disabled: !hasSelection, onClick: bringToFront },
    { id: "back", label: "맨 뒤로", disabled: !hasSelection, onClick: sendToBack },
    { id: "forward", label: "앞으로", hint: "Ctrl+Shift+]", disabled: !hasSelection, onClick: bringForward },
    { id: "backward", label: "뒤로", hint: "Ctrl+Shift+[", disabled: !hasSelection, onClick: sendBackward },
    { id: "divider-4", divider: true },
    { id: "align-left", label: "왼쪽 정렬", disabled: !hasMultipleSelection, onClick: () => align("l") },
    { id: "align-center", label: "가운데 정렬", disabled: !hasMultipleSelection, onClick: () => align("hc") },
    { id: "align-right", label: "오른쪽 정렬", disabled: !hasMultipleSelection, onClick: () => align("r") },
    { id: "distribute-h", label: "가로 간격 맞춤", disabled: selectedIds.length < 3, onClick: () => distribute("h") },
    { id: "distribute-v", label: "세로 간격 맞춤", disabled: selectedIds.length < 3, onClick: () => distribute("v") },
    { id: "same-width", label: "같은 너비", disabled: !hasMultipleSelection, onClick: () => matchSelectionSize("w") },
    { id: "same-height", label: "같은 높이", disabled: !hasMultipleSelection, onClick: () => matchSelectionSize("h") },
    { id: "snap-grid", label: "그리드 맞춤", disabled: !hasSelection, onClick: snapSelectionToGrid },
    { id: "flip-h", label: "가로 뒤집기", disabled: !hasSelection, onClick: () => flipSelection("h") },
    { id: "flip-v", label: "세로 뒤집기", disabled: !hasSelection, onClick: () => flipSelection("v") },
    { id: "tidy-up", label: "정리 (Tidy up)", disabled: selectedIds.length < 2, onClick: tidyUpSelection },
    { id: "divider-vector", divider: true },
    { id: "vector-union", label: "도형 합치기 (Union)", disabled: selectedIds.length < 2, onClick: () => runBooleanSelection("union") },
    { id: "vector-subtract", label: "도형 빼기 (Subtract)", disabled: selectedIds.length < 2, onClick: () => runBooleanSelection("subtract") },
    { id: "vector-intersect", label: "도형 겹침 (Intersect)", disabled: selectedIds.length < 2, onClick: () => runBooleanSelection("intersect") },
    { id: "vector-exclude", label: "도형 제외 (Exclude)", disabled: selectedIds.length < 2, onClick: () => runBooleanSelection("exclude") },
    { id: "mask-use", label: "마스크로 사용", disabled: selectedIds.length !== 1, onClick: useMaskSelection },
    { id: "mask-release", label: "마스크 해제", disabled: selectedIds.length !== 1 || !selectedNode?.isMask, onClick: releaseMaskSelection },
    { id: "divider-4b", divider: true },
    { id: "zoom-selection", label: "선택 맞춤", disabled: !hasSelection, onClick: zoomToSelection },
    { id: "zoom-content", label: "콘텐츠 맞춤", onClick: zoomToContent },
    { id: "zoom-page", label: "페이지 맞춤", onClick: zoomToPage },
    { id: "divider-4c", divider: true },
    { id: "toggle-grid", label: showGrid ? "그리드 숨기기" : "그리드 표시", onClick: () => setShowGrid((prev) => !prev) },
    { id: "toggle-outline", label: outlineMode ? "아웃라인 해제" : "아웃라인 보기", onClick: () => setOutlineMode((prev) => !prev) },
    { id: "toggle-rulers", label: showRulers ? "룰러 숨기기" : "룰러 표시", onClick: () => setShowRulers((prev) => !prev) },
    { id: "toggle-ui", label: uiHidden ? "UI 표시" : "UI 숨김", onClick: () => setUiHidden((prev) => !prev) },
  ];

  const parentNode = selectedNode?.parentId ? doc.nodes[selectedNode.parentId] : null;
  const parentIsAutoLayout = parentNode?.layout?.mode === "auto";
  const autoLayout = selectedNode?.layout?.mode === "auto" ? selectedNode.layout : null;
  const resolvedAutoLayout = autoLayout ?? DEFAULT_AUTO_LAYOUT;
  const sizing = selectedNode?.layoutSizing ?? { width: "fixed", height: "fixed" };
  const constraints = selectedNode?.constraints ?? {};
  const resolvedTextStyle = selectedNode ? resolveTextStyle(doc, selectedNode) : null;
  const devCss = selectedNode ? buildDevCss(doc, selectedNode, { roundPx: devRoundPx }) : "";
  const devSpecPayload = selectedNode ? buildSpecPayload(doc, selectedNode) : null;
  const devSpecText = devSpecPayload ? JSON.stringify(devSpecPayload, null, 2) : "";
  const selectedInteractions = selectedNode?.prototype?.interactions ?? [];
  const selectedAbs = selectedNode ? getAbsoluteFrame(doc, selectedNode.id) : null;
  const parentAbs = selectedNode?.parentId ? getAbsoluteFrame(doc, selectedNode.parentId) : null;
  const devSpecLines = selectedNode ? buildSpecLines(doc, selectedNode) : [];
  const devFillStyle = selectedNode ? findStyleName(doc, selectedNode.style.fillStyleId, "fill") : null;
  const devStrokeStyle = selectedNode ? findStyleName(doc, selectedNode.style.strokeStyleId, "stroke") : null;
  const devTextStyle = selectedNode && selectedNode.type === "text" ? findStyleName(doc, selectedNode.text?.styleRef, "text") : null;
  const devFillVar = selectedNode ? findVariableName(doc, selectedNode.style.fillRef) : null;
  const effectDefs = useMemo(() => buildEffectDefs(doc, "adv-effect"), [doc]);
  const resolvedStroke = selectedNode ? resolveStroke(doc, selectedNode) : null;
  const resolvedRadius = selectedNode?.style.radius ?? 0;
  const radiusValue = typeof resolvedRadius === "number" ? resolvedRadius : resolvedRadius?.tl ?? 0;
  const radiusCorners = typeof resolvedRadius === "object" && resolvedRadius ? resolvedRadius : null;
  const isPolygon = selectedNode?.type === "polygon";
  const isStar = selectedNode?.type === "star";
  const shapeConfig = selectedNode?.shape ?? {};
  const polygonSides = Math.max(3, Math.round(shapeConfig.polygonSides ?? 6));
  const starPoints = Math.max(3, Math.round(shapeConfig.starPoints ?? 5));
  const starInnerRatio = Math.max(0.1, Math.min(0.9, shapeConfig.starInnerRatio ?? 0.5));
  const selectedEffects = selectedNode ? resolveEffects(doc, selectedNode) : [];
  const applyConstraintPreset = useCallback(
    (preset: Constraints) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { constraints: { ...preset } }, true);
    },
    [selectedNode, updateNode],
  );
  const applyEffects = useCallback(
    (next: Effect[]) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { style: { ...selectedNode.style, effects: next, effectStyleId: undefined } }, true);
    },
    [selectedNode, updateNode],
  );
  const shadowEffect = selectedEffects.find((effect) => effect.type === "shadow") as Effect | undefined;
  const blurEffect = selectedEffects.find((effect) => effect.type === "blur") as Effect | undefined;

  const DesignPanelInner = () => (
    <>
      {selectedNode ? (
      <div className="space-y-4" key="with-node">
        <div className="rounded-md border border-neutral-100 bg-neutral-50/50 overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 hover:bg-neutral-100" onClick={() => setRightPanelSections((s) => ({ ...s, geometry: !s.geometry }))}>
            <span>기하</span>
            <span className={`shrink-0 transition-transform ${rightPanelSections.geometry ? "rotate-180" : ""}`} aria-hidden>▾</span>
          </button>
          {rightPanelSections.geometry && (
            <div className="px-2 pb-2">
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">X</span>
                  <input type="number" value={Math.round(selectedNode.frame.x)} onChange={(e) => updateNode(selectedNode.id, { frame: { ...selectedNode.frame, x: Number(e.target.value) } }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">Y</span>
                  <input type="number" value={Math.round(selectedNode.frame.y)} onChange={(e) => updateNode(selectedNode.id, { frame: { ...selectedNode.frame, y: Number(e.target.value) } }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">W</span>
                  <input type="number" value={Math.round(selectedNode.frame.w)} onChange={(e) => updateNode(selectedNode.id, { frame: { ...selectedNode.frame, w: Number(e.target.value) }, widthPercent: undefined }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">H</span>
                  <input type="number" value={Math.round(selectedNode.frame.h)} onChange={(e) => updateNode(selectedNode.id, { frame: { ...selectedNode.frame, h: Number(e.target.value) }, heightPercent: undefined }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                </label>
                {selectedNode.parentId ? (
                  <>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">가로 %</span>
                      <input type="number" min={0} max={100} step={1} placeholder="—" value={selectedNode.widthPercent ?? ""} onChange={(e) => { const v = e.target.value === "" ? undefined : Number(e.target.value); updateNode(selectedNode.id, { widthPercent: v }, true); }} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">세로 %</span>
                      <input type="number" min={0} max={100} step={1} placeholder="—" value={selectedNode.heightPercent ?? ""} onChange={(e) => { const v = e.target.value === "" ? undefined : Number(e.target.value); updateNode(selectedNode.id, { heightPercent: v }, true); }} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                    </label>
                  </>
                ) : null}
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">회전</span>
                  <input type="number" value={Math.round(selectedNode.frame.rotation)} onChange={(e) => updateNode(selectedNode.id, { frame: { ...selectedNode.frame, rotation: Number(e.target.value) } }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
                </label>
              </div>
              <div className="mt-2">
                <button type="button" className="rounded border border-neutral-200 px-2 py-1 text-[11px]" onClick={fitSelectionToContent} disabled={!selectedNode.children?.length && !autoLayout}>내용 맞춤</button>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-md border border-neutral-100 bg-neutral-50/50 overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 hover:bg-neutral-100" onClick={() => setRightPanelSections((s) => ({ ...s, layout: !s.layout }))}>
            <span>레이아웃</span>
            <span className={`shrink-0 transition-transform ${rightPanelSections.layout ? "rotate-180" : ""}`} aria-hidden>▾</span>
          </button>
          {rightPanelSections.layout && (
            <div className="px-2 pb-2">
              <div className="mt-2 space-y-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">자동</span>
                  <input type="checkbox" checked={Boolean(autoLayout)} onChange={(e) => { if (e.target.checked) updateNode(selectedNode.id, { layout: { ...DEFAULT_AUTO_LAYOUT } }, true); else updateNode(selectedNode.id, { layout: { mode: "fixed" } }, true); }} />
                </label>
                {autoLayout && (
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">간격 모드</span>
                    <select value={resolvedAutoLayout.gapMode ?? "fixed"} onChange={(e) => updateNode(selectedNode.id, { layout: { ...resolvedAutoLayout, gapMode: e.target.value as "fixed" | "space-between" } }, true)} className="rounded border border-neutral-200 px-2 py-1 text-xs">
                      <option value="fixed">고정 간격</option>
                      <option value="space-between">공간 분배</option>
                    </select>
                  </label>
                )}
                {parentIsAutoLayout && (
                  <>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">자식 크기</div>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">가로</span>
                      <select value={sizing.width} onChange={(e) => updateNode(selectedNode.id, { layoutSizing: { ...sizing, width: e.target.value as "fixed" | "fill" | "hug" } }, true)} className="rounded border border-neutral-200 px-2 py-1 text-[11px]">
                        <option value="fixed">고정</option>
                        <option value="fill">채우기</option>
                        <option value="hug">감싸기</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">세로</span>
                      <select value={sizing.height} onChange={(e) => updateNode(selectedNode.id, { layoutSizing: { ...sizing, height: e.target.value as "fixed" | "fill" | "hug" } }, true)} className="rounded border border-neutral-200 px-2 py-1 text-[11px]">
                        <option value="fixed">고정</option>
                        <option value="fill">채우기</option>
                        <option value="hug">감싸기</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <label className="flex items-center gap-1"><span className="text-neutral-500">minW</span><input type="number" placeholder="—" value={sizing.minWidth ?? ""} onChange={(e) => updateNode(selectedNode.id, { layoutSizing: { ...sizing, minWidth: e.target.value === "" ? undefined : Number(e.target.value) } }, true)} className="w-14 rounded border border-neutral-200 px-1 py-0.5" /></label>
                      <label className="flex items-center gap-1"><span className="text-neutral-500">maxW</span><input type="number" placeholder="—" value={sizing.maxWidth ?? ""} onChange={(e) => updateNode(selectedNode.id, { layoutSizing: { ...sizing, maxWidth: e.target.value === "" ? undefined : Number(e.target.value) } }, true)} className="w-14 rounded border border-neutral-200 px-1 py-0.5" /></label>
                      <label className="flex items-center gap-1"><span className="text-neutral-500">minH</span><input type="number" placeholder="—" value={sizing.minHeight ?? ""} onChange={(e) => updateNode(selectedNode.id, { layoutSizing: { ...sizing, minHeight: e.target.value === "" ? undefined : Number(e.target.value) } }, true)} className="w-14 rounded border border-neutral-200 px-1 py-0.5" /></label>
                      <label className="flex items-center gap-1"><span className="text-neutral-500">maxH</span><input type="number" placeholder="—" value={sizing.maxHeight ?? ""} onChange={(e) => updateNode(selectedNode.id, { layoutSizing: { ...sizing, maxHeight: e.target.value === "" ? undefined : Number(e.target.value) } }, true)} className="w-14 rounded border border-neutral-200 px-1 py-0.5" /></label>
                    </div>
                  </>
                )}
                {["frame", "section", "component", "instance", "group"].includes(selectedNode.type) && (
                  <>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">클립</span>
                      <input type="checkbox" checked={Boolean(selectedNode.clipContent)} onChange={(e) => updateNode(selectedNode.id, { clipContent: e.target.checked }, true)} />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">오버플로우</span>
                      <select value={selectedNode.overflowScrolling ?? "none"} onChange={(e) => updateNode(selectedNode.id, { overflowScrolling: e.target.value === "none" ? undefined : (e.target.value as "vertical" | "horizontal" | "both") }, true)} className="rounded border border-neutral-200 px-2 py-1 text-xs">
                        <option value="none">없음</option>
                        <option value="horizontal">가로</option>
                        <option value="vertical">세로</option>
                        <option value="both">둘 다</option>
                      </select>
                    </label>
                  </>
                )}
                {selectedNode.parentId && doc.nodes[selectedNode.parentId]?.overflowScrolling ? (
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">스크롤 시 고정</span>
                    <input type="checkbox" checked={Boolean(selectedNode.sticky)} onChange={(e) => updateNode(selectedNode.id, { sticky: e.target.checked }, true)} />
                  </label>
                ) : null}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-md border border-neutral-100 bg-neutral-50/50 overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 hover:bg-neutral-100" onClick={() => setRightPanelSections((s) => ({ ...s, fillStroke: !s.fillStroke }))}>
            <span>채우기·테두리·효과</span>
            <span className={`shrink-0 transition-transform ${rightPanelSections.fillStroke ? "rotate-180" : ""}`} aria-hidden>▾</span>
          </button>
          {rightPanelSections.fillStroke && (
            <div className="px-2 pb-2">
              <div className="mt-2 space-y-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="text-neutral-500">채우기</span>
                    {selectedNode.style.fillRef ? <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">변수</span> : null}
                  </span>
                  <input type="color" value={resolveFillColor(doc, selectedNode)} onChange={(e) => updateNode(selectedNode.id, { style: { ...selectedNode.style, fills: [{ type: "solid", color: e.target.value }] } }, true)} className="h-7 w-12 rounded border border-neutral-200" />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                    onClick={() =>
                      updateNode(selectedNode.id, {
                        style: {
                          ...selectedNode.style,
                          fillStyleId: undefined,
                          strokeStyleId: undefined,
                          effectStyleId: undefined,
                          fillRef: undefined,
                        },
                      }, true)
                    }
                  >
                    스타일 제거
                  </button>
                </div>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">블렌드</span>
                  <select
                    value={selectedNode.style.blendMode ?? "normal"}
                    onChange={(e) => updateNode(selectedNode.id, { style: { ...selectedNode.style, blendMode: e.target.value as BlendMode } }, true)}
                    className="min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-[11px]"
                  >
                    {BLEND_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>
        {selectedNode.type === "text" && (
          <div className="rounded-md border border-neutral-100 bg-neutral-50/50 overflow-hidden">
            <button type="button" className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 hover:bg-neutral-100" onClick={() => setRightPanelSections((s) => ({ ...s, text: !s.text }))}>
              <span>텍스트</span>
              <span className={`shrink-0 transition-transform ${rightPanelSections.text ? "rotate-180" : ""}`} aria-hidden>▾</span>
            </button>
            {rightPanelSections.text && (
              <div className="px-2 pb-2">
                <div className="mt-2 space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">내용</span>
                    <input type="text" value={selectedNode.text?.value ?? ""} onChange={(e) => updateNode(selectedNode.id, { text: { ...(selectedNode.text ?? { value: "", style: DEFAULT_TEXT_STYLE }), value: e.target.value } as NodeText }, true)} className="w-full rounded border border-neutral-200 px-2 py-1 text-xs" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-neutral-500">OpenType (font-feature-settings)</span>
                    <input type="text" value={resolvedTextStyle?.fontFeatureSettings ?? ""} onChange={(e) => updateNode(selectedNode.id, { text: { ...(selectedNode.text ?? { value: "", style: DEFAULT_TEXT_STYLE }), style: { ...(resolvedTextStyle ?? DEFAULT_TEXT_STYLE), fontFeatureSettings: e.target.value || undefined } } as NodeText }, true)} placeholder='e.g. "liga" 1, "ss01" 1' className="w-full rounded border border-neutral-200 px-2 py-1 text-xs" />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="rounded-md border border-neutral-100 bg-neutral-50/50 overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 hover:bg-neutral-100" onClick={() => setRightPanelSections((s) => ({ ...s, prototype: !s.prototype }))}>
            <span>프로토타입</span>
            <span className={`shrink-0 transition-transform ${rightPanelSections.prototype ? "rotate-180" : ""}`} aria-hidden>▾</span>
          </button>
          {rightPanelSections.prototype && (
            <div className="px-2 pb-2">
              <div className="mt-2 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">인터랙션</div>
                {selectedInteractions.map((ia) => (
                  <div key={ia.id} className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-white px-2 py-1">
                    <span className="text-[11px]">{ia.trigger}</span>
                    {ia.action.type === "navigate" ? (
                      <select value={ia.action.targetPageId ?? ""} onChange={(e) => updatePrototypeInteraction(selectedNode.id, ia.id, { action: { ...ia.action, type: "navigate", targetPageId: e.target.value } as import("../doc/scene").PrototypeAction })} className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]">
                        {doc.pages.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                      </select>
                    ) : null}
                    <button type="button" className="rounded border border-neutral-200 px-1 py-0.5 text-[10px]" onClick={() => removePrototypeInteraction(selectedNode.id, ia.id)}>삭제</button>
                  </div>
                ))}
                <button type="button" className="rounded border border-neutral-200 px-2 py-1 text-[11px]" onClick={() => addPrototypeInteraction(selectedNode.id)}>인터랙션 추가</button>
              </div>
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="space-y-4" key="no-node">
        <div className="text-xs text-neutral-500">레이어를 선택해 속성을 편집하세요.</div>
        {pageNode && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">페이지</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">너비</span>
                <input type="number" value={Math.round(pageNode.frame.w)} onChange={(e) => updateNode(pageNode.id, { frame: { ...pageNode.frame, w: Number(e.target.value) } }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">높이</span>
                <input type="number" value={Math.round(pageNode.frame.h)} onChange={(e) => updateNode(pageNode.id, { frame: { ...pageNode.frame, h: Number(e.target.value) } }, true)} className="w-20 rounded border border-neutral-200 px-2 py-1" />
              </label>
            </div>
            <label className="mt-2 flex items-center justify-between gap-2">
              <span className="text-neutral-500">배경</span>
              <input type="color" value={resolveFillColor(doc, pageNode)} onChange={(e) => updateNode(pageNode.id, { style: { ...pageNode.style, fills: [{ type: "solid", color: e.target.value }] } }, true)} className="h-7 w-12 rounded border border-neutral-200" />
            </label>
          </div>
        )}
      </div>
    )}
  </>
  );

  if (!canvasMounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-sm text-neutral-500">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden text-sm text-neutral-900">
      {!uiHidden ? (
      <aside className="flex h-full w-80 shrink-0 min-h-0 flex-col overflow-hidden border-r border-neutral-200 bg-neutral-50/90">
        {/* 8번: 좌측 탭 — 페이지 | 레이어 | 자산 */}
        <div className="flex shrink-0 border-b border-neutral-200 bg-white px-2 pt-2">
          {(["pages", "layers", "assets"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`flex-1 rounded-t-md px-3 py-2 text-xs font-medium ${
                leftPanelTab === tab ? "bg-neutral-50 text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
              onClick={() => setLeftPanelTab(tab)}
            >
              {tab === "pages" ? "페이지" : tab === "layers" ? "레이어" : "자산"}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {leftPanelTab === "pages" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-medium" onClick={addPage}>추가</button>
                <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs" onClick={createPageFromSelection} disabled={!hasSelection}>선택→페이지</button>
                <button type="button" className={`rounded-md border px-2 py-1.5 text-xs ${allInfinite ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`} onClick={toggleInfiniteAll}>전체 무한</button>
                <button type="button" className={`rounded-md border px-2 py-1.5 text-xs ${activePageId && infiniteCanvasPages[activePageId] ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`} onClick={toggleInfiniteCanvas} disabled={!activePageId}>무한 캔버스</button>
              </div>
              <div className="mt-3 space-y-2">
                {doc.pages.map((page) => (
                  <div key={page.id} className={`flex items-center justify-between gap-2 rounded-md border px-2 py-2 text-xs ${page.id === activePageId ? "border-neutral-900 bg-white ring-1 ring-neutral-900" : "border-neutral-200 bg-white"}`} onClick={() => selectPage(page.id)}>
                    <input type="text" value={page.name} onChange={(e) => renamePage(page.id, e.target.value, false)} onBlur={(e) => renamePage(page.id, e.target.value, true)} onClick={(e) => e.stopPropagation()} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px]" disabled={doc.pages[0]?.id === page.id} onClick={(e) => { e.stopPropagation(); movePage(page.id, -1); }}>▲</button>
                      <button type="button" className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px]" disabled={doc.pages[doc.pages.length - 1]?.id === page.id} onClick={(e) => { e.stopPropagation(); movePage(page.id, 1); }}>▼</button>
                      <button type="button" className={`rounded border px-1.5 py-0.5 text-[10px] ${prototypeStartPageId === page.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`} onClick={(e) => { e.stopPropagation(); updateDocPrototype({ startPageId: page.id }); }}>시작</button>
                      <button type="button" className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px]" onClick={(e) => { e.stopPropagation(); duplicatePage(page.id); }}>복제</button>
                      <button type="button" className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px]" disabled={doc.pages.length <= 1} onClick={(e) => { e.stopPropagation(); removePage(page.id); }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : leftPanelTab === "layers" ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs" onClick={() => setGridSnap((prev) => !prev)}>스냅 {gridSnap ? "켜짐" : "꺼짐"}</button>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={pixelSnap} onChange={(e) => setPixelSnap(e.target.checked)} />
                  픽셀 스냅
                </label>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]" onClick={addGuideVertical} title="세로 가이드 추가">가이드 │</button>
                  <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]" onClick={addGuideHorizontal} title="가로 가이드 추가">가이드 ─</button>
                  <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]" onClick={clearGuides} disabled={!doc.view.guides?.x?.length && !doc.view.guides?.y?.length} title="가이드 모두 제거">가이드 지우기</button>
                </div>
                {layerSort === "tree" && (
                  <>
                    <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]" onClick={() => setLayerExpandedIds(new Set())}>모두 접기</button>
                    <button type="button" className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]" onClick={() => setLayerExpandedIds(layerTreeExpandAllIds)}>모두 펼치기</button>
                  </>
                )}
              </div>
              <input type="text" value={layerQuery} onChange={(e) => setLayerQuery(e.target.value)} placeholder="레이어 검색" className="mt-2 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs" aria-label="레이어 검색" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select value={layerTypeFilter} onChange={(e) => setLayerTypeFilter(e.target.value)} className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[11px]">
                  <option value="all">전체</option>
                  <option value="frame">프레임</option>
                  <option value="section">섹션</option>
                  <option value="group">그룹</option>
                  <option value="component">컴포넌트</option>
                  <option value="instance">인스턴스</option>
                  <option value="text">텍스트</option>
                  <option value="image">이미지</option>
                  <option value="video">비디오</option>
                  <option value="shape">도형</option>
                  <option value="slice">슬라이스</option>
                  <option value="hotspot">핫스팟</option>
                </select>
                <select value={layerSort} onChange={(e) => setLayerSort(e.target.value as "tree" | "name")} className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[11px]">
                  <option value="tree">트리</option>
                  <option value="name">이름</option>
                </select>
              </div>
              <div className="mt-3 flex-1 space-y-1 min-h-0 overflow-y-auto">
                {layersWithDepth.length === 0 ? (
                  <p className="py-6 px-2 text-center text-[11px] text-neutral-400">레이어가 없습니다.<br />캔버스에 프레임이나 도형을 그려 보세요.</p>
                ) : (
                  layersWithDepth.map(({ node, depth }) => {
                    const selected = doc.selection.has(node.id);
                    const hasChildren = Boolean(node.children?.length);
                    const isExpanded = layerExpandedIds.has(node.id);
                    return (
                      <div
                        key={node.id}
                        data-layer-id={node.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", node.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedId = e.dataTransfer.getData("text/plain");
                          if (draggedId && draggedId !== node.id) moveLayerInDoc(draggedId, node.id, e.altKey);
                        }}
                        className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${selected ? "bg-blue-50 text-blue-700" : "bg-white hover:bg-neutral-50"}`}
                        style={{ paddingLeft: `${8 + depth * 12}px` }}
                        onClick={(e) => { e.stopPropagation(); const append = e.shiftKey; if (append) { const next = new Set(docRef.current.selection); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); replace({ ...docRef.current, selection: next }); } else { replace({ ...docRef.current, selection: new Set([node.id]) }); } }}
                      >
                        {layerSort === "tree" && hasChildren ? (
                          <button type="button" className="shrink-0 p-0.5 rounded hover:bg-neutral-200" onClick={(e) => { e.stopPropagation(); setLayerExpandedIds((prev) => { const next = new Set(prev); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; }); }} aria-label={isExpanded ? "접기" : "펼치기"}>{isExpanded ? "▾" : "▸"}</button>
                        ) : layerSort === "tree" ? <span className="w-4 shrink-0" /> : null}
                        <input type="text" value={node.name === node.type ? NODE_TYPE_LABELS[node.type] ?? node.name : node.name} onChange={(e) => updateNode(node.id, { name: e.target.value }, false)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" onClick={(e) => e.stopPropagation()} />
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" className="rounded border border-neutral-200 px-1 py-0.5 text-[10px]" onClick={(e) => { e.stopPropagation(); updateNode(node.id, { hidden: !node.hidden }); }} aria-label={node.hidden ? "표시" : "숨김"}>{node.hidden ? "표시" : "숨김"}</button>
                          <button type="button" className="rounded border border-neutral-200 px-1 py-0.5 text-[10px]" onClick={(e) => { e.stopPropagation(); updateNode(node.id, { locked: !node.locked }); }} aria-label={node.locked ? "잠금 해제" : "잠금"}>{node.locked ? "잠금해제" : "잠금"}</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <input type="text" value={elementQuery} onChange={(e) => setElementQuery(e.target.value)} placeholder="요소 검색" className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
              <div className="mt-3 space-y-1">
                {filteredPresetGroups.map((group) => {
                  const isOpen = assetsAccordionOpen[group.title] !== false;
                  return (
                    <div key={group.title} className="rounded-md border border-neutral-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between bg-neutral-50 px-2 py-1.5 text-left text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
                        onClick={() => toggleAssetsAccordion(group.title)}
                      >
                        <span>{group.title}</span>
                        <span className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>▾</span>
                      </button>
                      {isOpen ? (
                        <div className="grid grid-cols-2 gap-1.5 p-2">
                          {group.items.map((item) => (
                            <button key={item.id} type="button" className="rounded border border-neutral-100 px-2 py-1.5 text-left text-[11px] hover:bg-neutral-50" onClick={() => insertPreset(item)}>{item.label}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <input type="text" value={resourceQuery} onChange={(e) => setResourceQuery(e.target.value)} placeholder="컴포넌트·위젯 검색" className="mt-4 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs" />
              <div className="mt-2 space-y-1">
                {filteredResourceGroups.map((group) => {
                  const isOpen = assetsAccordionOpen[group.title] !== false;
                  return (
                    <div key={`res-${group.title}`} className="rounded-md border border-neutral-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between bg-neutral-50 px-2 py-1.5 text-left text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
                        onClick={() => toggleAssetsAccordion(group.title)}
                      >
                        <span>{group.title}</span>
                        <span className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>▾</span>
                      </button>
                      {isOpen ? (
                        <div className="grid grid-cols-2 gap-1.5 p-2 max-h-40 overflow-y-auto">
                          {group.items.map((item) => (
                            <button key={item.id} type="button" className="rounded border border-neutral-100 px-2 py-1.5 text-left text-[11px] hover:bg-neutral-50" onClick={() => insertPreset(item)}>{item.label}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </aside>
      ) : null}

      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-50 h-14 shrink-0 overflow-x-auto overflow-y-hidden border-b border-neutral-200 bg-white" role="toolbar" aria-label="편집 도구">
          <div className="flex h-full min-w-max items-center justify-between gap-2 px-4">
          <div className="flex shrink-0 items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 없음"
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm"
            />
            <div className="flex items-center gap-2">
              {TOOL_GROUPS.map((group, gi) => {
                const activeInGroup = group.ids.includes(tool);
                const displayId = activeInGroup ? tool : group.ids[0];
                const displayOpt = TOOL_OPTIONS.find((o) => o.id === displayId);
                const isOpen = toolbarDropdown === `group-${gi}`;
                return (
                  <div key={gi} className="relative flex items-center gap-1">
                    {gi > 0 && <span className="h-4 w-px bg-neutral-200" aria-hidden />}
                    <button
                      ref={isOpen ? toolbarDropdownRef : undefined}
                      type="button"
                      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                        activeInGroup ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"
                      }`}
                      onClick={() => setToolbarDropdown(isOpen ? null : `group-${gi}`)}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      {displayOpt?.label ?? ""}
                      <span className="opacity-70" aria-hidden>▾</span>
                    </button>
                    {isOpen && typeof document !== "undefined"
                      ? createPortal(
                          <>
                            <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setToolbarDropdown(null)} />
                            <div
                              className="fixed z-[9999] min-w-[120px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
                              style={{ left: toolbarDropdownRect.left, top: toolbarDropdownRect.top }}
                            >
                              {group.ids.map((id) => {
                                const opt = TOOL_OPTIONS.find((o) => o.id === id);
                                if (!opt) return null;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    className={`flex w-full px-3 py-1.5 text-left text-xs ${
                                      tool === opt.id ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
                                    }`}
                                    onClick={() => { setTool(opt.id); setToolbarDropdown(null); }}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </>,
                          document.body,
                        )
                      : null}
                  </div>
                );
              })}
              <span className="h-4 w-px bg-neutral-200" aria-hidden />
              <div className="relative">
                <button
                  ref={toolbarOverflowOpen ? toolbarOverflowRef : undefined}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${toolbarOverflowOpen ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
                  onClick={() => { setToolbarOverflowOpen((o) => !o); setToolbarDropdown(null); }}
                  aria-expanded={toolbarOverflowOpen}
                  aria-label="더 보기"
                >
                  ⋯
                </button>
                {toolbarOverflowOpen && typeof document !== "undefined"
                  ? createPortal(
                      <>
                        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setToolbarOverflowOpen(false)} />
                        <div
                          className="fixed z-[9999] min-w-[180px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg text-xs"
                          style={{ left: toolbarOverflowRect.left, top: toolbarOverflowRect.top }}
                        >
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">도구</div>
                      <button type="button" className="flex w-full items-center justify-between px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50" onClick={() => { setTool("comment"); setToolbarOverflowOpen(false); }}>
                        코멘트
                        {comments.length > 0 ? <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] text-white" aria-label={`코멘트 ${comments.length}건`}>{comments.length}</span> : null}
                      </button>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50" onClick={() => { setTool("slice"); setToolbarOverflowOpen(false); }}>슬라이스</button>
                      <div className="my-1 h-px bg-neutral-200" />
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Boolean</div>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={selectedIds.length < 2} onClick={() => { runBooleanSelection("union"); setToolbarOverflowOpen(false); }}>도형 합치기 (Union)</button>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={selectedIds.length < 2} onClick={() => { runBooleanSelection("subtract"); setToolbarOverflowOpen(false); }}>도형 빼기 (Subtract)</button>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={selectedIds.length < 2} onClick={() => { runBooleanSelection("intersect"); setToolbarOverflowOpen(false); }}>도형 겹침 (Intersect)</button>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={selectedIds.length < 2} onClick={() => { runBooleanSelection("exclude"); setToolbarOverflowOpen(false); }}>도형 제외 (Exclude)</button>
                      <div className="my-1 h-px bg-neutral-200" />
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">마스크</div>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={selectedIds.length !== 1} onClick={() => { useMaskSelection(); setToolbarOverflowOpen(false); }}>마스크로 사용</button>
                      <button type="button" className="flex w-full px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={selectedIds.length !== 1 || !selectedNode?.isMask} onClick={() => { releaseMaskSelection(); setToolbarOverflowOpen(false); }}>마스크 해제</button>
                        </div>
                      </>,
                      document.body,
                    )
                : null}
              </div>
            </div>
          </div>

          <div className="flex min-w-max shrink-0 flex-nowrap items-center gap-2 overflow-x-auto py-1">
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => align("l")}>왼쪽 정렬</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => align("hc")}>가운데 정렬</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => align("r")}>오른쪽 정렬</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => matchSelectionSize("w")}>같은 너비</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => matchSelectionSize("h")}>같은 높이</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={snapSelectionToGrid}>스냅</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => flipSelection("h")}>가로 뒤집기</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => flipSelection("v")}>세로 뒤집기</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => distribute("h")}>가로 분배</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={() => distribute("v")}>세로 분배</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={clearSelection} disabled={!hasSelection}>선택 해제</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={invertSelection}>선택 반전</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={tidyUpSelection} disabled={selectedIds.length < 2}>정리</button>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs">
              <button type="button" className="px-2" onClick={fitSelectionToContent} disabled={!hasSelection}>내용 맞춤</button>
              <button type="button" className="px-2" onClick={toggleSelectionHidden} disabled={!hasSelection}>
                {selectionHidden ? "숨김 해제" : "숨김"}
              </button>
              <button type="button" className="px-2" onClick={toggleSelectionLocked} disabled={!hasSelection}>
                {selectionLocked ? "잠금 해제" : "잠금"}
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs">
              <button type="button" className="px-1" onClick={() => zoomBy(-0.1)}>-</button>
              <button type="button" className="px-2" onClick={zoomReset}>{zoomPercent}%</button>
              <button type="button" className="px-1" onClick={() => zoomBy(0.1)}>+</button>
              <button type="button" className="px-2" onClick={zoomToSelection}>선택 맞춤</button>
              <button type="button" className="px-2" onClick={zoomToContent}>콘텐츠 맞춤</button>
              <button type="button" className="px-2" onClick={zoomToPage}>페이지 맞춤</button>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs">
              <button type="button" className="px-2" onClick={() => setShowGrid((prev) => !prev)}>
                그리드 {showGrid ? "켜짐" : "꺼짐"}
              </button>
              <button type="button" className="px-2" onClick={() => setShowPixelGrid((prev) => !prev)}>
                픽셀 {showPixelGrid ? "켜짐" : "꺼짐"}
              </button>
              <button type="button" className="px-2" onClick={() => setOutlineMode((prev) => !prev)}>
                아웃라인 {outlineMode ? "켜짐" : "꺼짐"}
              </button>
              <button type="button" className="px-2" onClick={() => setShowRulers((prev) => !prev)}>
                룰러 {showRulers ? "켜짐" : "꺼짐"}
              </button>
              <button type="button" className="px-2" onClick={() => setUiHidden((prev) => !prev)}>
                UI {uiHidden ? "표시" : "숨김"}
              </button>
            </div>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={groupSelected}>그룹</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={ungroupSelected}>그룹 해제</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={sendToBack}>맨 뒤로</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={bringToFront}>맨 앞으로</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={sendBackward}>뒤로</button>
            <button type="button" className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-xs" onClick={bringForward}>앞으로</button>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                livePreview ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-200 bg-white text-neutral-600"
              }`}
              onClick={toggleLivePreview}
            >
              {livePreview ? "라이브 종료" : "라이브"}
            </button>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                prototypePreview ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-200 bg-white text-neutral-600"
              }`}
              onClick={togglePrototypePreview}
            >
              {prototypePreview ? "미리보기 종료" : "미리보기"}
            </button>
            <button
              type="button"
              className="rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white"
              onClick={saveDraft}
              disabled={status !== "idle"}
            >
              {status === "saving" ? "저장 중" : "저장"}
            </button>
            <button
              type="button"
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              onClick={() => pageId && setVersionListOpen(true)}
              disabled={!pageId}
              title="버전 히스토리"
              aria-label="버전 히스토리"
            >
              버전
            </button>
            <button type="button" className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-50" onClick={() => setShortcutHelpOpen(true)} title="단축키 도움말 (Ctrl+/)">?</button>
            <button
              type="button"
              className="rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white"
              onClick={publish}
              disabled={status !== "idle"}
            >
              {status === "publishing" ? "배포 중" : "배포"}
            </button>
          </div>
          </div>
        </header>

        {versionListOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="버전 히스토리" onClick={() => setVersionListOpen(false)}>
            <div className="max-h-[80vh] w-full max-w-md rounded-lg border border-neutral-200 bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h2 className="text-sm font-medium text-neutral-900">버전 히스토리</h2>
                <button type="button" className="rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={() => setVersionListOpen(false)} aria-label="닫기">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {versionListLoading ? (
                  <p className="text-xs text-neutral-500">불러오는 중...</p>
                ) : versionList.length === 0 ? (
                  <p className="text-xs text-neutral-500">저장된 버전이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {versionList.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded border border-neutral-100 bg-neutral-50/50 px-3 py-2 text-xs">
                        <span className="text-neutral-600">{new Date(v.created_at).toLocaleString("ko-KR")}</span>
                        <button
                          type="button"
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] hover:bg-neutral-100 disabled:opacity-50"
                          onClick={() => restoreVersion(v.id)}
                          disabled={versionRestoring !== null}
                        >
                          {versionRestoring === v.id ? "복구 중…" : "복구"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {shortcutHelpOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="단축키 도움말" onClick={() => setShortcutHelpOpen(false)}>
            <div className="max-h-[85vh] w-full max-w-sm rounded-lg border border-neutral-200 bg-white shadow-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h2 className="text-sm font-medium text-neutral-900">단축키</h2>
                <button type="button" className="rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={() => setShortcutHelpOpen(false)} aria-label="닫기">✕</button>
              </div>
              <div className="overflow-y-auto p-4 text-xs space-y-3">
                <div><span className="font-medium text-neutral-600">도구</span><ul className="mt-1 space-y-0.5 text-neutral-700"><li>V 선택</li><li>F 프레임</li><li>R 사각형</li><li>O 원</li><li>L 선</li><li>T 텍스트</li><li>P 펜</li><li>H 손</li></ul></div>
                <div><span className="font-medium text-neutral-600">편집</span><ul className="mt-1 space-y-0.5 text-neutral-700"><li>Ctrl+C 복사 / X 잘라내기 / V 붙여넣기</li><li>Del, Backspace 삭제</li><li>Ctrl+Z 실행 취소 / Shift+Z 다시 실행</li><li>Ctrl+G 그룹 / Shift+G 그룹 해제</li><li>Ctrl+A 전체 선택 / Shift+A 선택 해제</li></ul></div>
                <div><span className="font-medium text-neutral-600">줌</span><ul className="mt-1 space-y-0.5 text-neutral-700"><li>Ctrl+0 100% / 1 맞춤 / + - 확대·축소</li></ul></div>
                <div><span className="font-medium text-neutral-600">기타</span><ul className="mt-1 space-y-0.5 text-neutral-700"><li>Esc 취소·모달 닫기</li><li>? 또는 Ctrl+/ 이 도움말</li></ul></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {messageText ? <div className="shrink-0 border-b border-neutral-200 bg-amber-50 px-4 py-2 text-xs">{messageText}</div> : null}

        {pendingComment ? (
          <div
            className="fixed z-50 min-w-[280px] rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
            style={{ left: Math.min(pendingComment.screenX, typeof window !== "undefined" ? window.innerWidth - 300 : pendingComment.screenX), top: Math.min(pendingComment.screenY + 12, typeof window !== "undefined" ? window.innerHeight - 180 : pendingComment.screenY + 12) }}
          >
            <div className="mb-2 text-xs font-medium text-neutral-600">새 코멘트</div>
            <textarea
              value={pendingCommentContent}
              onChange={(e) => setPendingCommentContent(e.target.value)}
              placeholder="내용을 입력하세요"
              className="mb-2 w-full resize-none rounded border border-neutral-200 px-2 py-1.5 text-sm"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-neutral-200 px-2 py-1 text-xs"
                onClick={() => {
                  setPendingComment(null);
                  setPendingCommentContent("");
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                onClick={submitPendingComment}
                disabled={commentSubmitting || !pendingCommentContent.trim()}
              >
                {commentSubmitting ? "추가 중…" : "추가"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          <section className="relative min-w-0 flex-1 bg-neutral-100">
            <div ref={canvasRef} className="absolute inset-0" onWheel={prototypePreview ? undefined : handleWheel}>
              {!prototypePreview && showRulers ? (
                <>
                  <div className="pointer-events-none absolute left-0 top-0 right-0 z-10 h-6 border-b border-neutral-200 bg-white/90 text-[10px] text-neutral-500">
                    <div className="absolute left-0 top-0 h-6 w-6 border-r border-neutral-200 bg-white/90" />
                    {rulerTicks.x.map((tick) => (
                      <div key={`x-${tick.value}`} className="absolute top-0 h-full" style={{ left: tick.pos }}>
                        <div className="h-2 w-px bg-neutral-300" />
                        <div className="translate-x-1">{tick.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-6 border-r border-neutral-200 bg-white/90 text-[10px] text-neutral-500">
                    {rulerTicks.y.map((tick) => (
                      <div key={`y-${tick.value}`} className="absolute left-0 w-full" style={{ top: tick.pos }}>
                        <div className="ml-4 h-px w-2 bg-neutral-300" />
                        <div className="ml-1 -translate-y-1">{tick.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {!prototypePreview && textEditingId && textEditingRect ? (
                <div
                  className="absolute z-20"
                  style={{
                    left: textEditingRect.x,
                    top: textEditingRect.y,
                    width: textEditingRect.w,
                    height: textEditingRect.h,
                  }}
                >
                  <textarea
                    ref={textEditingRef}
                    value={textEditingValue}
                    onChange={(e) => setTextEditingValue(e.target.value)}
                    onBlur={commitTextEditing}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setTextEditingId(null);
                        return;
                      }
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        commitTextEditing();
                      }
                    }}
                    className="h-full w-full resize-none rounded-md border border-blue-400 bg-white/90 p-1 text-xs shadow"
                    style={{
                      color: editingFill,
                      fontFamily: editingTextStyle?.fontFamily ?? DEFAULT_FONT_FAMILY,
                      fontSize: editingTextStyle?.fontSize ?? 16,
                      fontWeight: editingTextStyle?.fontWeight ?? 500,
                      lineHeight: String(editingTextStyle?.lineHeight ?? 1.4),
                      letterSpacing: editingTextStyle?.letterSpacing ?? 0,
                      textAlign: editingTextStyle?.align ?? "left",
                    }}
                  />
                </div>
              ) : null}
              {prototypePreview ? (
                <div
                  ref={previewContainerRef}
                  className="absolute inset-0 flex items-start justify-start overflow-auto bg-neutral-100 p-6"
                >
                  <div
                    style={{
                      width: previewDims.width * effectivePreviewScale,
                      height: previewDims.height * effectivePreviewScale,
                    }}
                  >
                    <div
                      style={{
                        width: previewDims.width,
                        height: previewDims.height,
                        transform: `scale(${effectivePreviewScale})`,
                        transformOrigin: "top left",
                      }}
                      className="rounded-2xl border border-neutral-200 bg-white shadow-sm"
                    >
                      <AdvancedRuntimePlayer
                        doc={doc}
                        initialPageId={activePreviewPageId ?? undefined}
                        onPageChange={onPreviewPageChange}
                        className="relative h-full w-full"
                        fitToContent
                        previewMode
                      />
                    </div>
                  </div>
                </div>
              ) : livePreview ? (
                <div
                  ref={previewContainerRef}
                  className="absolute inset-0 flex items-start justify-start overflow-auto bg-neutral-100 p-6"
                >
                  <div
                    style={{
                      width: previewDims.width * effectivePreviewScale,
                      height: previewDims.height * effectivePreviewScale,
                    }}
                  >
                    <div
                      style={{
                        width: previewDims.width,
                        height: previewDims.height,
                        transform: `scale(${effectivePreviewScale})`,
                        transformOrigin: "top left",
                      }}
                      className="rounded-2xl border border-emerald-200 bg-white shadow-sm"
                    >
                      <AdvancedRuntimePlayer
                        doc={doc}
                        initialPageId={livePageId ?? activePreviewPageId ?? undefined}
                        onPageChange={onLivePageChange}
                        className="relative h-full w-full"
                        fitToContent
                        previewMode
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  viewBox={viewBox}
                  className="h-full w-full"
                  onPointerDown={handleCanvasPointerDown}
                  onDoubleClick={(e) => {
                    if (pathEditState && tool === "path") {
                      e.preventDefault();
                      e.stopPropagation();
                      commitPathEdit(false);
                    }
                  }}
                  onContextMenu={(e) => openContextMenu(e)}
                  onPointerMove={(e) => {
                    updateDrag(e);
                    if (marquee) updateMarquee(e);
                  }}
                  onPointerUp={(e) => {
                    endDrag(e);
                    if (marquee) endMarquee(e);
                  }}
                  onPointerLeave={(e) => {
                    endDrag(e);
                    if (marquee) endMarquee(e);
                  }}
                  onPointerCancel={(e) => {
                    endDrag(e);
                    if (marquee) endMarquee(e);
                  }}
                >
                <defs>
                  <pattern id="adv-grid" width={showPixelGrid ? 1 : GRID} height={showPixelGrid ? 1 : GRID} patternUnits="userSpaceOnUse">
                    <path d={`M ${showPixelGrid ? 1 : GRID} 0 L 0 0 0 ${showPixelGrid ? 1 : GRID}`} fill="none" stroke="#E5E7EB" strokeWidth={showPixelGrid ? 0.25 : 0.5} />
                  </pattern>
                  <marker id="adv-editor-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#111111" />
                  </marker>
                  {effectDefs}
                </defs>
                <g data-layer="grid" style={{ willChange: "transform" }}>
                  {showGrid ? <rect x={-10000} y={-10000} width={20000} height={20000} fill="url(#adv-grid)" /> : null}
                </g>

                <g data-layer="nodes" style={{ willChange: "transform" }}>
                  {visibleNodeIds.map((id) => {
                    const node = doc.nodes[id];
                    if (!node || node.hidden) return null;
                    const abs = getAbsoluteFrame(doc, id);
                    if (!abs) return null;
                    const drag = dragRef.current;
                    const isDragging = Boolean(drag?.mode === "move" && drag.ids.includes(id) && dragDelta);
                    const displayX = isDragging && dragDelta ? abs.x + dragDelta.dx : abs.x;
                    const displayY = isDragging && dragDelta ? abs.y + dragDelta.dy : abs.y;
                    const isSelected = doc.selection.has(id);
                    const useLod = doc.view.zoom <= 0.5;
                    const blendMode = node.style.blendMode && node.style.blendMode !== "normal" ? node.style.blendMode : undefined;
                    const nodeEffects = resolveEffects(doc, node);
                    const effectId = nodeEffects.length ? getEffectFilterId("adv-effect", node.id) : undefined;

                    return (
                      <CanvasNode
                        key={id}
                        id={id}
                        doc={doc}
                        node={node}
                        displayX={displayX}
                        displayY={displayY}
                        isSelected={isSelected}
                        useLod={useLod}
                        outlineMode={outlineMode}
                        effectId={effectId}
                        blendMode={blendMode}
                        onContextMenu={openContextMenu}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, id, node.type)}
                      />
                    );
                  })}
                </g>

                <g data-layer="guides" pointerEvents="none" style={{ willChange: "transform" }}>
                  {(doc.view.guides?.x ?? []).map((gx, i) => {
                    const viewW = canvasSize.width / doc.view.zoom;
                    const viewH = canvasSize.height / doc.view.zoom;
                    return (
                      <line
                        key={`v-${i}`}
                        x1={gx}
                        y1={doc.view.panY - 500}
                        x2={gx}
                        y2={doc.view.panY + viewH + 500}
                        stroke="#0EA5E9"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                    );
                  })}
                  {(doc.view.guides?.y ?? []).map((gy, i) => {
                    const viewW = canvasSize.width / doc.view.zoom;
                    const viewH = canvasSize.height / doc.view.zoom;
                    return (
                      <line
                        key={`h-${i}`}
                        x1={doc.view.panX - 500}
                        y1={gy}
                        x2={doc.view.panX + viewW + 500}
                        y2={gy}
                        stroke="#0EA5E9"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                    );
                  })}
                </g>
                <g data-layer="overlay" style={{ willChange: "transform" }}>
                {marquee ? (
                  <rect
                    x={marquee.x}
                    y={marquee.y}
                    width={marquee.w}
                    height={marquee.h}
                    fill="rgba(37,99,235,0.1)"
                    stroke="#2563EB"
                    strokeDasharray="4 2"
                  />
                ) : null}

                {pathEditState ? (
                  <g pointerEvents="none">
                    <path
                      d={anchorsToPathData(pathEditState.anchors, pathEditState.closed)}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth={2}
                    />
                    {pathEditState.anchors.map((a, i) => (
                      <g key={i}>
                        {a.handle1X != null && a.handle1Y != null ? (
                          <>
                            <line x1={a.x} y1={a.y} x2={a.handle1X} y2={a.handle1Y} stroke="#94A3B8" strokeWidth={1} />
                            <circle cx={a.handle1X} cy={a.handle1Y} r={4} fill="#64748B" />
                          </>
                        ) : null}
                        {a.handle2X != null && a.handle2Y != null ? (
                          <>
                            <line x1={a.x} y1={a.y} x2={a.handle2X} y2={a.handle2Y} stroke="#94A3B8" strokeWidth={1} />
                            <circle cx={a.handle2X} cy={a.handle2Y} r={4} fill="#64748B" />
                          </>
                        ) : null}
                        <circle cx={a.x} cy={a.y} r={i === 0 && pathEditState.anchors.length >= 2 && !pathEditState.closed ? 6 : 5} fill="#2563EB" stroke="#fff" strokeWidth={1.5} />
                      </g>
                    ))}
                  </g>
                ) : null}

                {comments.length > 0
                  ? comments.map((c) => (
                      <g
                        key={c.id}
                        data-comment-pin
                        style={{ cursor: "pointer" }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          ev.preventDefault();
                          setSelectedCommentId(c.id);
                        }}
                      >
                        <path
                          d={`M ${c.x} ${c.y - 12} L ${c.x - 6} ${c.y + 4} L ${c.x} ${c.y} L ${c.x + 6} ${c.y + 4} Z`}
                          fill={c.resolved ? "#94A3B8" : "#2563EB"}
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                        {!c.resolved && c.replies.length > 0 ? (
                          <circle cx={c.x + 8} cy={c.y - 10} r={6} fill="#EF4444" stroke="#fff" strokeWidth={1} />
                        ) : null}
                      </g>
                    ))
                  : null}

                {showLayoutGrid
                  ? visibleNodeIds.map((id) => {
                      const node = doc.nodes[id];
                      if (!node?.layoutGrid?.length || !["frame", "section", "component"].includes(node.type)) return null;
                      const abs = getAbsoluteFrame(doc, id);
                      if (!abs) return null;
                      const drag = dragRef.current;
                      const isDragging = Boolean(drag?.mode === "move" && drag.ids.includes(id) && dragDelta);
                      const displayX = isDragging && dragDelta ? abs.x + dragDelta.dx : abs.x;
                      const displayY = isDragging && dragDelta ? abs.y + dragDelta.dy : abs.y;
                      return (
                        <g key={`layout-grid-${id}`} transform={`translate(${displayX} ${displayY})`} pointerEvents="none">
                          {renderLayoutGridLines(node.layoutGrid!, node.frame.w, node.frame.h)}
                        </g>
                      );
                    })
                  : null}

                {panelMode === "dev" && devMeasure && selectedAbs && parentAbs
                  ? (() => {
                      const left = Math.round(selectedAbs.x - parentAbs.x);
                      const right = Math.round(parentAbs.x + parentAbs.w - (selectedAbs.x + selectedAbs.w));
                      const top = Math.round(selectedAbs.y - parentAbs.y);
                      const bottom = Math.round(parentAbs.y + parentAbs.h - (selectedAbs.y + selectedAbs.h));
                      const midX = selectedAbs.x + selectedAbs.w / 2;
                      const midY = selectedAbs.y + selectedAbs.h / 2;
                      const labelColor = "#F97316";
                      return (
                        <g pointerEvents="none">
                          <line x1={parentAbs.x} y1={midY} x2={selectedAbs.x} y2={midY} stroke={labelColor} strokeWidth={1} />
                          <line
                            x1={selectedAbs.x + selectedAbs.w}
                            y1={midY}
                            x2={parentAbs.x + parentAbs.w}
                            y2={midY}
                            stroke={labelColor}
                            strokeWidth={1}
                          />
                          <line x1={midX} y1={parentAbs.y} x2={midX} y2={selectedAbs.y} stroke={labelColor} strokeWidth={1} />
                          <line
                            x1={midX}
                            y1={selectedAbs.y + selectedAbs.h}
                            x2={midX}
                            y2={parentAbs.y + parentAbs.h}
                            stroke={labelColor}
                            strokeWidth={1}
                          />
                          <text x={(parentAbs.x + selectedAbs.x) / 2} y={midY - 4} fill={labelColor} fontSize={10} textAnchor="middle">
                            {left}px
                          </text>
                          <text
                            x={(selectedAbs.x + selectedAbs.w + parentAbs.x + parentAbs.w) / 2}
                            y={midY - 4}
                            fill={labelColor}
                            fontSize={10}
                            textAnchor="middle"
                          >
                            {right}px
                          </text>
                          <text x={midX + 4} y={(parentAbs.y + selectedAbs.y) / 2} fill={labelColor} fontSize={10}>
                            {top}px
                          </text>
                          <text x={midX + 4} y={(selectedAbs.y + selectedAbs.h + parentAbs.y + parentAbs.h) / 2} fill={labelColor} fontSize={10}>
                            {bottom}px
                          </text>
                          <text x={selectedAbs.x} y={selectedAbs.y - 6} fill={labelColor} fontSize={10}>
                            {Math.round(selectedAbs.w)}x{Math.round(selectedAbs.h)}
                          </text>
                        </g>
                      );
                    })()
                  : null}
                {panelMode === "dev" && devGuides && selectedAbs && parentAbs && selectedNode
                  ? (() => {
                      const parent = selectedNode.parentId ? doc.nodes[selectedNode.parentId] : null;
                      if (!parent) return null;
                      const siblings = parent.children
                        .filter((id) => id !== selectedNode.id)
                        .map((id) => ({ id, frame: getAbsoluteFrame(doc, id) }))
                        .filter((item): item is { id: string; frame: Rect } => Boolean(item.frame));
                      if (!siblings.length) return null;
                      const left = siblings.reduce<Rect | null>((acc, item) => {
                        if (item.frame.x + item.frame.w > selectedAbs.x) return acc;
                        if (!acc || item.frame.x + item.frame.w > acc.x + acc.w) return item.frame;
                        return acc;
                      }, null);
                      const right = siblings.reduce<Rect | null>((acc, item) => {
                        if (item.frame.x < selectedAbs.x + selectedAbs.w) return acc;
                        if (!acc || item.frame.x < acc.x) return item.frame;
                        return acc;
                      }, null);
                      const top = siblings.reduce<Rect | null>((acc, item) => {
                        if (item.frame.y + item.frame.h > selectedAbs.y) return acc;
                        if (!acc || item.frame.y + item.frame.h > acc.y + acc.h) return item.frame;
                        return acc;
                      }, null);
                      const bottom = siblings.reduce<Rect | null>((acc, item) => {
                        if (item.frame.y < selectedAbs.y + selectedAbs.h) return acc;
                        if (!acc || item.frame.y < acc.y) return item.frame;
                        return acc;
                      }, null);
                      const midX = selectedAbs.x + selectedAbs.w / 2;
                      const midY = selectedAbs.y + selectedAbs.h / 2;
                      const labelColor = "#0EA5E9";
                      const guides: React.ReactElement[] = [];
                      const addGapLine = (x1: number, y1: number, x2: number, y2: number, label: string) => {
                        guides.push(<line key={`line-${label}-${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={labelColor} strokeWidth={1} />);
                        guides.push(
                          <text key={`text-${label}-${x1}-${y1}`} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fill={labelColor} fontSize={10} textAnchor="middle">
                            {label}
                          </text>,
                        );
                      };
                      if (left) {
                        const gap = Math.round(selectedAbs.x - (left.x + left.w));
                        addGapLine(left.x + left.w, midY, selectedAbs.x, midY, `${gap}px`);
                      }
                      if (right) {
                        const gap = Math.round(right.x - (selectedAbs.x + selectedAbs.w));
                        addGapLine(selectedAbs.x + selectedAbs.w, midY, right.x, midY, `${gap}px`);
                      }
                      if (top) {
                        const gap = Math.round(selectedAbs.y - (top.y + top.h));
                        addGapLine(midX, top.y + top.h, midX, selectedAbs.y, `${gap}px`);
                      }
                      if (bottom) {
                        const gap = Math.round(bottom.y - (selectedAbs.y + selectedAbs.h));
                        addGapLine(midX, selectedAbs.y + selectedAbs.h, midX, bottom.y, `${gap}px`);
                      }
                      const parentCenterX = parentAbs.x + parentAbs.w / 2;
                      const parentCenterY = parentAbs.y + parentAbs.h / 2;
                      if (Math.abs(parentCenterX - midX) <= 1) {
                        guides.push(
                          <line key="center-x" x1={parentCenterX} y1={parentAbs.y} x2={parentCenterX} y2={parentAbs.y + parentAbs.h} stroke={labelColor} strokeDasharray="4 4" />,
                        );
                      }
                      if (Math.abs(parentCenterY - midY) <= 1) {
                        guides.push(
                          <line key="center-y" x1={parentAbs.x} y1={parentCenterY} x2={parentAbs.x + parentAbs.w} y2={parentCenterY} stroke={labelColor} strokeDasharray="4 4" />,
                        );
                      }
                      return <g pointerEvents="none">{guides}</g>;
                    })()
                  : null}
                {panelMode === "dev" && devSpecOverlay && selectedAbs && devSpecLines.length
                  ? (() => {
                      const lineHeight = 12;
                      const padding = 6;
                      const height = devSpecLines.length * lineHeight + padding * 2;
                      const width = Math.max(...devSpecLines.map((line) => line.length), 12) * 6 + padding * 2;
                      let x = selectedAbs.x;
                      let y = selectedAbs.y - height - 8;
                      const minY = parentAbs?.y ?? 0;
                      if (y < minY) y = selectedAbs.y + selectedAbs.h + 8;
                      return (
                        <g pointerEvents="none">
                          <rect x={x} y={y} width={width} height={height} fill="white" stroke="#F97316" strokeWidth={1} rx={6} />
                          {devSpecLines.map((line, index) => (
                            <text key={line} x={x + padding} y={y + padding + lineHeight * (index + 1) - 2} fill="#F97316" fontSize={10}>
                              {line}
                            </text>
                          ))}
                        </g>
                      );
                    })()
                  : null}
                </g>
              </svg>
              )}
            </div>
            {!prototypePreview && contextMenu ? (
              <div className="absolute z-20 flex" style={{ left: contextMenu.x, top: contextMenu.y }}>
                <div className="min-w-[190px] rounded-md border border-neutral-200 bg-white py-1 text-xs shadow-lg">
                  {contextPrimaryItems.map((item) => {
                    if ("divider" in item) {
                      return <div key={item.id} className="my-1 h-px bg-neutral-200" />;
                    }
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={item.disabled}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                          item.disabled ? "cursor-not-allowed text-neutral-300" : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                        onClick={() => {
                          if (item.disabled) return;
                          runAndCloseContext(item.onClick);
                        }}
                      >
                        <span>{item.label}</span>
                        {item.hint ? <span className="text-[10px] text-neutral-400">{item.hint}</span> : null}
                      </button>
                    );
                  })}
                  <div className="my-1 h-px bg-neutral-200" />
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-100 ${contextMenuSubMenu === "more" ? "bg-neutral-50" : ""}`}
                    onClick={() => setContextMenuSubMenu((s) => (s === "more" ? null : "more"))}
                  >
                    <span>더 보기</span>
                    <span className="text-neutral-400" aria-hidden>▶</span>
                  </button>
                </div>
                {contextMenuSubMenu === "more" ? (
                  <div className="ml-0.5 min-w-[200px] max-h-[70vh] overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 text-xs shadow-lg">
                    {contextMoreItems.map((item) => {
                      if ("divider" in item) {
                        return <div key={item.id} className="my-1 h-px bg-neutral-200" />;
                      }
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={item.disabled}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${
                            item.disabled ? "cursor-not-allowed text-neutral-300" : "text-neutral-700 hover:bg-neutral-100"
                          }`}
                          onClick={() => {
                            if (item.disabled) return;
                            runAndCloseContext(item.onClick);
                          }}
                        >
                          <span>{item.label}</span>
                          {item.hint ? <span className="text-[10px] text-neutral-400">{item.hint}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {!uiHidden ? (
          <aside className="flex h-full w-80 shrink-0 min-h-0 flex-col overflow-hidden border-l border-neutral-200 bg-neutral-50/80 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {([
                { id: "design", label: "디자인" },
                { id: "prototype", label: "프로토타입" },
                { id: "dev", label: "개발" },
                { id: "export", label: "내보내기" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-[10px] ${
                    panelMode === tab.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-500"
                  }`}
                  onClick={() => setPanelMode(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {selectedCommentId ? (() => {
              const root = comments.find((c) => c.id === selectedCommentId) ?? comments.find((c) => c.replies.some((r) => r.id === selectedCommentId));
              if (!root || !pageId) return null;
              const resolveComment = () => {
                fetch(`/api/pages/${pageId}/comments/${root.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ resolved: true }),
                })
                  .then((res) => res.ok ? res.json() : null)
                  .then(() => { fetchComments(); setSelectedCommentId(null); });
              };
              const addReply = () => {
                if (!commentReplyDraft.trim()) return;
                setCommentSubmitting(true);
                fetch(`/api/pages/${pageId}/comments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    x: root.x,
                    y: root.y,
                    nodeId: root.nodeId,
                    content: commentReplyDraft.trim(),
                    parentId: root.id,
                  }),
                })
                  .then((res) => res.ok ? res.json() : null)
                  .then(() => { fetchComments(); setCommentReplyDraft(""); })
                  .finally(() => setCommentSubmitting(false));
              };
              return (
                <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">코멘트</span>
                    <button type="button" className="rounded border border-neutral-200 px-2 py-0.5 text-[10px]" onClick={() => setSelectedCommentId(null)}>닫기</button>
                  </div>
                  <div className="mt-2 text-sm text-neutral-800">{root.content}</div>
                  <div className="mt-1 text-[10px] text-neutral-500">{root.author} · {new Date(root.createdAt).toLocaleString()}</div>
                  {root.replies.length > 0 ? (
                    <div className="mt-2 space-y-1.5 border-t border-neutral-200 pt-2">
                      {root.replies.map((r) => (
                        <div key={r.id} className="rounded border border-neutral-100 bg-white px-2 py-1.5 text-xs">
                          <div className="text-neutral-800">{r.content}</div>
                          <div className="text-[10px] text-neutral-500">{r.author} · {new Date(r.createdAt).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!root.resolved ? (
                    <>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className="rounded bg-emerald-600 px-2 py-1 text-[10px] text-white" onClick={resolveComment}>해결</button>
                      </div>
                      <div className="mt-2">
                        <textarea
                          value={commentReplyDraft}
                          onChange={(e) => setCommentReplyDraft(e.target.value)}
                          placeholder="답글 입력..."
                          className="w-full resize-none rounded border border-neutral-200 px-2 py-1.5 text-xs"
                          rows={2}
                        />
                        <button type="button" className="mt-1 rounded bg-blue-600 px-2 py-1 text-[10px] text-white disabled:opacity-50" onClick={addReply} disabled={commentSubmitting || !commentReplyDraft.trim()}>
                          {commentSubmitting ? "전송 중…" : "답글"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-[10px] text-neutral-500">해결됨</div>
                  )}
                </div>
              );
            })() : null}
            {panelMode === "design" ? (
              <div className="space-y-4 text-xs">
              {<DesignPanelInner />}
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">컴포넌트</div>
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                    onClick={createComponentFromSelection}
                    disabled={!hasSelection}
                  >
                    선택 항목을 컴포넌트로 만들기
                  </button>
                  {selectedIsComponent ? (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">변형 (Variants)</div>
                      {(selectedNode.variants ?? []).length > 0 ? (
                        <ul className="space-y-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px]">
                          {selectedNode.variants?.map((v) => (
                            <li key={v.id} className="flex items-center justify-between gap-2">
                              <span>{v.name}</span>
                              <span className="text-neutral-400">{doc.nodes[v.rootId]?.name ?? v.rootId.slice(0, 8)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => addComponentVariant(selectedNode.id)}
                      >
                        변형 추가
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => createInstanceFromComponent(selectedNode.id, selectedNode.variants?.[0]?.id)}
                      >
                        인스턴스 만들기
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => syncInstancesForComponent(selectedNode.id)}
                      >
                        인스턴스 동기화
                      </button>
                    </div>
                  ) : null}
                  {selectedIsInstance ? (
                    <div className="space-y-2">
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500">
                        원본: {instanceSource?.name ?? "알 수 없음"}
                      </div>
                      {instanceSource?.variants?.length ? (
                        <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                          <span>변형</span>
                          <select
                            value={selectedNode.variantId ?? instanceSource.variants[0]?.id ?? ""}
                            onChange={(e) => setInstanceVariant(selectedNode.id, e.target.value)}
                            className="w-28 rounded border border-neutral-200 px-2 py-1 text-[11px]"
                          >
                            {instanceSource.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {componentNodes.length ? (
                        <div className="space-y-2">
                          <label className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                            <span>컴포넌트 교체</span>
                            <select
                              value={swapComponentId}
                              onChange={(e) => setSwapComponentId(e.target.value)}
                              className="w-28 rounded border border-neutral-200 px-2 py-1 text-[11px]"
                            >
                              {componentNodes.map((component) => (
                                <option key={component.id} value={component.id}>
                                  {component.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                            onClick={() => swapInstanceComponent(selectedNode.id, swapComponentId)}
                            disabled={!swapComponentId || swapComponentId === selectedNode.instanceOf}
                          >
                            인스턴스 스왑
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-400">스왑할 컴포넌트가 없습니다.</div>
                      )}
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => pushInstanceOverridesToComponent(selectedNode.id)}
                      >
                        메인에 반영 (Push overrides)
                      </button>
                      {instanceTextOverrides.length ? (
                        <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">텍스트 오버라이드</div>
                          {instanceTextOverrides.map((item) => (
                            <div key={item.id} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                <span>{item.label}</span>
                                {item.sourceName ? <span className="text-[10px] text-neutral-400">{item.sourceName}</span> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={item.value}
                                  onChange={(e) => {
                                    const node = doc.nodes[item.id];
                                    if (!node || node.type !== "text") return;
                                    updateNode(node.id, { text: { ...(node.text ?? { value: "", style: DEFAULT_TEXT_STYLE }), value: e.target.value } as NodeText }, true);
                                  }}
                                  className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  className="rounded border border-neutral-200 px-2 py-1 text-[10px]"
                                  onClick={() => resetInstanceNodeToMaster(item.id)}
                                >
                                  리셋
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {instanceImageOverrides.length ? (
                        <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">미디어 오버라이드</div>
                          {instanceImageOverrides.map((item) => (
                            <div key={item.id} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                <span>{item.label}</span>
                                {item.sourceName ? <span className="text-[10px] text-neutral-400">{item.sourceName}</span> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={item.src}
                                  onChange={(e) => {
                                    const node = doc.nodes[item.id];
                                    if (!node) return;
                                    if (node.type === "image") {
                                      updateNode(node.id, { image: { ...node.image, src: e.target.value, fit: node.image?.fit ?? "cover" } }, true);
                                    } else if (node.type === "video") {
                                      updateNode(node.id, { video: { ...node.video, src: e.target.value, fit: node.video?.fit ?? "cover" } }, true);
                                    }
                                  }}
                                  className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  className="rounded border border-neutral-200 px-2 py-1 text-[10px]"
                                  onClick={() => resetInstanceNodeToMaster(item.id)}
                                >
                                  리셋
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => {
                          if (!selectedNode.instanceOf) return;
                          syncInstancesForComponent(selectedNode.instanceOf, { instanceId: selectedNode.id });
                        }}
                      >
                        이 인스턴스만 동기화
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => {
                          if (!selectedNode.instanceOf) return;
                          syncInstancesForComponent(selectedNode.instanceOf, { preserveOverrides: false, instanceId: selectedNode.id });
                        }}
                      >
                        오버라이드 초기화
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => detachInstance(selectedNode.id)}
                      >
                        인스턴스 분리
                      </button>
                    </div>
                  ) : null}
                  {componentNodes.length ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">라이브러리</div>
                      <div className="mt-2 space-y-1">
                        {componentNodes.map((component) => (
                          <div key={component.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1">
                            <span className="text-xs text-neutral-600">{component.name}</span>
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() => createInstanceFromComponent(component.id)}
                            >
                              삽입
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">스타일 라이브러리</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      placeholder="스타일 이름"
                      className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                      onClick={() => selectedNode && addStyleToken("fill", resolveFill(doc, selectedNode))}
                      disabled={!selectedNode}
                    >
                      채우기 등록
                    </button>
                    <button
                      type="button"
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                      onClick={() => selectedNode && addStyleToken("stroke", resolveStrokes(doc, selectedNode))}
                      disabled={!selectedNode}
                    >
                      테두리 등록
                    </button>
                    <button
                      type="button"
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                      onClick={() => selectedNode?.type === "text" && addStyleToken("text", resolveTextStyle(doc, selectedNode) ?? selectedNode.text?.style)}
                      disabled={selectedNode?.type !== "text"}
                    >
                      텍스트 등록
                    </button>
                    <button
                      type="button"
                      className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                      onClick={() => selectedNode && addStyleToken("effect", resolveEffects(doc, selectedNode))}
                      disabled={!selectedNode}
                    >
                      효과 등록
                    </button>
                  </div>

                  {fillStyles.length ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">채우기 스타일</div>
                      <div className="mt-2 space-y-1">
                        {fillStyles.map((style) => {
                          const fills = Array.isArray(style.value) ? (style.value as Fill[]) : [];
                          const firstSolid = fills.find((f): f is { type: "solid"; color: string } => f?.type === "solid");
                          const swatchBg = firstSolid?.color ?? "#E5E5E5";
                          return (
                          <div key={style.id} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1">
                            <span className="h-5 w-5 shrink-0 rounded border border-neutral-200" style={{ background: swatchBg }} title="미리보기" />
                            <input
                              type="text"
                              value={style.name}
                              onChange={(e) => updateStyleToken(style.id, { name: e.target.value })}
                              className="w-full bg-transparent text-xs"
                            />
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() =>
                                selectedNode &&
                                updateNode(
                                  selectedNode.id,
                                  {
                                    style: {
                                      ...selectedNode.style,
                                      fills: Array.isArray(style.value) ? (style.value as Fill[]) : selectedNode.style.fills,
                                      fillStyleId: style.id,
                                      fillRef: undefined,
                                    },
                                  },
                                  true,
                                )
                              }
                              disabled={!selectedNode}
                            >
                              적용
                            </button>
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() => removeStyleToken(style.id)}
                            >
                              삭제
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {strokeStyles.length ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">테두리 스타일</div>
                      <div className="mt-2 space-y-1">
                        {strokeStyles.map((style) => (
                          <div key={style.id} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1">
                            <input
                              type="text"
                              value={style.name}
                              onChange={(e) => updateStyleToken(style.id, { name: e.target.value })}
                              className="w-full bg-transparent text-xs"
                            />
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() =>
                                selectedNode &&
                                updateNode(
                                  selectedNode.id,
                                  {
                                    style: {
                                      ...selectedNode.style,
                                      strokes: Array.isArray(style.value) ? (style.value as Stroke[]) : selectedNode.style.strokes,
                                      strokeStyleId: style.id,
                                    },
                                  },
                                  true,
                                )
                              }
                              disabled={!selectedNode}
                            >
                              적용
                            </button>
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() => removeStyleToken(style.id)}
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {effectStyles.length ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">효과 스타일</div>
                      <div className="mt-2 space-y-1">
                        {effectStyles.map((style) => (
                          <div key={style.id} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1">
                            <input
                              type="text"
                              value={style.name}
                              onChange={(e) => updateStyleToken(style.id, { name: e.target.value })}
                              className="w-full bg-transparent text-xs"
                            />
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() =>
                                selectedNode &&
                                updateNode(
                                  selectedNode.id,
                                  {
                                    style: {
                                      ...selectedNode.style,
                                      effects: Array.isArray(style.value) ? (style.value as Effect[]) : selectedNode.style.effects,
                                      effectStyleId: style.id,
                                    },
                                  },
                                  true,
                                )
                              }
                              disabled={!selectedNode}
                            >
                              적용
                            </button>
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() => removeStyleToken(style.id)}
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {textStyles.length ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">텍스트 스타일</div>
                      <div className="mt-2 space-y-1">
                        {textStyles.map((style) => (
                          <div key={style.id} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1">
                            <input
                              type="text"
                              value={style.name}
                              onChange={(e) => updateStyleToken(style.id, { name: e.target.value })}
                              className="w-full bg-transparent text-xs"
                            />
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() =>
                                selectedNode?.type === "text" &&
                                updateNode(
                                  selectedNode.id,
                                  {
                                    text: {
                                      ...selectedNode.text,
                                      value: selectedNode.text?.value ?? "",
                                      style: (style.value as TextStyle) ?? selectedNode.text?.style ?? DEFAULT_TEXT_STYLE,
                                      styleRef: style.id,
                                    } as NodeText,
                                  },
                                  true,
                                )
                              }
                              disabled={selectedNode?.type !== "text"}
                            >
                              적용
                            </button>
                            <button
                              type="button"
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                              onClick={() => removeStyleToken(style.id)}
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border border-neutral-100 bg-neutral-50/50 overflow-hidden">
                  <button type="button" className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 hover:bg-neutral-100" onClick={() => setRightPanelSections((s) => ({ ...s, variables: !s.variables }))}>
                    <span>변수</span>
                    <span className={`shrink-0 transition-transform ${rightPanelSections.variables ? "rotate-180" : ""}`} aria-hidden>▾</span>
                  </button>
                  {rightPanelSections.variables ? (
                <div className="px-2 pb-2">
                <div className="mt-2 space-y-2">
                  <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">모드</div>
                    <div className="flex items-center gap-2">
                      <select
                        value={activeVariableMode}
                        onChange={(e) => setActiveVariableMode(e.target.value)}
                        className="rounded border border-neutral-200 px-2 py-1 text-xs"
                      >
                        {variableModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newVariableModeName}
                        onChange={(e) => setNewVariableModeName(e.target.value)}
                        placeholder="새 모드"
                        className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        className="rounded border border-neutral-200 px-2 py-1 text-xs"
                        onClick={addVariableMode}
                      >
                        추가
                      </button>
                    </div>
                    <div className="space-y-1">
                      {variableModes.map((mode) => (
                        <div key={mode} className="flex items-center gap-2">
                          <input
                            type="text"
                            defaultValue={mode}
                            onBlur={(e) => renameVariableMode(mode, e.target.value)}
                            className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                            onClick={() => removeVariableMode(mode)}
                            disabled={variableModes.length <= 1}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border border-neutral-200 bg-white p-2">
                    <input
                      type="text"
                      value={newVariableName}
                      onChange={(e) => setNewVariableName(e.target.value)}
                      placeholder="변수 이름"
                      className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newVariableType}
                        onChange={(e) => setNewVariableType(e.target.value as VariableType)}
                        className="rounded border border-neutral-200 px-2 py-1 text-xs"
                      >
                        <option value="color">색상</option>
                        <option value="number">숫자</option>
                        <option value="string">문자</option>
                        <option value="boolean">불리언</option>
                      </select>
                      {newVariableType === "color" ? (
                        <input
                          type="color"
                          value={newVariableValue}
                          onChange={(e) => setNewVariableValue(e.target.value)}
                          className="h-8 w-14 rounded border border-neutral-200"
                        />
                      ) : null}
                      {newVariableType === "number" ? (
                        <input
                          type="number"
                          value={newVariableValue}
                          onChange={(e) => setNewVariableValue(e.target.value)}
                          className="w-24 rounded border border-neutral-200 px-2 py-1 text-xs"
                        />
                      ) : null}
                      {newVariableType === "string" ? (
                        <input
                          type="text"
                          value={newVariableValue}
                          onChange={(e) => setNewVariableValue(e.target.value)}
                          className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
                        />
                      ) : null}
                      {newVariableType === "boolean" ? (
                        <label className="flex items-center gap-2 text-xs text-neutral-600">
                          <input
                            type="checkbox"
                            checked={newVariableBool}
                            onChange={(e) => setNewVariableBool(e.target.checked)}
                          />
                          값
                        </label>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="rounded border border-neutral-200 px-2 py-1 text-xs"
                      onClick={addVariable}
                    >
                      변수 추가
                    </button>
                  </div>

                  {doc.variables.length ? (
                    <div className="space-y-1">
                      {doc.variables.map((variable) => (
                        <div key={variable.id} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1">
                          <input
                            type="text"
                            value={variable.name}
                            onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
                            className="w-full bg-transparent text-xs"
                          />
                          {variable.type === "color" ? (
                            <input
                              type="color"
                              value={String(variable.value)}
                              onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                              className="h-6 w-10 rounded border border-neutral-200"
                            />
                          ) : null}
                          {variable.type === "number" ? (
                            <input
                              type="number"
                              value={Number(variable.value)}
                              onChange={(e) => updateVariable(variable.id, { value: Number(e.target.value) })}
                              className="w-20 rounded border border-neutral-200 px-2 py-1 text-xs"
                            />
                          ) : null}
                          {variable.type === "string" ? (
                            <input
                              type="text"
                              value={String(variable.value)}
                              onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                              className="w-28 rounded border border-neutral-200 px-2 py-1 text-xs"
                            />
                          ) : null}
                          {variable.type === "boolean" ? (
                            <input
                              type="checkbox"
                              checked={Boolean(variable.value)}
                              onChange={(e) => updateVariable(variable.id, { value: e.target.checked })}
                            />
                          ) : null}
                          {variableModes.length > 1 ? (
                            <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                              <span>모드값</span>
                              {variable.type === "color" ? (
                                <input
                                  type="color"
                                  value={String(variable.modes?.[activeVariableMode] ?? variable.value)}
                                  onChange={(e) => updateVariableModeValue(variable.id, activeVariableMode, e.target.value)}
                                  className="h-6 w-10 rounded border border-neutral-200"
                                />
                              ) : null}
                              {variable.type === "number" ? (
                                <input
                                  type="number"
                                  value={Number(variable.modes?.[activeVariableMode] ?? variable.value)}
                                  onChange={(e) =>
                                    updateVariableModeValue(variable.id, activeVariableMode, Number(e.target.value))
                                  }
                                  className="w-20 rounded border border-neutral-200 px-2 py-1 text-xs"
                                />
                              ) : null}
                              {variable.type === "string" ? (
                                <input
                                  type="text"
                                  value={String(variable.modes?.[activeVariableMode] ?? variable.value)}
                                  onChange={(e) => updateVariableModeValue(variable.id, activeVariableMode, e.target.value)}
                                  className="w-28 rounded border border-neutral-200 px-2 py-1 text-xs"
                                />
                              ) : null}
                              {variable.type === "boolean" ? (
                                <input
                                  type="checkbox"
                                  checked={Boolean(variable.modes?.[activeVariableMode] ?? variable.value)}
                                  onChange={(e) => updateVariableModeValue(variable.id, activeVariableMode, e.target.checked)}
                                />
                              ) : null}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                            onClick={() => removeVariable(variable.id)}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                </div>
                  ) : null}
              </div>

            </div>
            ) : null}
            {panelMode === "prototype" ? (
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">흐름</div>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">시작 페이지</span>
                      <select
                        value={prototypeStartPageId ?? ""}
                        onChange={(e) => updateDocPrototype({ startPageId: e.target.value || undefined })}
                        className="w-32 rounded border border-neutral-200 px-2 py-1"
                      >
                        {doc.pages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                      onClick={() => setPrototypePreview((prev) => !prev)}
                      disabled={!prototypeStartPageId}
                    >
                      {prototypePreview ? "미리보기 종료" : "미리보기"}
                    </button>
                    <div className="rounded-md border border-neutral-200 bg-white px-2 py-2 text-[11px] text-neutral-600">
                      <div className="flex items-center justify-between">
                        <span>미리보기 배율</span>
                        <span>{Math.round(effectivePreviewScale * 100)}%</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                          onClick={() => {
                            setPreviewScaleMode("manual");
                            setPreviewScaleManual((prev) => clamp(prev - 0.1, 0.1, 2));
                          }}
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min={10}
                          max={200}
                          step={5}
                          value={Math.round(effectivePreviewScale * 100)}
                          onChange={(e) => {
                            const next = clamp(Number(e.target.value) / 100, 0.1, 2);
                            setPreviewScaleMode("manual");
                            setPreviewScaleManual(next);
                          }}
                          className="w-full"
                        />
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                          onClick={() => {
                            setPreviewScaleMode("manual");
                            setPreviewScaleManual((prev) => clamp(prev + 0.1, 0.1, 2));
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                          onClick={() => setPreviewScaleMode("auto")}
                        >
                          맞춤
                        </button>
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                          onClick={() => {
                            setPreviewScaleMode("manual");
                            setPreviewScaleManual(1);
                          }}
                        >
                          100%
                        </button>
                      </div>
                    </div>
                    {prototypePreview ? (
                      <>
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500">
                          현재 페이지: {doc.pages.find((page) => page.id === activePreviewPageId)?.name ?? "알 수 없음"}
                        </div>
                        <label className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-600">
                          <span>미리보기 페이지</span>
                          <select
                            value={activePreviewPageId ?? ""}
                            onChange={(e) => setPreviewPageId(e.target.value || null)}
                            className="w-32 rounded border border-neutral-200 px-2 py-1"
                          >
                            {doc.pages.map((page) => (
                              <option key={page.id} value={page.id}>
                                {page.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">인터랙션</div>
                  {selectedNode ? (
                    <div className="mt-2 space-y-2">
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600">
                        선택: {toLabel(selectedNode)}
                      </div>
                      {selectedInteractions.length ? (
                        <div className="space-y-2">
                          {selectedInteractions.map((interaction) => {
                            const actionType = interaction.action.type;
                            const needsTarget = actionType === "navigate" || actionType === "overlay";
                            const startPageForScroll = doc.pages.find((p) => p.id === (prototypeStartPageId ?? doc.pages[0]?.id));
                            const scrollTargetNodeIds = startPageForScroll
                              ? (() => {
                                  const set = new Set<string>();
                                  collectSubtreeIds(doc, startPageForScroll.rootId, set);
                                  return Array.from(set);
                                })()
                              : [];
                            const scrollableContainerIds = scrollTargetNodeIds.filter((id) => doc.nodes[id]?.overflowScrolling);
                            const scrollToTargetId = actionType === "scrollTo" && "targetNodeId" in interaction.action ? interaction.action.targetNodeId : scrollTargetNodeIds[0] ?? "";
                            const supportsTransition = actionType !== "url" && actionType !== "submit" && actionType !== "setVariable";
                            const transitionType = ("transition" in interaction.action && interaction.action.transition?.type) ?? "instant";
                            const transitionDuration = ("transition" in interaction.action && interaction.action.transition?.duration) ?? 300;
                            const durationNum = typeof transitionDuration === "number" ? transitionDuration : 300;
                            const transitionEasing = ("transition" in interaction.action && interaction.action.transition?.easing) ?? "ease";
                            const easingStr = typeof transitionEasing === "string" ? transitionEasing : "ease";
                            const delayMs = ("delayMs" in interaction.action && interaction.action.delayMs != null) ? interaction.action.delayMs : 0;
                            const defaultTarget = prototypeStartPageId ?? doc.pages[0]?.id ?? "";
                            const urlValue = "url" in interaction.action ? interaction.action.url : "";
                            const openInNewTab = "openInNewTab" in interaction.action ? interaction.action.openInNewTab !== false : true;
                            const submitUrl = "url" in interaction.action ? interaction.action.url : "";
                            const submitMethod = "method" in interaction.action ? interaction.action.method ?? "POST" : "POST";
                            const submitNextPageId = "nextPageId" in interaction.action ? interaction.action.nextPageId ?? "" : "";
                            return (
                            <div key={interaction.id} className="space-y-2 rounded-md border border-neutral-200 bg-white p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-neutral-500">인터랙션</span>
                                <button
                                  type="button"
                                  className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
                                  onClick={() => removePrototypeInteraction(selectedNode.id, interaction.id)}
                                >
                                  삭제
                                </button>
                              </div>
                              <label className="flex items-center justify-between gap-2">
                                <span className="text-neutral-500">트리거</span>
                                <select
                                  value={interaction.trigger}
                                  onChange={(e) => {
                                    const nextTrigger = e.target.value as PrototypeTrigger;
                                    const payload: { trigger: PrototypeTrigger; scrollTriggerConfig?: ScrollTriggerConfig } = { trigger: nextTrigger };
                                    if (nextTrigger === "scroll") {
                                      payload.scrollTriggerConfig = interaction.scrollTriggerConfig ?? {
                                        nodeId: scrollableContainerIds[0],
                                        threshold: 0.5,
                                        unit: "percent",
                                      };
                                    }
                                    updatePrototypeInteraction(selectedNode.id, interaction.id, payload);
                                  }}
                                  className="w-24 rounded border border-neutral-200 px-2 py-1"
                                >
                                  <option value="click">클릭</option>
                                  <option value="hover">호버</option>
                                  <option value="onPress">마우스 누름</option>
                                  <option value="load">페이지 로드</option>
                                  <option value="scroll">스크롤</option>
                                </select>
                              </label>
                              {interaction.trigger === "scroll" && (
                                <>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">스크롤 컨테이너</span>
                                    <select
                                      value={interaction.scrollTriggerConfig?.nodeId ?? ""}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          scrollTriggerConfig: {
                                            ...(interaction.scrollTriggerConfig ?? { threshold: 0.5, unit: "percent" }),
                                            nodeId: e.target.value || undefined,
                                          },
                                        })
                                      }
                                      className="min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-[11px]"
                                    >
                                      <option value="">(페이지 내 첫 스크롤)</option>
                                      {scrollableContainerIds.map((id) => (
                                        <option key={id} value={id}>{doc.nodes[id]?.name ?? id}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">기준</span>
                                    <span className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={interaction.scrollTriggerConfig?.unit === "px" ? 0 : 0}
                                        max={interaction.scrollTriggerConfig?.unit === "percent" ? 100 : undefined}
                                        value={interaction.scrollTriggerConfig?.unit === "percent"
                                          ? Math.round((interaction.scrollTriggerConfig?.threshold ?? 0.5) * 100)
                                          : (interaction.scrollTriggerConfig?.threshold ?? 0)}
                                        onChange={(e) => {
                                          const raw = Number(e.target.value);
                                          const unit = interaction.scrollTriggerConfig?.unit ?? "percent";
                                          const threshold = unit === "percent" ? Math.max(0, Math.min(1, raw / 100)) : Math.max(0, raw);
                                          updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                            scrollTriggerConfig: {
                                              ...(interaction.scrollTriggerConfig ?? { threshold: 0.5, unit: "percent" }),
                                              threshold,
                                            },
                                          });
                                        }}
                                        className="w-14 rounded border border-neutral-200 px-2 py-1 text-[11px]"
                                      />
                                      <select
                                        value={interaction.scrollTriggerConfig?.unit ?? "percent"}
                                        onChange={(e) => {
                                          const nextUnit = e.target.value as "percent" | "px";
                                          const prev = interaction.scrollTriggerConfig ?? { threshold: 0.5, unit: "percent" as const };
                                          const threshold = nextUnit === "percent" ? (prev.unit === "percent" ? prev.threshold : 0.5) : (prev.unit === "px" ? prev.threshold : 200);
                                          updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                            scrollTriggerConfig: { ...prev, unit: nextUnit, threshold },
                                          });
                                        }}
                                        className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                                      >
                                        <option value="percent">%</option>
                                        <option value="px">px</option>
                                      </select>
                                    </span>
                                  </label>
                                </>
                              )}
                              <label className="flex items-center justify-between gap-2">
                                <span className="text-neutral-500">액션</span>
                                <select
                                  value={interaction.action.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value as PrototypeAction["type"];
                                    const nextAction: PrototypeAction =
                                      nextType === "navigate" || nextType === "overlay"
                                        ? {
                                            type: nextType,
                                            targetPageId:
                                              "targetPageId" in interaction.action ? interaction.action.targetPageId : defaultTarget,
                                            transition: "transition" in interaction.action ? interaction.action.transition : undefined,
                                            delayMs: "delayMs" in interaction.action ? interaction.action.delayMs : undefined,
                                            condition: "condition" in interaction.action ? interaction.action.condition : undefined,
                                          }
                                        : nextType === "url"
                                          ? {
                                              type: "url",
                                              url: "url" in interaction.action ? interaction.action.url : "",
                                              openInNewTab: "openInNewTab" in interaction.action ? interaction.action.openInNewTab : true,
                                              delayMs: "delayMs" in interaction.action ? interaction.action.delayMs : undefined,
                                              condition: "condition" in interaction.action ? interaction.action.condition : undefined,
                                            }
                                          : nextType === "submit"
                                            ? {
                                                type: "submit",
                                                url: "url" in interaction.action ? interaction.action.url : "",
                                                method: "method" in interaction.action ? interaction.action.method : "POST",
                                                nextPageId: "nextPageId" in interaction.action ? interaction.action.nextPageId : undefined,
                                                delayMs: "delayMs" in interaction.action ? interaction.action.delayMs : undefined,
                                                condition: "condition" in interaction.action ? interaction.action.condition : undefined,
                                              }
                                            : nextType === "setVariable"
                                              ? {
                                                  type: "setVariable",
                                                  variableId: interaction.action.type === "setVariable" ? interaction.action.variableId : (doc.variables[0]?.id ?? ""),
                                                  value: interaction.action.type === "setVariable" ? interaction.action.value : undefined,
                                                  mode: interaction.action.type === "setVariable" ? interaction.action.mode : undefined,
                                                }
                                              : nextType === "scrollTo"
                                                ? {
                                                    type: "scrollTo",
                                                    targetNodeId:
                                                      interaction.action.type === "scrollTo" ? interaction.action.targetNodeId : scrollTargetNodeIds[0] ?? "",
                                                    transition: "transition" in interaction.action ? interaction.action.transition : undefined,
                                                    delayMs: "delayMs" in interaction.action ? interaction.action.delayMs : undefined,
                                                    condition: "condition" in interaction.action ? interaction.action.condition : undefined,
                                                  }
                                                : nextType === "setVariant"
                                                  ? {
                                                      type: "setVariant",
                                                      variantId:
                                                        interaction.action.type === "setVariant" ? interaction.action.variantId : (() => {
                                                          const instId = selectedNode?.type === "instance" ? selectedNode.id : scrollTargetNodeIds.find((id) => doc.nodes[id]?.type === "instance");
                                                          const compId = instId ? doc.nodes[instId]?.instanceOf : undefined;
                                                          const comp = compId ? doc.nodes[compId] : null;
                                                          return comp?.variants?.[0]?.id ?? "";
                                                        })(),
                                                      targetNodeId:
                                                        interaction.action.type === "setVariant" ? interaction.action.targetNodeId : (selectedNode?.type === "instance" ? selectedNode.id : scrollTargetNodeIds.find((id) => doc.nodes[id]?.type === "instance")) ?? undefined,
                                                      delayMs: "delayMs" in interaction.action ? interaction.action.delayMs : undefined,
                                                      condition: "condition" in interaction.action ? interaction.action.condition : undefined,
                                                    }
                                                  : {
                                                    type: nextType,
                                                    transition: "transition" in interaction.action ? interaction.action.transition : undefined,
                                                    delayMs: "delayMs" in interaction.action ? interaction.action.delayMs : undefined,
                                                    condition: "condition" in interaction.action ? interaction.action.condition : undefined,
                                                  };
                                    updatePrototypeInteraction(selectedNode.id, interaction.id, { action: nextAction });
                                  }}
                                  className="w-24 rounded border border-neutral-200 px-2 py-1"
                                >
                                  <option value="navigate">페이지 이동</option>
                                  <option value="overlay">오버레이</option>
                                  <option value="url">링크 열기</option>
                                  <option value="submit">폼 제출</option>
                                  <option value="back">뒤로가기</option>
                                  <option value="closeOverlay">오버레이 닫기</option>
                                  <option value="scrollTo">스크롤 이동</option>
                                  <option value="setVariant">변형 설정</option>
                                  <option value="setVariable">변수 설정</option>
                                </select>
                              </label>
                              {needsTarget ? (
                                <label className="flex items-center justify-between gap-2">
                                  <span className="text-neutral-500">대상</span>
                                  <select
                                    value={"targetPageId" in interaction.action ? interaction.action.targetPageId : defaultTarget}
                                    onChange={(e) =>
                                      updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                        action: { ...(interaction.action as PrototypeAction), targetPageId: e.target.value } as PrototypeAction,
                                      })
                                    }
                                    className="w-32 rounded border border-neutral-200 px-2 py-1"
                                  >
                                    {doc.pages.map((page) => (
                                      <option key={page.id} value={page.id}>
                                        {page.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {actionType === "scrollTo" ? (
                                <label className="flex items-center justify-between gap-2">
                                  <span className="text-neutral-500">스크롤 대상</span>
                                  <select
                                    value={scrollToTargetId}
                                    onChange={(e) =>
                                      updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                        action: { ...(interaction.action as PrototypeAction), targetNodeId: e.target.value } as PrototypeAction,
                                      })
                                    }
                                    className="w-40 rounded border border-neutral-200 px-2 py-1"
                                  >
                                    {scrollTargetNodeIds.map((id) => (
                                      <option key={id} value={id}>
                                        {doc.nodes[id]?.name ?? id}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {actionType === "setVariant" ? (() => {
                                const setVariantTargetId = (interaction.action.type === "setVariant" ? interaction.action.targetNodeId : null) ?? (selectedNode?.type === "instance" ? selectedNode.id : null) ?? scrollTargetNodeIds.find((id) => doc.nodes[id]?.type === "instance") ?? "";
                                const setVariantInstance = setVariantTargetId ? doc.nodes[setVariantTargetId] : null;
                                const setVariantComponent = setVariantInstance?.instanceOf ? doc.nodes[setVariantInstance.instanceOf] : null;
                                const setVariantVariants = setVariantComponent?.variants ?? [];
                                const setVariantVariantId = interaction.action.type === "setVariant" ? interaction.action.variantId : setVariantVariants[0]?.id ?? "";
                                const instanceIdsOnPage = scrollTargetNodeIds.filter((id) => doc.nodes[id]?.type === "instance");
                                return (
                                  <>
                                    <label className="flex items-center justify-between gap-2">
                                      <span className="text-neutral-500">인스턴스</span>
                                      <select
                                        value={setVariantTargetId}
                                        onChange={(e) =>
                                          updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                            action: { ...(interaction.action as PrototypeAction), targetNodeId: e.target.value || undefined } as PrototypeAction,
                                          })
                                        }
                                        className="w-40 rounded border border-neutral-200 px-2 py-1"
                                      >
                                        {instanceIdsOnPage.map((id) => (
                                          <option key={id} value={id}>
                                            {doc.nodes[id]?.name ?? id}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="flex items-center justify-between gap-2">
                                      <span className="text-neutral-500">변형</span>
                                      <select
                                        value={setVariantVariantId}
                                        onChange={(e) =>
                                          updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                            action: { ...(interaction.action as PrototypeAction), variantId: e.target.value } as PrototypeAction,
                                          })
                                        }
                                        className="w-40 rounded border border-neutral-200 px-2 py-1"
                                      >
                                        {setVariantVariants.map((v) => (
                                          <option key={v.id} value={v.id}>
                                            {v.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </>
                                );
                              })() : null}
                              {actionType === "url" ? (
                                <>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">URL</span>
                                    <input
                                      type="text"
                                      value={urlValue}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            url: e.target.value,
                                          } as PrototypeAction,
                                        })
                                      }
                                      className="w-40 rounded border border-neutral-200 px-2 py-1"
                                      placeholder="https://"
                                    />
                                  </label>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">새 탭</span>
                                    <input
                                      type="checkbox"
                                      checked={openInNewTab}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            openInNewTab: e.target.checked,
                                          } as PrototypeAction,
                                        })
                                      }
                                    />
                                  </label>
                                </>
                              ) : null}
                              {actionType === "submit" ? (
                                <>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">URL</span>
                                    <input
                                      type="text"
                                      value={submitUrl}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            url: e.target.value,
                                          } as PrototypeAction,
                                        })
                                      }
                                      className="w-40 rounded border border-neutral-200 px-2 py-1"
                                      placeholder="https://"
                                    />
                                  </label>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">성공 이동</span>
                                    <select
                                      value={submitNextPageId}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            nextPageId: e.target.value || undefined,
                                          } as PrototypeAction,
                                        })
                                      }
                                      className="w-32 rounded border border-neutral-200 px-2 py-1"
                                    >
                                      <option value="">없음</option>
                                      {doc.pages.map((page) => (
                                        <option key={page.id} value={page.id}>
                                          {page.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">방식</span>
                                    <select
                                      value={submitMethod}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            method: e.target.value as "POST" | "GET",
                                          } as PrototypeAction,
                                        })
                                      }
                                      className="w-24 rounded border border-neutral-200 px-2 py-1"
                                    >
                                    <option value="POST">POST</option>
                                    <option value="GET">GET</option>
                                  </select>
                                  </label>
                                </>
                              ) : null}
                              {actionType === "setVariable" ? (
                                <>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">변수</span>
                                    <select
                                      value={interaction.action.type === "setVariable" ? interaction.action.variableId : ""}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: { ...(interaction.action as PrototypeAction), variableId: e.target.value } as PrototypeAction,
                                        })
                                      }
                                      className="w-32 rounded border border-neutral-200 px-2 py-1"
                                    >
                                      {doc.variables.map((v) => (
                                        <option key={v.id} value={v.id}>
                                          {v.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">모드</span>
                                    <select
                                      value={interaction.action.type === "setVariable" ? (interaction.action.mode ?? "") : ""}
                                      onChange={(e) =>
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            mode: e.target.value || undefined,
                                          } as PrototypeAction,
                                        })
                                      }
                                      className="w-24 rounded border border-neutral-200 px-2 py-1"
                                    >
                                      <option value="">—</option>
                                      {(doc.variableModes?.length ? doc.variableModes : ["기본"]).map((m) => (
                                        <option key={m} value={m}>
                                          {m}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">값</span>
                                    <input
                                      type="text"
                                      value={interaction.action.type === "setVariable" && interaction.action.value !== undefined ? String(interaction.action.value) : ""}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = doc.variables.find((x) => x.id === (interaction.action.type === "setVariable" ? interaction.action.variableId : ""));
                                        const val =
                                          v?.type === "number" ? (Number(raw) as number) : v?.type === "boolean" ? raw === "true" : raw;
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            value: raw === "" ? undefined : val,
                                          } as PrototypeAction,
                                        });
                                      }}
                                      className="w-24 rounded border border-neutral-200 px-2 py-1"
                                      placeholder="값"
                                    />
                                  </label>
                                </>
                              ) : null}
                              {supportsTransition ? (
                                <>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">전환</span>
                                    <select
                                      value={transitionType === false || transitionType === undefined ? "instant" : transitionType}
                                      onChange={(e) => {
                                        const next = e.target.value as PrototypeTransitionType;
                                        const current = "transition" in interaction.action ? interaction.action.transition : undefined;
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            transition: next === "instant" ? undefined : { type: next, duration: current?.duration, easing: current?.easing },
                                          } as PrototypeAction,
                                        });
                                      }}
                                      className="w-24 rounded border border-neutral-200 px-2 py-1"
                                    >
                                      <option value="instant">즉시</option>
                                      <option value="fade">페이드</option>
                                      <option value="smart">Smart Animate</option>
                                      <option value="slide-left">슬라이드 좌</option>
                                      <option value="slide-right">슬라이드 우</option>
                                    </select>
                                  </label>
                                  {transitionType !== "instant" ? (
                                    <>
                                      <label className="flex items-center justify-between gap-2">
                                        <span className="text-neutral-500">지속(ms)</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={durationNum}
                                          onChange={(e) => {
                                            const next = Number(e.target.value);
                                            const current = "transition" in interaction.action ? interaction.action.transition : undefined;
                                            updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                              action: {
                                                ...(interaction.action as PrototypeAction),
                                                transition: current ? { ...current, duration: Number.isFinite(next) && next >= 0 ? next : undefined } : undefined,
                                              } as PrototypeAction,
                                            });
                                          }}
                                          className="w-20 rounded border border-neutral-200 px-2 py-1"
                                        />
                                      </label>
                                      <label className="flex items-center justify-between gap-2">
                                        <span className="text-neutral-500">이징</span>
                                        <select
                                          value={easingStr}
                                          onChange={(e) => {
                                            const next = e.target.value;
                                            const current = "transition" in interaction.action ? interaction.action.transition : undefined;
                                            updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                              action: {
                                                ...(interaction.action as PrototypeAction),
                                                transition: current ? { ...current, easing: next } : undefined,
                                              } as PrototypeAction,
                                            });
                                          }}
                                          className="w-24 rounded border border-neutral-200 px-2 py-1"
                                        >
                                          <option value="ease">ease</option>
                                          <option value="ease-in">ease-in</option>
                                          <option value="ease-out">ease-out</option>
                                          <option value="linear">linear</option>
                                        </select>
                                      </label>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                              {actionType !== "setVariable" ? (
                                <div className="space-y-1 rounded border border-neutral-100 bg-neutral-50 p-2">
                                  <span className="text-[10px] text-neutral-400">조건 (만족 시 실행)</span>
                                  <label className="flex items-center justify-between gap-2">
                                    <span className="text-neutral-500">변수</span>
                                    <select
                                      value={"condition" in interaction.action && interaction.action.condition?.variableId ? interaction.action.condition.variableId : ""}
                                      onChange={(e) => {
                                        const c = "condition" in interaction.action ? interaction.action.condition : undefined;
                                        updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                          action: {
                                            ...(interaction.action as PrototypeAction),
                                            condition: e.target.value
                                              ? { variableId: e.target.value, op: c?.op ?? "eq", value: c?.value ?? "" }
                                              : undefined,
                                          } as PrototypeAction,
                                        });
                                      }}
                                      className="w-28 rounded border border-neutral-200 px-2 py-1"
                                    >
                                      <option value="">없음</option>
                                      {doc.variables.map((v) => (
                                        <option key={v.id} value={v.id}>
                                          {v.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {"condition" in interaction.action && interaction.action.condition?.variableId ? (
                                    <>
                                      <label className="flex items-center justify-between gap-2">
                                        <span className="text-neutral-500">연산</span>
                                        <select
                                          value={"condition" in interaction.action && interaction.action.condition?.op ? interaction.action.condition.op : "eq"}
                                          onChange={(e) => {
                                            const c = "condition" in interaction.action ? interaction.action.condition : undefined;
                                            if (!c?.variableId) return;
                                            updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                              action: {
                                                ...(interaction.action as PrototypeAction),
                                                condition: { ...c, op: e.target.value as PrototypeCondition["op"] },
                                              } as PrototypeAction,
                                            });
                                          }}
                                          className="w-20 rounded border border-neutral-200 px-2 py-1"
                                        >
                                          <option value="eq">=</option>
                                          <option value="neq">≠</option>
                                          <option value="gt">&gt;</option>
                                          <option value="gte">≥</option>
                                          <option value="lt">&lt;</option>
                                          <option value="lte">≤</option>
                                        </select>
                                      </label>
                                      <label className="flex items-center justify-between gap-2">
                                        <span className="text-neutral-500">값</span>
                                        <input
                                          type="text"
                                          value={"condition" in interaction.action && interaction.action.condition?.value !== undefined ? String(interaction.action.condition.value) : ""}
                                          onChange={(e) => {
                                            const c = "condition" in interaction.action ? interaction.action.condition : undefined;
                                            if (!c?.variableId) return;
                                            const raw = e.target.value;
                                            const v = doc.variables.find((x) => x.id === c.variableId);
                                            const val = v?.type === "number" ? Number(raw) : v?.type === "boolean" ? raw === "true" : raw;
                                            updatePrototypeInteraction(selectedNode.id, interaction.id, {
                                              action: {
                                                ...(interaction.action as PrototypeAction),
                                                condition: { ...c, value: val },
                                              } as PrototypeAction,
                                            });
                                          }}
                                          className="w-24 rounded border border-neutral-200 px-2 py-1"
                                        />
                                      </label>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                              <label className="flex items-center justify-between gap-2">
                                <span className="text-neutral-500">딜레이(ms)</span>
                                <input
                                  type="number"
                                  value={delayMs}
                                  onChange={(e) => {
                                    const nextDelay = Number(e.target.value);
                                    const base = interaction.action;
                                    const action: PrototypeAction =
                                      "delayMs" in base
                                        ? { ...base, delayMs: Number.isFinite(nextDelay) && nextDelay > 0 ? nextDelay : undefined }
                                        : base;
                                    updatePrototypeInteraction(selectedNode.id, interaction.id, { action });
                                  }}
                                  className="w-24 rounded border border-neutral-200 px-2 py-1"
                                />
                              </label>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-neutral-200 px-2 py-2 text-[11px] text-neutral-500">
                          아직 인터랙션이 없습니다.
                        </div>
                      )}
                      <button
                        type="button"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => addPrototypeInteraction(selectedNode.id)}
                      >
                        인터랙션 추가
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-neutral-500">노드를 선택해 인터랙션을 추가하세요.</div>
                  )}
                </div>
              </div>
            ) : null}
            {panelMode === "dev" ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                    <span>측정 표시</span>
                    <input
                      type="checkbox"
                      checked={devMeasure}
                      onChange={(e) => setDevMeasure(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                    <span>가이드 표시</span>
                    <input
                      type="checkbox"
                      checked={devGuides}
                      onChange={(e) => setDevGuides(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                    <span>스펙 라벨</span>
                    <input
                      type="checkbox"
                      checked={devSpecOverlay}
                      onChange={(e) => setDevSpecOverlay(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                    <span>좌표 정수 반올림 (CSS)</span>
                    <input
                      type="checkbox"
                      checked={devRoundPx}
                      onChange={(e) => setDevRoundPx(e.target.checked)}
                    />
                  </label>
                </div>
                {selectedNode ? (
                  <>
                    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-600 space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">크기</div>
                      <div>W {Math.round(selectedNode.frame.w)} H {Math.round(selectedNode.frame.h)}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-2">선택 요소</div>
                      <div>이름: {toLabel(selectedNode)}</div>
                      <div>타입: {NODE_TYPE_LABELS[selectedNode.type] ?? selectedNode.type}</div>
                      <div>위치: {Math.round(selectedNode.frame.x)}px, {Math.round(selectedNode.frame.y)}px</div>
                    </div>
                    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-600 space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">레이아웃</div>
                      <div>
                        모드: {selectedNode.layout?.mode === "auto" ? "오토" : "고정"}
                      </div>
                      {selectedNode.layout?.mode === "auto" ? (
                        <>
                          <div>방향: {selectedNode.layout.dir}</div>
                          <div>간격: {selectedNode.layout.gap}px</div>
                          <div>
                            패딩: {selectedNode.layout.padding.t}/{selectedNode.layout.padding.r}/{selectedNode.layout.padding.b}/{selectedNode.layout.padding.l}
                          </div>
                          <div>정렬: {selectedNode.layout.align}</div>
                          <div>줄바꿈: {selectedNode.layout.wrap ? "사용" : "없음"}</div>
                        </>
                      ) : null}
                      {selectedNode.layoutSizing ? (
                        <div>
                          리사이즈: W {selectedNode.layoutSizing.width} / H {selectedNode.layoutSizing.height}
                        </div>
                      ) : null}
                      {selectedNode.constraints && Object.keys(selectedNode.constraints).length ? (
                        <div>
                          제약: {Object.entries(selectedNode.constraints)
                            .filter(([, value]) => Boolean(value))
                            .map(([key]) => key)
                            .join(", ")}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-600 space-y-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">토큰</div>
                      <div>Fill Style: {devFillStyle ?? "없음"}</div>
                      <div>Stroke Style: {devStrokeStyle ?? "없음"}</div>
                      <div>Text Style: {devTextStyle ?? "없음"}</div>
                      <div>Fill Variable: {devFillVar ?? "없음"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">CSS</div>
                      <textarea
                        value={devCss}
                        readOnly
                        className="mt-2 h-40 w-full rounded border border-neutral-200 bg-white p-2 font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        className="mt-2 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => devCss && navigator.clipboard?.writeText(devCss)}
                        disabled={!devCss}
                      >
                        CSS 복사
                      </button>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">스펙</div>
                      <textarea
                        value={devSpecText}
                        readOnly
                        className="mt-2 h-40 w-full rounded border border-neutral-200 bg-white p-2 font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        className="mt-2 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
                        onClick={() => devSpecText && navigator.clipboard?.writeText(devSpecText)}
                        disabled={!devSpecText}
                      >
                        스펙 복사
                      </button>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">자산 추출</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-1 text-xs"
                          onClick={exportSelectionPng}
                          disabled={!hasSelection}
                        >
                          선택 → PNG
                        </button>
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-1 text-xs"
                          onClick={exportSelectionSvg}
                          disabled={!hasSelection}
                        >
                          선택 → SVG
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-400">선택 노드만 PNG/SVG로 내보냅니다.</p>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-neutral-500">노드를 선택해 개발 정보를 확인하세요.</div>
                )}
              </div>
            ) : null}
            {panelMode === "export" ? (
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">대상</div>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">페이지</span>
                      <select
                        value={activeExportPageId ?? ""}
                        onChange={(e) => setExportPageId(e.target.value || null)}
                        className="w-32 rounded border border-neutral-200 px-2 py-1"
                      >
                        {doc.pages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">범위</span>
                      <select
                        value={exportScope}
                        onChange={(e) => setExportScope(e.target.value as "page" | "selection")}
                        className="w-32 rounded border border-neutral-200 px-2 py-1"
                      >
                        <option value="page">페이지</option>
                        <option value="selection" disabled={!hasSelection}>
                          선택
                        </option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-neutral-500">배율</span>
                      <select
                        value={exportScale}
                        onChange={(e) => setExportScale(Number(e.target.value))}
                        className="w-24 rounded border border-neutral-200 px-2 py-1"
                      >
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                      </select>
                    </label>
                    {exportScope === "page" ? (
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-neutral-500">내용만</span>
                        <input
                          type="checkbox"
                          checked={exportContentOnly}
                          onChange={(e) => setExportContentOnly(e.target.checked)}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                {selectedNode && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">선택 노드 내보내기 설정</div>
                    <div className="mt-2 space-y-1">
                      {(selectedNode.exportSettings ?? []).map((es, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 rounded border border-neutral-100 px-2 py-1 text-[11px]">
                          <span>{es.format.toUpperCase()} @{es.scale}x</span>
                          <button type="button" className="rounded border border-neutral-200 px-1 py-0.5" onClick={() => { const next = [...(selectedNode.exportSettings ?? [])]; next.splice(i, 1); updateNode(selectedNode.id, { exportSettings: next.length ? next : undefined }, true); }}>삭제</button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1 flex-wrap">
                        <select id="export-add-format" className="rounded border border-neutral-200 px-2 py-1 text-[11px]" defaultValue="png">
                          <option value="png">PNG</option>
                          <option value="svg">SVG</option>
                          <option value="pdf">PDF</option>
                        </select>
                        <select id="export-add-scale" className="rounded border border-neutral-200 px-2 py-1 text-[11px]" defaultValue="1">
                          <option value={1}>1x</option>
                          <option value={2}>2x</option>
                          <option value={3}>3x</option>
                        </select>
                        <button
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-1 text-[11px]"
                          onClick={() => {
                            const format = (document.getElementById("export-add-format") as HTMLSelectElement)?.value as "png" | "svg" | "pdf";
                            const scale = Number((document.getElementById("export-add-scale") as HTMLSelectElement)?.value || 1);
                            const next = [...(selectedNode.exportSettings ?? []), { format, scale }];
                            updateNode(selectedNode.id, { exportSettings: next }, true);
                          }}
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">내보내기</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded border border-neutral-200 px-2 py-1 text-xs"
                      onClick={exportDocJson}
                    >
                      JSON
                    </button>
                    <button type="button" className="rounded border border-neutral-200 px-2 py-1 text-xs" onClick={exportSvg}>
                      SVG
                    </button>
                    <button type="button" className="rounded border border-neutral-200 px-2 py-1 text-xs" onClick={exportPng}>
                      PNG
                    </button>
                    <button type="button" className="rounded border border-neutral-200 px-2 py-1 text-xs" onClick={exportJpg}>
                      JPG
                    </button>
                    <button type="button" className="rounded border border-neutral-200 px-2 py-1 text-xs" onClick={() => void exportPdf()}>
                      PDF
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-400">
                    외부 이미지는 PNG 내보내기에서 차단될 수 있습니다.
                  </div>
                </div>
              </div>
            ) : null}
            </div>
          </aside>
          ) : null}
        </div>
        <div className="sr-only" aria-hidden="true">
          {canvasMounted ? <AdvancedRuntimeRenderer doc={doc} activePageId={activeExportPageId ?? undefined} svgRef={exportSvgRef} /> : null}
        </div>
        </div>
      </main>
    </div>
  );
}
