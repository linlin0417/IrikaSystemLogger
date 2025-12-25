import fs from "fs";
import path from "path";
import crypto from "crypto";
import { LogRecord, Transport, EofRecord, levelPriority } from "../types";
import { formatTimestamp } from "../utils/time";
import { cleanupLogs, ensureDir, generateLogFileName } from "../utils/files";
import { ResolvedLoggerOptions } from "../utils/config";

const DIRECT_LEVELS = new Set<LogRecord["lvl"]>(["ERROR", "ASSERT", "SECURITY"]);

export class FileTransport implements Transport {
  private opts: ResolvedLoggerOptions;
  private logDir: string;
  private stream: fs.WriteStream | null = null;
  private hash = crypto.createHash("sha256");
  private buffer: string[] = [];
  private bufferBytes = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private queue: Promise<void> = Promise.resolve();
  private currentDateKey = "";
  private sequence = 0;
  private currentFileName = "";
  private currentFilePath = "";
  private currentSize = 0;
  private exitHandler: (() => void) | null = null;

  constructor(opts: ResolvedLoggerOptions) {
    this.opts = opts;
    this.logDir = path.resolve(process.cwd(), opts.logDir);
    ensureDir(this.logDir);
    this.initializeFile();
    cleanupLogs({
      logDir: this.logDir,
      maxTotalSizeBytes: this.opts.maxTotalSizeBytes,
      maxFiles: this.opts.maxFiles,
      maxFileAgeDays: this.opts.maxFileAgeDays
    }).catch(() => {
      // ignore cleanup errors during boot
    });
    this.startFlushTimer();
    this.registerExitHook();
  }

  log(record: LogRecord): void {
    this.enqueue(async () => {
      const line = JSON.stringify(record) + "\n";
      const lineBytes = Buffer.byteLength(line);
      const now = new Date(record.ts);
      const { dateKey } = formatTimestamp(now, this.opts.timezone);

      if (this.shouldRotate(dateKey, lineBytes)) {
        const reason = dateKey !== this.currentDateKey ? "rotate_date" : "rotate_size";
        await this.rotate(reason);
      }

      if (DIRECT_LEVELS.has(record.lvl)) {
        await this.writeLine(line, lineBytes, true);
      } else {
        this.buffer.push(line);
        this.bufferBytes += lineBytes;
        if (this.bufferBytes >= this.opts.batchSizeBytes) {
          await this.flushBuffer();
        }
      }
    });
  }

  async flush(): Promise<void> {
    await this.enqueue(() => this.flushBuffer());
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.enqueue(async () => {
      await this.flushBuffer();
      await this.endStream();
    });
    await this.queue;
  }

  private enqueue(task: () => Promise<void> | void): Promise<void> {
    this.queue = this.queue.then(async () => {
      await task();
    }).catch(() => {
      // swallow transport errors to avoid crashing caller; can add emitter later
    });
    return this.queue;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.enqueue(() => this.flushBuffer());
    }, this.opts.flushIntervalMs);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  private initializeFile(): void {
    const now = Date.now();
    const { dateKey } = formatTimestamp(new Date(now), this.opts.timezone);
    this.currentDateKey = dateKey;
    this.sequence = 0;
    const fileName = generateLogFileName({
      app: this.opts.app,
      version: this.opts.version,
      dateKey,
      timestamp: now,
      pid: process.pid,
      sequence: this.sequence
    });
    this.openStream(fileName);
  }

  private openStream(fileName: string): void {
    this.currentFileName = fileName;
    this.currentFilePath = path.join(this.logDir, fileName);
    this.currentSize = 0;
    this.hash = crypto.createHash("sha256");
    this.stream = fs.createWriteStream(this.currentFilePath, {
      flags: "a",
      highWaterMark: this.opts.highWaterMark
    });
    this.stream.on("error", () => {
      // swallow; future improvement: emit
    });
  }

  private registerExitHook(): void {
    this.exitHandler = () => {
      if (this.buffer.length === 0) return;
      const content = this.buffer.join("");
      this.buffer = [];
      this.bufferBytes = 0;
      const fd = this.stream ? (this.stream as unknown as { fd?: number }).fd : undefined;
      if (typeof fd === "number") {
        try {
          fs.writeSync(fd, content, undefined, "utf8");
        } catch (err) {
          // ignore sync write failures on exit
        }
      }
    };
    process.once("exit", this.exitHandler);
  }

  private async writeLine(line: string, bytes: number, updateHash: boolean): Promise<void> {
    if (!this.stream) return;
    if (updateHash) {
      this.hash.update(line, "utf8");
    }
    this.currentSize += bytes;
    await this.writeToStream(line);
  }

  private writeToStream(chunk: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stream) return resolve();
      const ok = this.stream.write(chunk, (err) => {
        if (err) reject(err);
        else resolve();
      });
      if (!ok) {
        this.stream.once("drain", () => {
          // noop: resolution happens via write callback
        });
      }
    });
  }

  private shouldRotate(dateKey: string, incomingBytes: number): boolean {
    if (!this.stream) return false;
    if (dateKey !== this.currentDateKey) return true;
    if (this.currentSize + this.bufferBytes + incomingBytes > this.opts.maxFileSizeBytes) return true;
    return false;
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) return;
    const content = this.buffer.join("");
    this.buffer = [];
    const bytes = this.bufferBytes;
    this.bufferBytes = 0;
    await this.writeLine(content, bytes, true);
  }

  private async endStream(): Promise<void> {
    if (!this.stream) return;
    await new Promise<void>((resolve) => {
      this.stream?.end(() => resolve());
    });
    this.stream = null;
  }

  private async rotate(reason: EofRecord["reason"]): Promise<void> {
    await this.flushBuffer();
    const checksum = this.hash.digest("hex");
    const nextTimestamp = Date.now();
    const { dateKey } = formatTimestamp(new Date(nextTimestamp), this.opts.timezone);
    const nextSequence = reason === "rotate_date" ? 0 : this.sequence + 1;
    const nextFileName = generateLogFileName({
      app: this.opts.app,
      version: this.opts.version,
      dateKey,
      timestamp: nextTimestamp,
      pid: process.pid,
      sequence: nextSequence
    });

    const eof: EofRecord = {
      level: "SYSTEM",
      type: "EOF",
      reason,
      next_file: nextFileName,
      checksum,
      ts: Date.now()
    };
    const eofLine = JSON.stringify(eof) + "\n";

    await this.writeToStream(eofLine);
    await this.endStream();

    this.sequence = nextSequence;
    this.currentDateKey = dateKey;
    this.openStream(nextFileName);

    await cleanupLogs({
      logDir: this.logDir,
      maxTotalSizeBytes: this.opts.maxTotalSizeBytes,
      maxFiles: this.opts.maxFiles,
      maxFileAgeDays: this.opts.maxFileAgeDays
    });
  }
}
