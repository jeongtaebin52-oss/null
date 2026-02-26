export type NodeType =
  | "frame"
  | "group"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "star"
  | "path"
  | "text"
  | "image"
  | "video"
  | "section"
  | "slice"
  | "component"
  | "instance"
  | "hotspot";

const DEFAULT_NODE_NAMES: Record<NodeType, string> = {
  frame: "프레임",
  group: "그룹",
  rect: "사각형",
  ellipse: "원",
  line: "선",
  arrow: "화살표",
  polygon: "다각형",
  star: "별",
  path: "벡터",
  text: "텍스트",
  image: "이미지",
  video: "비디오",
  section: "섹션",
  slice: "슬라이스",
  component: "컴포넌트",
  instance: "인스턴스",
  hotspot: "핫스팟",
};

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export type Fill =
  | { type: "solid"; color: string; opacity?: number }
  | { type: "linear"; from: string; to: string; angle: number; opacity?: number; stops?: { offset: number; color: string }[] }
  | { type: "image"; src: string; fit: "cover" | "contain" | "fill" };

export type Stroke = {
  color: string;
  width: number;
  align?: "inside" | "center" | "outside";
  dash?: number[];
};

export type Effect =
  | { type: "shadow"; x: number; y: number; blur: number; color: string; opacity?: number }
  | { type: "blur"; blur: number }
  | { type: "noise"; amount?: number };

export type NodeShape = {
  polygonSides?: number;
  starPoints?: number;
  starInnerRatio?: number;
  /** SVG path d (path 노드용). 없으면 기본 베지어 곡선 사용 */
  pathData?: string;
};

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  italic?: boolean;
  underline?: boolean;
  /** 텍스트 케이스: none | upper(대문자) | lower(소문자) | capitalize(첫 글자 대문자) */
  textCase?: "none" | "upper" | "lower" | "capitalize";
  /** 취소선 */
  lineThrough?: boolean;
  /** OpenType font-feature-settings (e.g. "liga" 1, "ss01" 1) */
  fontFeatureSettings?: string;
};

export type AutoLayout = {
  mode: "auto";
  dir: "row" | "column";
  gap: number;
  /** 고정 간격(fixed) vs 공간 분배(space-between) */
  gapMode?: "fixed" | "space-between";
  padding: { t: number; r: number; b: number; l: number };
  align: "start" | "center" | "end" | "stretch" | "baseline";
  wrap: boolean;
  /** 레이아웃 크기 계산 시 테두리 두께 포함 (stroke inclusion) */
  includeStrokeInBounds?: boolean;
};

export type LayoutMode = { mode: "fixed" } | AutoLayout;

export type LayoutSizing = "fixed" | "fill" | "hug";

export type LayoutSizingAxis = {
  width: LayoutSizing;
  height: LayoutSizing;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export type Constraints = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
  hCenter?: boolean;
  vCenter?: boolean;
  scaleX?: boolean;
  scaleY?: boolean;
};

export type VariableType = "color" | "number" | "string" | "boolean";

export type Variable = {
  id: string;
  name: string;
  type: VariableType;
  value: string | number | boolean;
  modes?: Record<string, string | number | boolean>;
};

export type StyleTokenType = "fill" | "stroke" | "text" | "effect";

export type StyleToken = {
  id: string;
  name: string;
  type: StyleTokenType;
  value: unknown;
};

export type PrototypeTrigger = "click" | "hover" | "load" | "scroll" | "onPress";

/** 스크롤 트리거(trigger=== "scroll")일 때만 사용. 대상 스크롤 컨테이너 노드 ID, 도달 기준(0~1 또는 px), 단위. */
export type ScrollTriggerConfig = {
  nodeId?: string;
  threshold: number;
  unit: "percent" | "px";
};

export type PrototypeTransitionType = "instant" | "fade" | "slide-left" | "slide-right" | "smart";

export type PrototypeTransition = {
  type: PrototypeTransitionType;
  /** 전환 지속 시간(ms). 미설정 시 300 */
  duration?: number;
  /** 이징: ease | ease-in | ease-out | linear */
  easing?: string;
};

/** 액션 실행 조건: 변수 값 비교. 조건 불만족 시 액션 스킵 */
export type PrototypeCondition = {
  variableId: string;
  op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte";
  value: string | number | boolean;
};

