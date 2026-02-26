export function normalizeDomain(input?: string | null): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  let host = raw;
  if (raw.includes("://")) {
    try {
      host = new URL(raw).hostname;
    } catch {
      host = raw;
    }
  } else if (raw.includes("/")) {
    host = raw.split("/")[0] ?? raw;
  }

  host = host.trim().replace(/\.$/, "");
  if (!host) return null;
  host = host.replace(/:\d+$/, "");
  if (!host) return null;
  return host.toLowerCase();
}

export function isLocalHostname(host: string): boolean {
  const value = host.toLowerCase();
  if (value === "localhost" || value === "127.0.0.1" || value === "0.0.0.0" || value === "::1") return true;
  if (value === "host.docker.internal") return true;
  return false;
}

export function getAlternateDomains(domain: string): string[] {
  const normalized = normalizeDomain(domain);
  if (!normalized) return [];
  if (normalized.startsWith("www.")) {
    return [normalized, normalized.slice(4)];
  }
  return [normalized, `www.${normalized}`];
}

export function extractHostFromHeader(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const host = value.split(",")[0]?.trim() ?? "";
  return normalizeDomain(host);
}
