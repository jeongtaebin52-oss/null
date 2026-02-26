import type { IncomingMessage } from "http";
import { parse } from "url";
import { prisma } from "@/lib/db";
import { extractHostFromHeader, getAlternateDomains, isLocalHostname, normalizeDomain } from "@/lib/hosting-domain";
import { getBaseUrl } from "@/lib/url";

type DomainRecord = {
  page_id: string;
  domain: string;
  status: string;
  force_https: boolean;
  redirect_www: boolean;
};

type DomainDecision =
  | { type: "redirect"; status: number; location: string }
  | { type: "rewrite"; url: string; pageId: string }
  | null;

const CACHE_TTL_MS = 60_000;
const domainCache = new Map<string, { expiresAt: number; value: DomainRecord | null }>();

function cacheGet(domain: string): DomainRecord | null | undefined {
  const entry = domainCache.get(domain);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    domainCache.delete(domain);
    return undefined;
  }
  return entry.value;
}

function cacheSet(domain: string, value: DomainRecord | null) {
  domainCache.set(domain, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function findDomain(domain: string): Promise<DomainRecord | null> {
  const cached = cacheGet(domain);
  if (cached !== undefined) return cached;
  const record = await prisma.pageDomain.findUnique({
    where: { domain },
    select: {
      page_id: true,
      domain: true,
      status: true,
      force_https: true,
      redirect_www: true,
    },
  });
  cacheSet(domain, record ?? null);
  return record ?? null;
}

function shouldSkipRewrite(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.startsWith("/_next") || lower.startsWith("/api")) return true;
  if (lower.startsWith("/favicon") || lower.startsWith("/robots") || lower.startsWith("/sitemap")) return true;
  if (lower.startsWith("/sw.js") || lower.startsWith("/manifest.json") || lower.startsWith("/offline.html")) return true;
  return false;
}

function baseHosts(): string[] {
  const base = normalizeDomain(getBaseUrl());
  if (!base) return [];
  return getAlternateDomains(base);
}

function resolveProto(req: IncomingMessage): string | null {
  const header = req.headers["x-forwarded-proto"];
  if (typeof header === "string") return header.split(",")[0]?.trim() || null;
  if (Array.isArray(header) && header.length > 0) return header[0]?.split(",")[0]?.trim() || null;
  return null;
}

export async function resolveDomainRoute(
  req: IncomingMessage,
  parsedUrl: ReturnType<typeof parse>,
): Promise<DomainDecision> {
  const hostHeader = extractHostFromHeader(
    (req.headers["x-forwarded-host"] as string | undefined) ?? (req.headers.host as string | undefined),
  );
  if (!hostHeader || isLocalHostname(hostHeader)) return null;

  const base = baseHosts();
  if (base.includes(hostHeader)) return null;

  const candidates = getAlternateDomains(hostHeader);
  let record: DomainRecord | null = null;
  for (const candidate of candidates) {
    record = await findDomain(candidate);
    if (record) break;
  }
  if (!record) return null;
  if (record.status !== "verified") return null;

  const pathname = parsedUrl.pathname ?? "/";
  if (shouldSkipRewrite(pathname)) return null;

  const proto = resolveProto(req);
  const canonical = record.domain;
  const alt = canonical.startsWith("www.") ? canonical.slice(4) : `www.${canonical}`;

  if (record.force_https && proto && proto !== "https") {
    const location = `https://${canonical}${req.url ?? "/"}`;
    return { type: "redirect", status: 308, location };
  }

  if (record.redirect_www && hostHeader !== canonical && (hostHeader === alt)) {
    const scheme = proto || "http";
    const location = `${scheme}://${canonical}${req.url ?? "/"}`;
    return { type: "redirect", status: 308, location };
  }

  return { type: "rewrite", url: `/p/${record.page_id}`, pageId: record.page_id };
}
