"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import RuntimeRenderer, { buildControlRoles, type NavigateEvent, type ControlRole } from "./renderer";
import type { Doc, Node, PrototypeAction, PrototypeCondition, PrototypeInteraction, PrototypeTransitionType, SerializableDoc } from "../doc/scene";
import { cloneDoc, hydrateDoc } from "../doc/scene";
import { applyConstraintsOnResize, layoutDoc } from "../layout/engine";

type Props = {
  doc: Doc | SerializableDoc;
  initialPageId?: string | null;
  className?: string;
  onPageChange?: (pageId: string) => void;
  fitToContent?: boolean;
  previewMode?: boolean;
};

type PageTransitionState = {
  type: PrototypeTransitionType;
  fromId: string;
  toId: string;
  phase: "start" | "active";
  duration?: number;
  easing?: string;
};

type OverlayTransitionState = {
  type: PrototypeTransitionType;
  overlayId: string;
  mode: "enter" | "exit";
  phase: "start" | "active";
  duration?: number;
  easing?: string;
};

const TRANSITION_DURATION: Record<PrototypeTransitionType, number> = {
  instant: 0,
  fade: 220,
  "slide-left": 260,
  "slide-right": 260,
  smart: 300,
};
const DEFAULT_OVERLAY_CLOSE: PrototypeTransitionType = "fade";

type FieldMeta = {
  label: string;
  key: string;
  valueHint?: string;
};

function normalizeFieldLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\[.*?\]/g, "")
    .replace(/[:：\-]/g, "")
    .replace(/\s+/g, "");
}

function resolveTargetPlan(normalized: string) {
  if (normalized.includes("pro") || normalized.includes("\uD504\uB85C")) return "pro";
  if (
    normalized.includes("standard") ||
    normalized.includes("\uC2A4\uD0E0\uB2E4\uB4DC") ||
    normalized.includes("basic") ||
    normalized.includes("\uBCA0\uC774\uC9C1")
  )
    return "standard";
  if (normalized.includes("enterprise") || normalized.includes("\uC5D4\uD130\uD504\uB77C\uC774\uC988")) return "enterprise";
  return null;
}

function mapFieldLabel(label: string): FieldMeta | null {
  const explicitKeyMatch = label.match(/^\s*\[?([\p{L}\p{N}_-]+)\]?\s*[:\-]/u);
  if (explicitKeyMatch) {
    return { label, key: explicitKeyMatch[1].toLowerCase() };
  }
  const bracketMatch = label.match(/\[([\p{L}\p{N}_-]+)\]/u);
  if (bracketMatch) {
    return { label, key: bracketMatch[1].toLowerCase() };
  }

  const normalized = normalizeFieldLabel(label);
  if (!normalized) return null;

  if (normalized.includes("email") || normalized.includes("\uC774\uBA54\uC77C")) {
    return { label, key: "email" };
  }
  if (normalized.includes("username") || normalized.includes("\uC544\uC774\uB514") || normalized === "id" || normalized.endsWith("id")) {
    return { label, key: "email" };
  }
  if (
    normalized.includes("passwordconfirm") ||
    (normalized.includes("password") && normalized.includes("confirm")) ||
    (normalized.includes("\uBE44\uBC00\uBC88\uD638") && normalized.includes("\uD655\uC778"))
  ) {
    return { label, key: "passwordConfirm" };
  }
  if (normalized.includes("password") || normalized.includes("\uBE44\uBC00\uBC88\uD638")) {
    return { label, key: "password" };
  }
  if (normalized.includes("name") || normalized.includes("\uC774\uB984")) {
    return { label, key: "name" };
  }
  if (normalized.includes("phone") || normalized.includes("\uC804\uD654") || normalized.includes("\uC5F0\uB77D")) {
    return { label, key: "phone" };
  }
  if (normalized.includes("message") || normalized.includes("\uBA54\uC2DC\uC9C0") || normalized.includes("\uBB38\uC758")) {
    return { label, key: "message" };
  }
  if (normalized.includes("cardnumber") || normalized.includes("\uCE74\uB4DC") || normalized.includes("\uBC88\uD638")) {
    return { label, key: "cardNumber" };
  }
  if (normalized.includes("cardname") || normalized.includes("\uBA85\uC758")) {
    return { label, key: "cardName" };
  }
  if (normalized.includes("expiry") || normalized.includes("exp") || normalized.includes("\uB9CC\uB8CC")) {
    return { label, key: "cardExpiry" };
  }
  if (normalized.includes("cvc") || normalized.includes("cvv")) {
    return { label, key: "cardCvc" };
  }
  if (
    normalized.includes("terms") ||
    normalized.includes("\uC57D\uAD00") ||
    normalized.includes("\uB3D9\uC758")
  ) {
    return { label, key: "terms" };
  }

  const planHint = resolveTargetPlan(normalized);
  if (planHint) {
    return { label, key: "targetPlan", valueHint: planHint };
  }
  if (
    normalized.includes("plan") ||
    normalized.includes("\uD50C\uB79C") ||
    normalized.includes("\uC694\uAE08\uC81C")
  ) {
    return { label, key: "targetPlan" };
  }

  return null;
}

