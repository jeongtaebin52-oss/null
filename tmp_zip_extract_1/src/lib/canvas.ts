// ----- defaults (extended) -----
// ✅ editor-view.tsx가 { id, ...base }를 쓰기 때문에 base에 type이 반드시 있어야 합니다.

/** 캔버스 노드 버튼/링크 등 액션 (canvas-render에서 사용) */
export type BuilderAction = { type: "none" } | { type: "link"; url?: string };

/** ELEMENT_DEFAULTS 키와 동기화 (editor-view, canvas-render에서 import) */
export type CanvasNodeType =
  | "box"
  | "frame"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "badge"
  | "link"
  | "shape_rect"
  | "shape_ellipse"
  | "line"
  | "path"
  | "input"
  | "textarea"
  | "checkbox"
  | "select"
  | "slider";

/** 단일 노드 (id, 위치, 크기, 기본 스타일·액션·바인딩) */
export type CanvasNode = {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, unknown>;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  action?: BuilderAction;
  /** 폼/상태 바인딩 (canvas-render에서 bind.key 사용) */
  bind?: { key?: string };
};

/** 캔버스 문서 (editor-view, canvas-render, replay 등에서 import) */
export type CanvasDocument = {
  width: number;
  height: number;
  nodes: CanvasNode[];
};

type DefaultDef = {
  type: CanvasNodeType;
  w: number;
  h: number;
  props: Record<string, unknown>;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  hidden?: boolean;
  action?: BuilderAction;
};

