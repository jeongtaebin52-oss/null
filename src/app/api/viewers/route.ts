import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** §29.4 관객 수 실시간 갱신: 피드 폴링용. ids=id1,id2,... → { id1: 현재 관객 수, ... } */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam || typeof idsParam !== "string") {
    return NextResponse.json({ viewers: {} });
  }
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ viewers: {} });
  if (ids.length > 50) ids.splice(50);

  const counts = await prisma.liveSession.groupBy({
    by: ["page_id"],
    where: { page_id: { in: ids }, ended_at: null },
    _count: { id: true },
  });
  const viewers: Record<string, number> = {};
  for (const id of ids) viewers[id] = 0;
  for (const c of counts) viewers[c.page_id] = c._count.id;
  return NextResponse.json({ viewers });
}
