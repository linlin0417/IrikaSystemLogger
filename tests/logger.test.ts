import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createLogger, createLogStream } from "../src/index.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "irika-logger-"));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("file rotation writes EOF and next file name", async () => {
  const logger = createLogger({
    app: "app",
    version: "1.0.0",
    logDir: tmpDir,
    maxFileSizeBytes: 200,
    batchSizeBytes: 1,
    flushIntervalMs: 10
  });

  logger.info("a".repeat(150));
  logger.info("b".repeat(150));
  await logger.flush();
  await logger.close();

  const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".log")).sort();
  assert.ok(files.length >= 2, "should rotate and create at least two files");

  const firstFile = path.join(tmpDir, files[0]);
  const lines = fs.readFileSync(firstFile, "utf8").trim().split(/\r?\n/);
  const eofLine = lines.at(-1) ?? "";
  const eof = JSON.parse(eofLine);
  assert.equal(eof.type, "EOF");
  assert.ok(eof.checksum);
  assert.ok(eof.next_file);
});

test("createLogStream filters by level and traceId", async () => {
  const file = path.join(tmpDir, "sample.log");
  const lines = [
    { ts: "2025-12-25T00:00:00.000+08:00", lvl: "INFO", app: "app", msg: "ok", pid: 1 },
    { ts: "2025-12-25T00:00:01.000+08:00", lvl: "WARN", app: "app", msg: "warn", pid: 1, traceId: "t1" },
    { ts: "2025-12-25T00:00:02.000+08:00", lvl: "ERROR", app: "app", msg: "err", pid: 1, traceId: "t2" },
    { level: "SYSTEM", type: "EOF", reason: "rotate_size", next_file: "n", checksum: "x", ts: Date.now() }
  ];
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));

  const collected: unknown[] = [];
  for await (const rec of createLogStream(file, { minLevel: "WARN", traceId: "t2" })) {
    collected.push(rec);
  }
  assert.equal(collected.length, 1);
  const rec = collected[0] as any;
  assert.equal(rec.msg, "err");
  assert.equal(rec.traceId, "t2");
});

test("consoleIncludeContext false hides ctx in console output (option)", async () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };

  try {
    const logger = createLogger({
      app: "app",
      version: "1.0.0",
      logDir: tmpDir,
      consoleIncludeContext: false
    });

    logger.info("msg", { foo: "bar" });
    await logger.flush();
    await logger.close();

    assert.ok(logs.some((l) => l.includes("msg")), "should output message");
    assert.ok(logs.every((l) => !l.includes("\"foo\":\"bar\"")), "ctx should be omitted");
  } finally {
    console.log = origLog;
  }
});

test("consoleIncludeContext can be disabled via config file", async () => {
  const logs: string[] = [];
  const origLog = console.log;
  const origCwd = process.cwd();
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };

  try {
    const configDir = tmpDir;
    process.chdir(configDir);
    const logDir = path.join(configDir, "logs");
    fs.mkdirSync(logDir, { recursive: true });

    const cfg = {
      consoleIncludeContext: false,
      logDir
    };
    fs.writeFileSync(path.join(configDir, ".IrikaSystemLoggerConfig"), JSON.stringify(cfg));

    const logger = createLogger({ app: "app", version: "1.0.0" });
    logger.info("cfg-msg", { foo: "bar" });
    await logger.flush();
    await logger.close();

    assert.ok(logs.some((l) => l.includes("cfg-msg")), "should output message");
    assert.ok(logs.every((l) => !l.includes("\"foo\":\"bar\"")), "ctx should be omitted by config");
  } finally {
    process.chdir(origCwd);
    console.log = origLog;
  }
});
