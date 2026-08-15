export type LogLevel =
  | "VERBOSE"
  | "DEBUG"
  | "INFO"
  | "SUCCESS"
  | "WARN"
  | "ERROR"
  | "ASSERT"
  | "SECURITY"
  | "PERFORMANCE"
  | "SYSTEM"
  | (string & {});

export const levelPriority: Record<string, number> = {
  VERBOSE: 10,
  DEBUG: 20,
  INFO: 30,
  SUCCESS: 35,
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
  level?: string;
  timezone?: string;
  pidMode?: "independent" | "ipc_master" | "ipc_worker";
  consoleIncludeContext?: boolean;
  maxFileSizeBytes?: number;
  maxTotalSizeBytes?: number;
  maxFiles?: number | null;
  maxFileAgeDays?: number;
  flushIntervalMs?: number;
  batchSizeBytes?: number;
  highWaterMark?: number;
  customLevels?: Record<string, number>;
  consoleColorMap?: Record<string, string>;
  consoleFormatter?: (record: LogRecord) => string;
  useWorkerThread?: boolean;
}

export interface Transport {
  log(record: LogRecord): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}
