import fs from "fs";
import path from "path";
import { BaseLoggerOptions, levelPriority } from "../types";

const DEFAULTS = {
  logDir: "./logs",
  maxFileSizeBytes: 3 * 1024 * 1024,
  timezone: "UTC+8",
  maxTotalSizeBytes: 800 * 1024 * 1024,
  maxFiles: null as number | null,
  maxFileAgeDays: 7,
  flushIntervalMs: 1000,
  batchSizeBytes: 4096,
  highWaterMark: 64 * 1024,
  level: "INFO" as string,
  pidMode: "independent" as BaseLoggerOptions["pidMode"],
  consoleIncludeContext: true,
  useWorkerThread: false
};

export interface ResolvedLoggerOptions {
  app: string;
  version: string;
  logDir: string;
  level: string;
  timezone: string;
  pidMode: "independent" | "ipc_master" | "ipc_worker";
  consoleIncludeContext: boolean;
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
  maxFiles: number | null;
  maxFileAgeDays: number;
  flushIntervalMs: number;
  batchSizeBytes: number;
  highWaterMark: number;
  customLevels?: Record<string, number>;
  consoleColorMap?: Record<string, string>;
  consoleFormatter?: (record: import("../types").LogRecord) => string;
  useWorkerThread: boolean;
}

function normalizeTimeZone(tz: string): string {
  const trimmed = tz.trim();
  const match = trimmed.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return trimmed;
  // Etc/GMT sign is inverted: UTC+8 => Etc/GMT-8
  const sign = match[1] === "+" ? "-" : "+";
  const hh = match[2].padStart(2, "0");
  const mm = match[3] ? match[3].padStart(2, "0") : "00";
  if (mm !== "00") return trimmed; // fallback to original if minutes present
  return `Etc/GMT${sign}${parseInt(hh, 10)}`;
}

function readConfigFile(cwd: string): Partial<BaseLoggerOptions> {
  const filePath = path.join(cwd, ".IrikaSystemLoggerConfig");
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    return parsed as Partial<BaseLoggerOptions>;
  } catch (err) {
    // If config is broken, prefer to continue with defaults to avoid crashing the app.
    // A future enhancement could emit a warning event.
    return {};
  }
}

export function resolveOptions(user: BaseLoggerOptions): ResolvedLoggerOptions {
  const cwdConfig = readConfigFile(process.cwd());
  const merged: BaseLoggerOptions = {
    ...DEFAULTS,
    ...cwdConfig,
    ...user
  } as BaseLoggerOptions;

  const tz = normalizeTimeZone(merged.timezone ?? DEFAULTS.timezone);
  const candidateLevel = (merged.level ?? DEFAULTS.level).toUpperCase();
  const pidMode = (merged.pidMode ?? DEFAULTS.pidMode) as "independent" | "ipc_master" | "ipc_worker";
  return {
    app: merged.app,
    version: merged.version,
    logDir: merged.logDir ?? DEFAULTS.logDir,
    level: candidateLevel,
    timezone: tz,
    pidMode,
    consoleIncludeContext: merged.consoleIncludeContext ?? DEFAULTS.consoleIncludeContext,
    maxFileSizeBytes: merged.maxFileSizeBytes ?? DEFAULTS.maxFileSizeBytes,
    maxTotalSizeBytes: merged.maxTotalSizeBytes ?? DEFAULTS.maxTotalSizeBytes,
    maxFiles: merged.maxFiles ?? DEFAULTS.maxFiles,
    maxFileAgeDays: merged.maxFileAgeDays ?? DEFAULTS.maxFileAgeDays,
    flushIntervalMs: merged.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
    batchSizeBytes: merged.batchSizeBytes ?? DEFAULTS.batchSizeBytes,
    highWaterMark: merged.highWaterMark ?? DEFAULTS.highWaterMark,
    customLevels: merged.customLevels,
    consoleColorMap: merged.consoleColorMap,
    consoleFormatter: merged.consoleFormatter,
    useWorkerThread: merged.useWorkerThread ?? DEFAULTS.useWorkerThread
  };
}
