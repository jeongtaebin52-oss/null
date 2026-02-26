/**
 * Step 30: 런타임 확장 포인트 — Plugins/Widgets API 구조만.
 * 플러그인 마켓·실제 위젯 구현은 선택(후속).
 * Phase 1: Plugin API & context (read-only doc, variable mode).
 */

import type { ReactNode } from "react";
import type { Doc, Node } from "../doc/scene";

export type RenderContext = {
  doc: Doc;
  pageId: string;
  interactive: boolean;
  variableRuntime?: unknown;
  /** 현재 선택된 노드 id 목록 (에디터용). */
  selectionIds?: string[];
  /** 플러그인용 읽기 전용 API (getNode, getDoc, getPageId, getVariableMode). */
  pluginAPI?: PluginAPI;
};

/** Phase 1: 플러그인이 문서/변수 정보를 읽을 수 있는 API. */
export type PluginAPI = {
  getNode(id: string): Node | undefined;
  getDoc(): Doc;
  getPageId(): string;
  getVariableMode(): string | undefined;
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

/** 디버깅용: 등록된 런타임 플러그인 개수. */
export function listPlugins(): number {
  return registry.length;
}