export const ELEMENT_DEFAULTS: Record<CanvasNodeType, DefaultDef> = {
  box: {
    type: "box",
    w: 240,
    h: 140,
    props: { background: "#F5F5F5", radius: 12 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  frame: {
    type: "frame",
    w: 320,
    h: 240,
    props: { background: "#FFFFFF", radius: 14, border: "#E5E5E5", borderWidth: 1 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  text: {
    type: "text",
    w: 240,
    h: 44,
    props: { text: "텍스트", color: "#111111", fontSize: 16, fontWeight: 500, align: "left" },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  button: {
    type: "button",
    w: 160,
    h: 44,
    props: { label: "버튼", fill: "#111111", color: "#FFFFFF", radius: 999, fontSize: 13, fontWeight: 600 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  image: {
    type: "image",
    w: 280,
    h: 180,
    props: { url: "", fit: "cover", radius: 12 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  divider: {
    type: "divider",
    w: 260,
    h: 8,
    props: { color: "#EAEAEA", thickness: 1 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  badge: {
    type: "badge",
    w: 90,
    h: 28,
    props: { label: "배지", color: "#111111", background: "#F1F1F1" },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },

  link: {
    type: "link",
    w: 180,
    h: 44,
    props: { label: "링크", border: "#3B82F6", background: "rgba(59,130,246,0.10)" },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  shape_rect: {
    type: "shape_rect",
    w: 180,
    h: 120,
    props: { fill: "#EDEDED", stroke: "#111111", strokeWidth: 0, radius: 16 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  shape_ellipse: {
    type: "shape_ellipse",
    w: 140,
    h: 140,
    props: { fill: "#EDEDED", stroke: "#111111", strokeWidth: 0 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  line: {
    type: "line",
    w: 220,
    h: 40,
    props: { stroke: "#111111", strokeWidth: 2, dash: "" },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  path: {
    type: "path",
    w: 240,
    h: 160,
    props: { stroke: "#111111", strokeWidth: 2, points: [[0.05, 0.5], [0.25, 0.2], [0.6, 0.8], [0.9, 0.35]] },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },

  input: {
    type: "input",
    w: 280,
    h: 44,
    props: { placeholder: "입력", fill: "#FFFFFF", stroke: "#E5E5E5", strokeWidth: 1, radius: 12 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  textarea: {
    type: "textarea",
    w: 280,
    h: 110,
    props: { placeholder: "입력", fill: "#FFFFFF", stroke: "#E5E5E5", strokeWidth: 1, radius: 12 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  checkbox: {
    type: "checkbox",
    w: 160,
    h: 24,
    props: { label: "동의", color: "#111111" },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  select: {
    type: "select",
    w: 260,
    h: 44,
    props: { options: ["옵션 1", "옵션 2"], fill: "#FFFFFF", stroke: "#E5E5E5", strokeWidth: 1, radius: 12 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
  slider: {
    type: "slider",
    w: 260,
    h: 44,
    props: { min: 0, max: 100, step: 1 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    action: { type: "none" },
  },
};
// ---- Compatibility exports for editor-view.tsx ----
// 일부 롤백/머지 과정에서 빠질 수 있어, 반드시 export로 보장합니다.

export const DEFAULT_CANVAS = {
  width: 360,
  height: 640,
  nodes: [],
} as const;

export const GRID_SIZE = 8;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number, grid = GRID_SIZE) {
  return Math.round(value / grid) * grid;
}
// ---- Required exports for editor-view.tsx (compat layer) ----

export function genNodeId(prefix = "node") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function countByType(nodes: Array<{ type?: string }>) {
  return nodes.reduce<Record<string, number>>((acc, node) => {
    const t = typeof node.type === "string" ? node.type : "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
}

export function clampNodeToCanvas(
  node: CanvasNode,
  doc: { width: number; height: number },
  minSize = 24
): CanvasNode {
  const clampLocal = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const w = clampLocal(node.w, minSize, doc.width);
  const h = clampLocal(node.h, minSize, doc.height);
  const x = clampLocal(node.x, 0, doc.width - w);
  const y = clampLocal(node.y, 0, doc.height - h);

  return { ...node, x, y, w, h };
}
// ==============================
// V2 compatibility layer (for work-view.tsx)
// ==============================

export type CanvasScene = {
  id: string;
  name: string;
  width: number;
  height: number;
  nodes: CanvasNode[];
};

export type CanvasContentV2 = {
  schema: "canvas_v2";
  startSceneId: string;
  scenes: CanvasScene[];
};

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function asNumber(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asString(v: unknown, fallback: string) {
  return typeof v === "string" ? v : fallback;
}

/**
 * normalizeContentToV2:
 * - 과거 단일 문서 {width,height,nodes}
 * - builder_v3 {pages}
 * - null_canvas {pages}
 * - canvas_v2 {scenes}
 * 어떤 형태든 "canvas_v2"로 정규화해서 work-view가 항상 소비 가능하게 만듭니다.
 */
export function normalizeContentToV2(raw: unknown): CanvasContentV2 {
  // already v2
  if (isObj(raw) && (raw as any).schema === "canvas_v2" && Array.isArray((raw as any).scenes)) {
    const scenesRaw = (raw as any).scenes as any[];
    const scenes: CanvasScene[] = scenesRaw.map((s, idx) => ({
      id: asString(s?.id, `scene_${idx + 1}`),
      name: asString(s?.name, `장면 ${idx + 1}`),
      width: asNumber(s?.width, 390),
      height: asNumber(s?.height, 844),
      nodes: Array.isArray(s?.nodes) ? (s.nodes as CanvasNode[]) : [],
    }));
    const start = asString((raw as any).startSceneId, scenes[0]?.id ?? "scene_1");
    const startSceneId = scenes.some((s) => s.id === start) ? start : scenes[0]?.id ?? "scene_1";
    return { schema: "canvas_v2", startSceneId, scenes: scenes.length ? scenes : [{ id: "scene_1", name: "장면 1", width: 390, height: 844, nodes: [] }] };
  }

  // canonical null_canvas
  if (isObj(raw) && (raw as any).schema === "null_canvas" && Array.isArray((raw as any).pages)) {
    const pages = (raw as any).pages as any[];
    const scenes: CanvasScene[] = pages.map((p, idx) => ({
      id: asString(p?.id, `scene_${idx + 1}`),
      name: asString(p?.name, `장면 ${idx + 1}`),
      width: asNumber(p?.viewport?.width, asNumber(p?.width, 390)),
      height: asNumber(p?.viewport?.height, asNumber(p?.height, 844)),
      nodes: Array.isArray(p?.nodes) ? (p.nodes as CanvasNode[]) : [],
    }));
    const start = asString((raw as any).startPageId, scenes[0]?.id ?? "scene_1");
    const startSceneId = scenes.some((s) => s.id === start) ? start : scenes[0]?.id ?? "scene_1";
    return { schema: "canvas_v2", startSceneId, scenes: scenes.length ? scenes : [{ id: "scene_1", name: "장면 1", width: 390, height: 844, nodes: [] }] };
  }

  // legacy builder_v3
  if (isObj(raw) && (raw as any).schema === "builder_v3" && Array.isArray((raw as any).pages)) {
    const pages = (raw as any).pages as any[];
    const scenes: CanvasScene[] = pages.map((p, idx) => ({
      id: asString(p?.id, `scene_${idx + 1}`),
      name: asString(p?.name, `장면 ${idx + 1}`),
      width: asNumber(p?.viewport?.width, 390),
      height: asNumber(p?.viewport?.height, 844),
      nodes: Array.isArray(p?.nodes) ? (p.nodes as CanvasNode[]) : [],
    }));
    const start = asString((raw as any).startPageId, scenes[0]?.id ?? "scene_1");
    const startSceneId = scenes.some((s) => s.id === start) ? start : scenes[0]?.id ?? "scene_1";
    return { schema: "canvas_v2", startSceneId, scenes: scenes.length ? scenes : [{ id: "scene_1", name: "장면 1", width: 390, height: 844, nodes: [] }] };
  }

  // fallback: single document
  const width = isObj(raw) ? asNumber((raw as any).width, 390) : 390;
  const height = isObj(raw) ? asNumber((raw as any).height, 844) : 844;
  const nodes = isObj(raw) && Array.isArray((raw as any).nodes) ? ((raw as any).nodes as CanvasNode[]) : [];
  return { schema: "canvas_v2", startSceneId: "scene_1", scenes: [{ id: "scene_1", name: "장면 1", width, height, nodes }] };
}

export function pickScene(content: CanvasContentV2, sceneId: string | null | undefined): CanvasScene {
  const id = typeof sceneId === "string" && sceneId ? sceneId : content.startSceneId;
  return content.scenes.find((s) => s.id === id) ?? content.scenes[0];
}

export function toDocument(scene: CanvasScene): CanvasDocument {
  return { width: scene.width, height: scene.height, nodes: scene.nodes };
}
