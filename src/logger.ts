import { resolveOptions, ResolvedLoggerOptions } from "./utils/config";
import { formatTimestamp } from "./utils/time";
import { ConsoleTransport } from "./transports/console";
import { FileTransport } from "./transports/file";
import { levelPriority, LogRecord, LogLevel, Transport } from "./types";

export interface LoggerInitOptions {
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

export class IrikaLogger {
  private readonly opts: ResolvedLoggerOptions;
  private readonly transports: Transport[];
  private readonly minLevelScore: number;
  private readonly moduleName?: string;

  constructor(init: LoggerInitOptions, shared?: { transports: Transport[]; opts: ResolvedLoggerOptions; moduleName?: string }) {
    if (shared) {
      this.opts = shared.opts;
      this.transports = shared.transports;
      this.moduleName = shared.moduleName;
    } else {
      this.opts = resolveOptions(init);
      this.transports = [new ConsoleTransport(this.opts.timezone), new FileTransport(this.opts)];
      this.moduleName = undefined;
      if (this.opts.pidMode === "ipc_master") {
        // 模式 B 尚未實作，先提示使用者改用 independent。
        // eslint-disable-next-line no-console
        console.warn("ipc_master 模式尚未實作，將改用 independent");
      }
    }
    this.minLevelScore = levelPriority[this.opts.level];
  }

  private emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    if (level !== "SYSTEM" && levelPriority[level] < this.minLevelScore) return;
    const now = new Date();
    const { ts } = formatTimestamp(now, this.opts.timezone);
    const record: LogRecord = {
      ts,
      lvl: level,
      app: this.opts.app,
      mod: this.moduleName,
      msg,
      pid: process.pid,
      traceId,
      ctx
    };
    for (const t of this.transports) {
      t.log(record);
    }
  }

  verbose(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("VERBOSE", msg, ctx, traceId);
  }

  debug(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("DEBUG", msg, ctx, traceId);
  }

  info(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("INFO", msg, ctx, traceId);
  }

  warn(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("WARN", msg, ctx, traceId);
  }

  error(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("ERROR", msg, ctx, traceId);
  }

  assert(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("ASSERT", msg, ctx, traceId);
  }

  security(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("SECURITY", msg, ctx, traceId);
  }

  performance(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("PERFORMANCE", msg, ctx, traceId);
  }

  child(moduleName: string): IrikaLogger {
    return new IrikaLogger({ app: this.opts.app, version: this.opts.version }, {
      transports: this.transports,
      opts: this.opts,
      moduleName
    });
  }

  async flush(): Promise<void> {
    for (const t of this.transports) {
      await t.flush();
    }
  }

  async close(): Promise<void> {
    for (const t of this.transports) {
      await t.close();
    }
  }
}

export function createLogger(options: LoggerInitOptions): IrikaLogger {
  return new IrikaLogger(options);
}
