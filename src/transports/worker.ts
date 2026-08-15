import { Worker } from "worker_threads";
import path from "path";
import { LogRecord, Transport } from "../types";
import { ResolvedLoggerOptions } from "../utils/config";

import url from "url";

const currentFilename = typeof __filename !== "undefined" ? __filename : url.fileURLToPath((import.meta as any).url);
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

export class WorkerTransport implements Transport {
  private worker: Worker;
  
  constructor(opts: ResolvedLoggerOptions) {
    const isTs = currentFilename.endsWith(".ts");
    const ext = isTs ? ".ts" : (currentFilename.endsWith(".cjs") ? ".cjs" : ".js");
    let workerScript = "";
    if (currentDirname.replace(/\\/g, '/').endsWith("transports")) {
      workerScript = path.join(currentDirname, `worker-script${ext}`);
    } else {
      workerScript = path.join(currentDirname, "transports", `worker-script${ext}`);
    }
    
    this.worker = new Worker(workerScript, {
      workerData: { opts },
      execArgv: process.execArgv
    });
    
    this.worker.on("error", (err) => {
      console.error("Worker error:", err);
    });
  }

  log(record: LogRecord): void {
    this.worker.postMessage({ type: "log", record });
  }

  async flush(): Promise<void> {
    return new Promise((resolve) => {
      const id = Date.now() + Math.random().toString();
      const listener = (msg: any) => {
        if (msg.type === "flushed" && msg.id === id) {
          this.worker.off("message", listener);
          resolve();
        }
      };
      this.worker.on("message", listener);
      this.worker.postMessage({ type: "flush", id });
    });
  }

  async close(): Promise<void> {
    await this.flush();
    await this.worker.terminate();
  }
}
