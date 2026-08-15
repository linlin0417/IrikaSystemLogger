import { parentPort, workerData } from "worker_threads";
import { FileTransport } from "./file";

if (parentPort && workerData && workerData.opts) {
  const fileTransport = new FileTransport(workerData.opts);

  parentPort.on("message", async (msg) => {
    if (msg.type === "log") {
      fileTransport.log(msg.record);
    } else if (msg.type === "flush") {
      await fileTransport.flush();
      parentPort!.postMessage({ type: "flushed", id: msg.id });
    }
  });
}
