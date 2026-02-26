export type CronMatchResult = {
  ok: boolean;
  matches: boolean;
  error?: string;
};

type CronField = { set: Set<number>; isAll: boolean };

function addRange(set: Set<number>, start: number, end: number, step: number) {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  for (let i = s; i <= e; i += step) set.add(i);
}

function parseCronField(field: string, min: number, max: number): CronField | null {
  const parts = field.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const set = new Set<number>();
  let isAll = false;

  for (const part of parts) {
    if (part === "*") {
      addRange(set, min, max, 1);
      isAll = true;
      continue;
    }
    const [base, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step <= 0) return null;
    if (base === "*") {
      addRange(set, min, max, step);
      continue;
    }
    if (base.includes("-")) {
      const [a, b] = base.split("-").map((v) => Number(v));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      addRange(set, a, b, step);
      continue;
    }
    const value = Number(base);
    if (!Number.isFinite(value)) return null;
    if (step === 1) {
      set.add(value);
    } else {
      addRange(set, value, max, step);
    }
  }

  for (const v of set) {
    if (v < min || v > max) return null;
  }
  return { set, isAll };
}

function normalizeDow(value: number) {
  return value === 7 ? 0 : value;
}

export function matchesCron(cron: string, date: Date): CronMatchResult {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { ok: false, matches: false, error: "invalid_parts" };

  const [minField, hourField, domField, monField, dowField] = parts;
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = normalizeDow(date.getDay());

  const minuteSet = parseCronField(minField, 0, 59);
  const hourSet = parseCronField(hourField, 0, 23);
  const domSet = parseCronField(domField, 1, 31);
  const monSet = parseCronField(monField, 1, 12);
  const dowSet = parseCronField(dowField, 0, 7);

  if (!minuteSet || !hourSet || !domSet || !monSet || !dowSet) {
    return { ok: false, matches: false, error: "invalid_field" };
  }

  const minuteMatch = minuteSet.set.has(minute);
  const hourMatch = hourSet.set.has(hour);
  const domMatch = domSet.set.has(dom);
  const monMatch = monSet.set.has(month);
  const dowMatch = dowSet.set.has(dow) || (dow === 0 && dowSet.set.has(7));

  const domRestricted = !domSet.isAll;
  const dowRestricted = !dowSet.isAll;
  const dayMatch = domRestricted && dowRestricted
    ? domMatch || dowMatch
    : domRestricted
      ? domMatch
      : dowRestricted
        ? dowMatch
        : true;

  const matches = minuteMatch && hourMatch && monMatch && dayMatch;
  return { ok: true, matches };
}
