import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";
import { buildMobileHostPackage } from "@/lib/mobile-package";

type Params = { pageId: string };

async function requireOwner(pageId: string, req: Request) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return { page: null as null, error: apiErrorJson("anon_required", 401) };
  const user = await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } });
  if (!user) return { page: null as null, error: apiErrorJson("user_not_found", 404) };
  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return { page: null as null, error: apiErrorJson("not_found", 404) };
  return { page, error: null };
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);
  const { error } = await requireOwner(pageId, req);
  if (error) return error;

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") ?? "capacitor";
  if (typeParam !== "capacitor" && typeParam !== "react-native") {
    return apiErrorJson("invalid_type", 400, { allowed: ["capacitor", "react-native"] });
  }

  const row = await prisma.pageSetting.findUnique({
    where: { page_id_key: { page_id: pageId, key: "mobile" } },
    select: { value: true },
  });
  const settings = row?.value ?? {};

  try {
    const pkg = buildMobileHostPackage(typeParam, settings);
    const filename = `${pkg.name}-${pageId.slice(0, 8)}.zip`;

    return new NextResponse(pkg.zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return apiErrorJson("package_failed", 500, { message: "패키지 생성 실패", detail: message });
  }
}
