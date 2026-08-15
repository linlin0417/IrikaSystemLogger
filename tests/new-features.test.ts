import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createLogger } from "../src/index.ts";
import { LogRecord } from "../src/types.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "irika-logger-new-"));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("SUCCESS level works and triggers event hooks", async () => {
  const logger = createLogger({
    app: "test-app",
    version: "1.0",
    logDir: tmpDir
  });

  const logs: LogRecord[] = [];
  logger.on('log', (record) => {
    logs.push(record);
  });

  logger.success("this is a success msg");
  await logger.flush();
  await logger.close();

  assert.equal(logs.length, 1);
  assert.equal(logs[0].lvl, "SUCCESS");
  assert.equal(logs[0].msg, "this is a success msg");
});

test("Event hook can be removed with off()", async () => {
  const logger = createLogger({
    app: "test-app",
    version: "1.0",
    logDir: tmpDir
  });

  const logs: LogRecord[] = [];
  const listener = (record: LogRecord) => {
    logs.push(record);
  };
  
  logger.on('log', listener);
  logger.info("msg 1");
  logger.off('log', listener);
  logger.info("msg 2");
  
  await logger.close();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].msg, "msg 1");
});

test("Custom level mapping and formatter", async () => {
  const customFormatter = (record: LogRecord) => {
    return `[${record.lvl}] ${record.msg}`;
  };

  const consoleLogs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    consoleLogs.push(args.join(" "));
  };

  try {
    const logger = createLogger({
      app: "app",
      version: "1.0",
      logDir: tmpDir,
      consoleFormatter: customFormatter,
      customLevels: {
        "SUPER": 90
      },
      level: "SUPER" // Should only log SUPER and above (which is just SUPER here, wait, PERFORMANCE is 80)
    });

    // @ts-ignore - emit is private, but we can call it directly in JS or test by casting
    (logger as any).emit("SUPER", "super message");
    logger.info("info message"); // Should be ignored because minLevel is 90

    await logger.close();
    
    assert.equal(consoleLogs.length, 1);
    assert.equal(consoleLogs[0], "[SUPER] super message");
  } finally {
    console.log = origLog;
  }
});

test.skip("Worker Thread I/O offloading (skip in test runner)", async () => {
  const logger = createLogger({
    app: "worker-app",
    version: "1.0",
    logDir: tmpDir,
    useWorkerThread: true
  });

  logger.info("hello from worker");
  await logger.close(); // Close should await worker termination

  const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".log")).sort();
  assert.ok(files.length > 0, "worker should have created a log file");

  const logContent = fs.readFileSync(path.join(tmpDir, files[0]), "utf8");
  assert.ok(logContent.includes("hello from worker"));
});

test.skip("IPC Transport batching (skip in test runner)", async () => {
  let sentData: any = null;
  const originalSend = process.send;
  process.send = (msg: any, cb?: (err: Error | null) => void) => {
    sentData = msg;
    if (cb) cb(null);
    return true;
  };

  try {
    const logger = createLogger({
      app: "ipc-app",
      version: "1.0",
      logDir: tmpDir,
      pidMode: "ipc_worker",
      batchSizeBytes: 0, // Force batching length threshold to be 1
      flushIntervalMs: 0
    });

    logger.info("ipc message");
    await logger.flush();
    await logger.close();

    assert.ok(sentData);
    assert.equal(sentData.type, "IRIKA_LOGGER_BATCH");
    assert.equal(sentData.app, "ipc-app");
    assert.equal(sentData.records.length, 1);
    assert.equal(sentData.records[0].msg, "ipc message");
  } finally {
    process.send = originalSend;
  }
});
