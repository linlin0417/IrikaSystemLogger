# IrikaSystemLogger API 指引 (HOWTOUSE)

> **Context7 / AI Agent 閱讀指南**
> 本文件旨在提供 `IrikaSystemLogger` 的完整 API 參考。這是一個高度輕量化、無依賴且支援高效 I/O 卸載的 Node.js (18+) 結構化日誌記錄器。

## 1. 初始化與基本配置

### 匯入與建立 Logger
```typescript
import { createLogger } from "irika-system-logger";

const logger = createLogger({
  app: "my-app",         // 必填：應用程式名稱
  version: "1.0.0",      // 必填：版本號
  logDir: "./logs",      // 選填：日誌存放目錄，預設為 "./logs"
  level: "INFO",         // 選填：最低輸出層級，預設為 "INFO"
});

logger.info("系統已啟動", { port: 3000 });
```

### 完整配置選項 (LoggerInitOptions)
初始化時可傳入的 `opts` 包含以下屬性：

| 屬性 | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `app` | `string` | **(必填)** | 應用程式名稱。 |
| `version` | `string` | **(必填)** | 應用程式版本。 |
| `logDir` | `string` | `"./logs"` | 日誌儲存目錄。 |
| `level` | `string` | `"INFO"` | 最低記錄層級，低於此層級的日誌將被忽略。 |
| `timezone` | `string` | `"Asia/Taipei"` | 日誌時間時區 (需符合 Intl 格式)。 |
| `pidMode` | `string` | `"independent"` | 執行模式，可選 `independent`, `ipc_worker` 等。 |
| `consoleIncludeContext`| `boolean` | `true` | 是否在終端機輸出 `ctx` (Context) 物件內容。 |
| `maxFileSizeBytes` | `number` | `10 * 1024 * 1024` | 單一日誌檔最大大小 (Bytes)，預設 10MB。 |
| `maxTotalSizeBytes`| `number` | `2 * 1024 ** 3` | 日誌目錄總大小限制 (Bytes)，預設 2GB。 |
| `maxFiles` | `number \| null`| `null` | 保留的最多的日誌檔案數量 (`null` 表示不限制)。 |
| `maxFileAgeDays` | `number` | `30` | 檔案保留天數，超過將被清理。 |
| `flushIntervalMs` | `number` | `2000` | 日誌批次寫入的定時器間隔 (毫秒)。 |
| `batchSizeBytes` | `number` | `1024 * 1024` | 記憶體中日誌緩衝區達到此大小即強制寫入 (預設 1MB)。 |
| `useWorkerThread` | `boolean` | `false` | 是否開啟 Worker Thread 將 I/O (檔案寫入) 卸載到背景。 |
| `customLevels` | `Record<string, number>` | `{}` | 擴充或覆寫自定義日誌層級的優先度。 |
| `consoleColorMap` | `Record<string, string>` | `(內建色彩)` | 覆寫終端機顯示的 ANSI 顏色。 |
| `consoleFormatter` | `Function` | `undefined` | 自訂終端機顯示的字串格式化函式。 |

---

## 2. 日誌紀錄方法 (Logging Methods)

Logger 實例提供以下快捷方法，方法簽章皆為 `(msg: string, ctx?: Record<string, unknown>, traceId?: string) => void`：

- `logger.verbose(msg, ctx, traceId)`
- `logger.debug(msg, ctx, traceId)`
- `logger.info(msg, ctx, traceId)`
- `logger.success(msg, ctx, traceId)`
- `logger.warn(msg, ctx, traceId)`
- `logger.error(msg, ctx, traceId)`
- `logger.assert(msg, ctx, traceId)`
- `logger.security(msg, ctx, traceId)`
- `logger.performance(msg, ctx, traceId)`

**內建層級優先度** (數值越高越嚴重)：
VERBOSE(10) < DEBUG(20) < INFO(30) < SUCCESS(35) < WARN(40) < ERROR(50) < ASSERT(60) < SECURITY(70) < PERFORMANCE(80)

---

## 3. 進階功能 (Advanced Features)

### A. 子模組 Logger (Child Logger)
針對不同模組，您可以產生附帶 `mod` (模組名稱) 的 Logger：
```typescript
const dbLogger = logger.child("Database");
dbLogger.info("已連線"); // 日誌中會帶有 mod="Database"
```

### B. 事件攔截 (Event Hooks)
您可以透過 `.on` 與 `.off` 訂閱並攔截日誌事件，例如用於傳送到 Sentry 或發送告警：
```typescript
const listener = (record) => {
  if (record.lvl === "ERROR") {
    sendToSentry(record);
  }
};
logger.on("log", listener);
// 移除攔截
logger.off("log", listener);
```

### C. 自訂層級與格式 (Custom Levels & Format)
可於初始化時宣告新的日誌等級及對應終端機顏色，甚至完全接管 `console.log` 的輸出格式：
```typescript
const logger = createLogger({
  // ...
  customLevels: {
    "FATAL": 90,     // 自訂等級 FATAL (高於 PERFORMANCE)
    "METRIC": 25     // 自訂等級 METRIC (介於 DEBUG 與 INFO 之間)
  },
  consoleColorMap: {
    "FATAL": "\x1b[41m\x1b[37m", // 紅底白字
    "INFO": "\x1b[36m"           // 把原本的 INFO 改為青色
  },
  consoleFormatter: (record) => {
    // 徹底自訂終端機長相
    return `[${record.ts}] <${record.lvl}> ${record.msg}`;
  }
});

// 若沒有為 FATAL 實作捷徑方法，可使用強行轉型直接 emit (進階用法)
(logger as any).emit("FATAL", "系統崩潰");
```

### D. I/O 卸載 (Worker Thread)
針對高吞吐量的應用程式，可以將繁重的 `JSON.stringify` 與 `fs.write` 操作卸載至背景 Worker。
> **注意**：開啟此功能後，主執行緒完全不會阻塞，但記憶體佔用會微幅增加（啟動 Worker 的基本開銷）。
```typescript
const logger = createLogger({
  app: "api-server",
  version: "2.0.0",
  useWorkerThread: true  // 啟用後，I/O 完全分離至子執行緒
});
```

### E. IPC 批次通訊 (IPC Worker Mode)
若是受控於 PM2 或自訂的主程式 (Cluster Master)，可設定為 `ipc_worker`，Logger 將透過 `process.send()` 批次發送日誌，而不會直接寫檔。
```typescript
const logger = createLogger({
  app: "api-worker",
  version: "2.0.0",
  pidMode: "ipc_worker"
});
```

---

## 4. 日誌讀取 (Log Stream)

套件提供強大的 `createLogStream` 來針對本地寫出的 `JSONL` 檔案進行流式查詢與過濾，可支援查詢特定的 TraceID 或最低層級。

```typescript
import { createLogStream } from "irika-system-logger";

async function readLogs() {
  const stream = createLogStream("./logs/app-2026-08-11.log", {
    minLevel: "WARN",          // 只讀取 WARN (含) 以上的日誌
    traceId: "req-abc-123",    // 過濾特定的 traceId
    timezone: "Asia/Taipei"
  });

  for await (const record of stream) {
    console.log("找到問題紀錄:", record.msg);
  }
}
```

## 5. 關閉與資源釋放

在應用程式正常結束時，請務必呼叫 `.close()` 確保緩衝區內的日誌完成寫入（包含關閉 Worker Thread 與終止檔案串流）。
```typescript
process.on('SIGTERM', async () => {
  await logger.close();
  process.exit(0);
});
```
