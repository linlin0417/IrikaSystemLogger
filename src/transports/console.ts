import { LogRecord, Transport } from "../types";
import { formatConsoleLine } from "../utils/console-format";

import { ResolvedLoggerOptions } from "../utils/config";

export class ConsoleTransport implements Transport {
  private originalConsoleLog = console.log;

  constructor(private readonly opts: ResolvedLoggerOptions) {}

  log(record: LogRecord): void {
    const line = formatConsoleLine(record, {
      timezone: this.opts.timezone,
      consoleIncludeContext: this.opts.consoleIncludeContext,
      consoleColorMap: this.opts.consoleColorMap,
      consoleFormatter: this.opts.consoleFormatter
    });
    // eslint-disable-next-line no-console
    this.originalConsoleLog(line);
  }

  async flush(): Promise<void> {
    return;
  }

  flushSync(): void {
    // Console output is already synchronous
  }

  async close(): Promise<void> {
    return;
  }
}
