import { getBaseUrl } from "@/lib/url";

export type MobileHostSettings = {
  appName?: string;
  appId?: string;
  serverUrl?: string;
  allowCleartext?: boolean;
  statusBarStyle?: "default" | "light" | "dark";
  statusBarColor?: string;
  notes?: string;
};

type ResolvedMobileHostConfig = {
  appName: string;
  appId: string;
  serverUrl: string;
  allowCleartext: boolean;
  statusBarStyle: "default" | "light" | "dark";
  statusBarColor?: string;
  notes?: string;
};

function cleanString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

export function normalizeMobileSettings(input: unknown): MobileHostSettings {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  const style = obj.statusBarStyle;
  return {
    appName: cleanString(obj.appName, 80),
    appId: cleanString(obj.appId, 120),
    serverUrl: cleanString(obj.serverUrl, 500),
    allowCleartext: typeof obj.allowCleartext === "boolean" ? obj.allowCleartext : undefined,
    statusBarStyle: style === "light" || style === "dark" || style === "default" ? style : undefined,
    statusBarColor: cleanString(obj.statusBarColor, 20),
    notes: cleanString(obj.notes, 500),
  };
}

export function resolveMobileHostConfig(input: unknown): ResolvedMobileHostConfig {
  const settings = normalizeMobileSettings(input);
  const serverUrl = settings.serverUrl ?? getBaseUrl();
  const allowCleartext =
    typeof settings.allowCleartext === "boolean" ? settings.allowCleartext : serverUrl.startsWith("http://");
  return {
    appName: settings.appName ?? "NULL Host",
    appId: settings.appId ?? "com.null.host",
    serverUrl,
    allowCleartext,
    statusBarStyle: settings.statusBarStyle ?? "default",
    statusBarColor: settings.statusBarColor,
    notes: settings.notes,
  };
}

export function buildCapacitorHostConfig(input: unknown) {
  const cfg = resolveMobileHostConfig(input);
  const config: Record<string, unknown> = {
    appId: cfg.appId,
    appName: cfg.appName,
    webDir: "www",
    server: {
      url: cfg.serverUrl,
      cleartext: cfg.allowCleartext,
    },
  };
  if (cfg.statusBarStyle !== "default" || cfg.statusBarColor) {
    config.plugins = {
      StatusBar: {
        style: cfg.statusBarStyle,
        backgroundColor: cfg.statusBarColor || undefined,
      },
    };
  }
  return config;
}

export function buildReactNativeHostConfig(input: unknown) {
  const cfg = resolveMobileHostConfig(input);
  return {
    appId: cfg.appId,
    appName: cfg.appName,
    serverUrl: cfg.serverUrl,
  };
}
