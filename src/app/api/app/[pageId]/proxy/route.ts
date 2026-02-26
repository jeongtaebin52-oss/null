import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";
import { apiErrorJson } from "@/lib/api-error";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]"];
const MAX_TIMEOUT_MS = 15_000;

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return BLOCKED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(".internal"));
  } catch {
    return true;
  }
}

async function resolveSecrets(pageId: string, text: string): Promise<string> {
  const matches = text.match(/\{\{secrets\.([^}]+)\}\}/g);
  if (!matches) return text;

  const keys = matches.map((m) => m.replace("{{secrets.", "").replace("}}", ""));
  const secrets = await prisma.appSecret.findMany({
    where: { page_id: pageId, key: { in: keys } },
  });
  const map = new Map(secrets.map((s) => [s.key, s.value]));

  let result = text;
  for (const key of keys) {
    result = result.replaceAll(`{{secrets.${key}}}`, map.get(key) ?? "");
  }
  return result;
}

export const POST = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body || typeof body.url !== "string") {
      return apiErrorJson("url_required", 400, "url이 필요합니다.");
    }

    const rawUrl = String(body.url);
    const method = String(body.method ?? "GET").toUpperCase();
    const rawHeaders = (body.headers as Record<string, string>) ?? {};
    const rawBody = body.body;

    const url = await resolveSecrets(pageId, rawUrl);
    if (isBlockedUrl(url)) {
      return apiErrorJson("blocked_host", 403, "차단된 호스트입니다.");
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      headers[k] = await resolveSecrets(pageId, String(v));
    }

    if (!headers["Content-Type"] && rawBody && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

    try {
      const fetchOpts: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      if (rawBody && method !== "GET" && method !== "HEAD") {
        fetchOpts.body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
      }

      const res = await fetch(url, fetchOpts);
      clearTimeout(timeout);

      const contentType = res.headers.get("content-type") ?? "";
      let data: unknown;
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      } else {
        data = await res.text().catch(() => "");
      }

      return NextResponse.json({
        ok: res.ok,
        status: res.status,
        data,
      });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "proxy_failed";
      return apiErrorJson("proxy_failed", 502, {
        message: "프록시 요청에 실패했습니다.",
        extra: { detail: message },
      });
    }
  }
);
