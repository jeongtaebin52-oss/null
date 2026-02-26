import { describe, expect, it } from "vitest";
import { createDoc, createNode, addNode, cloneDoc } from "../src/advanced/doc/scene";
import { layoutDoc } from "../src/advanced/layout/engine";

/**
 * Q1 에디터 퀄리티: 대표 플로우(생성/편집/삭제/복사/실행/내보내기) 관련 엣지 케이스 검증.
 * UI 없이 scene·layout 수준에서 안전 동작을 확인한다.
 */
describe("Q1 에디터 엣지 케이스", () => {
  it("노드 삭제 후(children에서 제거·nodes에서 제거) layoutDoc 오류 없이 동작", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const frame = createNode("frame", { frame: { x: 0, y: 0, w: 200, h: 100, rotation: 0 } });
    addNode(doc, frame, pageId);
    const rect = createNode("rect", { frame: { x: 10, y: 10, w: 50, h: 30, rotation: 0 } });
    addNode(doc, rect, frame.id);

    const next = cloneDoc(doc);
    const parent = next.nodes[frame.id];
    if (parent) parent.children = parent.children.filter((id) => id !== rect.id);
    delete next.nodes[rect.id];

    expect(() => layoutDoc(next)).not.toThrow();
    const laidOut = layoutDoc(next);
    expect(laidOut.nodes[rect.id]).toBeUndefined();
    expect(laidOut.nodes[frame.id].children).not.toContain(rect.id);
  });

  it("빈 선택과 동일한 상태(selection 비움)에서 cloneDoc·layoutDoc 오류 없이 동작", () => {
    const doc = createDoc();
    doc.selection = new Set();
    expect(() => layoutDoc(doc)).not.toThrow();
    expect(() => layoutDoc(cloneDoc(doc))).not.toThrow();
  });

  it("존재하지 않는 노드 id가 children에 있어도 layoutDoc이 예외 없이 스킵", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const frame = createNode("frame", { frame: { x: 0, y: 0, w: 100, h: 100, rotation: 0 } });
    addNode(doc, frame, pageId);
    frame.children = ["non_existent_id"];
    expect(() => layoutDoc(doc)).not.toThrow();
  });
});
