import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { resolveMobileHostConfig } from "@/lib/mobile-host";
import { buildZip } from "@/lib/zip";

type MobilePackageType = "capacitor" | "react-native";

const PACKAGE_ROOTS: Record<MobilePackageType, { dir: string; name: string }> = {
  capacitor: { dir: "mobile/capacitor-host", name: "null-capacitor-host" },
  "react-native": { dir: "mobile/react-native-host", name: "null-react-native-host" },
};

type BuildResult = {
  zip: Buffer;
  name: string;
  resolved: ReturnType<typeof resolveMobileHostConfig>;
};

function collectFiles(dir: string, baseDir: string, rootName: string) {
  const entries: { path: string; data: Buffer; mtime?: Date }[] = [];
  const ignore = new Set(["node_modules", ".git", "dist", "build", ".next"]);

  const walk = (current: string) => {
    for (const item of readdirSync(current)) {
      if (ignore.has(item)) continue;
      const full = join(current, item);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = relative(baseDir, full).replace(/\\/g, "/");
      const path = `${rootName}/${rel}`;
      entries.push({ path, data: readFileSync(full), mtime: stat.mtime });
    }
  };

  walk(dir);
  return entries;
}

export function buildMobileHostPackage(type: MobilePackageType, settings: unknown): BuildResult {
  const config = PACKAGE_ROOTS[type];
  const resolved = resolveMobileHostConfig(settings);
  const rootDir = join(process.cwd(), config.dir);
  const entries = collectFiles(rootDir, rootDir, config.name);

  const hostConfig = {
    appName: resolved.appName,
    appId: resolved.appId,
    serverUrl: resolved.serverUrl,
    allowCleartext: resolved.allowCleartext,
    statusBarStyle: resolved.statusBarStyle,
    statusBarColor: resolved.statusBarColor,
    notes: resolved.notes,
  };
  const hostConfigJson = Buffer.from(JSON.stringify(hostConfig, null, 2), "utf8");

  const infoJson = Buffer.from(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        type,
        appName: resolved.appName,
        appId: resolved.appId,
        serverUrl: resolved.serverUrl,
      },
      null,
      2
    ),
    "utf8"
  );

  const finalEntries = entries.map((entry) => {
    if (entry.path.endsWith("/host.config.json")) {
      return { ...entry, data: hostConfigJson };
    }
    return entry;
  });

  finalEntries.push({ path: `${config.name}/NULL_HOST_INFO.json`, data: infoJson });

  return { zip: buildZip(finalEntries), name: config.name, resolved };
}
