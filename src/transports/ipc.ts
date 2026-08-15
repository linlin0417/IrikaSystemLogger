import { LogRecord, Transport } from "../types";
import { ResolvedLoggerOptions } from "../utils/config";

export class IpcTransport implements Transport {
  private buffer: LogRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private opts: ResolvedLoggerOptions;

  constructor(opts: ResolvedLoggerOptions) {
    this.opts = opts;
    if (this.opts.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flushBuffer();
      }, this.opts.flushIntervalMs);
      if (this.flushTimer.unref) this.flushTimer.unref();
    }
    
    // Attempt to flush on exit
    process.once("exit", () => {
      this.flushBuffer();
    });
  }

  log(record: LogRecord): void {
    if (!process.send) return; // not an IPC child
    
    this.buffer.push(record);
    
    // simplistic batch size trigger based on array length to avoid expensive JSON.stringify per record
    // Assuming each record is roughly 256 bytes, batchSizeBytes / 256 is the threshold
    const maxRecords = Math.max(1, Math.floor(this.opts.batchSizeBytes / 256));
    
    if (this.buffer.length >= maxRecords) {
      this.flushBuffer();
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0 || !process.send) return;
    const payload = this.buffer;
    this.buffer = [];
    
    // We send a batch object with a specific type so the master process can identify it
    process.send({
      type: "IRIKA_LOGGER_BATCH",
      app: this.opts.app,
      records: payload
    }, (err) => {
      if (err) {
        // failed to send over IPC, silently drop or handle?
        // for now, ignore to prevent crashes
      }
    });
  }

  async flush(): Promise<void> {
    this.flushBuffer();
    return Promise.resolve();
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushBuffer();
    return Promise.resolve();
  }
}