function isGenericControlLabel(label: string) {
  const normalized = normalizeFieldLabel(label);
  if (!normalized) return true;
  return (
    normalized === "input" ||
    normalized === "textfield" ||
    normalized.includes("필드") ||
    normalized.includes("입력") ||
    normalized.includes("checkbox") ||
    normalized.includes("체크") ||
    normalized.includes("toggle") ||
    normalized.includes("토글") ||
    normalized.includes("switch") ||
    normalized.includes("버튼") ||
    normalized.includes("button")
  );
}

function findControlTextLabel(doc: Doc, rootId: string) {
  const root = doc.nodes[rootId];
  if (!root) return "";
  const stack = [...(root.children ?? [])];
  while (stack.length) {
    const id = stack.shift();
    if (!id) continue;
    const node = doc.nodes[id];
    if (!node) continue;
    if (node.type === "text" && node.text?.value) {
      return node.text.value;
    }
    if (node.children?.length) {
      stack.push(...node.children);
    }
  }
  return "";
}

function resolveControlLabel(doc: Doc, role: ControlRole, rootId: string) {
  const node = doc.nodes[rootId];
  const nameLabel = node?.name?.trim() ?? "";
  const placeholder = role.type === "input" ? role.placeholder?.trim() ?? "" : "";
  const textLabel = findControlTextLabel(doc, rootId);
  const base = nameLabel || placeholder || textLabel;
  if (!base) return rootId;
  if (isGenericControlLabel(base)) {
    return placeholder || textLabel || nameLabel || rootId;
  }
  return base;
}

function collectDescendants(doc: Doc | SerializableDoc, rootId: string) {
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const node = doc.nodes[id];
    if (node?.children?.length) {
      node.children.forEach((childId) => stack.push(childId));
    }
  }
  return ids;
}

function resolveSubmitScopeIds(doc: Doc | SerializableDoc, pageId: string | null, nodeId?: string | null) {
  const page = pageId ? doc.pages.find((p) => p.id === pageId) ?? doc.pages[0] : doc.pages[0];
  const pageRootId = page?.rootId ?? doc.root;
  if (!nodeId) return collectDescendants(doc, pageRootId);

  let current: Node | undefined | null = doc.nodes[nodeId];
  while (current) {
    const name = current.name?.toLowerCase() ?? "";
    const isFormish =
      (current.type === "frame" ||
        current.type === "section" ||
        current.type === "component" ||
        current.type === "instance" ||
        current.type === "group" ||
        current.type === "slice") &&
      (name.includes("\uD3FC") || name.includes("form") || name.includes("\uD328\uB110") || name.includes("panel"));
    if (isFormish) return collectDescendants(doc, current.id);
    if (current.id === pageRootId) break;
    current = current.parentId ? doc.nodes[current.parentId] : null;
  }

  return collectDescendants(doc, pageRootId);
}

function isSameOriginUrl(href: string) {
  try {
    const target = new URL(href, window.location.origin);
    return target.origin === window.location.origin;
  } catch {
    return false;
  }
}

const SUBMIT_ERROR_MESSAGES: Record<string, string> = {
  email_password_required: "\uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
  password_too_short: "\uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.",
  password_mismatch: "\uBE44\uBC00\uBC88\uD638 \uD655\uC778\uACFC \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  anon_user_id_required: "\uC138\uC158\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
  user_not_found: "\uC0AC\uC6A9\uC790\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
  email_in_use: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4. \uB85C\uADF8\uC778\uC744 \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.",
  already_registered: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4. \uB85C\uADF8\uC778\uC744 \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.",
  invalid_credentials: "\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  invalid_plan: "\uC62C\uBC14\uB978 \uD50C\uB79C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.",
  upgrade_failed: "\uACB0\uC81C \uC2B9\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
  invalid_entry: "\uC785\uB825\uAC12\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
  forbidden: "\uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  stripe_not_configured: "\uACB0\uC81C \uC2DC\uC2A4\uD15C\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
  stripe_price_missing: "\uC694\uAE08\uC81C \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
  billing_unavailable: "\uACB0\uC81C \uC11C\uBE44\uC2A4\uB97C \uD604\uC7AC \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
};

const SUBMIT_SUCCESS_MESSAGE = "\uC694\uCCAD\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
const SUBMIT_SENT_MESSAGE = "\uC694\uCCAD\uC744 \uC804\uC1A1\uD588\uC2B5\uB2C8\uB2E4.";
const SUBMIT_FAILED_MESSAGE = "\uC694\uCCAD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.";

function resolveSubmitError(error: unknown, fallback: string) {
  if (typeof error !== "string") return fallback;
  return SUBMIT_ERROR_MESSAGES[error] ?? fallback;
}

function getTransitionType(action: PrototypeAction): PrototypeTransitionType {
  return "transition" in action && action.transition?.type ? action.transition.type : "instant";
}

