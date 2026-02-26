import { describe, expect, it } from "vitest";
import { createDoc, createNode, addNode, hydrateDoc, cloneDoc } from "../src/advanced/doc/scene";
import { layoutDoc } from "../src/advanced/layout/engine";

describe("L2 스트레스 테스트 — 대용량 문서", () => {
  it("수천 노드 문서에서 hydrateDoc·layoutDoc 오류 없이 동작", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const count = 2000;
    for (let i = 0; i < count; i++) {
      const node = createNode("rect", {
        frame: { x: (i % 80) * 14, y: Math.floor(i / 80) * 14, w: 12, h: 12, rotation: 0 },
      });
      addNode(doc, node, pageId);
    }
    expect(Object.keys(doc.nodes).length).toBeGreaterThanOrEqual(count + 2);

    expect(() => layoutDoc(doc)).not.toThrow();
    const laidOut = layoutDoc(doc);
    expect(laidOut.nodes).toBeDefined();
    expect(Object.keys(laidOut.nodes).length).toBeGreaterThanOrEqual(count + 2);
  });

  it("대용량 문서 직렬화 후 hydrateDoc 복원 가능", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    for (let i = 0; i < 500; i++) {
      const node = createNode("rect", {
        frame: { x: (i % 50) * 20, y: Math.floor(i / 50) * 20, w: 18, h: 18, rotation: 0 },
      });
      addNode(doc, node, pageId);
    }
    const serializable = {
      ...doc,
      selection: Array.from(doc.selection),
    };
    expect(() => hydrateDoc(serializable)).not.toThrow();
    const restored = hydrateDoc(serializable);
    expect(restored.root).toBe(doc.root);
    expect(Object.keys(restored.nodes).length).toBe(Object.keys(doc.nodes).length);
    expect(() => layoutDoc(restored)).not.toThrow();
  });
});

describe("I5 Vector network — path 세그먼트별 fill", () => {
  it("path 노드에 segments가 있으면 layoutDoc·hydrateDoc 오류 없이 동작", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const pathNode = createNode("path", {
      frame: { x: 0, y: 0, w: 200, h: 100, rotation: 0 },
      shape: {
        segments: [
          { d: "M 0 0 L 100 0 L 100 50 Z", fills: [{ type: "solid", color: "#FF0000" }] },
          { d: "M 100 50 L 200 50 L 200 100 L 100 100 Z", fills: [{ type: "solid", color: "#00FF00" }] },
          { d: "M 0 50 L 100 50 L 100 100 L 0 100 Z", fills: [{ type: "linear", from: "#000", to: "#fff", angle: 90 }] },
        ],
      },
    });
    addNode(doc, pathNode, pageId);
    expect(() => layoutDoc(doc)).not.toThrow();
    const laidOut = layoutDoc(doc);
    const node = laidOut.nodes[pathNode.id];
    expect(node?.shape?.segments?.length).toBe(3);
    const serializable = { ...laidOut, selection: Array.from(laidOut.selection) };
    expect(() => hydrateDoc(serializable)).not.toThrow();
    const restored = hydrateDoc(serializable);
    const restoredPath = restored.nodes[pathNode.id];
    expect(restoredPath?.shape?.segments?.length).toBe(3);
    expect(restoredPath?.shape?.segments?.[0].fills[0].type).toBe("solid");
    expect(restoredPath?.shape?.segments?.[2].fills[0].type).toBe("linear");
  });
});

describe("Q2 성능 — 대용량 문서", () => {
  const LAYOUT_TIMEOUT_MS = 5000;

  it("수천 노드 문서에서 layoutDoc이 제한 시간 내 완료", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const count = 2000;
    for (let i = 0; i < count; i++) {
      const node = createNode("rect", {
        frame: { x: (i % 80) * 14, y: Math.floor(i / 80) * 14, w: 12, h: 12, rotation: 0 },
      });
      addNode(doc, node, pageId);
    }
    const start = performance.now();
    layoutDoc(doc);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(LAYOUT_TIMEOUT_MS);
  });

  it("대용량 문서 cloneDoc이 제한 시간 내 완료", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    for (let i = 0; i < 1500; i++) {
      const node = createNode("rect", {
        frame: { x: (i % 60) * 16, y: Math.floor(i / 60) * 16, w: 14, h: 14, rotation: 0 },
      });
      addNode(doc, node, pageId);
    }
    const start = performance.now();
    cloneDoc(doc);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});

describe("N1 Table 노드 타입", () => {
  it("table 노드에 자식이 있으면 layoutDoc이 columns 기준 그리드로 배치", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const tableNode = createNode("table", {
      frame: { x: 0, y: 0, w: 300, h: 100, rotation: 0 },
      table: { columns: 3, headerRow: true },
    });
    addNode(doc, tableNode, pageId);
    for (let i = 0; i < 6; i++) {
      const cell = createNode("rect", { frame: { x: 0, y: 0, w: 1, h: 1, rotation: 0 } });
      addNode(doc, cell, tableNode.id);
    }
    expect(() => layoutDoc(doc)).not.toThrow();
    const laidOut = layoutDoc(doc);
    const table = laidOut.nodes[tableNode.id];
    expect(table?.type).toBe("table");
    expect(table?.table?.columns).toBe(3);
    const childIds = table!.children;
    expect(childIds.length).toBe(6);
    const firstCell = laidOut.nodes[childIds[0]];
    const secondCell = laidOut.nodes[childIds[1]];
    expect(firstCell?.frame.x).toBe(0);
    expect(firstCell?.frame.w).toBe(100);
    expect(secondCell?.frame.x).toBe(100);
  });

  it("table 노드 직렬화 후 hydrateDoc 복원 가능", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const tableNode = createNode("table", { table: { columns: 2, headerRow: false } });
    addNode(doc, tableNode, pageId);
    const serializable = { ...doc, selection: Array.from(doc.selection) };
    const restored = hydrateDoc(serializable);
    const table = restored.nodes[tableNode.id];
    expect(table?.type).toBe("table");
    expect(table?.table?.columns).toBe(2);
    expect(table?.table?.headerRow).toBe(false);
    expect(() => layoutDoc(restored)).not.toThrow();
  });
});
