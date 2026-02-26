/**
 * Step 30: 런타임 확장 포인트 — Plugins/Widgets API 구조만.
 * 플러그인 마켓·실제 위젯 구현은 선택(후속).
 */

import type { ReactNode } from "react";
import type { Node } from "../doc/scene";

export type RenderContext = {
  doc: unknown;
  pageId: string;
  interactive: boolean;
  variableRuntime?: unknown;
};

/** 노드 타입별 커스텀 렌더 함수. null 반환 시 기본 렌더러 사용. */
export type WidgetRenderFn = (props: {
  node: Node;
  ctx: RenderContext;
  children: ReactNode;
}) => ReactNode | null;

export type RuntimePlugin = {
  /** 노드 타입 → 커스텀 렌더 함수. 플러그인이 처리할 타입만 등록. */
  widgetRenderers?: Partial<Record<string, WidgetRenderFn>>;
};

const registry: RuntimePlugin[] = [];

/** 런타임 플러그인 등록. (위젯·커스텀 노드 렌더 등) */
export function registerRuntimePlugin(plugin: RuntimePlugin): void {
  registry.push(plugin);
}

/** 노드 타입에 대한 커스텀 렌더러 반환. 없으면 null → 기본 렌더러 사용. */
export function getCustomNodeRenderer(
  nodeType: string,
): ((props: { node: Node; ctx: RenderContext; children: ReactNode }) => ReactNode | null) | null {
  for (let i = registry.length - 1; i >= 0; i--) {
    const fn = registry[i].widgetRenderers?.[nodeType];
    if (fn) return fn;
  }
  return null;
}