export type PrototypeAction =
  | { type: "navigate"; targetPageId: string; transition?: PrototypeTransition; delayMs?: number; condition?: PrototypeCondition }
  | { type: "back"; transition?: PrototypeTransition; delayMs?: number; condition?: PrototypeCondition }
  | { type: "overlay"; targetPageId: string; transition?: PrototypeTransition; delayMs?: number; condition?: PrototypeCondition; position?: "center" | "top" | "bottom" | "left" | "right" | "bottom-left" | "bottom-right" | "top-left" | "top-right"; overlayWidth?: number; overlayHeight?: number; dim?: number }
  | { type: "closeOverlay"; transition?: PrototypeTransition; delayMs?: number; condition?: PrototypeCondition }
  | { type: "url"; url: string; openInNewTab?: boolean; transition?: PrototypeTransition; delayMs?: number; condition?: PrototypeCondition }
  | { type: "submit"; url: string; method?: "POST" | "GET"; nextPageId?: string; delayMs?: number; condition?: PrototypeCondition }
  | { type: "setVariable"; variableId: string; value?: string | number | boolean; mode?: string }
  | { type: "scrollTo"; targetNodeId: string; axis?: "x" | "y" | "both"; offset?: number; transition?: PrototypeTransition; delayMs?: number; condition?: PrototypeCondition }
  | { type: "setVariant"; variantId: string; targetNodeId?: string; delayMs?: number; condition?: PrototypeCondition };

export type PrototypeInteraction = {
  id: string;
  trigger: PrototypeTrigger;
  action: PrototypeAction;
  /** trigger === "scroll"일 때 스크롤 컨테이너·threshold·단위. */
  scrollTriggerConfig?: ScrollTriggerConfig;
};

export type NodePrototype = {
  interactions: PrototypeInteraction[];
};

export type DocPrototype = {
  startPageId?: string;
};

export type NodeDataBinding =
  | {
      type: "collection";
      collectionId: string;
      mode: "table" | "list";
      fields?: string[];
      limit?: number;
      editable?: boolean;
      allowDelete?: boolean;
    };

export type Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

export type NodeStyle = {
  fills: Fill[];
  strokes: Stroke[];
  opacity: number;
  blendMode: BlendMode;
  effects: Effect[];
  radius?: number | { tl: number; tr: number; br: number; bl: number };
  fillRef?: string;
  strokeStyleId?: string;
  fillStyleId?: string;
  effectStyleId?: string;
  strokeCap?: "butt" | "round" | "square";
  strokeJoin?: "miter" | "round" | "bevel";
  strokeMiter?: number;
};

export type NodeText = {
  value: string;
  style: TextStyle;
  styleRef?: string;
  wrap?: boolean;
  autoSize?: boolean;
};

export type NodeImage = {
  src: string;
  fit: "cover" | "contain" | "fill";
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  /** 크롭 영역 (0~1 정규화). 미설정 시 전체 표시 */
  crop?: { x: number; y: number; w: number; h: number };
  /** 밝기 (0~2, 1=기본) */
  brightness?: number;
  /** 대비 (0~2, 1=기본) */
  contrast?: number;
};

export type NodeOverrides = {
  name?: string;
  frame?: Frame;
  style?: NodeStyle;
  text?: NodeText;
  image?: NodeImage;
  video?: NodeImage;
  layout?: LayoutMode;
  layoutSizing?: LayoutSizingAxis;
  constraints?: Constraints;
  hidden?: boolean;
  locked?: boolean;
  clipContent?: boolean;
  shape?: NodeShape;
  data?: NodeDataBinding;
  prototype?: NodePrototype;
  isMask?: boolean;
  overflowScrolling?: "none" | "vertical" | "horizontal" | "both";
  sticky?: boolean;
  widthPercent?: number;
  heightPercent?: number;
};

