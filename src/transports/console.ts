import { LogRecord, Transport } from "../types";
import { formatConsoleLine } from "../utils/console-format";

export class ConsoleTransport implements Transport {
  constructor(private readonly timezone: string, private readonly includeContext = true) {}

  log(record: LogRecord): void {
    const line = formatConsoleLine(record, this.timezone, this.includeContext);
    // eslint-disable-next-line no-console
    console.log(line);
  }

  async flush(): Promise<void> {
    return;
  }

  async close(): Promise<void> {
    return;
  }
}
