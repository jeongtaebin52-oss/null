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

function genSceneId(prefix = "scene") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
const MAX_HISTORY = 60;
const SNAP_THRESHOLD = 6;

// Inspector(UI)에서 쓰는 키(background/size/weight/...)와
// CanvasRender가 실제로 읽는 키(fill/fontSize/fontWeight/...)가 달라서
// 설정이 "안 먹는" 현상이 발생합니다.
// 여기서 patch를 양쪽 키로 동기화해서 엔진/렌더러/뷰어를 모두 안정화합니다.
function mapInspectorPropsForRender(nodeType: CanvasNodeType, patch: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...patch };
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);

  // box/badge 등에서 background를 쓰는 UI를 지원
  if ("background" in patch) {
    const bg = str((patch as any).background);
    if (bg.trim()) out.fill = bg; // CanvasRender는 fill 우선
  }

  // outline/테두리
  if ("borderColor" in patch) {
    const c = str((patch as any).borderColor);
    if (c.trim()) out.stroke = c;
  }
  if ("borderWidth" in patch) {
    out.strokeWidth = num((patch as any).borderWidth, 0);
  }

  // text: size/weight(UX용) -> fontSize/fontWeight(렌더러용)
  if (nodeType === "text") {
    const size = str((patch as any).size || "");
    if (size) {
      const fs = size === "sm" ? 14 : size === "md" ? 16 : size === "lg" ? 20 : undefined;
      if (fs) out.fontSize = fs;
    }
    const weight = str((patch as any).weight || "");
    if (weight) {
      const fw = weight === "light" ? 300 : weight === "medium" ? 500 : weight === "bold" ? 700 : undefined;
      if (fw) out.fontWeight = fw;
    }
  }

  // button: variant는 그대로 유지(렌더러에서 outline 처리)
  // badge: background를 fill로도 반영
  if (nodeType === "badge") {
    if ("background" in patch) {
      const bg = str((patch as any).background);
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

export default function EditorView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPageId = searchParams.get("pageId");
  const initialSceneId = searchParams.get("s");


  const [pageId, setPageId] = useState<string | null>(initialPageId);
  const [title, setTitle] = useState<string>("");

  // 새로고침/브라우저 종료 시 작업물이 날아가는 문제를 막기 위한 로컬 드래프트 자동저장
  const draftKey = useMemo(() => `NULL_EDITOR_DRAFT:${pageId ?? "new"}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageId],
  );

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [startSceneId, setStartSceneId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(initialSceneId);

  // 로컬 드래프트 복구: pageId가 없을 때(새 작업) 새로고침해도 복구되도록
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
      setMessage("드래프트 복구됨");
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
  });

  const [status, setStatus] = useState<"idle" | "saving" | "publishing">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [guides, setGuides] = useState<GuideLine[]>([]);
  const guidesRef = useRef<GuideLine[]>([]);
  useEffect(() => {
    guidesRef.current = guides;
  }, [guides]);

  const dragRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const nodes = history.present;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;

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

    // scenes 동기화: 현재 장면에 현재 nodes를 반영 (뷰어 호환을 위해 top-level nodes도 유지)
    if (activeSceneId) {
      setScenes((prev) => prev.map((s) => (s.id === activeSceneId ? { ...s, nodes } : s)));
    }
  }, [nodes, activeSceneId]);

  // 로컬 드래프트 자동 저장 (새 작업은 pageId가 없을 수 있음)
  // 저장(Save)을 누르지 않아도 새로고침 시 복구 가능
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
    // url에 s= 반영 (에디터에서도 공유/복원 가능)
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
    const name = `장면 ${scenes.length + 1}`;

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
    // 입력 중에는 공백/빈칸도 허용해야 정상 편집 UX가 됩니다.
    const raw = name.slice(0, 40);
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, name: raw } : s)));

    if (raw.trim().length === 0) setMessage("장면 이름은 비울 수 없습니다.");
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
    setMessage("복제됨");
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
      return { ...node, props: { ...(node.props ?? {}), ...mapped } };
    });
    setPresent(nextNodes, commit);
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

    // Canvas edges/center snap (WinForms 감각)
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

  function startResize(event: ReactPointerEvent<HTMLElement>, id: string, handle: DragState extends any ? "nw" | "ne" | "sw" | "se" : never) {
    event.preventDefault();
    event.stopPropagation();
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node) return;

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

      setGuides([]); // resize guide는 다음 단계에서 추가 가능
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

  
  function normalizeToV2(content: any): ContentV2 {
    if (content && typeof content === "object" && content.schema === "canvas_v2" && Array.isArray(content.scenes)) {
      const scenes: Scene[] = content.scenes
        .filter((s: any) => s && typeof s === "object")
        .map((s: any, idx: number) => ({
          id: typeof s.id === "string" && s.id ? s.id : genSceneId(`scene${idx + 1}`),
          name: typeof s.name === "string" && s.name.trim() ? s.name.slice(0, 40) : `장면 ${idx + 1}`,
          width: typeof s.width === "number" && Number.isFinite(s.width) ? s.width : (content.width ?? DEFAULT_CANVAS.width),
          height: typeof s.height === "number" && Number.isFinite(s.height) ? s.height : (content.height ?? DEFAULT_CANVAS.height),
          nodes: Array.isArray(s.nodes) ? (s.nodes as CanvasNode[]) : [],
        }));
      const start = typeof content.startSceneId === "string" && content.startSceneId ? content.startSceneId : (scenes[0]?.id ?? genSceneId());
      return {
        schema: "canvas_v2",
        startSceneId: scenes.some((s) => s.id === start) ? start : (scenes[0]?.id ?? start),
        scenes: scenes.length ? scenes : [{
          id: start,
          name: DEFAULT_CANVAS.width ? "장면 1" : "장면 1",
          width: content.width ?? DEFAULT_CANVAS.width,
          height: content.height ?? DEFAULT_CANVAS.height,
          nodes: Array.isArray(content.nodes) ? (content.nodes as CanvasNode[]) : [],
        }],
      };
    }

    const width = content?.width ?? DEFAULT_CANVAS.width;
    const height = content?.height ?? DEFAULT_CANVAS.height;
    const nodes = Array.isArray(content?.nodes) ? (content.nodes as CanvasNode[]) : [];
    const sid = genSceneId();
    return { schema: "canvas_v2", startSceneId: sid, scenes: [{ id: sid, name: "장면 1", width, height, nodes }] };
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

function extractPageId(data: any): string | null {
    const candidates = [data?.page?.id, data?.pageId, data?.id, data?.page?.pageId];
    const found = candidates.find((v) => typeof v === "string" && v.length > 0);
    return found ?? null;
  }

  function extractError(data: any): string {
    if (!data) return "저장 실패";
    return data?.error ?? data?.message ?? data?.detail ?? "저장 실패";
  }

  async function saveDraft(): Promise<string | null> {
    if (status !== "idle") return pageId;
    setStatus("saving");
    setMessage(null);

    // scenes에는 activeSceneId의 nodes가 useEffect로 반영되지만,
    // 저장 직전에는 최신 nodesRef를 한 번 더 강제 반영합니다(새로고침/스위치 타이밍 이슈 방지)
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
              name: "Scene 1",
              width: docMetaRef.current.width,
              height: docMetaRef.current.height,
              nodes: nodesRef.current,
            },
          ];
    const startPageId = activeSceneId ?? startSceneId ?? scenesForSave[0]?.id ?? "";

    const payload = {
      title: title.trim() ? title.trim() : null,
      content: {
        // 단일 포맷(에디터/뷰어/리플레이 공통)
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

        // (선택) 레거시 안전장치: 기존 코드가 width/height/nodes를 직접 읽는 경우를 대비
        width: docMeta.width,
        height: docMeta.height,
        nodes: nodesRef.current,
      },
    };

    try {
      if (!pageId) {
        const res = await fetch("/api/pages", {
          method: "POST",
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
          setMessage("저장 실패: pageId 누락");
          return null;
        }
        setPageId(createdId);
        router.replace(`/editor?pageId=${createdId}`);
        setMessage("드래프트 저장됨");
        return createdId;
      }

      const res = await fetch(`/api/pages/${pageId}/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(extractError(data));
        return null;
      }

      setMessage("버전 저장됨");
      return pageId;
    } catch {
      setMessage("저장 실패");
      return null;
    } finally {
      setStatus("idle");
    }
  }

  async function publish() {
    if (status !== "idle") return;
    setMessage(null);

    try {
      const targetId = await saveDraft();
      if (!targetId) return;

      setStatus("publishing");

      const res = await fetch(`/api/pages/${targetId}/publish`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error ?? data?.message ?? "게시 실패");
        return;
      }

      const liveId = data?.page?.id ?? data?.pageId ?? targetId;
      router.push(`/p/${liveId}`);
    } catch {
      setMessage("게시 실패");
    } finally {
      setStatus("idle");
    }
  }

  function preview() {
    setShowPreview(true);
  }

  // Keyboard shortcuts (WinForms 감각)
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
        void publish();
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
              placeholder="작품 제목"
              className="w-56 rounded-[10px] border border-neutral-200 px-3 py-2 text-xs"
            />

            <div className="hidden items-center gap-2 text-xs text-neutral-600 md:flex">
              <button type="button" onClick={undo} disabled={!canUndo} className="rounded-full border px-3 py-1 disabled:opacity-40">
                Undo
              </button>
              <button type="button" onClick={redo} disabled={!canRedo} className="rounded-full border px-3 py-1 disabled:opacity-40">
                Redo
              </button>
              <button type="button" onClick={duplicateSelected} disabled={selectedCount === 0} className="rounded-full border px-3 py-1 disabled:opacity-40">
                Duplicate
              </button>
              <button type="button" onClick={deleteSelected} disabled={selectedCount === 0} className="rounded-full border px-3 py-1 disabled:opacity-40">
                Delete
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setGridSnap((prev) => !prev)} className="rounded-full border px-3 py-2 text-xs">
              Grid {gridSnap ? "On" : "Off"}
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <button type="button" onClick={sendBackward} disabled={selectedCount === 0} className="rounded-full border px-3 py-2 text-xs disabled:opacity-40">
                Back
              </button>
              <button type="button" onClick={bringForward} disabled={selectedCount === 0} className="rounded-full border px-3 py-2 text-xs disabled:opacity-40">
                Front
              </button>
            </div>

            <button
              type="button"
              onClick={saveDraft}
              disabled={status !== "idle"}
              className="rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-900 disabled:opacity-50"
              title="Ctrl/Cmd+S"
            >
              {status === "saving" ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={publish}
              disabled={status !== "idle"}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              title="Ctrl/Cmd+Enter"
            >
              {status === "publishing" ? "Publishing..." : "Publish"}
            </button>

            <button type="button" onClick={preview} className="rounded-full border px-3 py-2 text-xs">
              Preview
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[180px_1fr_280px]">
        {/* Toolbox */}
        <aside className="rounded-[14px] border border-neutral-200 p-4 text-xs text-neutral-700">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Toolbox</div>
          
          <div className="mt-4 rounded-[12px] border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-neutral-700">Scenes</div>
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
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Rename</div>
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
                      const fallback = `장면 ${idx >= 0 ? idx + 1 : 1}`;
                      setScenes((prev) => prev.map((s) => (s.id === activeSceneId ? { ...s, name: fallback } : s)));
                      setMessage("장면 이름은 비울 수 없습니다.");
                    }
                  }}
                  className="mt-2 w-full rounded-[10px] border border-neutral-200 px-3 py-2 text-[11px]"
                />
              </div>
            ) : null}
          </div>