export interface Node {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  children: string[];
  frame: Frame;
  style: NodeStyle;
  text?: NodeText;
  image?: NodeImage;
  video?: NodeImage;
  layout?: LayoutMode;
  layoutSizing?: LayoutSizingAxis;
  constraints?: Constraints;
  locked?: boolean;
  hidden?: boolean;
  clipContent?: boolean;
  shape?: NodeShape;
  data?: NodeDataBinding;
  componentId?: string;
  instanceOf?: string;
  sourceId?: string;
  overrides?: NodeOverrides;
  prototype?: NodePrototype;
  /** 그룹 내 첫 자식일 때 true면 이 노드가 형제들을 마스크함 */
  isMask?: boolean;
  /** 프레임/섹션: 자식이 영역을 넘을 때 스크롤. none | vertical | horizontal | both */
  overflowScrolling?: "none" | "vertical" | "horizontal" | "both";
  /** 스크롤 컨테이너 내에서 스크롤 시 상단에 고정(sticky). 부모에 overflowScrolling 있을 때만 유효 */
  sticky?: boolean;
  /** 컴포넌트 변형. 각 변형은 rootId(컴포넌트 자식)를 가리킴 */
  variants?: Array<{ id: string; name: string; rootId: string }>;
  /** 컴포넌트 속성 정의: sourceId -> { kind, name } (텍스트·불리언·인스턴스 스왑) */
  propertyDefinitions?: Record<string, { kind: "text" | "boolean" | "instance"; name: string }>;
  /** 인스턴스가 사용할 변형 id (미설정 시 첫 변형 또는 컴포넌트 첫 자식) */
  variantId?: string;
  /** 레이아웃 그리드 (Columns / Rows / Grid). 프레임·섹션·컴포넌트 등 */
  layoutGrid?: LayoutGridItem[];
  /** 노드별 내보내기 설정. 비어 있으면 기본 내보내기 사용 */
  exportSettings?: { format: "png" | "svg" | "pdf"; scale: number }[];
  /** 부모 대비 크기 비율(0–100). 설정 시 w/h는 부모 기준으로 계산 */
  widthPercent?: number;
  heightPercent?: number;
}

export type LayoutGridItem =
  | { type: "columns"; count: number; width?: number; gutter?: number; offset?: number; color?: string; opacity?: number }
  | { type: "rows"; count: number; height?: number; gutter?: number; offset?: number; color?: string; opacity?: number }
  | { type: "grid"; cellSize: number; color?: string; opacity?: number };

export type DocPage = {
  id: string;
  name: string;
  rootId: string;
};

export interface Doc {
  schema: "null_advanced_v1";
  version: 1;
  root: string;
  pages: DocPage[];
  nodes: Record<string, Node>;
  selection: Set<string>;
  view: { zoom: number; panX: number; panY: number; guides?: { x: number[]; y: number[] } };
  styles: StyleToken[];
  variables: Variable[];
  variableModes?: string[];
  variableMode?: string;
  components: Record<string, string>;
  prototype?: DocPrototype;
}

export type SerializableDoc = Omit<Doc, "selection"> & { selection: string[] };

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Space Grotesk, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.4,
  letterSpacing: 0,
  align: "left",
};

const DEFAULT_STYLE: NodeStyle = {
  fills: [{ type: "solid", color: "#EDEDED" }],
  strokes: [],
  opacity: 1,
  blendMode: "normal",
  effects: [],
  strokeCap: "butt",
  strokeJoin: "miter",
  strokeMiter: 4,
};

const DEFAULT_FRAME: Frame = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };

