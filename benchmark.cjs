const { createLogger } = require("./dist/index.cjs");
const path = require("path");
const fs = require("fs");

async function runBenchmark() {
  console.log("=== IrikaSystemLogger Benchmark ===");
  const logDir = path.join(__dirname, "benchmark_logs");
  if (fs.existsSync(logDir)) {
    fs.rmSync(logDir, { recursive: true, force: true });
  }

  // 1. 初始化效能測試 (Worker)
  const startInit = performance.now();
  const logger = createLogger({
    app: "benchmark",
    version: "1.0.0",
    logDir,
    useWorkerThread: true
  });
  const endInit = performance.now();
  console.log(`[Worker Initialization] Time: ${(endInit - startInit).toFixed(2)} ms`);

  // Disable console output for throughput test
  const originalStdoutWrite = process.stdout.write;
  process.stdout.write = () => true;

  // 2. 高吞吐量日誌測試
  const ITERATIONS = 100000;
  const complexObj = {
    user: { id: 123, name: "Test User", roles: ["admin", "user"] },
    request: { method: "POST", url: "/api/data", headers: { "content-type": "application/json" } },
    metrics: { cpu: 45.2, memory: 1024, uptime: 3600 }
  };

  console.log(`\n[Throughput] Writing ${ITERATIONS} logs (with context)...`);
  const startLog = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    logger.info("Benchmark log message", complexObj);
  }
  const endLog = performance.now();
  process.stdout.write = originalStdoutWrite;
  const logTimeMs = endLog - startLog;
  console.log(`\n[Throughput] Enqueue Time: ${logTimeMs.toFixed(2)} ms`);
  console.log(`[Throughput] Rate: ${Math.floor(ITERATIONS / (logTimeMs / 1000))} logs/sec`);

  // Disable stdout again for flush
  process.stdout.write = () => true;

  // 等待寫入完成
  const startFlush = performance.now();
  await logger.flush();
  await logger.close();
  const endFlush = performance.now();
  process.stdout.write = originalStdoutWrite;
  
  console.log(`[Throughput] Flush Time: ${(endFlush - startFlush).toFixed(2)} ms`);
  console.log(`[Throughput] Total Time: ${(endFlush - startLog).toFixed(2)} ms`);
  console.log(`[Throughput] Actual Write Rate: ${Math.floor(ITERATIONS / ((endFlush - startLog) / 1000))} logs/sec`);
  
  console.log("\nBenchmark complete.");
}

runBenchmark().catch(console.error);