<div className="mt-4 flex flex-col gap-2">
            {(["box", "text", "button", "image", "divider", "badge"] as CanvasNodeType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addNode(type)}
                className="flex items-center justify-between rounded-[10px] border border-neutral-200 px-3 py-2 text-sm"
              >
                {type}
                <span className="text-[10px] text-neutral-400">+</span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-[12px] bg-neutral-50 p-3 text-[11px] text-neutral-600">
            <div className="font-semibold text-neutral-700">단축키</div>
            <div className="mt-2 space-y-1">
              <div>Shift+클릭: 멀티 선택</div>
              <div>Del/Backspace: 삭제</div>
              <div>Ctrl/Cmd+D: 복제</div>
              <div>Ctrl/Cmd+Z / Shift+Z: Undo/Redo</div>
              <div>방향키: 이동 (Shift: 10배)</div>
              <div>Ctrl/Cmd+[ ]: 레이어 (Shift: 맨앞/맨뒤)</div>
              <div>Ctrl/Cmd+S: 저장</div>
              <div>Ctrl/Cmd+Enter: 게시</div>
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <section className="flex flex-col items-center gap-4">
          {message ? (
            <div className="w-full text-right text-[11px] text-red-500">{message}</div>
          ) : null}
          <div className="rounded-[16px] border border-neutral-200 bg-neutral-50 p-6">
            <div
              ref={canvasRef}
              className="relative"
              style={{ width: docMeta.width, height: docMeta.height }}
              onPointerDown={(e) => {
                if ((e as any).shiftKey) return;
                clearSelection();
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

                      // 미리보기: 버튼 액션 실행 (웹처럼)
                      if (showPreview && node.type === "button") {
                        const kind = String((node.props as any)?.actionKind ?? "none");
                        if (kind === "url") {
                          const href = String((node.props as any)?.href ?? "");
                          if (href.trim()) window.open(href.trim(), "_blank", "noreferrer");
                          return;
                        }
                        if (kind === "scene") {
                          const sid = String((node.props as any)?.sceneId ?? "");
                          if (sid) switchScene(sid);
                          return;
                        }
                        // none이면 아무 것도 안 함
                        return;
                      }


                      const shift = (event as any).shiftKey === true;
                      if (shift) {
                        toggleSelect(node.id);
                        // shift 클릭 후에도 드래그 가능: 현재 선택 집합 기준으로 이동
                        const nextSel = selectedIdsRef.current.includes(node.id)
                          ? selectedIdsRef.current.filter((x) => x !== node.id)
                          : [...selectedIdsRef.current, node.id];
                        const stable = nextSel.length ? nextSel : [node.id];
                        // selection state는 비동기라, 드래그는 계산된 stable 기준으로 시작
                        setSelectedIds(stable);
                        startMoveDrag(event, node.id);
                        return;
                      }

                      // 일반 클릭: 단일 선택 후 드래그
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
        </section>

        {/* Properties */}
        <aside className="rounded-[14px] border border-neutral-200 p-4 text-xs text-neutral-600">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Properties</div>

          {/* Multi select */}
          {selectedCount > 1 ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[12px] bg-neutral-50 p-3">
                <div className="text-xs font-semibold text-neutral-800">선택됨: {selectedCount}개</div>
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
              </div>

              <div className="rounded-[12px] bg-neutral-50 p-3 text-[11px] text-neutral-600">
                <div className="font-semibold text-neutral-700">이동</div>
                <div className="mt-2">방향키로 이동하세요. (Shift=10배, Grid On이면 8px 단위)</div>
              </div>
            </div>
          ) : null}

          {/* Single select */}
          {selectedNode ? (
            <div className="mt-4 flex flex-col gap-3">
              {/* 자주 쓰는 것 상단 고정 */}
              <div className="rounded-[12px] bg-neutral-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Transform</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PropertyField label="X" value={selectedNode.x} onChange={(v) => updateNode(selectedNode.id, { x: v })} />
                  <PropertyField label="Y" value={selectedNode.y} onChange={(v) => updateNode(selectedNode.id, { y: v })} />
                  <PropertyField label="W" value={selectedNode.w} onChange={(v) => updateNode(selectedNode.id, { w: v })} />
                  <PropertyField label="H" value={selectedNode.h} onChange={(v) => updateNode(selectedNode.id, { h: v })} />
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

              {/* 타입별 상세 */}
              {selectedNode.type === "text" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="Text"
                    value={String(selectedNode.props.text ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { text: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <SelectField
                      label="Size"
                      value={String(selectedNode.props.size ?? "md")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { size: value })}
                      options={["sm", "md", "lg"]}
                    />
                    <SelectField
                      label="Weight"
                      value={String(selectedNode.props.weight ?? "medium")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { weight: value })}
                      options={["light", "medium", "bold"]}
                    />
                    <SelectField
                      label="Align"
                      value={String(selectedNode.props.align ?? "left")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { align: value })}
                      options={["left", "center", "right"]}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "button" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="Label"
                    value={String(selectedNode.props.label ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { label: value })}
                  />
                  <div className="mt-3">
                    <SelectField
                      label="Variant"
                      value={String(selectedNode.props.variant ?? "primary")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { variant: value })}
                      options={["primary", "outline"]}
                    />
                  </div>

                  {/* Transition (Phase1) */}
                  <div className="mt-4 border-t border-neutral-100 pt-3">
                    <SelectField
                      label="Action"
                      value={String(selectedNode.props.actionKind ?? "none")}
                      onChange={(value) =>
                        updateNodeProps(selectedNode.id, {
                          actionKind: value,
                        })
                      }
                      options={["none", "url", "scene"]}
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
                          label="Scene"
                          value={String(selectedNode.props.sceneId ?? "")}
                          onChange={(value) => updateNodeProps(selectedNode.id, { sceneId: value })}
                          options={scenes.map((s) => s.id)}
                        />
                        <div className="mt-2 text-[11px] text-neutral-400">
                          현재 장면 목록 기준. (표시명: 좌측 Scene 탭)
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "image" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="Image URL"
                    value={String(selectedNode.props.url ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { url: value })}
                  />
                  <div className="mt-2 text-[10px] text-neutral-400">TODO: external image allowlist</div>
                </div>
              ) : null}

              {selectedNode.type === "box" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="Background"
                    value={String(selectedNode.props.background ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { background: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PropertyField
                      label="Radius"
                      value={Number(selectedNode.props.radius ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { radius: value })}
                    />
                    <PropertyField
                      label="Padding"
                      value={Number(selectedNode.props.padding ?? 12)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { padding: value })}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "divider" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="Color"
                    value={String(selectedNode.props.color ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                  />
                  <div className="mt-3">
                    <PropertyField
                      label="Thickness"
                      value={Number(selectedNode.props.thickness ?? 1)}
                      onChange={(value) => updateNodeProps(selectedNode.id, { thickness: value })}
                    />
                  </div>
                </div>
              ) : null}

              {selectedNode.type === "badge" ? (
                <div className="rounded-[12px] bg-white">
                  <TextField
                    label="Label"
                    value={String(selectedNode.props.label ?? "")}
                    onChange={(value) => updateNodeProps(selectedNode.id, { label: value })}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <TextField
                      label="Color"
                      value={String(selectedNode.props.color ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { color: value })}
                    />
                    <TextField
                      label="Background"
                      value={String(selectedNode.props.background ?? "")}
                      onChange={(value) => updateNodeProps(selectedNode.id, { background: value })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedCount === 0 ? (
            <div className="mt-4 text-[11px] text-neutral-500">요소를 선택하세요. (Shift로 멀티 선택)</div>
          ) : null}

          <div className="mt-4 text-[11px] text-neutral-500">캔버스는 고정 크기(모바일 기준).</div>
          <div className="mt-2 text-[11px] text-neutral-500">텍스트 입력값 수집 없음.</div>
          {status !== "idle" ? <div className="mt-3 text-[11px]">작업 중...</div> : null}
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
    </div>
  );
}

function PropertyField({
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

function TextField({
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-2 text-xs">
      <span className="text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[8px] border border-neutral-200 px-2 py-2 text-xs"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
