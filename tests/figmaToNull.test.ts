import { describe, expect, it } from "vitest";
import { figmaNodesToNullDoc } from "../src/lib/figmaToNull";
import type { FigmaNode, FigmaPaint } from "../src/lib/figma";

describe("figmaToNull", () => {
  describe("figmaNodesToNullDoc", () => {
    it("returns empty doc when root has no children", () => {
      const docRoot: FigmaNode = {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: [],
      };
      const doc = figmaNodesToNullDoc("fileKey", docRoot);
      expect(doc.schema).toBe("null_advanced_v1");
      expect(doc.root).toBe("root");
      expect(doc.pages).toHaveLength(1);
      expect(Object.keys(doc.nodes)).toContain("root");
    });

    it("converts a single FRAME to page content", () => {
      const frame: FigmaNode = {
        id: "1:0",
        name: "Frame 1",
        type: "FRAME",
        absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
        children: [],
      };
      const docRoot: FigmaNode = {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: [frame],
      };
      const doc = figmaNodesToNullDoc("fileKey", docRoot);
      expect(doc.pages).toHaveLength(1);
      expect(doc.pages[0]!.rootId).toBe("figma_page_1");
      const pageNode = doc.nodes["figma_page_1"];
      expect(pageNode).toBeDefined();
      expect(pageNode?.type).toBe("frame");
      expect(pageNode?.frame).toEqual({ x: 0, y: 0, w: 400, h: 300, rotation: 0 });
    });

    it("converts RECTANGLE with fill to rect node", () => {
      const rect: FigmaNode = {
        id: "2:0",
        name: "Rectangle",
        type: "RECTANGLE",
        absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 50 },
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
        children: [],
      };
      const frame: FigmaNode = {
        id: "1:0",
        name: "Frame",
        type: "FRAME",
        absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
        children: [rect],
      };
      const docRoot: FigmaNode = {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: [frame],
      };
      const doc = figmaNodesToNullDoc("fileKey", docRoot);
      const nodeIds = Object.keys(doc.nodes).filter((id) => id.startsWith("figma_") && id !== "figma_page_1");
      expect(nodeIds.length).toBeGreaterThanOrEqual(1);
      const rectNode = Object.values(doc.nodes).find((n) => n.type === "rect");
      expect(rectNode).toBeDefined();
      expect(rectNode?.frame).toEqual({ x: 10, y: 20, w: 100, h: 50, rotation: 0 });
      expect(rectNode?.style?.fills).toHaveLength(1);
      expect(rectNode?.style?.fills?.[0]).toMatchObject({ type: "solid", color: "#ff0000" });
    });

    it("uses options.fileName for page name", () => {
      const frame: FigmaNode = {
        id: "1:0",
        name: "Frame",
        type: "FRAME",
        absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
        children: [],
      };
      const docRoot: FigmaNode = {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: [frame],
      };
      const doc = figmaNodesToNullDoc("fileKey", docRoot, { fileName: "My Design" });
      expect(doc.pages[0]!.name).toBe("My Design");
      expect(doc.nodes["figma_page_1"]?.name).toBe("My Design");
    });

    it("applies imageUrlMap to image-type nodes", () => {
      const rectWithImage: FigmaNode = {
        id: "2:0",
        name: "Image",
        type: "RECTANGLE",
        absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 150 },
        fills: [{ type: "IMAGE", imageRef: "ref", opacity: 1 }] as FigmaPaint[],
        children: [],
      };
      const frame: FigmaNode = {
        id: "1:0",
        name: "Frame",
        type: "FRAME",
        absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
        children: [rectWithImage],
      };
      const docRoot: FigmaNode = {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: [frame],
      };
      const imageUrlMap: Record<string, string> = { "2:0": "https://example.com/image.png" };
      const doc = figmaNodesToNullDoc("fileKey", docRoot, { imageUrlMap });
      const imgNode = Object.values(doc.nodes).find((n) => n.type === "image");
      expect(imgNode).toBeDefined();
      expect(imgNode?.image?.src).toBe("https://example.com/image.png");
    });
  });
});
