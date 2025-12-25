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
