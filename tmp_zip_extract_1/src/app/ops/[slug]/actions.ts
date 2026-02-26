"use server";

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { clearAdminSession, createAdminSession, isAdminUiConfigured, requireAdminSession, verifyAdminKey } from "@/lib/admin-session";

/**
 * Server Actions for Admin UI
 * - Avoids calling admin APIs (which are header-protected).
 * - Enforces admin session cookie.
 */

async function assertAdmin(slug: string) {
  if (!isAdminUiConfigured()) notFound();
  if (slug !== process.env.ADMIN_SECRET_SLUG) notFound();

  const gate = await requireAdminSession();
  if (!gate.ok) {
    // UI route exists but access denied. Keep semantics minimal:
    // - If not configured or wrong slug => 404 (handled above)
    // - If no session => allow page to render login UI
    // Actions themselves require session:
    throw new Error("ADMIN_SESSION_REQUIRED");
  }
}

export async function adminLoginAction(slug: string, formData: FormData) {
  if (!isAdminUiConfigured()) notFound();
  if (slug !== process.env.ADMIN_SECRET_SLUG) notFound();

  const key = String(formData.get("key") ?? "");
  if (!verifyAdminKey(key)) {
    return { ok: false as const, error: "BAD_KEY" as const };
  }

  await createAdminSession();
  return { ok: true as const };
}

export async function adminLogoutAction(slug: string) {
  if (!isAdminUiConfigured()) notFound();
  if (slug !== process.env.ADMIN_SECRET_SLUG) notFound();
  await clearAdminSession();
  return { ok: true as const };
}

export async function hidePageAction(slug: string, formData: FormData) {
  await assertAdmin(slug);

  const pageId = String(formData.get("pageId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || "admin_hide";
  if (!pageId) return { ok: false as const, error: "BAD_PAGE" as const };

  await prisma.page.update({
    where: { id: pageId },
    data: {
      is_hidden: true,
      hidden_at: new Date(),
      hidden_reason: reason,
    },
  });

  return { ok: true as const };
}

export async function forceExpirePageAction(slug: string, formData: FormData) {
  await assertAdmin(slug);

  const pageId = String(formData.get("pageId") ?? "");
  if (!pageId) return { ok: false as const, error: "BAD_PAGE" as const };

  await prisma.page.update({
    where: { id: pageId },
    data: {
      status: "expired",
      forced_expired_at: new Date(),
    },
  });

  return { ok: true as const };
}

export async function handleReportAction(slug: string, formData: FormData) {
  await assertAdmin(slug);

  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "resolved");
  const action = String(formData.get("action") ?? "none");
  const adminNote = String(formData.get("admin_note") ?? "").slice(0, 2000) || null;

  if (!reportId) return { ok: false as const, error: "BAD_REPORT" as const };

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { abuses: { take: 1, orderBy: { created_at: "desc" } }, page: true },
  });
  if (!report) return { ok: false as const, error: "NOT_FOUND" as const };

  const now = new Date();

  if (action === "hide_page") {
    await prisma.page.update({
      where: { id: report.page_id },
      data: {
        is_hidden: true,
        hidden_at: now,
        hidden_reason: report.reason ?? "reported",
      },
    });
  }

  if (action === "force_expire") {
    await prisma.page.update({
      where: { id: report.page_id },
      data: { status: "expired", forced_expired_at: now },
    });
  }

  if (action === "ban_ip") {
    const abuse = report.abuses?.[0];
    if (abuse?.ip_hash) {
      await prisma.ipBlock.upsert({
        where: { ip_hash: abuse.ip_hash },
        update: {
          reason: adminNote ?? "report-ban",
          // TODO(정책확정 필요): 차단 만료 기간 정책
          expires_at: null,
        },
        create: {
          ip_hash: abuse.ip_hash,
          reason: adminNote ?? "report-ban",
          expires_at: null,
        },
      });
    }
  }

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: status as any,
      action: action as any,
      admin_note: adminNote,
      handled_at: now,
    },
  });

  return { ok: true as const };
}