export function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createNode(type: NodeType, overrides: Partial<Node> = {}): Node {
  const base: Node = {
    id: makeId(type),
    type,
    name: DEFAULT_NODE_NAMES[type] ?? type,
    parentId: null,
    children: [],
    frame: { ...DEFAULT_FRAME },
    style: { ...DEFAULT_STYLE, fills: [...DEFAULT_STYLE.fills], strokes: [] },
    layout: { mode: "fixed" },
    layoutSizing: { width: "fixed", height: "fixed" },
    constraints: {},
    locked: false,
    hidden: false,
    clipContent: false,
    prototype: { interactions: [] },
  };

  if (type === "frame" || type === "section") {
    base.frame = { x: 0, y: 0, w: 1200, h: 800, rotation: 0 };
    base.style = {
      ...base.style,
      fills: [{ type: "solid", color: "#FFFFFF" }],
      strokes: [{ color: "#E5E7EB", width: 1, align: "inside" }],
    };
  }

  if (type === "rect") {
    base.frame = { x: 0, y: 0, w: 200, h: 140, rotation: 0 };
    base.style = { ...base.style, radius: 12 };
  }

  if (type === "ellipse") {
    base.frame = { x: 0, y: 0, w: 160, h: 160, rotation: 0 };
  }

  if (type === "line" || type === "arrow") {
    base.frame = { x: 0, y: 0, w: 240, h: 0, rotation: 0 };
    base.style = { ...base.style, strokes: [{ color: "#111111", width: 2 }] };
  }

  if (type === "polygon" || type === "star") {
    base.frame = { x: 0, y: 0, w: 180, h: 180, rotation: 0 };
    base.style = { ...base.style, fills: [{ type: "solid", color: "#EDEDED" }], strokes: [{ color: "#111111", width: 1 }] };
    if (type === "polygon") {
      base.shape = { polygonSides: 6 };
    } else {
      base.shape = { starPoints: 5, starInnerRatio: 0.5 };
    }
  }

  if (type === "path") {
    base.frame = { x: 0, y: 0, w: 220, h: 140, rotation: 0 };
    base.style = { ...base.style, fills: [], strokes: [{ color: "#111111", width: 2 }] };
  }

  if (type === "text") {
    base.frame = { x: 0, y: 0, w: 240, h: 40, rotation: 0 };
    base.text = { value: "텍스트", style: { ...DEFAULT_TEXT_STYLE }, wrap: true, autoSize: false };
    base.style = { ...base.style, fills: [{ type: "solid", color: "#111111" }] };
  }

  if (type === "image" || type === "video") {
    base.frame = { x: 0, y: 0, w: 320, h: 220, rotation: 0 };
    const media = { src: "", fit: "cover" as const, offsetX: 0, offsetY: 0, scale: 1 };
    if (type === "video") base.video = { ...media };
    else base.image = { ...media };
    base.style = { ...base.style, fills: [{ type: "solid", color: "#D1D5DB" }] };
  }

  if (type === "group" || type === "component" || type === "instance") {
    base.style = { ...base.style, fills: [] };
  }

  if (type === "hotspot") {
    base.frame = { x: 0, y: 0, w: 100, h: 44, rotation: 0 };
    base.style = { ...base.style, fills: [], strokes: [] };
  }

  return { ...base, ...overrides };
}

/** 초기 문서용 고정 ID (SSR/클라이언트 hydration 일치) */
const INITIAL_PAGE_ID = "page_0";

export function createDoc(): Doc {
  const root = "root";
  const pageId = INITIAL_PAGE_ID;
  const pageNode = createNode("frame", {
    id: pageId,
    name: "페이지 1",
    parentId: root,
  });

  return {
    schema: "null_advanced_v1",
    version: 1,
    root,
    pages: [{ id: pageId, name: "페이지 1", rootId: pageId }],
    nodes: {
      [root]: {
        id: root,
        type: "group",
        name: "루트",
        parentId: null,
        children: [pageId],
        frame: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
        style: { ...DEFAULT_STYLE, fills: [] },
        layout: { mode: "fixed" },
        constraints: {},
        locked: true,
        hidden: true,
      },
      [pageId]: pageNode,
    },
    selection: new Set(),
    view: { zoom: 1, panX: -200, panY: -200 },
    styles: [],
    variables: [],
    variableModes: ["기본"],
    variableMode: "기본",
    components: {},
    prototype: { startPageId: pageId },
  };
}

export function addNode(doc: Doc, node: Node, parentId: string) {
  doc.nodes[node.id] = node;
  node.parentId = parentId;
  const parent = doc.nodes[parentId];
  if (parent) parent.children = [...parent.children, node.id];
}

