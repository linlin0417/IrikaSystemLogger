export type LogLevel =
  | "VERBOSE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "ASSERT"
  | "SECURITY"
  | "PERFORMANCE"
  | "SYSTEM";

export const levelPriority: Record<Exclude<LogLevel, "SYSTEM">, number> = {
  VERBOSE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  ASSERT: 60,
  SECURITY: 70,
  PERFORMANCE: 80
};

export interface LogRecord {
  ts: string;
  lvl: LogLevel;
  app: string;
  mod?: string;
  msg: string;
  pid: number;
  traceId?: string;
  ctx?: Record<string, unknown>;
}

export interface EofRecord {
  level: "SYSTEM";
  type: "EOF";
  reason: "rotate_size" | "rotate_date" | "manual";
  next_file: string;
  checksum: string;
  ts: number;
}

export interface BaseLoggerOptions {
  app: string;
  version: string;
  logDir?: string;
  level?: keyof typeof levelPriority;
  timezone?: string;
  pidMode?: "independent" | "ipc_master";
  maxFileSizeBytes?: number;
  maxTotalSizeBytes?: number;
  maxFiles?: number | null;
  maxFileAgeDays?: number;
  flushIntervalMs?: number;
  batchSizeBytes?: number;
  highWaterMark?: number;
}

export interface Transport {
  log(record: LogRecord): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}