function getRuntimeVariableValue(
  doc: Doc | SerializableDoc,
  variableId: string,
  variableMode: string,
  variableOverrides: Record<string, string | number | boolean>,
): string | number | boolean | undefined {
  const variable = doc.variables?.find((v) => v.id === variableId);
  if (!variable) return undefined;
  if (variableId in variableOverrides) return variableOverrides[variableId];
  if (variable.modes && variableMode in variable.modes) return variable.modes[variableMode];
  return variable.value;
}

function evaluateCondition(
  doc: Doc | SerializableDoc,
  condition: PrototypeCondition,
  variableMode: string,
  variableOverrides: Record<string, string | number | boolean>,
): boolean {
  const current = getRuntimeVariableValue(doc, condition.variableId, variableMode, variableOverrides);
  const target = condition.value;
  if (current === undefined) return false;
  switch (condition.op) {
    case "eq":
      return current === target;
    case "neq":
      return current !== target;
    case "gt":
      return typeof current === "number" && typeof target === "number" && current > target;
    case "lt":
      return typeof current === "number" && typeof target === "number" && current < target;
    case "gte":
      return typeof current === "number" && typeof target === "number" && current >= target;
    case "lte":
      return typeof current === "number" && typeof target === "number" && current <= target;
    default:
      return false;
  }
}

function getDelayMs(action: PrototypeAction) {
  const delay = "delayMs" in action ? action.delayMs ?? 0 : 0;
  return Math.max(0, Math.min(delay, 10000));
}

function transitionStyles(state: PageTransitionState, role: "from" | "to"): CSSProperties {
  const isActive = state.phase === "active";
  const duration = state.duration ?? TRANSITION_DURATION[state.type];
  const easing = state.easing ?? "ease";
  if (state.type === "fade" || state.type === "smart") {
    return {
      opacity: role === "from" ? (isActive ? 0 : 1) : isActive ? 1 : 0,
      transition: `opacity ${duration}ms ${easing}`,
    };
  }
  if (state.type === "slide-left") {
    return {
      transform:
        role === "from"
          ? `translateX(${isActive ? "-20%" : "0%"})`
          : `translateX(${isActive ? "0%" : "100%"})`,
      transition: `transform ${duration}ms ${easing}`,
    };
  }
  if (state.type === "slide-right") {
    return {
      transform:
        role === "from"
          ? `translateX(${isActive ? "20%" : "0%"})`
          : `translateX(${isActive ? "0%" : "-100%"})`,
      transition: `transform ${duration}ms ${easing}`,
    };
  }
  return {};
}

function overlayStyles(state: OverlayTransitionState): CSSProperties {
  const isActive = state.phase === "active";
  const duration = state.duration ?? TRANSITION_DURATION[state.type];
  const easing = state.easing ?? "ease";
  if (state.type === "fade" || state.type === "smart") {
    return {
      opacity: state.mode === "enter" ? (isActive ? 1 : 0) : isActive ? 0 : 1,
      transition: `opacity ${duration}ms ${easing}`,
    };
  }
  if (state.type === "slide-left") {
    return {
      transform:
        state.mode === "enter"
          ? `translateX(${isActive ? "0%" : "100%"})`
          : `translateX(${isActive ? "100%" : "0%"})`,
      transition: `transform ${duration}ms ${easing}`,
    };
  }
  if (state.type === "slide-right") {
    return {
      transform:
        state.mode === "enter"
          ? `translateX(${isActive ? "0%" : "-100%"})`
          : `translateX(${isActive ? "-100%" : "0%"})`,
      transition: `transform ${duration}ms ${easing}`,
    };
  }
  return {};
}

