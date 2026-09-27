import { Worker } from "worker_threads";
import path from "path";
import { LogRecord, Transport } from "../types";
import { ResolvedLoggerOptions } from "../utils/config";

import url from "url";

const currentFilename = typeof __filename !== "undefined" ? __filename : url.fileURLToPath((import.meta as any).url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

export class WorkerTransport implements Transport {
  private worker?: Worker;
  private workerScript: string;
  private workerData: any;
  
  constructor(opts: ResolvedLoggerOptions) {
    const isTs = currentFilename.endsWith(".ts");
    const ext = isTs ? ".ts" : (currentFilename.endsWith(".cjs") ? ".cjs" : ".js");
    let workerScript = "";
    if (currentDirname.replace(/\\/g, '/').endsWith("transports")) {
      workerScript = path.join(currentDirname, `worker-script${ext}`);
    } else {
      workerScript = path.join(currentDirname, "transports", `worker-script${ext}`);
    }
    
    this.workerScript = workerScript;
    this.workerData = { opts };
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(this.workerScript, {
        workerData: this.workerData,
        execArgv: process.execArgv
      });
      this.worker.on("error", (err) => {
        console.error("Worker error:", err);
      });
    }
    return this.worker;
  }

  log(record: LogRecord): void {
    this.getWorker().postMessage({ type: "log", record });
  }

  async flush(): Promise<void> {
    if (!this.worker) return;
    return new Promise((resolve) => {
      const id = Date.now() + Math.random().toString();
      const listener = (msg: any) => {
        if (msg.type === "flushed" && msg.id === id) {
          this.worker!.off("message", listener);
          resolve();
        }
      };
      this.worker!.on("message", listener);
      this.worker!.postMessage({ type: "flush", id });
    });
  }

  flushSync(): void {
    // Worker does not support synchronous flushing easily.
    // If autoCatchExceptions triggers, the FileTransport in the worker might not sync flush.
    // However, the worker transport might just drop messages. This is a known limitation.
  }

  async close(): Promise<void> {
    if (!this.worker) return;
    await this.flush();
    await this.worker.terminate();
  }
}
