import { resolveOptions, ResolvedLoggerOptions } from "./utils/config";
import { formatTimestamp } from "./utils/time";
import { ConsoleTransport } from "./transports/console";
import { FileTransport } from "./transports/file";
import { WorkerTransport } from "./transports/worker";
import { IpcTransport } from "./transports/ipc";
import { levelPriority, LogRecord, LogLevel, Transport } from "./types";

export interface LoggerInitOptions {
  app: string;
  version: string;
  logDir?: string;
  level?: keyof typeof levelPriority;
  timezone?: string;
  pidMode?: "independent" | "ipc_master";
  consoleIncludeContext?: boolean;
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
  private readonly combinedPriority: Record<string, number>;
  private listeners: Set<(record: LogRecord) => void> = new Set();

  constructor(init: LoggerInitOptions, shared?: { transports: Transport[]; opts: ResolvedLoggerOptions; moduleName?: string; combinedPriority?: Record<string, number>; listeners?: Set<(record: LogRecord) => void> }) {
    if (shared) {
      this.opts = shared.opts;
      this.transports = shared.transports;
      this.moduleName = shared.moduleName;
      this.combinedPriority = shared.combinedPriority ?? { ...levelPriority, ...this.opts.customLevels };
      this.listeners = shared.listeners ?? new Set();
    } else {
      this.opts = resolveOptions(init);
      this.combinedPriority = { ...levelPriority, ...this.opts.customLevels };
      this.transports = [new ConsoleTransport(this.opts)];
      
      if (this.opts.useWorkerThread) {
        this.transports.push(new WorkerTransport(this.opts));
      } else {
        this.transports.push(new FileTransport(this.opts));
      }
      
      if (this.opts.pidMode === "ipc_master") {
        // eslint-disable-next-line no-console
        console.warn("ipc_master 模式尚未實作，將改用 independent");
      } else if (this.opts.pidMode === "ipc_worker") {
        this.transports.push(new IpcTransport(this.opts));
      }
      
      this.moduleName = undefined;
    }
    this.minLevelScore = this.combinedPriority[this.opts.level] ?? this.combinedPriority["INFO"];
  }

  on(event: 'log', listener: (record: LogRecord) => void) {
    this.listeners.add(listener);
  }

  off(event: 'log', listener: (record: LogRecord) => void) {
    this.listeners.delete(listener);
  }

  private emit(level: string, msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    const priority = this.combinedPriority[level] ?? 10;
    if (level !== "SYSTEM" && priority < this.minLevelScore) return;
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
    if (this.listeners.size > 0) {
      for (const listener of this.listeners) {
        listener(record);
      }
    }
  }

  verbose(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("VERBOSE", msg, ctx, traceId);
  }

  success(msg: string, ctx?: Record<string, unknown>, traceId?: string): void {
    this.emit("SUCCESS", msg, ctx, traceId);
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
      moduleName,
      combinedPriority: this.combinedPriority,
      listeners: this.listeners
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