export default function AdvancedRuntimePlayer({ doc, initialPageId, className, onPageChange, fitToContent, previewMode }: Props) {
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const pageIds = useMemo(() => (Array.isArray(doc.pages) ? doc.pages.map((page) => page.id) : []), [doc.pages]);
  const startPageId = doc.prototype?.startPageId ?? pageIds[0] ?? null;

  const [basePageId, setBasePageId] = useState<string | null>(initialPageId ?? startPageId);
  const [history, setHistory] = useState<string[]>([]);
  const [overlayStack, setOverlayStack] = useState<string[]>([]);
  const [pageTransition, setPageTransition] = useState<PageTransitionState | null>(null);
  const [overlayTransition, setOverlayTransition] = useState<OverlayTransitionState | null>(null);
  const [controlState, setControlState] = useState<Record<string, boolean>>({});
  const [controlTextState, setControlTextState] = useState<Record<string, string>>({});
  const [submitNotice, setSubmitNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const modes = doc.variableModes?.length ? doc.variableModes : ["기본"];
  const [variableMode, setVariableMode] = useState<string>(doc.variableMode ?? modes[0] ?? "기본");
  const [variableOverrides, setVariableOverrides] = useState<Record<string, string | number | boolean>>({});
  const [instanceVariantOverrides, setInstanceVariantOverrides] = useState<Record<string, string>>({});
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const baseLaidOut = useMemo(() => layoutDoc(hydrateDoc(doc)), [doc]);
  const laidOut = useMemo(() => {
    if (containerSize.w <= 0 || containerSize.h <= 0) return baseLaidOut;
    const pageId = basePageId ?? baseLaidOut.prototype?.startPageId ?? baseLaidOut.pages[0]?.id ?? null;
    const page = pageId ? baseLaidOut.pages.find((p) => p.id === pageId) ?? baseLaidOut.pages[0] : baseLaidOut.pages[0];
    if (!page) return baseLaidOut;
    const rootId = page.rootId;
    const root = baseLaidOut.nodes[rootId];
    if (!root) return baseLaidOut;
    const prevFrame = root.frame;
    const nextDoc = cloneDoc(baseLaidOut);
    const nextRoot = nextDoc.nodes[rootId];
    if (!nextRoot) return baseLaidOut;
    nextRoot.frame = { ...prevFrame, w: containerSize.w, h: containerSize.h };
    const constrained = applyConstraintsOnResize(nextDoc, rootId, prevFrame, nextRoot.frame);
    return layoutDoc(constrained);
  }, [baseLaidOut, basePageId, containerSize.w, containerSize.h]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ w: Math.max(0, width), h: Math.max(0, height) });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const controlRoles = useMemo(
    () => buildControlRoles(laidOut, { mode: variableMode, variableOverrides }),
    [laidOut, variableMode, variableOverrides],
  );
  const controlRootRoles = useMemo(() => {
    const roots = new Map<string, ControlRole>();
    Object.values(controlRoles).forEach((role) => {
      if (role.role !== "root") return;
      roots.set(role.rootId, role);
    });
    return roots;
  }, [controlRoles]);

  const controlFields = useMemo(() => {
    const fields = new Map<string, FieldMeta>();
    controlRootRoles.forEach((role, rootId) => {
      const label = resolveControlLabel(laidOut, role, rootId);
      const mapped = mapFieldLabel(label);
      fields.set(rootId, { label, key: mapped?.key ?? label, valueHint: mapped?.valueHint });
    });
    return fields;
  }, [controlRootRoles, laidOut]);

  const timersRef = useRef<number[]>([]);
  const basePageRef = useRef(basePageId);
  const overlayRef = useRef(overlayStack);
  const historyRef = useRef(history);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    basePageRef.current = basePageId;
  }, [basePageId]);
  useEffect(() => {
    overlayRef.current = overlayStack;
  }, [overlayStack]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // initialPageId(부모 prop)가 바뀐 경우에만 동기화. basePageId를 deps에 넣으면 사용자가 회원가입 등으로
  // 페이지 전환할 때마다 이 effect가 돌아서 다시 initialPageId로 되돌아가 깜빡임·Maximum update depth 발생.
  useEffect(() => {
    if (!initialPageId || !pageIds.includes(initialPageId)) return;
    setBasePageId(initialPageId);
    setHistory([]);
    setOverlayStack([]);
  }, [initialPageId, pageIds]);

  useEffect(() => {
    if (!basePageId || !pageIds.includes(basePageId)) {
      setBasePageId(startPageId);
      setHistory([]);
      setOverlayStack([]);
    }
  }, [basePageId, pageIds, startPageId]);

  useEffect(() => {
    if (!basePageId) return;
    onPageChangeRef.current?.(basePageId);
  }, [basePageId]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // doc이 바뀔 때 컨트롤/변수 초기화. preview(에디터)에서는 매 커밋마다 doc 참조가 바뀌므로 리셋하면
  // 입력 중 폼이 초기화되어 깜빡임·오류 유발 → preview 모드에서는 스킵.
  useEffect(() => {
    if (previewMode) return;
    setControlState({});
    setControlTextState({});
    const nextModes = doc.variableModes?.length ? doc.variableModes : ["기본"];
    setVariableMode(doc.variableMode ?? nextModes[0] ?? "기본");
    setVariableOverrides({});
  }, [doc, previewMode]);

  useEffect(() => {
    if (!submitNotice) return;
    const timeout = window.setTimeout(() => setSubmitNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [submitNotice]);

  useEffect(() => {
    if (!pageTransition) return;
    const duration = pageTransition.duration ?? TRANSITION_DURATION[pageTransition.type];
    if (duration === 0) {
      setBasePageId(pageTransition.toId);
      setPageTransition(null);
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      setPageTransition((prev) => (prev ? { ...prev, phase: "active" } : prev));
    });
    const timeout = window.setTimeout(() => {
      setBasePageId(pageTransition.toId);
      setPageTransition(null);
    }, duration);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [pageTransition]);

  useEffect(() => {
    if (!overlayTransition) return;
    const duration = overlayTransition.duration ?? TRANSITION_DURATION[overlayTransition.type];
    if (duration === 0) {
      if (overlayTransition.mode === "exit") {
        setOverlayStack((prev) => {
          const index = prev.lastIndexOf(overlayTransition.overlayId);
          if (index === -1) return prev;
          return prev.filter((_, idx) => idx !== index);
        });
      }
      setOverlayTransition(null);
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      setOverlayTransition((prev) => (prev ? { ...prev, phase: "active" } : prev));
    });
    const timeout = window.setTimeout(() => {
      if (overlayTransition.mode === "exit") {
        setOverlayStack((prev) => {
          const index = prev.lastIndexOf(overlayTransition.overlayId);
          if (index === -1) return prev;
          return prev.filter((_, idx) => idx !== index);
        });
      }
      setOverlayTransition(null);
    }, duration);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [overlayTransition]);

  const startPageTransition = useCallback(
    (fromId: string, toId: string, type: PrototypeTransitionType, options?: { duration?: number; easing?: string }) => {
      if (type === "instant") {
        setBasePageId(toId);
        return;
      }
      setPageTransition({ type, fromId, toId, phase: "start", duration: options?.duration, easing: options?.easing });
    },
    [],
  );

  const openOverlay = useCallback(
    (targetId: string, type: PrototypeTransitionType, options?: { duration?: number; easing?: string }) => {
      if (!targetId) return;
      setOverlayStack((prev) => [...prev, targetId]);
      if (type !== "instant") {
        setOverlayTransition({
          type,
          overlayId: targetId,
          mode: "enter",
          phase: "start",
          duration: options?.duration,
          easing: options?.easing,
        });
      }
    },
    [],
  );

  const closeOverlay = useCallback(
    (type: PrototypeTransitionType, options?: { duration?: number; easing?: string }) => {
      const stack = overlayRef.current;
      const top = stack[stack.length - 1];
      if (!top) return;
      if (type === "instant") {
        setOverlayStack((prev) => prev.slice(0, -1));
        return;
      }
      setOverlayTransition({ type, overlayId: top, mode: "exit", phase: "start", duration: options?.duration, easing: options?.easing });
    },
    [],
  );

  const closeOverlayDefault = useCallback(() => {
    closeOverlay(DEFAULT_OVERLAY_CLOSE);
  }, [closeOverlay]);

  const handleToggleControl = useCallback(
    (rootId: string) => {
      setControlState((prev) => {
        const meta = controlFields.get(rootId);
        if (meta?.key === "targetPlan") {
          const nextValue = !prev[rootId];
          const next = { ...prev };
          controlFields.forEach((field, id) => {
            if (field.key === "targetPlan") next[id] = false;
          });
          next[rootId] = nextValue;
          return next;
        }
        return { ...prev, [rootId]: !prev[rootId] };
      });
    },
    [controlFields],
  );

  const handleControlTextChange = useCallback((rootId: string, value: string) => {
    setControlTextState((prev) => ({ ...prev, [rootId]: value }));
  }, []);

  const buildSubmitPayload = useCallback((options?: { pageId?: string | null; scopeIds?: Set<string> }) => {
    const doc = docRef.current;
    const pageId = options?.pageId ?? basePageRef.current ?? null;
    const scopeIds = options?.scopeIds ?? resolveSubmitScopeIds(doc, pageId, null);
    const fields: Record<string, string | boolean> = {};
    const fallbackValues: Record<string, string | boolean> = {};
    controlRootRoles.forEach((role, rootId) => {
      if (!scopeIds.has(rootId)) return;
      const meta = controlFields.get(rootId);
      const key = meta?.key ?? rootId;
      if (role.type === "input") {
        const value = controlTextState[rootId] ?? "";
        if (key === "targetPlan") {
          if (value) fields[key] = value;
        } else if (value !== "") {
          fields[key] = value;
        } else if (!(key in fields)) {
          fallbackValues[key] = "";
        }
      } else if (role.type === "checkbox" || role.type === "toggle") {
        const checked = Boolean(controlState[rootId]);
        if (key === "targetPlan") {
          if (checked && !fields[key]) {
            fields[key] = meta?.valueHint ?? "pro";
          }
        } else {
          if (checked) {
            fields[key] = true;
          } else if (!(key in fields)) {
            fallbackValues[key] = false;
          }
        }
      }
    });
    Object.entries(fallbackValues).forEach(([key, value]) => {
      if (!(key in fields)) fields[key] = value;
    });
    return { fields, pageId, submittedAt: new Date().toISOString() };
  }, [controlFields, controlRootRoles, controlState, controlTextState]);

  const ensureAnonSession = useCallback(async () => {
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

  const handleAction = useCallback((action: PrototypeAction, source?: { nodeId?: string; pageId?: string }) => {
    const currentDoc = docRef.current;
    const currentPageId = basePageRef.current;
    const nextDelay = getDelayMs(action);
    const doAction = () => {
      if (!currentPageId) return;
      if ("condition" in action && action.condition) {
        const cond = action.condition as PrototypeCondition;
        if (!evaluateCondition(currentDoc, cond, variableMode, variableOverrides)) return;
      }
        if (action.type === "setVariable") {
          if (action.variableId) {
            if (action.mode !== undefined) setVariableMode(action.mode);
            const val = action.value;
            if (val !== undefined) setVariableOverrides((prev) => ({ ...prev, [action.variableId]: val }));
          }
          return;
        }
      const transitionType = getTransitionType(action);
      const transitionOpts =
        "transition" in action && action.transition
          ? { duration: action.transition.duration, easing: action.transition.easing }
          : { duration: undefined, easing: undefined };
      if (action.type === "url") {
        const href = action.url?.trim();
        if (!href) return;
        if (action.openInNewTab === false) {
          window.location.href = href;
        } else {
          window.open(href, "_blank", "noreferrer");
        }
        return;
      }
      if (action.type === "submit") {
        const endpoint = action.url?.trim();
        if (!endpoint) return;
        const pageId = source?.pageId ?? currentPageId;
        const scopeIds = resolveSubmitScopeIds(currentDoc, pageId, source?.nodeId ?? null);
        const payload = buildSubmitPayload({ pageId, scopeIds });
        const method = action.method === "GET" ? "GET" : "POST";
        const target = new URL(endpoint, window.location.origin);
        const queryFields = Object.fromEntries(target.searchParams.entries());
        const mergedFields = { ...queryFields, ...payload.fields };
        const meta = { _pageId: payload.pageId ?? "", _submittedAt: payload.submittedAt };
        const body = { ...mergedFields, ...meta };
        const sameOrigin = isSameOriginUrl(target.toString());
        const pathname = target.pathname;
        const storedAnonId = typeof localStorage !== "undefined" ? localStorage.getItem("anon_user_id") : null;
        const passwordFields = Array.from(controlFields.entries())
          .filter(([, meta]) => meta.key === "password" || meta.key === "passwordConfirm")
          .map(([rootId]) => rootId);

        const runSubmit = async () => {
          const tryFallbackNavigate = (message: string) => {
            if (!previewMode) return false;
            const fallbackId = action.nextPageId ?? target.searchParams.get("nextPageId");
            if (!fallbackId || !currentPageId) return false;
            if (!currentDoc.pages.some((page) => page.id === fallbackId)) return false;
            setOverlayStack([]);
            setHistory((prev) => [...prev, currentPageId]);
            startPageTransition(currentPageId, fallbackId, transitionType);
            setSubmitNotice({ type: "success", message });
            return true;
          };
          try {
            const anonId = sameOrigin ? (storedAnonId ?? (await ensureAnonSession())) : null;
            if (method === "GET") {
              Object.entries(body).forEach(([key, value]) => {
                if (value === undefined) return;
                target.searchParams.set(key, String(value));
              });
              await fetch(target.toString(), sameOrigin ? { method: "GET", credentials: "include" } : { method: "GET", mode: "no-cors" });
              setSubmitNotice({ type: "success", message: sameOrigin ? SUBMIT_SUCCESS_MESSAGE : SUBMIT_SENT_MESSAGE });
              if (action.nextPageId && currentPageId && currentDoc.pages.some((page) => page.id === action.nextPageId)) {
                setOverlayStack([]);
                setHistory((prev) => [...prev, currentPageId]);
                startPageTransition(currentPageId, action.nextPageId, transitionType, transitionOpts);
              }
              return;
            }

            const res = await fetch(sameOrigin ? target.toString() : endpoint, {
              method,
              headers: {
                "Content-Type": "application/json",
                ...(sameOrigin && anonId ? { "x-anon-user-id": anonId } : {}),
              },
              body: JSON.stringify(body),
              ...(sameOrigin ? { credentials: "include" } : { mode: "no-cors" as RequestMode }),
            });

            if (!sameOrigin) {
              setSubmitNotice({ type: "success", message: SUBMIT_SENT_MESSAGE });
              return;
            }

            const data = await res.json().catch(() => null);
            if (res.ok) {
              const nextPageId =
                data?.nextPageId ??
                action.nextPageId ??
                target.searchParams.get("nextPageId");
              if (data?.redirectUrl && typeof data.redirectUrl === "string") {
                window.location.href = data.redirectUrl;
                return;
              }
              if (data?.anonUserId && typeof localStorage !== "undefined") {
                localStorage.setItem("anon_user_id", data.anonUserId);
              }
              if (pathname.endsWith("/api/auth/logout") && typeof localStorage !== "undefined") {
                localStorage.removeItem("anon_user_id");
              }
              if (nextPageId && currentPageId && currentDoc.pages.some((page) => page.id === nextPageId)) {
                setOverlayStack([]);
                setHistory((prev) => [...prev, currentPageId]);
                startPageTransition(currentPageId, nextPageId, transitionType, transitionOpts);
              }
              if (passwordFields.length) {
                setControlTextState((prev) => {
                  const next = { ...prev };
                  passwordFields.forEach((id) => {
                    next[id] = "";
                  });
                  return next;
                });
              }
              setSubmitNotice({ type: "success", message: data?.message ?? SUBMIT_SUCCESS_MESSAGE });
            } else {
              const fallbackMessage = `${resolveSubmitError(data?.error, SUBMIT_FAILED_MESSAGE)} (미리보기 이동)`;
              if (!tryFallbackNavigate(fallbackMessage)) {
                setSubmitNotice({
                  type: "error",
                  message: resolveSubmitError(data?.error, SUBMIT_FAILED_MESSAGE),
                });
              }
            }
          } catch {
            const fallbackMessage = `${SUBMIT_FAILED_MESSAGE} (미리보기 이동)`;
            if (!tryFallbackNavigate(fallbackMessage)) {
              setSubmitNotice({ type: "error", message: SUBMIT_FAILED_MESSAGE });
            }
          }
        };

        void runSubmit();
        return;
      }
      if (action.type === "navigate") {
        if (!currentDoc.pages.some((page) => page.id === action.targetPageId)) return;
        if (action.targetPageId === currentPageId) return;
        setOverlayStack([]);
        setHistory((prev) => [...prev, currentPageId]);
        startPageTransition(currentPageId, action.targetPageId, transitionType, transitionOpts);
        return;
      }
      if (action.type === "back") {
        if (overlayRef.current.length) {
          closeOverlay(transitionType, transitionOpts);
          return;
        }
        const prevId = historyRef.current[historyRef.current.length - 1];
        if (!prevId) return;
        setHistory((prev) => prev.slice(0, -1));
        startPageTransition(currentPageId, prevId, transitionType, transitionOpts);
        return;
      }
      if (action.type === "overlay") {
        if (!currentDoc.pages.some((page) => page.id === action.targetPageId)) return;
        openOverlay(action.targetPageId, transitionType, transitionOpts);
        return;
      }
      if (action.type === "closeOverlay") {
        closeOverlay(transitionType, transitionOpts);
        return;
      }
      if (action.type === "scrollTo") {
        const el = typeof document !== "undefined" ? document.querySelector(`[data-node-id="${action.targetNodeId}"]`) : null;
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
        return;
      }
      if (action.type === "setVariant") {
        const targetId = action.targetNodeId ?? source?.nodeId;
        if (targetId) {
          setInstanceVariantOverrides((prev) => ({ ...prev, [targetId]: action.variantId }));
        }
        return;
      }
    };
    if (nextDelay > 0) {
      const timeout = window.setTimeout(doAction, nextDelay);
      timersRef.current.push(timeout);
    } else {
      doAction();
    }
  }, [buildSubmitPayload, closeOverlay, controlFields, ensureAnonSession, openOverlay, previewMode, startPageTransition, variableMode, variableOverrides]);

  const runLoadInteractions = useCallback(
    (pageId: string | null) => {
      if (!pageId) return;
      const currentDoc = docRef.current;
      const page = currentDoc.pages.find((item) => item.id === pageId) ?? currentDoc.pages[0];
      if (!page) return;
      const ids = collectDescendants(currentDoc, page.rootId);
      ids.forEach((id) => {
        const node = currentDoc.nodes[id];
        const interactions = node?.prototype?.interactions ?? [];
        interactions.forEach((interaction) => {
          if (interaction.trigger === "load") {
            handleAction(interaction.action, { nodeId: node?.id, pageId: page.id });
          }
        });
      });
    },
    [handleAction],
  );

  const handleNavigate = useCallback(
    (event: NavigateEvent) => {
      handleAction(event.action, { nodeId: event.nodeId, pageId: event.pageId });
    },
    [handleAction],
  );

  const topOverlayId = overlayStack.length ? overlayStack[overlayStack.length - 1] : null;
  const allowInteraction = !pageTransition && !overlayTransition;

  const baseLayerId = pageTransition ? pageTransition.fromId : basePageId;
  const nextLayerId = pageTransition?.toId ?? null;

  useEffect(() => {
    if (!allowInteraction) return;
    void ensureAnonSession();
  }, [allowInteraction, ensureAnonSession]);

  useEffect(() => {
    if (!allowInteraction) return;
    runLoadInteractions(basePageId);
  }, [allowInteraction, basePageId, runLoadInteractions]);

  const scrollTriggerFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!allowInteraction || !basePageId) return;
    scrollTriggerFiredRef.current = new Set();
    const currentDoc = docRef.current;
    const page = currentDoc.pages.find((p) => p.id === basePageId) ?? currentDoc.pages[0];
    if (!page) return;
    const descendantIds = Array.from(collectDescendants(currentDoc, page.rootId));
    const scrollableNodeIds = descendantIds.filter((id) => currentDoc.nodes[id]?.overflowScrolling);
    const scrollInteractions: { interaction: PrototypeInteraction; nodeId: string; pageId: string }[] = [];
    descendantIds.forEach((id) => {
      const node = currentDoc.nodes[id];
      node?.prototype?.interactions?.forEach((interaction) => {
        if (interaction.trigger === "scroll" && interaction.scrollTriggerConfig) {
          scrollInteractions.push({ interaction, nodeId: id, pageId: page.id });
        }
      });
    });
    if (scrollInteractions.length === 0) return;
    const cleanupFns: (() => void)[] = [];
    const raf = requestAnimationFrame(() => {
      scrollInteractions.forEach(({ interaction, nodeId, pageId }) => {
        const config = interaction.scrollTriggerConfig!;
        const containerNodeId = config.nodeId && scrollableNodeIds.includes(config.nodeId) ? config.nodeId : scrollableNodeIds[0];
        if (!containerNodeId) return;
        const nodeEl = typeof document !== "undefined" ? document.querySelector(`[data-node-id="${containerNodeId}"]`) : null;
        if (!nodeEl) return;
        const scrollEl = nodeEl.querySelector("foreignObject div") as HTMLElement | null;
        if (!scrollEl || !(scrollEl.scrollHeight > scrollEl.clientHeight || scrollEl.scrollWidth > scrollEl.clientWidth)) return;
        const check = () => {
          if (scrollTriggerFiredRef.current.has(interaction.id)) return;
          const { threshold, unit } = config;
          const verticalRatio = scrollEl.scrollHeight > scrollEl.clientHeight
            ? scrollEl.scrollTop / (scrollEl.scrollHeight - scrollEl.clientHeight) : 0;
          const horizontalRatio = scrollEl.scrollWidth > scrollEl.clientWidth
            ? scrollEl.scrollLeft / (scrollEl.scrollWidth - scrollEl.clientWidth) : 0;
          const ratio = Math.max(verticalRatio, horizontalRatio);
          const reached = unit === "percent" ? ratio >= threshold : (scrollEl.scrollTop >= threshold || scrollEl.scrollLeft >= threshold);
          if (reached) {
            scrollTriggerFiredRef.current.add(interaction.id);
            handleAction(interaction.action, { nodeId, pageId });
          }
        };
        scrollEl.addEventListener("scroll", check, { passive: true });
        check();
        cleanupFns.push(() => scrollEl.removeEventListener("scroll", check));
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanupFns.forEach((fn) => fn());
    };
  }, [allowInteraction, basePageId, handleAction, laidOut]);

  useEffect(() => {
    if (!allowInteraction) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!overlayRef.current.length) return;
      event.preventDefault();
      closeOverlayDefault();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [allowInteraction, closeOverlayDefault]);

  return (
    <div ref={containerRef} className={className ?? "relative h-full w-full"}>
      {submitNotice ? (
        <div
          className={`absolute right-4 top-4 z-20 rounded-full border px-3 py-2 text-xs shadow-sm ${
            submitNotice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {submitNotice.message}
        </div>
      ) : null}
      {baseLayerId ? (
        <div className="absolute inset-0" style={{ pointerEvents: topOverlayId ? "none" : "auto" }}>
          <div
            className="absolute inset-0"
            style={pageTransition ? transitionStyles(pageTransition, "from") : undefined}
          >
            <RuntimeRenderer
              doc={laidOut}
              activePageId={baseLayerId}
              interactive={allowInteraction && !topOverlayId}
              onNavigate={handleNavigate}
              fitToContent={fitToContent}
              controlState={controlState}
              onToggleControl={handleToggleControl}
              controlTextState={controlTextState}
              onChangeControlText={handleControlTextChange}
              variableRuntime={{ mode: variableMode, variableOverrides }}
              instanceVariantOverrides={instanceVariantOverrides}
            />
          </div>
          {pageTransition && nextLayerId ? (
            <div className="absolute inset-0" style={transitionStyles(pageTransition, "to")}>
              <RuntimeRenderer
                doc={doc}
                activePageId={nextLayerId}
                interactive={false}
                fitToContent={fitToContent}
                controlState={controlState}
                controlTextState={controlTextState}
                variableRuntime={{ mode: variableMode, variableOverrides }}
                instanceVariantOverrides={instanceVariantOverrides}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {topOverlayId ? (
        <div className="absolute inset-0 bg-black/10" style={{ pointerEvents: "none" }} />
      ) : null}

      {overlayStack.map((overlayId, index) => {
        const isTop = overlayId === topOverlayId;
        const hasTransition = overlayTransition && overlayTransition.overlayId === overlayId;
        return (
          <div
            key={`${overlayId}-${index}`}
            className="absolute inset-0"
            style={{
              ...(hasTransition ? overlayStyles(overlayTransition) : undefined),
              pointerEvents: isTop ? "auto" : "none",
            }}
            onClick={() => {
              if (!allowInteraction || !isTop) return;
              closeOverlayDefault();
            }}
          >
            <RuntimeRenderer
              doc={doc}
              activePageId={overlayId}
              interactive={allowInteraction && isTop}
              onNavigate={handleNavigate}
              fitToContent={fitToContent}
              controlState={controlState}
              onToggleControl={handleToggleControl}
              controlTextState={controlTextState}
              onChangeControlText={handleControlTextChange}
              variableRuntime={{ mode: variableMode, variableOverrides }}
              instanceVariantOverrides={instanceVariantOverrides}
            />
          </div>
        );
      })}
    </div>
  );
}
