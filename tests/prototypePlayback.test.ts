import { describe, expect, it } from "vitest";
import { createDoc, createNode, addNode } from "../src/advanced/doc/scene";
import { layoutDoc } from "../src/advanced/layout/engine";

describe("Q7 프로토타입 재생 (데이터 구조·전환·오버레이 검증)", () => {
  it("prototype.startPageId와 페이지가 있으면 layoutDoc 후에도 유지", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].id;
    doc.prototype = { startPageId: pageId };
    const laidOut = layoutDoc(doc);
    expect(laidOut.prototype?.startPageId).toBe(pageId);
    expect(laidOut.pages.some((p) => p.id === pageId)).toBe(true);
  });

  it("navigate 인터랙션이 있으면 targetPageId가 문서 페이지에 존재해야 재생 가능", () => {
    const doc = createDoc();
    const pageA = doc.pages[0];
    const pageBId = "page_B";
    doc.pages.push({ id: pageBId, name: "페이지 2", rootId: pageBId });
    const rootB = createNode("frame", { id: pageBId, name: "페이지 2 루트", parentId: doc.root });
    rootB.id = pageBId;
    doc.nodes[pageBId] = rootB;
    doc.nodes[doc.root].children.push(pageBId);

    const btn = createNode("rect", {
      frame: { x: 0, y: 0, w: 100, h: 40, rotation: 0 },
      prototype: {
        interactions: [
          {
            id: "ia1",
            trigger: "click",
            action: { type: "navigate", targetPageId: pageBId },
          },
        ],
      },
    });
    addNode(doc, btn, pageA.rootId);

    const laidOut = layoutDoc(doc);
    const laidBtn = laidOut.nodes[btn.id];
    expect(laidBtn?.prototype?.interactions).toHaveLength(1);
    const action = laidBtn?.prototype?.interactions?.[0]?.action;
    expect(action && "type" in action && action.type === "navigate").toBe(true);
    const targetId = action && "targetPageId" in action ? action.targetPageId : "";
    expect(laidOut.pages.some((p) => p.id === targetId)).toBe(true);
  });

  it("overlay 인터랙션이 있으면 targetPageId가 문서 페이지에 존재해야 재생 가능", () => {
    const doc = createDoc();
    const pageA = doc.pages[0];
    const overlayPageId = "overlay_page";
    doc.pages.push({ id: overlayPageId, name: "오버레이", rootId: overlayPageId });
    const overlayRoot = createNode("frame", { id: overlayPageId, name: "오버레이 루트", parentId: doc.root });
    overlayRoot.id = overlayPageId;
    doc.nodes[overlayPageId] = overlayRoot;
    doc.nodes[doc.root].children.push(overlayPageId);

    const trigger = createNode("rect", {
      frame: { x: 0, y: 0, w: 80, h: 32, rotation: 0 },
      prototype: {
        interactions: [
          {
            id: "ov1",
            trigger: "hover",
            action: { type: "overlay", targetPageId: overlayPageId, transition: { type: "fade", duration: 200 } },
          },
        ],
      },
    });
    addNode(doc, trigger, pageA.rootId);

    const laidOut = layoutDoc(doc);
    const laidTrigger = laidOut.nodes[trigger.id];
    const action = laidTrigger?.prototype?.interactions?.[0]?.action;
    expect(action && "type" in action && action.type === "overlay").toBe(true);
    const targetId = action && "targetPageId" in action ? action.targetPageId : "";
    expect(laidOut.pages.some((p) => p.id === targetId)).toBe(true);
  });

  it("closeOverlay 인터랙션은 targetPageId 없이 재생 가능", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].rootId;
    const closeBtn = createNode("rect", {
      frame: { x: 0, y: 0, w: 60, h: 28, rotation: 0 },
      prototype: {
        interactions: [
          { id: "cl1", trigger: "click", action: { type: "closeOverlay" } },
        ],
      },
    });
    addNode(doc, closeBtn, pageId);

    const laidOut = layoutDoc(doc);
    const action = laidOut.nodes[closeBtn.id]?.prototype?.interactions?.[0]?.action;
    expect(action && "type" in action && action.type === "closeOverlay").toBe(true);
  });

  it("transition 정보가 있어도 layoutDoc 후 유지", () => {
    const doc = createDoc();
    const pageId = doc.pages[0].id;
    const rootId = doc.pages[0].rootId;
    const btn = createNode("rect", {
      frame: { x: 0, y: 0, w: 100, h: 40, rotation: 0 },
      prototype: {
        interactions: [
          {
            id: "t1",
            trigger: "click",
            action: {
              type: "navigate",
              targetPageId: pageId,
              transition: { type: "slide-left", duration: 300, easing: "ease-out" },
            },
          },
        ],
      },
    });
    addNode(doc, btn, rootId);

    const laidOut = layoutDoc(doc);
    const action = laidOut.nodes[btn.id]?.prototype?.interactions?.[0]?.action;
    expect(action && "transition" in action).toBe(true);
    const t = action && "transition" in action ? action.transition : undefined;
    expect(t?.type).toBe("slide-left");
    expect(t?.duration).toBe(300);
    expect(t?.easing).toBe("ease-out");
  });
});
