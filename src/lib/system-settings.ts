import { prisma } from "@/lib/db";

type NumberOptions = {
  min?: number;
  max?: number;
  integer?: boolean;
};

function unwrapSettingValue(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "value" in (raw as Record<string, unknown>)) {
    return (raw as Record<string, unknown>).value;
  }
  return raw;
}

function clampNumber(value: number, options?: NumberOptions): number {
  let next = value;
  if (options?.integer) next = Math.round(next);
  if (typeof options?.min === "number") next = Math.max(options.min, next);
  if (typeof options?.max === "number") next = Math.min(options.max, next);
  return next;
}

export async function getSystemNumber(key: string, fallback: number, options?: NumberOptions): Promise<number> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    const raw = unwrapSettingValue(row?.value);
    if (typeof raw === "number" && Number.isFinite(raw)) return clampNumber(raw, options);
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return clampNumber(parsed, options);
    }
  } catch {
    // ignore
  }
  return clampNumber(fallback, options);
}

export async function getSystemBoolean(key: string, fallback: boolean): Promise<boolean> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    const raw = unwrapSettingValue(row?.value);
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
      const lowered = raw.trim().toLowerCase();
      if (["true", "1", "yes", "y", "on"].includes(lowered)) return true;
      if (["false", "0", "no", "n", "off"].includes(lowered)) return false;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export async function getSystemString(key: string, fallback: string): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    const raw = unwrapSettingValue(row?.value);
    if (typeof raw === "string") return raw;
  } catch {
    // ignore
  }
  return fallback;
}
