/**
 * 도형 Boolean 연산 (Union / Subtract / Intersect / Exclude).
 * martinez-polygon-clipping 사용. 폴리곤은 [[x,y], ...] 단일 링.
 */

import * as martinez from "martinez-polygon-clipping";
import { pathDataToPolygon, polygonToPathD } from "./pathData";

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

/** martinez Geometry(Polygon | MultiPolygon)에서 첫 폴리곤의 첫 링을 반환. */
function geometryToFirstRing(geom: martinez.Geometry | null): number[][] | null {
  if (!geom || geom.length === 0) return null;
  const top = geom[0];
  if (!top || top.length < 2) return null;
  // Polygon = Ring[]: top is Ring (Position[]), top[0] is [x,y] → top[0][0] is number.
  // MultiPolygon = Polygon[]: top is Polygon (Ring[]), top[0] is Ring → top[0][0] is [x,y] (array).
  const firstEl = top[0];
  if (Array.isArray(firstEl) && typeof firstEl[0] === "number") return top as number[][];
  return (top as number[][][])[0] ?? null;
}

/**
 * 두 폴리곤(단일 링)에 Boolean 연산 적용.
 * ring: [[x,y], ...] (닫힌 다각형, 첫 점 ≠ 마지막 점이어도 됨)
 * 반환: 결과 path d 문자열. 실패 시 null.
 */
export function runBoolean(
  ring1: number[][],
  ring2: number[][],
  op: BooleanOp
): string | null {
  if (ring1.length < 3 || ring2.length < 3) return null;
  const poly1: number[][][] = [ring1];
  const poly2: number[][][] = [ring2];
  const geom1 = poly1 as unknown as martinez.Geometry;
  const geom2 = poly2 as unknown as martinez.Geometry;
  let result: martinez.Geometry | null = null;
  try {
    switch (op) {
      case "union":
        result = martinez.union(geom1, geom2);
        break;
      case "subtract":
        result = martinez.diff(geom1, geom2);
        break;
      case "intersect":
        result = martinez.intersection(geom1, geom2);
        break;
      case "exclude":
        result = martinez.xor(geom1, geom2);
        break;
      default:
        return null;
    }
  } catch {
    return null;
  }
  const firstRing = geometryToFirstRing(result);
  if (!firstRing) return null;
  return polygonToPathD(firstRing);
}

/**
 * 여러 폴리곤에 순차 적용. op === 'union'이면 모두 합침.
 * op === 'subtract'면 첫 번째에서 나머지를 순서대로 뺌.
 * op === 'intersect'면 첫 두 개 교차 후 그 결과와 세 번째 교차 ... (순차 교차).
 * op === 'exclude'면 첫 두 개 xor 후 그 결과와 세 번째 xor ...
 */
export function runBooleanMultiple(rings: number[][][], op: BooleanOp): string | null {
  if (rings.length === 0) return null;
  if (rings.length === 1) return polygonToPathD(rings[0]);
  let acc = rings[0];
  for (let i = 1; i < rings.length; i++) {
    const d = runBoolean(acc, rings[i], op);
    if (d == null) return null;
    const nextRing = pathDataToPolygon(d);
    if (!nextRing) return null;
    acc = nextRing;
  }
  return polygonToPathD(acc);
}
