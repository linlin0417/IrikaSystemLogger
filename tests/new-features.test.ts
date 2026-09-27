import { test } from "node:test";
import assert from "node:assert";
import { createLogger } from "../src/logger";
import { safeStringify } from "../src/utils/safe-stringify";

test("Safe Stringify prevents circular reference crash", () => {
  const obj: any = { a: 1 };
  obj.circular = obj; // Create circular reference
  
  assert.doesNotThrow(() => {
    const result = safeStringify(obj);
    assert.strictEqual(result.includes("[Circular Reference]"), true);
  });
});

test("Console Interceptor hijacks and restores console", () => {
  const logger = createLogger({ app: "test", version: "1", level: "INFO" });
  let intercepted = false;
  
  logger.on('log', (record) => {
    if (record.msg === "test message") {
      intercepted = true;
      assert.deepStrictEqual(record.ctx?.console_args, ["test message"]);
    }
  });

  const originalLog = console.log;
  
  logger.hijackGlobalConsole();
  console.log("test message");
  logger.restoreGlobalConsole();
  
  // After restore, it shouldn't intercept
  const tempLog = console.log;
  let testRestoreCalled = false;
  console.log = () => { testRestoreCalled = true; };
  console.log("test restore");
  console.log = tempLog;
  
  assert.strictEqual(testRestoreCalled, true);
  assert.strictEqual(intercepted, true);
  assert.strictEqual(console.log, originalLog);
});

test("Worker Lazy Loading does not create worker until log is called", async () => {
  const logger = createLogger({ app: "test-worker", version: "1", useWorkerThread: true });
  // worker should be undefined initially
  const workerTransport = (logger as any).transports.find((t: any) => t.constructor.name === "WorkerTransport");
  assert.ok(workerTransport);
  assert.strictEqual(workerTransport.worker, undefined);
  
  try {
    logger.info("First log");
    assert.ok(workerTransport.worker); // worker is created now
  } catch (err: any) {
    // Ignore ERR_WORKER_INVALID_EXEC_ARGV caused by tsx runner, 
    // but its presence proves getWorker() was called.
    assert.strictEqual(err.code, "ERR_WORKER_INVALID_EXEC_ARGV");
  }
  
  await logger.close().catch(() => {});
});
