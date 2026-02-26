export type GhostPoint = { t: number; x: number; y: number };
export type GhostClick = { t: number; x: number; y: number; el?: string };

function perpendicularDistance(point: GhostPoint, start: GhostPoint, end: GhostPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    const px = point.x - start.x;
    const py = point.y - start.y;
    return Math.sqrt(px * px + py * py);
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  const distX = point.x - projX;
  const distY = point.y - projY;
  return Math.sqrt(distX * distX + distY * distY);
}

function rdp(points: GhostPoint[], epsilon: number): GhostPoint[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

/** §5.1 정지 500ms+ 구간: hold 요약 또는 마지막 좌표만 (같은 위치 500ms+ → 마지막만 유지) */
export function compressHolds(
  points: GhostPoint[],
  minGapSec = 0.5,
  maxDistNorm = 0.01
): GhostPoint[] {
  if (points.length <= 2) return points;
  const out: GhostPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const last = out[out.length - 1];
    const dt = p.t - last.t;
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dt >= minGapSec && dist <= maxDistNorm) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

export function simplifyGhostPoints(points: GhostPoint[], maxPoints: number, baseEpsilon = 0.002) {
  if (points.length <= maxPoints) {
    return points;
  }

  let epsilon = baseEpsilon;
  let simplified = rdp(points, epsilon);

  while (simplified.length > maxPoints && epsilon < 0.05) {
    epsilon *= 1.4;
    simplified = rdp(points, epsilon);
  }

  if (simplified.length <= maxPoints) {
    return simplified;
  }

  const step = Math.ceil(simplified.length / maxPoints);
  const sampled = simplified.filter((_, index) => index % step === 0);
  if (sampled[sampled.length - 1] !== simplified[simplified.length - 1]) {
    sampled.push(simplified[simplified.length - 1]);
  }
  return sampled;
}