export function cloneDoc(doc: Doc): Doc {
  return {
    ...doc,
    pages: doc.pages.map((p) => ({ ...p })),
    nodes: Object.fromEntries(
      Object.entries(doc.nodes).map(([id, node]) => [
        id,
        {
          ...node,
          children: [...node.children],
          frame: { ...node.frame },
          style: {
            ...node.style,
            fills: [...node.style.fills],
            strokes: [...node.style.strokes],
            effects: [...node.style.effects],
            radius: typeof node.style.radius === "object" && node.style.radius ? { ...node.style.radius } : node.style.radius,
          },
          text: node.text
            ? {
                value: node.text.value,
                style: { ...node.text.style },
                styleRef: node.text.styleRef,
                wrap: node.text.wrap,
                autoSize: node.text.autoSize,
              }
            : undefined,
          image: node.image ? { ...node.image } : undefined,
          video: node.video ? { ...node.video } : undefined,
          shape: node.shape ? { ...node.shape } : undefined,
          layout: node.layout
            ? "mode" in node.layout
              ? { ...node.layout, padding: "padding" in node.layout ? { ...node.layout.padding } : undefined }
              : node.layout
            : undefined,
          layoutSizing: node.layoutSizing ? { ...node.layoutSizing } : undefined,
          constraints: node.constraints ? { ...node.constraints } : undefined,
          data: node.data ? { ...node.data } : undefined,
          overrides: node.overrides
            ? {
                ...node.overrides,
                frame: node.overrides.frame ? { ...node.overrides.frame } : undefined,
                style: node.overrides.style
                  ? {
                      ...node.overrides.style,
                      fills: [...node.overrides.style.fills],
                      strokes: [...node.overrides.style.strokes],
                      effects: [...node.overrides.style.effects],
                      radius:
                        typeof node.overrides.style.radius === "object" && node.overrides.style.radius
                          ? { ...node.overrides.style.radius }
                          : node.overrides.style.radius,
                    }
                  : undefined,
                text: node.overrides.text
                  ? {
                      value: node.overrides.text.value,
                      style: { ...node.overrides.text.style },
                      styleRef: node.overrides.text.styleRef,
                      wrap: node.overrides.text.wrap,
                      autoSize: node.overrides.text.autoSize,
                    }
                  : undefined,
                image: node.overrides.image ? { ...node.overrides.image } : undefined,
                video: node.overrides.video ? { ...node.overrides.video } : undefined,
                shape: node.overrides.shape ? { ...node.overrides.shape } : undefined,
                layout: node.overrides.layout
                  ? "mode" in node.overrides.layout
                    ? { ...node.overrides.layout, padding: "padding" in node.overrides.layout ? { ...node.overrides.layout.padding } : undefined }
                    : node.overrides.layout
                  : undefined,
                layoutSizing: node.overrides.layoutSizing ? { ...node.overrides.layoutSizing } : undefined,
                constraints: node.overrides.constraints ? { ...node.overrides.constraints } : undefined,
                data: node.overrides.data ? { ...node.overrides.data } : undefined,
                prototype: node.overrides.prototype
                  ? {
                      interactions: node.overrides.prototype.interactions.map((interaction) => ({
                        ...interaction,
                        action: (() => {
                          const a = interaction.action;
                          const t = "transition" in a && a.transition ? { ...a.transition } : undefined;
                          return { ...a, transition: t } as PrototypeAction;
                        })(),
                      })),
                    }
                  : undefined,
              }
            : undefined,
          prototype: node.prototype
            ? {
                interactions: node.prototype.interactions.map((interaction) => ({
                  ...interaction,
                  action: (() => {
                    const a = interaction.action;
                    const t = "transition" in a && a.transition ? { ...a.transition } : undefined;
                    return { ...a, transition: t } as PrototypeAction;
                  })(),
                })),
              }
            : undefined,
        },
      ]),
    ) as Record<string, Node>,
    selection: new Set(doc.selection),
    view: { ...doc.view },
    styles: doc.styles.map((s) => ({ ...s })),
    variables: doc.variables.map((v) => ({ ...v, modes: v.modes ? { ...v.modes } : undefined })),
    variableModes: doc.variableModes ? [...doc.variableModes] : undefined,
    variableMode: doc.variableMode,
    components: { ...doc.components },
    prototype: doc.prototype ? { ...doc.prototype } : undefined,
  };
}

export function serializeDoc(doc: Doc): SerializableDoc {
  return {
    ...doc,
    selection: [...doc.selection],
  };
}

export function hydrateDoc(raw: unknown): Doc {
  if (!raw || typeof raw !== "object") return createDoc();
  const r = raw as Partial<SerializableDoc>;
  if (r.schema !== "null_advanced_v1") return createDoc();

  const base = createDoc();
  const nodes = r.nodes && typeof r.nodes === "object" ? (r.nodes as Record<string, Node>) : base.nodes;

  return {
    ...base,
    ...r,
    nodes,
    pages: Array.isArray(r.pages) && r.pages.length ? (r.pages as DocPage[]) : base.pages,
    selection: new Set(Array.isArray(r.selection) ? r.selection : []),
    view: r.view && typeof r.view === "object" ? (r.view as Doc["view"]) : base.view,
    styles: Array.isArray(r.styles) ? (r.styles as StyleToken[]) : base.styles,
    variables: Array.isArray(r.variables) ? (r.variables as Variable[]) : base.variables,
    components: r.components && typeof r.components === "object" ? (r.components as Record<string, string>) : base.components,
    prototype: r.prototype && typeof r.prototype === "object" ? (r.prototype as DocPrototype) : base.prototype,
  };
}
