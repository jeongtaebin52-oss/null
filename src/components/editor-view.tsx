// src/components/editor-view.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CanvasRender from "@/components/canvas-render";
import { ColorField, PropertyField, SelectField, TextAreaField, TextField } from "@/components/editor-fields";
import {
  DEFAULT_CANVAS,
  ELEMENT_DEFAULTS,
  GRID_SIZE,
  clamp,
  clampNodeToCanvas,
  genNodeId,
  snapToGrid,
  type CanvasDocument,
  type CanvasNode,
  type CanvasNodeType,
} from "@/lib/canvas";
import type { PlanFeatures } from "@/lib/plan";

type HistoryState = {
  past: CanvasNode[][];
  present: CanvasNode[];
  future: CanvasNode[][];
};

type GuideLine =
  | { kind: "v"; x: number }
  | { kind: "h"; y: number };

type DragState =
  | {
      mode: "move";
      primaryId: string;
      ids: string[];
      startX: number;
      startY: number;
      origins: Record<string, { x: number; y: number; w: number; h: number }>;
      didBeginHistory: boolean;
    }
  | {
      mode: "resize";
      id: string;
      startX: number;
      startY: number;
      origin: { x: number; y: number; w: number; h: number };
      handle: "nw" | "ne" | "sw" | "se";
      didBeginHistory: boolean;
    };



type Scene = {
  id: string;
  name: string;
  width: number;
  height: number;
  nodes: CanvasNode[];
};

type ContentV2 = {
  schema: "canvas_v2";
  startSceneId: string;
  scenes: Scene[];
};

const NODE_TYPE_LABELS: Record<CanvasNodeType, string> = {
  box: "박스",
  frame: "프레임",
  text: "텍스트",
  button: "버튼",
  image: "이미지",
  divider: "구분선",
  badge: "배지",
  link: "링크",
  shape_rect: "사각형",
  shape_ellipse: "원형",
  line: "선",
  path: "패스",
  input: "입력",
  textarea: "텍스트 영역",
  checkbox: "체크박스",
  select: "선택",
  slider: "슬라이더",
};

const TOOLBOX_GROUPS: Array<{ title: string; items: CanvasNodeType[] }> = [
  { title: "기본", items: ["box", "frame", "text", "button", "image", "divider", "badge", "link"] },
  { title: "도형", items: ["shape_rect", "shape_ellipse", "line", "path"] },
  { title: "폼", items: ["input", "textarea", "checkbox", "select", "slider"] },
];

const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "실선" },
  { value: "dashed", label: "점선" },
  { value: "dotted", label: "점점선" },
];

const BLEND_MODE_OPTIONS = [
  { value: "normal", label: "일반" },
  { value: "multiply", label: "곱하기" },
  { value: "screen", label: "스크린" },
  { value: "overlay", label: "오버레이" },
  { value: "darken", label: "어둡게" },
  { value: "lighten", label: "밝게" },
  { value: "color-dodge", label: "컬러 닷지" },
  { value: "color-burn", label: "컬러 번" },
  { value: "difference", label: "차이" },
  { value: "exclusion", label: "제외" },
];

const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "없음" },
  { value: "uppercase", label: "대문자" },
  { value: "lowercase", label: "소문자" },
  { value: "capitalize", label: "첫 글자 대문자" },
];

const FONT_STYLE_OPTIONS = [
  { value: "normal", label: "기본" },
  { value: "italic", label: "기울임" },
  { value: "oblique", label: "비스듬" },
];

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
];

const LINE_CAP_OPTIONS = [
  { value: "round", label: "라운드" },
  { value: "butt", label: "기본" },
  { value: "square", label: "사각" },
];

const LINE_JOIN_OPTIONS = [
  { value: "round", label: "라운드" },
  { value: "bevel", label: "베벨" },
  { value: "miter", label: "마이터" },
];

function genSceneId(prefix = "scene") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
const MAX_HISTORY = 60;
const SNAP_THRESHOLD = 6;

// Normalize inspector props for runtime render fields.
function mapInspectorPropsForRender(nodeType: CanvasNodeType, patch: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...patch };
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);

  // NOTE: comment removed (encoding issue).
  if ("background" in patch) {
    const bg = str(patch["background"]);
    if (bg.trim()) out.fill = bg; // Map background to renderer fill.
  }

  // NOTE: comment removed (encoding issue).
  if ("borderColor" in patch) {
    const c = str(patch["borderColor"]);
    if (c.trim()) out.stroke = c;
  }
  if ("borderWidth" in patch) {
    out.strokeWidth = num(patch["borderWidth"], 0);
  }

  // Text shortcuts: map size/weight to fontSize/fontWeight.
  if (nodeType === "text") {
    const size = str(patch["size"] ?? "");
    if (size) {
      const fs = size === "sm" ? 14 : size === "md" ? 16 : size === "lg" ? 20 : undefined;
      if (fs) out.fontSize = fs;
    }
    const weight = str(patch["weight"] ?? "");
    if (weight) {
      const fw = weight === "light" ? 300 : weight === "medium" ? 500 : weight === "bold" ? 700 : undefined;
      if (fw) out.fontWeight = fw;
    }
  }

  // NOTE: comment removed (encoding issue).
  // NOTE: comment removed (encoding issue).
  if (nodeType === "badge") {
    if ("background" in patch) {
      const bg = str(patch["background"]);
      if (bg.trim()) out.fill = bg;
    }
  }

  return out;
}

function isEditableTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = (node.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (node.isContentEditable) return true;
  return false;
}

