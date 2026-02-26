import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type SystemLogLevel = "info" | "warn" | "error" | "fatal";

type SystemLogEntry = {
  ts: string;
  level: SystemLogLevel;
  message: string;
  source?: string;
  meta?: unknown;
};

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "system.log");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function logSystemEvent(
  level: SystemLogLevel,
  message: string,
  meta?: unknown,
  source?: string,
  sync = false
) {
  try {
    ensureLogDir();
    const entry: SystemLogEntry = {
      ts: new Date().toISOString(),
      level,
      message,
      source,
      meta,
    };
    const line = `${JSON.stringify(entry)}\n`;
    if (sync) {
      appendFileSync(LOG_FILE, line, { encoding: "utf8" });
    } else {
      appendFileSync(LOG_FILE, line, { encoding: "utf8" });
    }
  } catch {
    // fail-safe: avoid throwing in logging path
  }
}

export function registerSystemLogHandlers() {
  process.on("uncaughtException", (err) => {
    logSystemEvent(
      "fatal",
      "uncaughtException",
      { message: err?.message ?? String(err), stack: err?.stack ?? null },
      "process",
      true
    );
  });
  process.on("unhandledRejection", (reason) => {
    const payload =
      reason instanceof Error
        ? { message: reason.message, stack: reason.stack ?? null }
        : { message: String(reason) };
    logSystemEvent("error", "unhandledRejection", payload, "process", true);
  });
}
