import type { Node } from "../doc/scene";

export type LayoutMode = "fixed" | "auto";
export type AutoDir = "row" | "col";
export interface Layout {
  mode: LayoutMode;
  dir?: AutoDir;
  gap?: number;
  padding?: number;
  align?: "start" | "center" | "end";
}

export function applyAutoLayout(children: Node[], layout: Layout) {
  let offset = layout.padding ?? 0;
  for (const child of children) {
    if (layout.dir === "row") {
      child.frame.x = offset;
      offset += child.frame.w + (layout.gap ?? 0);
    } else {
      child.frame.y = offset;
      offset += child.frame.h + (layout.gap ?? 0);
    }
  }
}