function rectOf(n: { x: number; y: number; w: number; h: number }) {
  const l = n.x;
  const t = n.y;
  const r = n.x + n.w;
  const b = n.y + n.h;
  const cx = l + n.w / 2;
  const cy = t + n.h / 2;
  return { l, t, r, b, cx, cy };
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function pickSmallestMissingPositive(nums: number[]) {
  const used = new Set<number>();
  for (const n of nums) if (Number.isFinite(n) && n > 0) used.add(n);
  let k = 1;
  while (used.has(k)) k++;
  return k;
}

function formatOptionList(value: unknown) {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(", ");
  if (typeof value === "string") return value;
  return "";
}

function parseOptionList(raw: string) {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function formatPathPoints(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  const parts: string[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const x = typeof item[0] === "number" ? item[0] : Number(item[0]);
    const y = typeof item[1] === "number" ? item[1] : Number(item[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    parts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return parts.join("; ");
}

function resolveFontSize(props: Record<string, unknown>, fallback = 16) {
  const raw = props.fontSize;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const preset = String(props.size ?? "");
  if (preset === "sm") return 14;
  if (preset === "md") return 16;
  if (preset === "lg") return 20;
  return fallback;
}

function resolveFontWeight(props: Record<string, unknown>, fallback = 500) {
  const raw = props.fontWeight;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const preset = String(props.weight ?? "");
  if (preset === "light") return 300;
  if (preset === "medium") return 500;
  if (preset === "bold") return 700;
  return fallback;
}

export default function EditorView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPageId = searchParams.get("pageId");
  const initialSceneId = searchParams.get("s");

  const [pageId, setPageId] = useState<string | null>(initialPageId);
  const [title, setTitle] = useState<string>("");

  // NOTE: comment removed (encoding issue).
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          const next = encodeURIComponent("/editor" + (typeof window !== "undefined" && window.location.search ? window.location.search : ""));
          window.location.href = `/login?next=${next}`;
        }
      })
      .catch(() => null);
  }, []);

  const draftKey = useMemo(() => `NULL_EDITOR_DRAFT:${pageId ?? "new"}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId],
  );

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [startSceneId, setStartSceneId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(initialSceneId);

  useEffect(() => {
    if (pageId) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d?.title === "string") setTitle(d.title);
      if (Array.isArray(d?.scenes)) setScenes(d.scenes);
      if (typeof d?.startSceneId === "string") setStartSceneId(d.startSceneId);
      if (typeof d?.activeSceneId === "string") setActiveSceneId(d.activeSceneId);

      const v2: ContentV2 = {
        schema: "canvas_v2",
        startSceneId: typeof d?.startSceneId === "string" ? d.startSceneId : "",
        scenes: Array.isArray(d?.scenes) ? d.scenes : [],
      };
      const scene = getActiveScene(v2, typeof d?.activeSceneId === "string" ? d.activeSceneId : null);
      if (scene) {
        setDocMeta({ width: scene.width, height: scene.height, nodes: scene.nodes });
        setHistory({ past: [], present: scene.nodes, future: [] });
      }
      setMessage("임시 저장본을 불러왔습니다.");
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);


  // multi-select
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const [gridSnap, setGridSnap] = useState(true);
  const gridSnapRef = useRef(true);
  useEffect(() => {
    gridSnapRef.current = gridSnap;
  }, [gridSnap]);

  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: [...DEFAULT_CANVAS.nodes],
    future: [],
  });

  const nodesRef = useRef<CanvasNode[]>(history.present);
  useEffect(() => {
    nodesRef.current = history.present;
  }, [history.present]);

  const [docMeta, setDocMeta] = useState<CanvasDocument>({
    width: DEFAULT_CANVAS.width,
    height: DEFAULT_CANVAS.height,
    nodes: [],
  });

  const docMetaRef = useRef({ width: docMeta.width, height: docMeta.height });
  useEffect(() => {
    docMetaRef.current = { width: docMeta.width, height: docMeta.height };
  }, [docMeta.width, docMeta.height]);

  const [features, setFeatures] = useState<PlanFeatures>({
    maxLivePages: 1,
    maxButtons: 3,
    maxTexts: 6,
    maxImages: 1,
    maxElements: 20,
    replayEnabled: false,
    detailedReports: false,
    maxHistoryItems: 10,
  });

  const [status, setStatus] = useState<"idle" | "saving" | "publishing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  /** NOTE: comment removed (encoding issue). */
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  // NOTE: comment removed (encoding issue).
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.features && typeof data.features === "object") {
          setFeatures((prev) => ({ ...prev, ...data.features }));
        }
      })
      .catch(() => {});
  }, []);

  const [guides, setGuides] = useState<GuideLine[]>([]);
  const guidesRef = useRef<GuideLine[]>([]);
  useEffect(() => {
    guidesRef.current = guides;
  }, [guides]);

  /** NOTE: comment removed (encoding issue). */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceKeyRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceKeyRef.current = false;
        panStartRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const dragRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /** NOTE: comment removed (encoding issue). */
  const copyBufferRef = useRef<CanvasNode[] | null>(null);
  /** NOTE: comment removed (encoding issue). */
  const [boxSelect, setBoxSelect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  /** NOTE: comment removed (encoding issue). */
  const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
  const [zoom, setZoom] = useState<(typeof ZOOM_STEPS)[number]>(1);
  /** NOTE: comment removed (encoding issue). */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const spaceKeyRef = useRef(false);

  const nodes = history.present;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;

  // NOTE: comment removed (encoding issue).
  const constraintCounts = useMemo(() => {
    const buttonCount = nodes.filter((n) => n.type === "button").length;
    const textCount = nodes.filter((n) => n.type === "text").length;
    const imageCount = nodes.filter((n) => n.type === "image").length;
    const totalElements = nodes.length;
    return { buttonCount, textCount, imageCount, totalElements };
  }, [nodes]);

  const selectedNode = useMemo(() => {
    if (selectedCount !== 1) return null;
    const id = selectedIds[0];
    return nodes.find((n) => n.id === id) ?? null;
  }, [nodes, selectedCount, selectedIds]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  function beginGestureHistoryOnce() {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.didBeginHistory) return;
    drag.didBeginHistory = true;
    setHistory((prev) => {
      const past = [...prev.past, prev.present].slice(-MAX_HISTORY);
      return { past, present: prev.present, future: [] };
    });
  }

  function setPresent(nodesNext: CanvasNode[], commit = true) {
    setHistory((prev) => {
      const past = commit ? [...prev.past, prev.present].slice(-MAX_HISTORY) : prev.past;
      const future = commit ? [] : prev.future;
      return { past, present: nodesNext, future };
    });
  }

  function undo() {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const past = prev.past.slice(0, -1);
      const future = [prev.present, ...prev.future];
      return { past, present: previous, future };
    });
    setMessage(null);
  }

  function redo() {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const future = prev.future.slice(1);
      const past = [...prev.past, prev.present].slice(-MAX_HISTORY);
      return { past, present: next, future };
    });
    setMessage(null);
  }

  useEffect(() => {
    if (!pageId) return;
    fetch(`/api/pages/${pageId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.version?.content_json) return;
        const content = data.version.content_json;
        setTitle(typeof data?.page?.title === "string" ? data.page.title : "");

        const v2 = normalizeToV2(content);
        setScenes(v2.scenes);
        setStartSceneId(v2.startSceneId);

        const initial = initialSceneId || v2.startSceneId;
        setActiveSceneId(initial);

        const scene = getActiveScene(v2, initial);
        setDocMeta({ width: scene.width, height: scene.height, nodes: scene.nodes });
        setHistory({ past: [], present: scene.nodes, future: [] });
        setSelectedIds([]);
      })
      .catch(() => null);
  }, [pageId]);

  useEffect(() => {
    setDocMeta((prev) => ({ ...prev, nodes }));

    // NOTE: comment removed (encoding issue).
    if (activeSceneId) {
      setScenes((prev) => prev.map((s) => (s.id === activeSceneId ? { ...s, nodes } : s)));
    }
  }, [nodes, activeSceneId]);

  // NOTE: comment removed (encoding issue).
  useEffect(() => {
    try {
      const payload = {
        title,
        scenes,
        startSceneId,
        activeSceneId,
        docMeta: { width: docMetaRef.current.width, height: docMetaRef.current.height },
        ts: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [draftKey, title, scenes, startSceneId, activeSceneId]);

  function addNode(type: CanvasNodeType) {
    const base = ELEMENT_DEFAULTS[type];
    const id = genNodeId("node");
    const { width, height } = docMetaRef.current;

    const x0 = width / 2 - base.w / 2;
    const y0 = height / 2 - base.h / 2;

    const nextNode: CanvasNode = clampNodeToCanvas(
      {
        id,
        ...base,
        x: gridSnapRef.current ? snapToGrid(x0, GRID_SIZE) : x0,
        y: gridSnapRef.current ? snapToGrid(y0, GRID_SIZE) : y0,
      },
      { width, height },
    );

    const nextNodes = [...nodesRef.current, nextNode];
    setPresent(nextNodes, true);
    setSelectedIds([id]);
    setMessage(null);
  }


  function switchScene(sceneId: string) {
    if (!sceneId) return;
    const target = scenes.find((s) => s.id === sceneId);
    if (!target) return;

    setActiveSceneId(sceneId);
    // NOTE: comment removed (encoding issue).
    const id = pageId;
    if (id) router.replace(`/editor?pageId=${id}&s=${encodeURIComponent(sceneId)}`);
    else router.replace(`/editor?s=${encodeURIComponent(sceneId)}`);

    setDocMeta({ width: target.width, height: target.height, nodes: target.nodes });
    setHistory({ past: [], present: target.nodes, future: [] });
    setSelectedIds([]);
    setMessage(null);
  }

  function addScene() {
    const id = genSceneId();
    const baseW = docMetaRef.current.width;
    const baseH = docMetaRef.current.height;
    const name = `씬 ${scenes.length + 1}`;

    const next: Scene = { id, name, width: baseW, height: baseH, nodes: [] };
    const nextScenes = [...scenes, next];
    setScenes(nextScenes);

    if (!startSceneId) setStartSceneId(id);
    switchScene(id);
  }

  function duplicateScene(sceneId: string) {
    const s = scenes.find((x) => x.id === sceneId);
    if (!s) return;
    const id = genSceneId();
    const name = `${s.name} 복제`;
    const nodes = s.nodes.map((n) => ({ ...n, id: genNodeId("node"), props: { ...(n.props ?? {}) } }));
    const next: Scene = { id, name, width: s.width, height: s.height, nodes };
    const nextScenes = [...scenes, next];
    setScenes(nextScenes);
    switchScene(id);
  }

  function renameScene(sceneId: string, name: string) {
    // NOTE: comment removed (encoding issue).
    const raw = name.slice(0, 40);
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, name: raw } : s)));

    if (raw.trim().length === 0) setMessage("씬 이름은 비워둘 수 없습니다.");
    else setMessage(null);
  }

  function deleteSelected() {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const next = nodesRef.current.filter((n) => !ids.includes(n.id));
    setPresent(next, true);
    setSelectedIds([]);
    setMessage(null);
  }

  function duplicateSelected() {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;

    const nowNodes = nodesRef.current;
    const idSet = new Set(ids);

    // preserve stacking: clone in the same order as current array
    const clones: CanvasNode[] = [];
    for (const n of nowNodes) {
      if (!idSet.has(n.id)) continue;
      const id = genNodeId("node");
      const { width, height } = docMetaRef.current;

      const dx = gridSnapRef.current ? GRID_SIZE : 8;
      const dy = gridSnapRef.current ? GRID_SIZE : 8;

      const cloned: CanvasNode = clampNodeToCanvas(
        {
          ...n,
          id,
          x: n.x + dx,
          y: n.y + dy,
          props: { ...(n.props ?? {}) },
        },
        { width, height },
      );
      clones.push(cloned);
    }

    const next = [...nowNodes, ...clones];
    setPresent(next, true);
    setSelectedIds(clones.map((c) => c.id));
    setMessage("복제되었습니다.");
  }

  function nudgeSelected(dx: number, dy: number) {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;

    const { width, height } = docMetaRef.current;
    const idSet = new Set(ids);

    const next = nodesRef.current.map((n) => {
      if (!idSet.has(n.id)) return n;
      const x = n.x + dx;
      const y = n.y + dy;
      return clampNodeToCanvas({ ...n, x, y }, { width, height });
    });

    setPresent(next, true);
  }

  function bringToFront() {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const base = nodesRef.current.filter((n) => !idSet.has(n.id));
    const top = nodesRef.current.filter((n) => idSet.has(n.id));
    setPresent([...base, ...top], true);
  }

  function sendToBack() {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const bottom = nodesRef.current.filter((n) => idSet.has(n.id));
    const rest = nodesRef.current.filter((n) => !idSet.has(n.id));
    setPresent([...bottom, ...rest], true);
  }

  function bringForward() {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    const arr = [...nodesRef.current];
    for (let i = arr.length - 2; i >= 0; i--) {
      if (idSet.has(arr[i].id) && !idSet.has(arr[i + 1].id)) {
        const tmp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = tmp;
      }
    }
    setPresent(arr, true);
  }

  function sendBackward() {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    const arr = [...nodesRef.current];
    for (let i = 1; i < arr.length; i++) {
      if (idSet.has(arr[i].id) && !idSet.has(arr[i - 1].id)) {
        const tmp = arr[i];
        arr[i] = arr[i - 1];
        arr[i - 1] = tmp;
      }
    }
    setPresent(arr, true);
  }

  /** NOTE: comment removed (encoding issue). */
  function alignSelected(horizontal: "left" | "center" | "right" | null, vertical: "top" | "middle" | "bottom" | null) {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const nodes = nodesRef.current;
    const selected = nodes.filter((n) => ids.includes(n.id));
    const minX = Math.min(...selected.map((n) => n.x));
    const maxX = Math.max(...selected.map((n) => n.x + n.w));
    const minY = Math.min(...selected.map((n) => n.y));
    const maxY = Math.max(...selected.map((n) => n.y + n.h));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const nextNodes = nodes.map((node) => {
      if (!ids.includes(node.id)) return node;
      let x = node.x;
      let y = node.y;
      if (horizontal === "left") x = minX;
      else if (horizontal === "center") x = centerX - node.w / 2;
      else if (horizontal === "right") x = maxX - node.w;
      if (vertical === "top") y = minY;
      else if (vertical === "middle") y = centerY - node.h / 2;
      else if (vertical === "bottom") y = maxY - node.h;
      return { ...node, x, y };
    });
    setPresent(nextNodes, true);
  }

  function alignToCanvas(horizontal: "left" | "center" | "right" | null, vertical: "top" | "middle" | "bottom" | null) {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const { width, height } = docMetaRef.current;
    const nextNodes = nodesRef.current.map((node) => {
      if (!idSet.has(node.id)) return node;
      let x = node.x;
      let y = node.y;
      if (horizontal === "left") x = 0;
      else if (horizontal === "center") x = width / 2 - node.w / 2;
      else if (horizontal === "right") x = width - node.w;
      if (vertical === "top") y = 0;
      else if (vertical === "middle") y = height / 2 - node.h / 2;
      else if (vertical === "bottom") y = height - node.h;
      return clampNodeToCanvas({ ...node, x, y }, { width, height });
    });
    setPresent(nextNodes, true);
  }

  /** NOTE: comment removed (encoding issue). */
  function distributeSelected(direction: "horizontal" | "vertical") {
    const ids = selectedIdsRef.current;
    if (ids.length < 2) return;
    const nodes = nodesRef.current;
    const selected = nodes.filter((n) => ids.includes(n.id));
    const idSet = new Set(ids);

    if (direction === "horizontal") {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = Math.max(...sorted.map((n) => n.x + n.w));
      const totalW = sorted.reduce((s, n) => s + n.w, 0);
      const gap = (maxX - minX - totalW) / (sorted.length - 1);
      let curX = minX;
      const updates = new Map<string, number>();
      for (const n of sorted) {
        updates.set(n.id, curX);
        curX += n.w + gap;
      }
      const nextNodes = nodes.map((node) => (idSet.has(node.id) && updates.has(node.id) ? { ...node, x: updates.get(node.id)! } : node));
      setPresent(nextNodes, true);
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = Math.max(...sorted.map((n) => n.y + n.h));
      const totalH = sorted.reduce((s, n) => s + n.h, 0);
      const gap = (maxY - minY - totalH) / (sorted.length - 1);
      let curY = minY;
      const updates = new Map<string, number>();
      for (const n of sorted) {
        updates.set(n.id, curY);
        curY += n.h + gap;
      }
      const nextNodes = nodes.map((node) => (idSet.has(node.id) && updates.has(node.id) ? { ...node, y: updates.get(node.id)! } : node));
      setPresent(nextNodes, true);
    }
  }

  function matchSelectedSize(mode: "width" | "height" | "both") {
    const ids = selectedIdsRef.current;
    if (ids.length < 2) return;
    const primaryId = ids[0];
    const primary = nodesRef.current.find((n) => n.id === primaryId) ?? nodesRef.current.find((n) => ids.includes(n.id));
    if (!primary) return;
    const { width, height } = docMetaRef.current;
    const idSet = new Set(ids);
    const nextNodes = nodesRef.current.map((node) => {
      if (!idSet.has(node.id)) return node;
      if (node.id === primary.id) return node;
      const patch: Partial<CanvasNode> = {};
      if (mode === "width" || mode === "both") patch.w = primary.w;
      if (mode === "height" || mode === "both") patch.h = primary.h;
      return clampNodeToCanvas({ ...node, ...patch }, { width, height });
    });
    setPresent(nextNodes, true);
  }

  function updateNode(id: string, patch: Partial<CanvasNode>, commit = true) {
    const { width, height } = docMetaRef.current;
    const nextNodes = nodesRef.current.map((node) =>
      node.id === id ? clampNodeToCanvas({ ...node, ...patch }, { width, height }) : node,
    );
    setPresent(nextNodes, commit);
  }

  function updateNodeProps(id: string, patch: Record<string, unknown>, commit = true) {
    const nextNodes = nodesRef.current.map((node) => {
      if (node.id !== id) return node;
      const mapped = mapInspectorPropsForRender(node.type, patch);
      const nextProps = { ...(node.props ?? {}), ...mapped };
      let nextAction = node.action;
      if (node.type === "button") {
        const kind = String(nextProps.actionKind ?? "none");
        if (kind === "url") {
          const href = String(nextProps.href ?? "").trim();
          nextAction = href ? { type: "link", url: href } : { type: "none" };
        } else if (kind === "scene") {
          const sid = String(nextProps.sceneId ?? "").trim();
          nextAction = sid ? { type: "scene", sceneId: sid } : { type: "none" };
        } else {
          nextAction = { type: "none" };
        }
      }
      if (node.type === "link") {
        const href = String(nextProps.href ?? "").trim();
        nextAction = href ? { type: "link", url: href } : { type: "none" };
      }
      return { ...node, props: nextProps, action: nextAction };
    });
    setPresent(nextNodes, commit);
  }

  function updateNodeBindKey(id: string, key: string) {
    const node = nodesRef.current.find((n) => n.id === id);
    const nextBind = { ...(node?.bind ?? {}), key: key.trim() ? key.trim() : undefined };
    updateNode(id, { bind: nextBind });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function setSingleSelect(id: string) {
    setSelectedIds([id]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  /** Set node hidden state. */
  function setNodeHidden(id: string, hidden: boolean) {
    updateNode(id, { hidden });
  }

  /** Set node locked state. */
  function setNodeLocked(id: string, locked: boolean) {
    updateNode(id, { locked });
  }

  function computeAlignmentSnapForMove(
    proposedX: number,
    proposedY: number,
    primary: CanvasNode,
    others: CanvasNode[],
    canvas: { width: number; height: number },
    gridEnabled: boolean,
  ): { x: number; y: number; guides: GuideLine[] } {
    const p = rectOf({ ...primary, x: proposedX, y: proposedY });
    const candidatesX: Array<{ v: number; guide: GuideLine }> = [];
    const candidatesY: Array<{ v: number; guide: GuideLine }> = [];

    for (const o of others) {
      const r = rectOf(o);
      // x edges/center
      candidatesX.push({ v: r.l, guide: { kind: "v", x: r.l } });
      candidatesX.push({ v: r.cx, guide: { kind: "v", x: r.cx } });
      candidatesX.push({ v: r.r, guide: { kind: "v", x: r.r } });
      // y edges/center
      candidatesY.push({ v: r.t, guide: { kind: "h", y: r.t } });
      candidatesY.push({ v: r.cy, guide: { kind: "h", y: r.cy } });
      candidatesY.push({ v: r.b, guide: { kind: "h", y: r.b } });
    }

    let snappedX = proposedX;
    let snappedY = proposedY;
    let didSnapX = false;
    let didSnapY = false;
    const outGuides: GuideLine[] = [];

    // Try snap X with l/cx/r
    const px = [
      { k: "l" as const, v: p.l },
      { k: "cx" as const, v: p.cx },
      { k: "r" as const, v: p.r },
    ];
    let bestDx = Infinity;
    let bestX: number | null = null;
    let bestGuideX: GuideLine | null = null;
    for (const pv of px) {
      for (const c of candidatesX) {
        const dx = c.v - pv.v;
        const adx = Math.abs(dx);
        if (adx <= SNAP_THRESHOLD && adx < bestDx) {
          bestDx = adx;
          bestGuideX = c.guide;
          // adjust x based on which anchor matched
          if (pv.k === "l") bestX = proposedX + dx;
          if (pv.k === "cx") bestX = proposedX + dx;
          if (pv.k === "r") bestX = proposedX + dx;
        }
      }
    }
    if (bestX != null && bestGuideX) {
      snappedX = bestX;
      didSnapX = true;
      outGuides.push(bestGuideX);
    }

    // Try snap Y with t/cy/b
    const py = [
      { k: "t" as const, v: p.t },
      { k: "cy" as const, v: p.cy },
      { k: "b" as const, v: p.b },
    ];
    let bestDy = Infinity;
    let bestY: number | null = null;
    let bestGuideY: GuideLine | null = null;
    for (const pv of py) {
      for (const c of candidatesY) {
        const dy = c.v - pv.v;
        const ady = Math.abs(dy);
        if (ady <= SNAP_THRESHOLD && ady < bestDy) {
          bestDy = ady;
          bestGuideY = c.guide;
          bestY = proposedY + dy;
        }
      }
    }
    if (bestY != null && bestGuideY) {
      snappedY = bestY;
      didSnapY = true;
      outGuides.push(bestGuideY);
    }

    // NOTE: comment removed (encoding issue).
    const canvasX = [
      { v: 0, guide: { kind: "v" as const, x: 0 } },
      { v: canvas.width / 2, guide: { kind: "v" as const, x: canvas.width / 2 } },
      { v: canvas.width, guide: { kind: "v" as const, x: canvas.width } },
    ];
    const canvasY = [
      { v: 0, guide: { kind: "h" as const, y: 0 } },
      { v: canvas.height / 2, guide: { kind: "h" as const, y: canvas.height / 2 } },
      { v: canvas.height, guide: { kind: "h" as const, y: canvas.height } },
    ];

    // Only if no other-node snap happened (feels right)
    if (!didSnapX) {
      const p2 = rectOf({ ...primary, x: snappedX, y: snappedY });
      const anchors = [p2.l, p2.cx, p2.r];
      let best = Infinity;
      let bestAdj: number | null = null;
      let bestGuide: GuideLine | null = null;
      for (const a of anchors) {
        for (const c of canvasX) {
          const d = c.v - a;
          const ad = Math.abs(d);
          if (ad <= SNAP_THRESHOLD && ad < best) {
            best = ad;
            bestGuide = c.guide;
            bestAdj = snappedX + d;
          }
        }
      }
      if (bestAdj != null && bestGuide) {
        snappedX = bestAdj;
        outGuides.push(bestGuide);
      }
    }

    if (!didSnapY) {
      const p2 = rectOf({ ...primary, x: snappedX, y: snappedY });
      const anchors = [p2.t, p2.cy, p2.b];
      let best = Infinity;
      let bestAdj: number | null = null;
      let bestGuide: GuideLine | null = null;
      for (const a of anchors) {
        for (const c of canvasY) {
          const d = c.v - a;
          const ad = Math.abs(d);
          if (ad <= SNAP_THRESHOLD && ad < best) {
            best = ad;
            bestGuide = c.guide;
            bestAdj = snappedY + d;
          }
        }
      }
      if (bestAdj != null && bestGuide) {
        snappedY = bestAdj;
        outGuides.push(bestGuide);
      }
    }

    // Grid snap last, but only if axis didn't snap to a guide
    if (gridEnabled) {
      if (!outGuides.some((g) => g.kind === "v")) snappedX = snapToGrid(snappedX, GRID_SIZE);
      if (!outGuides.some((g) => g.kind === "h")) snappedY = snapToGrid(snappedY, GRID_SIZE);
    }

    // clamp to canvas
    snappedX = clamp(snappedX, 0, canvas.width - primary.w);
    snappedY = clamp(snappedY, 0, canvas.height - primary.h);

    return { x: snappedX, y: snappedY, guides: uniq(outGuides.map((g) => (g.kind === "v" ? `v:${g.x}` : `h:${g.y}`))).map((k) => {
      const [kind, v] = k.split(":");
      if (kind === "v") return { kind: "v", x: Number(v) } as GuideLine;
      return { kind: "h", y: Number(v) } as GuideLine;
    }) };
  }

  function startMoveDrag(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    event.preventDefault();

    const nowNodes = nodesRef.current;
    const clicked = nowNodes.find((n) => n.id === id);
    if (!clicked) return;
    if (clicked.locked) return;

    const ids = selectedIdsRef.current.includes(id) ? selectedIdsRef.current : [id];
    const origins: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const nid of ids) {
      const n = nowNodes.find((x) => x.id === nid);
      if (n) origins[nid] = { x: n.x, y: n.y, w: n.w, h: n.h };
    }

    dragRef.current = {
      mode: "move",
      primaryId: id,
      ids,
      startX: event.clientX,
      startY: event.clientY,
      origins,
      didBeginHistory: false,
    };
  }

  function startResize(event: ReactPointerEvent<HTMLElement>, id: string, handle: "nw" | "ne" | "sw" | "se") {
    event.preventDefault();
    event.stopPropagation();
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node) return;
    if (node.locked) return;

    dragRef.current = {
      mode: "resize",
      id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: node.x, y: node.y, w: node.w, h: node.h },
      handle,
      didBeginHistory: false,
    };
  }

  useEffect(() => {
    function handleMove(ev: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;

      beginGestureHistoryOnce();

      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;

      const nowNodes = nodesRef.current;
      const { width, height } = docMetaRef.current;
      const gridEnabled = gridSnapRef.current;

      if (drag.mode === "move") {
        const primaryNow = nowNodes.find((n) => n.id === drag.primaryId);
        if (!primaryNow) return;

        // others = all nodes except selected
        const selected = new Set(drag.ids);
        const others = nowNodes.filter((n) => !selected.has(n.id));

        const originPrimary = drag.origins[drag.primaryId] ?? { x: primaryNow.x, y: primaryNow.y, w: primaryNow.w, h: primaryNow.h };

        const proposedX = originPrimary.x + dx;
        const proposedY = originPrimary.y + dy;

        const snap = computeAlignmentSnapForMove(
          proposedX,
          proposedY,
          { ...primaryNow, x: originPrimary.x, y: originPrimary.y },
          others,
          { width, height },
          gridEnabled,
        );

        setGuides(snap.guides);

        const appliedDx = snap.x - originPrimary.x;
        const appliedDy = snap.y - originPrimary.y;

        const nextNodes = nowNodes.map((n) => {
          if (!selected.has(n.id)) return n;
          const o = drag.origins[n.id];
          if (!o) return n;
          const nextXRaw = o.x + appliedDx;
          const nextYRaw = o.y + appliedDy;
          const nextX = clamp(nextXRaw, 0, width - n.w);
          const nextY = clamp(nextYRaw, 0, height - n.h);
          return { ...n, x: nextX, y: nextY };
        });

        setPresent(nextNodes, false);
        return;
      }

      // resize (single)
      const nodeNow = nowNodes.find((n) => n.id === drag.id);
      if (!nodeNow) return;

      const minSize = 24;
      let nextX = drag.origin.x;
      let nextY = drag.origin.y;
      let nextW = drag.origin.w;
      let nextH = drag.origin.h;

      const h = drag.handle;

      if (h.includes("e")) nextW = clamp(drag.origin.w + dx, minSize, width - drag.origin.x);
      if (h.includes("s")) nextH = clamp(drag.origin.h + dy, minSize, height - drag.origin.y);
      if (h.includes("w")) {
        nextW = clamp(drag.origin.w - dx, minSize, drag.origin.w + drag.origin.x);
        nextX = drag.origin.x + (drag.origin.w - nextW);
      }
      if (h.includes("n")) {
        nextH = clamp(drag.origin.h - dy, minSize, drag.origin.h + drag.origin.y);
        nextY = drag.origin.y + (drag.origin.h - nextH);
      }

      if (gridEnabled) {
        nextX = snapToGrid(nextX, GRID_SIZE);
        nextY = snapToGrid(nextY, GRID_SIZE);
        nextW = snapToGrid(nextW, GRID_SIZE);
        nextH = snapToGrid(nextH, GRID_SIZE);
      }

      // clamp
      nextX = clamp(nextX, 0, width - minSize);
      nextY = clamp(nextY, 0, height - minSize);
      nextW = clamp(nextW, minSize, width);
      nextH = clamp(nextH, minSize, height);

      const nextNodes = nowNodes.map((n) =>
        n.id === drag.id ? { ...n, x: nextX, y: nextY, w: nextW, h: nextH } : n,
      );

      setGuides([]);
      setPresent(nextNodes, false);
    }

    function handleUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      setGuides([]);
      // gesture ended: present already set; history past already created in beginGestureHistoryOnce()
      setHistory((prev) => ({ ...prev, future: [] }));
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  
  function normalizeToV2(content: unknown): ContentV2 {
    const record = content && typeof content === "object" ? (content as Record<string, unknown>) : null;
    const recordWidth = record?.["width"];
    const recordHeight = record?.["height"];
    const baseWidth = typeof recordWidth === "number" && Number.isFinite(recordWidth) ? recordWidth : DEFAULT_CANVAS.width;
    const baseHeight = typeof recordHeight === "number" && Number.isFinite(recordHeight) ? recordHeight : DEFAULT_CANVAS.height;

    if (record && record["schema"] === "canvas_v2" && Array.isArray(record["scenes"])) {
      const scenes: Scene[] = (record["scenes"] as unknown[])
        .filter((scene): scene is Record<string, unknown> => !!scene && typeof scene === "object")
        .map((scene, idx) => {
          const sceneId = typeof scene["id"] === "string" && scene["id"] ? scene["id"] : genSceneId(`scene${idx + 1}`);
          const sceneName =
            typeof scene["name"] === "string" && scene["name"].trim() ? scene["name"].slice(0, 40) : `씬 ${idx + 1}`;
          const sceneWidth =
            typeof scene["width"] === "number" && Number.isFinite(scene["width"]) ? (scene["width"] as number) : baseWidth;
          const sceneHeight =
            typeof scene["height"] === "number" && Number.isFinite(scene["height"]) ? (scene["height"] as number) : baseHeight;
          const nodes = Array.isArray(scene["nodes"]) ? (scene["nodes"] as CanvasNode[]) : [];
          return {
            id: sceneId,
            name: sceneName,
            width: sceneWidth,
            height: sceneHeight,
            nodes,
          };
        });

      const start =
        typeof record["startSceneId"] === "string" && record["startSceneId"]
          ? (record["startSceneId"] as string)
          : scenes[0]?.id ?? genSceneId();

      return {
        schema: "canvas_v2",
        startSceneId: scenes.some((s) => s.id === start) ? start : scenes[0]?.id ?? start,
        scenes: scenes.length
          ? scenes
          : [
              {
                id: start,
                name: "씬 1",
                width: baseWidth,
                height: baseHeight,
                nodes: Array.isArray(record["nodes"]) ? (record["nodes"] as CanvasNode[]) : [],
              },
            ],
      };
    }

    const nodes = record && Array.isArray(record["nodes"]) ? (record["nodes"] as CanvasNode[]) : [];
    const sid = genSceneId();
    return { schema: "canvas_v2", startSceneId: sid, scenes: [{ id: sid, name: "씬 1", width: baseWidth, height: baseHeight, nodes }] };
  }

  function getActiveScene(v2: ContentV2, sid: string | null) {
    const id = sid && v2.scenes.some((s) => s.id === sid) ? sid : v2.startSceneId;
    return v2.scenes.find((s) => s.id === id) ?? v2.scenes[0];
  }

  function replaceScene(v2: ContentV2, sid: string, patch: Partial<Scene>): ContentV2 {
    return {
      ...v2,
      scenes: v2.scenes.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
    };
  }

  function extractPageId(data: unknown): string | null {
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const pageRecord = record["page"] && typeof record["page"] === "object" ? (record["page"] as Record<string, unknown>) : {};
    const candidates = [pageRecord["id"], record["pageId"], record["id"], pageRecord["pageId"]];
    const found = candidates.find((v) => typeof v === "string" && v.length > 0);
    return found ?? null;
  }

  function extractError(data: unknown): string {
    if (!data || typeof data !== "object") return "Request failed.";
    const record = data as Record<string, unknown>;
    const msg = record["error"] ?? record["message"] ?? record["detail"];
    return typeof msg === "string" && msg ? msg : "Request failed.";
  }

  async function saveDraft(): Promise<string | null> {
    if (status !== "idle") return pageId;
    setStatus("saving");
    setMessage(null);

    // NOTE: comment removed (encoding issue).
    // NOTE: comment removed (encoding issue).
    const scenesLatest = scenes.map((s) =>
      s.id === (activeSceneId ?? s.id) ? { ...s, nodes: nodesRef.current } : s,
    );
    const fallbackSceneId = activeSceneId ?? startSceneId ?? "scene_1";
    const scenesForSave =
      scenesLatest.length > 0
        ? scenesLatest
        : [
            {
              id: fallbackSceneId,
              name: "씬 1",
              width: docMetaRef.current.width,
              height: docMetaRef.current.height,
              nodes: nodesRef.current,
            },
          ];
    const startPageId = activeSceneId ?? startSceneId ?? scenesForSave[0]?.id ?? "";

    const payload = {
      title: title.trim() ? title.trim() : null,
      content: {
        // NOTE: comment removed (encoding issue).
        schema: "null_canvas",
        startPageId,
        pages: scenesForSave.map((s) => ({
          id: s.id,
          name: s.name,
          viewport: {
            kind: s.width >= 800 ? "web" : s.width <= 420 ? "mobile" : "app",
            width: s.width,
            height: s.height,
          },
          nodes: s.nodes,
        })),
        state: {},

        // Preserve width/height/nodes snapshot when duplicating the doc
        width: docMeta.width,
        height: docMeta.height,
        nodes: nodesRef.current,
      },
    };

    try {
      if (!pageId) {
        const res = await fetch("/api/pages", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setMessage(extractError(data));
          return null;
        }
        const createdId = extractPageId(data);
        if (!createdId) {
          setMessage("저장 실패: pageId가 없습니다.");
          return null;
        }
        setPageId(createdId);
        router.replace(`/editor?pageId=${createdId}`);
        setMessage("임시 저장 완료");
        return createdId;
      }

      const res = await fetch(`/api/pages/${pageId}/version`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(extractError(data));
        return null;
      }

      setMessage("버전 저장 완료");
      return pageId;
    } catch {
      setMessage("저장 실패");
      return null;
    } finally {
      setStatus("idle");
    }
  }

  function openPublishModal() {
    if (status !== "idle") return;
    setMessage(null);
    setShowPublishModal(true);
  }

  async function doPublish() {
    if (status !== "idle") return;
    setShowPublishModal(false);
    setMessage(null);

    try {
      const targetId = await saveDraft();
      if (!targetId) return;

      setStatus("publishing");

      const res = await fetch(`/api/pages/${targetId}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error ?? data?.message ?? "배포 실패");
        return;
      }

      const liveId = data?.page?.id ?? data?.pageId ?? targetId;
      router.push(`/p/${liveId}`);
    } catch {
      setMessage("배포 실패");
    } finally {
      setStatus("idle");
    }
  }

  function preview() {
    setShowPreview(true);
  }

  // NOTE: comment removed (encoding issue).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      // Esc
      if (e.key === "Escape") {
        if (showPreview) setShowPreview(false);
        else clearSelection();
        return;
      }

      // Save: Ctrl/Cmd+S
      if (meta && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void saveDraft();
        return;
      }

      // Publish: Ctrl/Cmd+Enter
      if (meta && e.key === "Enter") {
        e.preventDefault();
        openPublishModal();
        return;
      }

      // Undo/Redo
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (shift) redo();
        else undo();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicate
      if (meta && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (meta && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        const allIds = nodesRef.current.map((n) => n.id);
        if (allIds.length > 0) setSelectedIds(allIds);
        return;
      }

      // Copy: keep selected nodes in buffer
      if (meta && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        const ids = selectedIdsRef.current;
        if (ids.length > 0) {
          const buf = nodesRef.current.filter((n) => ids.includes(n.id));
          copyBufferRef.current = buf.length > 0 ? buf : null;
        }
        return;
      }

      // NOTE: comment removed (encoding issue).
      if (meta && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        const buf = copyBufferRef.current;
        if (!buf || buf.length === 0) return;
        const offset = gridSnapRef.current ? GRID_SIZE : 8;
        const newNodes = buf.map((n) => ({
          ...n,
          id: genNodeId("node"),
          x: n.x + offset,
          y: n.y + offset,
        }));
        const next = [...nodesRef.current, ...newNodes];
        setPresent(next, true);
        setSelectedIds(newNodes.map((n) => n.id));
        setMessage("붙여넣기 완료");
        return;
      }

      // NOTE: comment removed (encoding issue).
      if (meta && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        const ids = selectedIdsRef.current;
        if (ids.length > 0) {
          const buf = nodesRef.current.filter((n) => ids.includes(n.id));
          if (buf.length > 0) {
            copyBufferRef.current = buf;
            deleteSelected();
            setMessage("잘라내기 완료");
          }
        }
        return;
      }

      // Layer
      if (meta && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        if (e.key === "]") {
          if (shift) bringToFront();
          else bringForward();
        } else {
          if (shift) sendToBack();
          else sendBackward();
        }
        return;
      }

      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdsRef.current.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }

      // Arrow nudge
      const stepBase = gridSnapRef.current ? GRID_SIZE : 1;
      const step = shift ? stepBase * 10 : stepBase;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudgeSelected(-step, 0);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nudgeSelected(step, 0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        nudgeSelected(0, -step);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        nudgeSelected(0, step);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, status, pageId, title, docMeta.width, docMeta.height]);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">NULL</span>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="페이지 제목"
              aria-label="페이지 제목"
              className="w-56 rounded-[10px] border border-neutral-200 px-3 py-2 text-xs"
            />

            <div className="hidden items-center gap-2 text-xs text-neutral-600 md:flex">
              <button type="button" onClick={undo} disabled={!canUndo} className="rounded-full border px-3 py-1 disabled:opacity-40">
                실행 취소
              </button>
              <button type="button" onClick={redo} disabled={!canRedo} className="rounded-full border px-3 py-1 disabled:opacity-40">
                다시 실행
              </button>
              <button type="button" onClick={duplicateSelected} disabled={selectedCount === 0} className="rounded-full border px-3 py-1 disabled:opacity-40">
                복제
              </button>
              <button type="button" onClick={deleteSelected} disabled={selectedCount === 0} className="rounded-full border px-3 py-1 disabled:opacity-40">
                삭제
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setGridSnap((prev) => !prev)} className="rounded-full border px-3 py-2 text-xs">
              그리드: {gridSnap ? "켜짐" : "꺼짐"}
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <button type="button" onClick={sendBackward} disabled={selectedCount === 0} className="rounded-full border px-3 py-2 text-xs disabled:opacity-40">
                뒤로
              </button>
              <button type="button" onClick={bringForward} disabled={selectedCount === 0} className="rounded-full border px-3 py-2 text-xs disabled:opacity-40">
                앞으로
              </button>
            </div>

            <button
              type="button"
              onClick={saveDraft}
              disabled={status !== "idle"}
              className="rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-900 disabled:opacity-50"
              title="Ctrl/Cmd+S"
            >
              {status === "saving" ? "저장 중..." : "저장"}
            </button>

            <button
              type="button"
              onClick={openPublishModal}
              disabled={status !== "idle"}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              title="Ctrl/Cmd+Enter"
            >
              {status === "publishing" ? "배포 중..." : "배포"}
            </button>

            <button type="button" onClick={preview} className="rounded-full border px-3 py-2 text-xs">
              미리보기
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[180px_1fr_280px]">
        {/* 도구함 */}
        <aside className="rounded-[14px] border border-neutral-200 p-4 text-xs text-neutral-700">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">도구함</div>
          <div className="mt-2 text-[11px] text-neutral-600">
            제한: 버튼 {constraintCounts.buttonCount}/{features.maxButtons} · 텍스트 {constraintCounts.textCount}/{features.maxTexts} · 이미지{" "}
            {constraintCounts.imageCount}/{features.maxImages}
          </div>
          <div className="mt-4 rounded-[12px] border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-neutral-700">씬</div>
              <button
                type="button"
                onClick={addScene}
                className="rounded-full border border-neutral-200 px-2 py-1 text-[11px]"
              >
                + 추가
              </button>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              {scenes.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded-[10px] border px-2 py-1 ${
                    s.id === activeSceneId ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => switchScene(s.id)}
                    className="flex-1 truncate text-left text-[11px] text-neutral-900"
                    title={s.name}
                  >
                    {s.name}
                  </button>

                  <button
                    type="button"
                    onClick={() => duplicateScene(s.id)}
                    className="rounded-full border border-neutral-200 px-2 py-1 text-[10px]"
                    title="복제"
                  >
                    복제
                  </button>
                </div>
              ))}
            </div>

            {activeSceneId ? (
              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">이름 변경</div>
                <input
                  type="text"
                  value={scenes.find((s) => s.id === activeSceneId)?.name ?? ""}
                  onChange={(e) => renameScene(activeSceneId, e.target.value)}
                  onBlur={() => {
                    if (!activeSceneId) return;
                    const idx = scenes.findIndex((s) => s.id === activeSceneId);
                    const cur = scenes.find((s) => s.id === activeSceneId);
                    if (!cur) return;
                    if (cur.name.trim().length === 0) {
                      const fallback = `씬 ${idx >= 0 ? idx + 1 : 1}`;
                      setScenes((prev) => prev.map((s) => (s.id === activeSceneId ? { ...s, name: fallback } : s)));
                      setMessage("씬 이름은 비워둘 수 없습니다.");
                    }
                  }}
                  className="mt-2 w-full rounded-[10px] border border-neutral-200 px-3 py-2 text-[11px]"
                  aria-label="씬 이름"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {TOOLBOX_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{group.title}</div>
                <div className="mt-2 flex flex-col gap-2">
                  {group.items.map((type) => {
                    const atLimit =
                      (type === "button" && constraintCounts.buttonCount >= features.maxButtons) ||
                      (type === "text" && constraintCounts.textCount >= features.maxTexts) ||
                      (type === "image" && constraintCounts.imageCount >= features.maxImages) ||
                      constraintCounts.totalElements >= features.maxElements;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addNode(type)}
                        disabled={atLimit}
                        className="flex items-center justify-between rounded-[10px] border border-neutral-200 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {NODE_TYPE_LABELS[type] ?? type}
                        <span className="text-[10px] text-neutral-400">+</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 레이어 목록: 표시/잠금/이름 */}
          {nodes.length > 0 ? (
            <div className="mt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">레이어</div>
              <ul className="mt-2 flex flex-col gap-0.5">
                {[...nodes].reverse().map((node) => {
                  const isSelected = selectedSet.has(node.id);
                  const name = String((node.props as Record<string, unknown>)?.layerName ?? NODE_TYPE_LABELS[node.type] ?? node.type);
                  const isEditing = editingLayerId === node.id;
                  return (
                    <li
                      key={node.id}
                      className={`flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] ${
                        isSelected ? "border-neutral-900 bg-neutral-100" : "border-transparent hover:bg-neutral-50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setNodeHidden(node.id, !node.hidden)}
                        className="shrink-0 rounded p-0.5 hover:bg-neutral-200"
                        title={node.hidden ? "표시" : "숨김"}
                        aria-label={node.hidden ? "표시" : "숨김"}
                      >
                        {node.hidden ? (
                          <span className="text-neutral-400">H</span>
                        ) : (
                          <span className="text-neutral-600">V</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNodeLocked(node.id, !node.locked)}
                        className="shrink-0 rounded p-0.5 hover:bg-neutral-200"
                        title={node.locked ? "잠금 해제" : "잠금"}
                        aria-label={node.locked ? "잠금 해제" : "잠금"}
                      >
                        {node.locked ? (
                          <span className="text-neutral-600">L</span>
                        ) : (
                          <span className="text-neutral-400">U</span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left"
                        onClick={() => setSingleSelect(node.id)}
                        onDoubleClick={() => setEditingLayerId(node.id)}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={name}
                            autoFocus
                            className="w-full rounded border border-neutral-300 px-1 py-0.5 text-[11px]"
                            onChange={(e) => updateNodeProps(node.id, { layerName: e.target.value })}
                            onBlur={() => setEditingLayerId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setEditingLayerId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="block truncate">{name || node.type}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 rounded-[12px] bg-neutral-50 p-3 text-[11px] text-neutral-600">
            <div className="font-semibold text-neutral-700">단축키</div>
            <div className="mt-2 space-y-1">
              <div>Ctrl/Cmd+A: 모두 선택 | Esc: 선택 해제</div>
              <div>Shift+클릭: 다중 선택 | 드래그: 박스 선택</div>
              <div>Ctrl/Cmd+C/V/X: 복사/붙여넣기/잘라내기</div>
              <div>Del/Backspace: 삭제 | Ctrl/Cmd+D: 복제</div>
              <div>Ctrl/Cmd+Z / Shift+Z: 실행 취소/다시 실행</div>
              <div>방향키: 미세 이동 (Shift: 10px)</div>
              <div>Ctrl/Cmd+[ ]: 레이어 순서 (Shift: 맨앞/맨뒤)</div>
              <div>Ctrl/Cmd+S: 저장 | Ctrl/Cmd+Enter: 배포</div>
              <div>속성: X,Y,W,H | 회전 | 투명도 | 캔버스 W,H</div>
              <div>Space+드래그: 패닝 | Ctrl+휠: 줌</div>
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <section className="flex flex-col items-center gap-4">
          {message ? (
            <div className="w-full text-right text-[11px] text-red-500" role="status" aria-live="polite">
              {message}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z) - 1)] ?? z)}
              className="rounded-full border px-3 py-1"
              title="축소"
            >
              -
            </button>
            <button type="button" onClick={() => setZoom(1)} className="rounded-full border px-3 py-1" title="100%">
              100%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(z) + 1)] ?? z)}
              className="rounded-full border px-3 py-1"
              title="확대"
            >
              +
            </button>
            <span className="text-neutral-500">{Math.round(zoom * 100)}%</span>
          </div>
          <div
            className="overflow-auto rounded-[16px] border border-neutral-200 bg-neutral-50 p-6"
            style={{ maxHeight: "70vh" }}
            onWheel={(e) => {
              if (!e.ctrlKey) return;
              e.preventDefault();
              if (e.deltaY < 0) setZoom((z) => ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(z) + 1)] ?? z);
              else setZoom((z) => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z) - 1)] ?? z);
            }}
          >
            <div
              style={{ width: docMeta.width * zoom + 400, height: docMeta.height * zoom + 400, transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
              <div
                ref={canvasRef}
                className="relative"
                style={{
                  width: docMeta.width,
                  height: docMeta.height,
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
                onPointerDown={(e) => {
                  if ((e as { shiftKey?: boolean }).shiftKey) return;
                  const el = canvasRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const canvasX = (e.clientX - rect.left) / zoom;
                  const canvasY = (e.clientY - rect.top) / zoom;
                  if (spaceKeyRef.current) {
                    panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: pan.x, panY: pan.y };
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    return;
                  }
                  setBoxSelect({ startX: canvasX, startY: canvasY, currentX: canvasX, currentY: canvasY });
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (panStartRef.current) {
                    setPan({
                      x: panStartRef.current.panX + e.clientX - panStartRef.current.clientX,
                      y: panStartRef.current.panY + e.clientY - panStartRef.current.clientY,
                    });
                    return;
                  }
                  if (!boxSelect) return;
                  const el = canvasRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / zoom;
                  const y = (e.clientY - rect.top) / zoom;
                  setBoxSelect((prev) =>
                    prev ? { ...prev, currentX: x, currentY: y } : null,
                  );
                }}
              onPointerUp={(e) => {
                if (panStartRef.current) {
                  panStartRef.current = null;
                  try {
                    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  } catch {}
                  return;
                }
                if (!boxSelect) return;
                const nodesList = nodesRef.current;
                const minX = Math.min(boxSelect.startX, boxSelect.currentX);
                const maxX = Math.max(boxSelect.startX, boxSelect.currentX);
                const minY = Math.min(boxSelect.startY, boxSelect.currentY);
                const maxY = Math.max(boxSelect.startY, boxSelect.currentY);
                const isClick = maxX - minX < 5 && maxY - minY < 5;
                const ids = isClick
                  ? []
                  : nodesList
                      .filter(
                        (n) =>
                          n.x < maxX &&
                          n.x + n.w > minX &&
                          n.y < maxY &&
                          n.y + n.h > minY,
                      )
                      .map((n) => n.id);
                setSelectedIds(ids);
                setBoxSelect(null);
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {}
              }}
              onPointerCancel={(e) => {
                panStartRef.current = null;
                if (boxSelect) {
                  setBoxSelect(null);
                }
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {}
              }}
            >
              {/* Render content */}
              <div className="pointer-events-none">
                <CanvasRender doc={docMeta} showGrid={gridSnap} className="shadow-none" />
              </div>

              {/* Guides */}
              {guides.map((g, idx) =>
                g.kind === "v" ? (
                  <div
                    key={`g-v-${idx}-${g.x}`}
                    className="pointer-events-none absolute top-0 z-30 h-full w-px bg-neutral-900/40"
                    style={{ left: g.x }}
                  />
                ) : (
                  <div
                    key={`g-h-${idx}-${g.y}`}
                    className="pointer-events-none absolute left-0 z-30 w-full h-px bg-neutral-900/40"
                    style={{ top: g.y }}
                  />
                ),
              )}

              {/* NOTE: comment removed (encoding issue). */}
              {boxSelect ? (
                <div
                  className="pointer-events-none absolute z-10 border-2 border-neutral-900/60 bg-neutral-900/10"
                  style={{
                    left: Math.min(boxSelect.startX, boxSelect.currentX),
                    top: Math.min(boxSelect.startY, boxSelect.currentY),
                    width: Math.abs(boxSelect.currentX - boxSelect.startX),
                    height: Math.abs(boxSelect.currentY - boxSelect.startY),
                  }}
                />
              ) : null}

              {/* Selection overlays */}
              {nodes.map((node) => {
                const isSelected = selectedSet.has(node.id);
                const showHandles = isSelected && selectedCount === 1;
                return (
                  <div
                    key={node.id}
                    role="presentation"
                    className={`absolute z-20 border ${
                      isSelected ? "border-neutral-900" : "border-transparent"
                    }`}
                    style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
                    onPointerDown={(event) => {
                      event.stopPropagation();

                      // Preview: run basic actions when preview mode is enabled.
                      if (showPreview && (node.type === "button" || node.type === "link")) {
                        const props = node.props as Record<string, unknown>;
                        if (node.type === "link") {
                          const href = String(props.href ?? "");
                          if (href.trim()) window.open(href.trim(), "_blank", "noopener,noreferrer");
                          return;
                        }
                        const kind = String(props.actionKind ?? "none");
                        if (kind === "url") {
                          const href = String(props.href ?? "");
                          if (href.trim()) window.open(href.trim(), "_blank", "noopener,noreferrer");
                          return;
                        }
                        if (kind === "scene") {
                          const sid = String(props.sceneId ?? "");
                          if (sid) switchScene(sid);
                          return;
                        }
                        // actionKind === "none": no preview action
                        return;
                      }


                      const shift = (event as { shiftKey?: boolean }).shiftKey === true;
                      if (shift) {
                        toggleSelect(node.id);
                        // Shift + click toggles selection and keeps a stable set
                        const nextSel = selectedIdsRef.current.includes(node.id)
                          ? selectedIdsRef.current.filter((x) => x !== node.id)
                          : [...selectedIdsRef.current, node.id];
                        const stable = nextSel.length ? nextSel : [node.id];
                        // Avoid empty selection to keep drag behavior stable
                        setSelectedIds(stable);
                        startMoveDrag(event, node.id);
                        return;
                      }

                      // Single click: select then drag
                      if (!selectedIdsRef.current.includes(node.id) || selectedIdsRef.current.length !== 1) {
                        setSingleSelect(node.id);
                      }
                      startMoveDrag(event, node.id);
                    }}
                  >
                    {showHandles ? (
                      <>
                        {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                          <span
                            key={handle}
                            role="presentation"
                            className="absolute h-2 w-2 rounded-full bg-neutral-900"
                            style={{
                              left: handle.includes("w") ? -4 : "auto",
                              right: handle.includes("e") ? -4 : "auto",
                              top: handle.includes("n") ? -4 : "auto",
                              bottom: handle.includes("s") ? -4 : "auto",
                            }}
                            onPointerDown={(event) => startResize(event, node.id, handle)}
                          />
                        ))}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </section>

        {/* 속성 */}
        <aside className="rounded-[14px] border border-neutral-200 p-4 text-xs text-neutral-600">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">속성</div>

          {/* Multi select */}
          {selectedCount > 1 ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[12px] bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-800">{selectedCount}개 선택됨</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={bringToFront} className="rounded-full border px-3 py-1 text-[11px]">
                    맨 앞으로
                  </button>
                  <button type="button" onClick={sendToBack} className="rounded-full border px-3 py-1 text-[11px]">
                    맨 뒤로
                  </button>
                  <button type="button" onClick={bringForward} className="rounded-full border px-3 py-1 text-[11px]">
                    앞으로
                  </button>
                  <button type="button" onClick={sendBackward} className="rounded-full border px-3 py-1 text-[11px]">
                    뒤로
                  </button>
                  <button type="button" onClick={duplicateSelected} className="rounded-full border px-3 py-1 text-[11px]">
                    복제
                  </button>
                  <button type="button" onClick={deleteSelected} className="rounded-full border px-3 py-1 text-[11px]">
                    삭제
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 border-t border-neutral-200 pt-2">
                  <span className="w-full text-[10px] text-neutral-500">정렬</span>
                  <button
                    type="button"
                    onClick={() => alignSelected("left", null)}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="왼쪽 정렬"
                  >
                    왼쪽
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelected("center", null)}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="가운데 정렬"
                  >
                    가운데
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelected("right", null)}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="오른쪽 정렬"
                  >
                    오른쪽
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelected(null, "top")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="위쪽 정렬"
                  >
                    위
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelected(null, "middle")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="가운데 정렬"
                  >
                    가운데
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelected(null, "bottom")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="아래쪽 정렬"
                  >
                    아래
                  </button>
                  <button
                    type="button"
                    onClick={() => distributeSelected("horizontal")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="가로 분배"
                  >
                    가로 분배
                  </button>
                  <button
                    type="button"
                    onClick={() => distributeSelected("vertical")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="세로 분배"
                  >
                    세로 분배
                  </button>
                  <span className="w-full text-[10px] text-neutral-500">캔버스 정렬</span>
                  <button
                    type="button"
                    onClick={() => alignToCanvas("left", null)}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="캔버스 왼쪽"
                  >
                    왼쪽
                  </button>
                  <button
                    type="button"
                    onClick={() => alignToCanvas("center", null)}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="캔버스 가로 가운데"
                  >
                    가운데
                  </button>
                  <button
                    type="button"
                    onClick={() => alignToCanvas("right", null)}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="캔버스 오른쪽"
                  >
                    오른쪽
                  </button>
                  <button
                    type="button"
                    onClick={() => alignToCanvas(null, "top")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="캔버스 위쪽"
                  >
                    위
                  </button>
                  <button
                    type="button"
                    onClick={() => alignToCanvas(null, "middle")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="캔버스 세로 가운데"
                  >
                    가운데
                  </button>
                  <button
                    type="button"
                    onClick={() => alignToCanvas(null, "bottom")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="캔버스 아래쪽"
                  >
                    아래
                  </button>
                  <span className="w-full text-[10px] text-neutral-500">크기 맞춤</span>
                  <button
                    type="button"
                    onClick={() => matchSelectedSize("width")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="너비 맞춤"
                  >
                    너비
                  </button>
                  <button
                    type="button"
                    onClick={() => matchSelectedSize("height")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="높이 맞춤"
                  >
                    높이
                  </button>
                  <button
                    type="button"
                    onClick={() => matchSelectedSize("both")}
                    className="rounded-full border px-2 py-1 text-[10px]"
                    title="가로·세로 맞춤"
                  >
                    둘 다
                  </button>
                </div>
              </div>

              <div className="rounded-[12px] bg-neutral-50 p-3 text-[11px] text-neutral-600">
                <div className="font-semibold text-neutral-700">이동</div>
                <div className="mt-2">화살표 키로 이동, Shift = 10px, 그리드 스냅 = 8px.</div>
              </div>
            </div>
          ) : null}

          {/* Single select */}
          {selectedNode ? (
            <div className="mt-4 flex flex-col gap-3">
              {/* NOTE: comment removed (encoding issue). */}
              <div className="rounded-[12px] bg-neutral-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">변형</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PropertyField label="X" value={selectedNode.x} onChange={(v) => updateNode(selectedNode.id, { x: v })} />
                  <PropertyField label="Y" value={selectedNode.y} onChange={(v) => updateNode(selectedNode.id, { y: v })} />
                  <PropertyField label="W" value={selectedNode.w} onChange={(v) => updateNode(selectedNode.id, { w: v })} />
                  <PropertyField label="H" value={selectedNode.h} onChange={(v) => updateNode(selectedNode.id, { h: v })} />
                  <PropertyField label="회전" value={typeof selectedNode.rotation === "number" ? selectedNode.rotation : 0} onChange={(v) => updateNode(selectedNode.id, { rotation: v })} />
                  <PropertyField label="투명도" value={typeof selectedNode.opacity === "number" ? selectedNode.opacity : 1} onChange={(v) => updateNode(selectedNode.id, { opacity: Math.max(0, Math.min(1, Number(v))) })} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={sendBackward} className="rounded-full border px-3 py-1 text-[11px]">
                    뒤로
                  </button>
                  <button type="button" onClick={bringForward} className="rounded-full border px-3 py-1 text-[11px]">
                    앞으로
                  </button>
                  <button type="button" onClick={duplicateSelected} className="rounded-full border px-3 py-1 text-[11px]">
                    복제
                  </button>
                  <button type="button" onClick={deleteSelected} className="rounded-full border px-3 py-1 text-[11px]">
                    삭제
                  </button>
                </div>
              </div>

              <div className="rounded-[12px] bg-neutral-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">효과</div>
                <div className="mt-3 space-y-3">
                  <TextField
                    label="그림자"
                    value={String(selectedNode.props.shadow ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { shadow: value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <PropertyField
                      label="블러(px)"
                      value={Number(selectedNode.props.blur ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { blur: Math.max(0, Number(value)) })}
                    />
                    <SelectField
                      label="블렌드"
                      value={String(selectedNode.props.blendMode ?? "normal")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { blendMode: value })}
                      options={BLEND_MODE_OPTIONS}
                    />
                  </div>
                  <div className="text-[10px] text-neutral-400">예시: 0 12px 30px rgba(0,0,0,0.15)</div>
                </div>
              </div>

              {/* Node details */}
              {selectedNode.type === "text" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="텍스트"
                    value={String(selectedNode.props.text ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { text: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="색상"
                      value={String(selectedNode.props.color ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <SelectField
                      label="정렬"
                      value={String(selectedNode.props.align ?? "left")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { align: value })}
                      options={TEXT_ALIGN_OPTIONS}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 16)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="굵기"
                      value={resolveFontWeight(selectedNode.props as Record<string, unknown>, 500)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontWeight: value })}
                    />
                    <PropertyField
                      label="줄 간격"
                      value={Number(selectedNode.props.lineHeight ?? 1.4)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { lineHeight: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="기울임"
                      value={String(selectedNode.props.fontStyle ?? "normal")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontStyle: value })}
                      options={FONT_STYLE_OPTIONS}
                    />
                    <SelectField
                      label="변환"
                      value={String(selectedNode.props.textTransform ?? "none")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textTransform: value })}
                      options={TEXT_TRANSFORM_OPTIONS}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "button" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="라벨"
                    value={String(selectedNode.props.label ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { label: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="채우기"
                      value={String(selectedNode.props.fill ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                    />
                    <ColorField
                      label="텍스트 색상"
                      value={String(selectedNode.props.color ?? "#FFFFFF")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 999)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 13)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="굵기"
                      value={resolveFontWeight(selectedNode.props as Record<string, unknown>, 600)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontWeight: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="정렬"
                      value={String(selectedNode.props.textAlign ?? "center")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textAlign: value })}
                      options={TEXT_ALIGN_OPTIONS}
                    />
                    <SelectField
                      label="변환"
                      value={String(selectedNode.props.textTransform ?? "none")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textTransform: value })}
                      options={TEXT_TRANSFORM_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="스타일"
                      value={String(selectedNode.props.variant ?? "primary")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { variant: value })}
                      options={[
                        { value: "primary", label: "기본" },
                        { value: "outline", label: "아웃라인" },
                      ]}
                    />
                    <SelectField
                      label="기울임"
                      value={String(selectedNode.props.fontStyle ?? "normal")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontStyle: value })}
                      options={FONT_STYLE_OPTIONS}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <ColorField
                      label="테두리 색상"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.fill ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                  </div>

                  {/* Transition (Phase1) */}
                  <div className="mt-4 border-t border-neutral-100 pt-3">
                    <SelectField
                      label="동작"
                      value={String(selectedNode.props.actionKind ?? "none")}
                      onChange={(value) =>
                        updateNodeProps(selectedNode.id, {
                          actionKind: value,
                        })
                      }
                      options={[
                        { value: "none", label: "없음" },
                        { value: "url", label: "URL 이동" },
                        { value: "scene", label: "씬 전환" },
                      ]}
                    />

                    {String(selectedNode.props.actionKind ?? "none") === "url" ? (
                      <div className="mt-3">
                        <TextField
                          label="URL"
                          value={String(selectedNode.props.href ?? "")}
                          onChange={(value) => updateNodeProps(selectedNode.id, { href: value })}
                        />
                      </div>
                    ) : null}

                    {String(selectedNode.props.actionKind ?? "none") === "scene" ? (
                      <div className="mt-3">
                        <SelectField
                          label="씬"
                          value={String(selectedNode.props.sceneId ?? "")}
                          onChange={(value) => updateNodeProps(selectedNode.id, { sceneId: value })}
                          options={scenes.map((s) => ({ value: s.id, label: s.name }))}
                        />
                    <div className="mt-2 text-[11px] text-neutral-400">
                      목록에서 씬 ID를 선택하세요.
                    </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "image" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="이미지 URL"
                    value={String(selectedNode.props.url ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { url: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="맞춤"
                      value={String(selectedNode.props.fit ?? "cover")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fit: value })}
                      options={[
                        { value: "cover", label: "채우기" },
                        { value: "contain", label: "맞춤" },
                        { value: "fill", label: "늘이기" },
                        { value: "scale-down", label: "축소 맞춤" },
                      ]}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.stroke ?? "#E5E5E5")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? selectedNode.props.strokeWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-neutral-400">직접 접근 가능한 HTTPS 이미지 URL을 사용하세요.</div>
                </div>
              ) : null}

              {selectedNode.type === "box" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="배경"
                    value={String(selectedNode.props.background ?? "#F5F5F5")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { background: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.stroke ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? selectedNode.props.strokeWidth ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "frame" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="배경"
                    value={String(selectedNode.props.background ?? "#FFFFFF")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { background: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.stroke ?? "#E5E5E5")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? selectedNode.props.strokeWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 14)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "link" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="라벨"
                    value={String(selectedNode.props.label ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { label: value })}
                  />
                  <TextField
                    label="URL"
                    value={String(selectedNode.props.href ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { href: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.border ?? "#3B82F6")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { border: value })}
                    />
                    <ColorField
                      label="배경"
                      value={String(selectedNode.props.background ?? "rgba(59,130,246,0.10)")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { background: value })}
                    />
                    <ColorField
                      label="텍스트 색상"
                      value={String(selectedNode.props.color ?? selectedNode.props.border ?? "#3B82F6")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 10)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="굵기"
                      value={resolveFontWeight(selectedNode.props as Record<string, unknown>, 500)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontWeight: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                    <SelectField
                      label="변환"
                      value={String(selectedNode.props.textTransform ?? "none")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textTransform: value })}
                      options={TEXT_TRANSFORM_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "dashed")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <SelectField
                      label="기울임"
                      value={String(selectedNode.props.fontStyle ?? "normal")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontStyle: value })}
                      options={FONT_STYLE_OPTIONS}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "shape_rect" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="채우기"
                    value={String(selectedNode.props.fill ?? "#EDEDED")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="선"
                      value={String(selectedNode.props.stroke ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { stroke: value })}
                    />
                    <PropertyField
                      label="선 두께"
                      value={Number(selectedNode.props.strokeWidth ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { strokeWidth: value })}
                    />
                    <SelectField
                      label="선 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 16)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "shape_ellipse" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="채우기"
                    value={String(selectedNode.props.fill ?? "#EDEDED")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="선"
                      value={String(selectedNode.props.stroke ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { stroke: value })}
                    />
                    <PropertyField
                      label="선 두께"
                      value={Number(selectedNode.props.strokeWidth ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { strokeWidth: value })}
                    />
                    <SelectField
                      label="선 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "line" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="선"
                    value={String(selectedNode.props.stroke ?? "#111111")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { stroke: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="선 두께"
                      value={Number(selectedNode.props.strokeWidth ?? 2)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { strokeWidth: value })}
                    />
                    <TextField
                      label="대시"
                      value={String(selectedNode.props.dash ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { dash: value })}
                    />
                    <SelectField
                      label="끝 모양"
                      value={String(selectedNode.props.lineCap ?? "round")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { lineCap: value })}
                      options={LINE_CAP_OPTIONS}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "path" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="선"
                    value={String(selectedNode.props.stroke ?? "#111111")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { stroke: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="선 두께"
                      value={Number(selectedNode.props.strokeWidth ?? 2)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { strokeWidth: value })}
                    />
                    <TextField
                      label="대시"
                      value={String(selectedNode.props.dash ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { dash: value })}
                    />
                    <ColorField
                      label="채우기"
                      value={String(selectedNode.props.fill ?? "rgba(0,0,0,0)")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                    />
                    <SelectField
                      label="닫힘"
                      value={String(selectedNode.props.closed ?? false)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { closed: value === "true" })}
                      options={[
                        { value: "false", label: "열림" },
                        { value: "true", label: "닫힘" },
                      ]}
                    />
                    <SelectField
                      label="끝 모양"
                      value={String(selectedNode.props.lineCap ?? "round")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { lineCap: value })}
                      options={LINE_CAP_OPTIONS}
                    />
                    <SelectField
                      label="모서리"
                      value={String(selectedNode.props.lineJoin ?? "round")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { lineJoin: value })}
                      options={LINE_JOIN_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextAreaField
                      label="포인트"
                      value={formatPathPoints(selectedNode.props.points)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { points: value })}
                      rows={3}
                    />
                    <div className="mt-2 text-[10px] text-neutral-400">형식: 0.1,0.2; 0.9,0.8 (0~1 또는 0~100)</div>
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "input" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="플레이스홀더"
                    value={String(selectedNode.props.placeholder ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { placeholder: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="채우기"
                      value={String(selectedNode.props.fill ?? "#FFFFFF")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                    />
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.stroke ?? "#E5E5E5")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? selectedNode.props.strokeWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="텍스트 색상"
                      value={String(selectedNode.props.color ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 13)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                    <SelectField
                      label="정렬"
                      value={String(selectedNode.props.textAlign ?? "left")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textAlign: value })}
                      options={TEXT_ALIGN_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="바인딩 키"
                      value={String(selectedNode.bind?.key ?? "")}
                      onChange={(value) => updateNodeBindKey(selectedNode.id, value)}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "textarea" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="플레이스홀더"
                    value={String(selectedNode.props.placeholder ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { placeholder: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="채우기"
                      value={String(selectedNode.props.fill ?? "#FFFFFF")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                    />
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.stroke ?? "#E5E5E5")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? selectedNode.props.strokeWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="텍스트 색상"
                      value={String(selectedNode.props.color ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 13)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                    <SelectField
                      label="정렬"
                      value={String(selectedNode.props.textAlign ?? "left")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textAlign: value })}
                      options={TEXT_ALIGN_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="바인딩 키"
                      value={String(selectedNode.bind?.key ?? "")}
                      onChange={(value) => updateNodeBindKey(selectedNode.id, value)}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "checkbox" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="라벨"
                    value={String(selectedNode.props.label ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { label: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="색상"
                      value={String(selectedNode.props.color ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 13)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="굵기"
                      value={resolveFontWeight(selectedNode.props as Record<string, unknown>, 500)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontWeight: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="변환"
                      value={String(selectedNode.props.textTransform ?? "none")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textTransform: value })}
                      options={TEXT_TRANSFORM_OPTIONS}
                    />
                    <SelectField
                      label="기울임"
                      value={String(selectedNode.props.fontStyle ?? "normal")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontStyle: value })}
                      options={FONT_STYLE_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="바인딩 키"
                      value={String(selectedNode.bind?.key ?? "")}
                      onChange={(value) => updateNodeBindKey(selectedNode.id, value)}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "select" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="옵션"
                    value={formatOptionList(selectedNode.props.options)}
                    onChange={(value) => updateNodeProps(selectedNode.id, { options: parseOptionList(value) })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="채우기"
                      value={String(selectedNode.props.fill ?? "#FFFFFF")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fill: value })}
                    />
                    <ColorField
                      label="테두리"
                      value={String(selectedNode.props.borderColor ?? selectedNode.props.stroke ?? "#E5E5E5")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderColor: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="테두리 스타일"
                      value={String(selectedNode.props.borderStyle ?? "solid")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderStyle: value })}
                      options={BORDER_STYLE_OPTIONS}
                    />
                    <PropertyField
                      label="테두리 두께"
                      value={Number(selectedNode.props.borderWidth ?? selectedNode.props.strokeWidth ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { borderWidth: value })}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="텍스트 색상"
                      value={String(selectedNode.props.color ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 13)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                    <SelectField
                      label="정렬"
                      value={String(selectedNode.props.textAlign ?? "left")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textAlign: value })}
                      options={TEXT_ALIGN_OPTIONS}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="바인딩 키"
                      value={String(selectedNode.bind?.key ?? "")}
                      onChange={(value) => updateNodeBindKey(selectedNode.id, value)}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "slider" ? (
                <div className="rounded-[12px] bg-white">
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="최소"
                      value={Number(selectedNode.props.min ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { min: value })}
                    />
                    <PropertyField
                      label="최대"
                      value={Number(selectedNode.props.max ?? 100)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { max: value })}
                    />
                    <PropertyField
                      label="단계"
                      value={Number(selectedNode.props.step ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { step: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="바인딩 키"
                      value={String(selectedNode.bind?.key ?? "")}
                      onChange={(value) => updateNodeBindKey(selectedNode.id, value)}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "divider" ? (
                <div className="rounded-[12px] bg-white">
                  <ColorField
                    label="색상"
                    value={String(selectedNode.props.color ?? "#EAEAEA")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                  />
                  <div className="mt-3">
                    <PropertyField
                      label="두께"
                      value={Number(selectedNode.props.thickness ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { thickness: value })}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "badge" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="라벨"
                    value={String(selectedNode.props.label ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { label: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ColorField
                      label="색상"
                      value={String(selectedNode.props.color ?? "#111111")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <ColorField
                      label="배경"
                      value={String(selectedNode.props.background ?? "#F1F1F1")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { background: value })}
                    />
                    <PropertyField
                      label="모서리"
                      value={Number(selectedNode.props.radius ?? 999)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                    <PropertyField
                      label="글자 크기"
                      value={resolveFontSize(selectedNode.props as Record<string, unknown>, 10)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontSize: value })}
                    />
                    <PropertyField
                      label="굵기"
                      value={resolveFontWeight(selectedNode.props as Record<string, unknown>, 600)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontWeight: value })}
                    />
                    <PropertyField
                      label="자간"
                      value={Number(selectedNode.props.letterSpacing ?? 0)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { letterSpacing: value })}
                    />
                  </div>
                  <div className="mt-3">
                    <TextField
                      label="글꼴"
                      value={String(selectedNode.props.fontFamily ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontFamily: value })}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="변환"
                      value={String(selectedNode.props.textTransform ?? "none")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { textTransform: value })}
                      options={TEXT_TRANSFORM_OPTIONS}
                    />
                    <SelectField
                      label="기울임"
                      value={String(selectedNode.props.fontStyle ?? "normal")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { fontStyle: value })}
                      options={FONT_STYLE_OPTIONS}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedCount === 0 ? (
            <div className="mt-4 text-[11px] text-neutral-500">레이어를 선택해 편집하세요. (Shift로 다중 선택)</div>
          ) : null}

          <div className="mt-4 rounded-[12px] bg-neutral-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">캔버스 크기</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PropertyField
                label="W"
                value={docMeta.width}
                onChange={(v) => {
                  const w = Math.max(100, Math.min(2000, Number(v)));
                  setDocMeta((prev) => ({ ...prev, width: w }));
                  if (activeSceneId) setScenes((prev) => prev.map((s) => (s.id === activeSceneId ? { ...s, width: w } : s)));
                }}
              />
              <PropertyField
                label="H"
                value={docMeta.height}
                onChange={(v) => {
                  const h = Math.max(100, Math.min(2000, Number(v)));
                  setDocMeta((prev) => ({ ...prev, height: h }));
                  if (activeSceneId) setScenes((prev) => prev.map((s) => (s.id === activeSceneId ? { ...s, height: h } : s)));
                }}
              />
            </div>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500">텍스트 입력은 미리보기에서 표시됩니다.</div>
          {status !== "idle" ? <div className="mt-3 text-[11px]">처리 중...</div> : null}
        </aside>
      </div>

      {showPreview ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="relative rounded-[16px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-4 top-4 rounded-full border border-neutral-200 px-3 py-1 text-xs"
            >
              닫기
            </button>
            <div className="pt-6">
              <CanvasRender doc={docMeta} className="shadow-none" />
            </div>
          </div>
        </div>
      ) : null}

      {showPublishModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-[14px] bg-white p-6 shadow-xl">
            <p className="text-sm text-neutral-700">배포하면 24시간 동안 공개됩니다. 계속할까요?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-xs"
              >
                취소
              </button>
              <button
                type="button"
                onClick={doPublish}
                className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
              >
                지금 배포
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
