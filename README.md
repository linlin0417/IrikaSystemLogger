# Irika System Logger

高效的 JSON 行式 logger，內建檔案輪替、保存策略、批次寫入與串流讀取，適合多進程及長時間服務使用。

## 安裝

```bash
npm install irika-system-logger
```

## 快速使用

```ts
import { createLogger } from "irika-system-logger";

const logger = createLogger({
  app: "my-app",
  version: "1.0.0",
  logDir: "./logs",
});

logger.info("service started", { traceId: "t-001" });
```

## 主要特性

- JSON 行格式，支援自訂欄位與 child logger 繼承
- 檔案輪替：依大小或日期切檔，寫入 EOF 校驗與下一檔案指標
- 保存策略：依檔案數量、總大小或檔齡清理
- 串流讀取：`createLogStream` 可依等級、traceId 篩選
- 控制台輸出：彩色格式


