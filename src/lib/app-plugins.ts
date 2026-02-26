import { prisma } from "@/lib/db";

export type PluginAction =
  | { id: string; label: string; type: "macro"; steps: PluginAction[] }
  | { id: string; label: string; type: "align" | "distribute" | "exportTokens" | "exportSelectionPng" | "exportSelectionSvg" | "toggleGrid" | "togglePixelGrid" | "toggleAudit" | "togglePerformance" }
  | { id: string; label: string; type: "openUrl"; url: string }
  | { id: string; label: string; type: string; params?: Record<string, unknown> };

export type PluginManifest = {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
  actions: PluginAction[];
};

const PLUGIN_SETTING_KEY = "app_plugins";
const MAX_PLUGIN_MANIFESTS = 50;
const MAX_PLUGIN_ACTIONS = 200;
const MAX_PLUGIN_STEPS = 50;
const MAX_PLUGIN_DEPTH = 4;

const ALLOWED_PLUGIN_ACTIONS = new Set([
  "macro",
  "align",
  "distribute",
  "exportTokens",
  "exportSelectionPng",
  "exportSelectionSvg",
  "toggleGrid",
  "togglePixelGrid",
  "toggleAudit",
  "togglePerformance",
  "openUrl",
]);

function isSafeExternalUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizePluginAction(raw: unknown, depth: number, budget: { count: number }): PluginAction | null {
  if (!raw || typeof raw !== "object") return null;
  if (depth > MAX_PLUGIN_DEPTH) return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.label !== "string" || typeof input.type !== "string") return null;
  if (!ALLOWED_PLUGIN_ACTIONS.has(input.type)) return null;
  if (budget.count >= MAX_PLUGIN_ACTIONS) return null;

  const action: PluginAction = {
    id: String(input.id),
    label: String(input.label),
    type: String(input.type),
  } as PluginAction;
  budget.count += 1;

  if (input.params && typeof input.params === "object" && !Array.isArray(input.params)) {
    (action as PluginAction).params = input.params as Record<string, unknown>;
  }

  if (action.type === "openUrl") {
    const safe = typeof input.url === "string" ? isSafeExternalUrl(input.url) : null;
    if (!safe) return null;
    (action as PluginAction & { url: string }).url = safe;
  }

  if (action.type === "macro") {
    const stepsRaw = Array.isArray(input.steps) ? input.steps : [];
    const steps: PluginAction[] = [];
    for (const step of stepsRaw) {
      const normalized = normalizePluginAction(step, depth + 1, budget);
      if (normalized) steps.push(normalized);
      if (steps.length >= MAX_PLUGIN_STEPS) break;
    }
    if (!steps.length) return null;
    (action as PluginAction & { steps: PluginAction[] }).steps = steps;
  }

  return action;
}

function normalizePluginManifest(raw: unknown): PluginManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.name !== "string") return null;

  const budget = { count: 0 };
  const actionsRaw = Array.isArray(input.actions) ? input.actions : [];
  const actions = actionsRaw
    .map((a) => normalizePluginAction(a, 0, budget))
    .filter((a): a is PluginAction => Boolean(a));

  if (!actions.length) return null;

  return {
    id: String(input.id),
    name: String(input.name),
    description: typeof input.description === "string" ? input.description : undefined,
    permissions: Array.isArray(input.permissions) ? input.permissions.filter((p) => typeof p === "string") : undefined,
    actions,
  };
}

function normalizePluginList(raw: unknown): PluginManifest[] {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list
    .slice(0, MAX_PLUGIN_MANIFESTS)
    .map((item) => normalizePluginManifest(item))
    .filter((item): item is PluginManifest => Boolean(item));
  const map = new Map<string, PluginManifest>();
  normalized.forEach((p) => map.set(p.id, p));
  return Array.from(map.values());
}

export async function getPlugins(pageId: string) {
  const row = await prisma.pageSetting.findUnique({
    where: { page_id_key: { page_id: pageId, key: PLUGIN_SETTING_KEY } },
    select: { value: true },
  });
  return normalizePluginList(row?.value ?? []);
}

export async function setPlugins(pageId: string, plugins: PluginManifest[]) {
  const normalized = normalizePluginList(plugins);
  await prisma.pageSetting.upsert({
    where: { page_id_key: { page_id: pageId, key: PLUGIN_SETTING_KEY } },
    update: { value: normalized as unknown as object },
    create: { page_id: pageId, key: PLUGIN_SETTING_KEY, value: normalized as unknown as object },
  });
  return normalized;
}

export async function addPlugins(pageId: string, plugins: PluginManifest[]) {
  const current = await getPlugins(pageId);
  const map = new Map(current.map((p) => [p.id, p]));
  for (const plugin of normalizePluginList(plugins)) {
    map.set(plugin.id, plugin);
  }
  return setPlugins(pageId, Array.from(map.values()));
}

export async function removePlugin(pageId: string, pluginId: string) {
  const current = await getPlugins(pageId);
  const next = current.filter((p) => p.id !== pluginId);
  return setPlugins(pageId, next);
}
