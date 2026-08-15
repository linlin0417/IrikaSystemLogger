import { LogRecord, Transport } from "../types";
import { formatConsoleLine } from "../utils/console-format";

import { ResolvedLoggerOptions } from "../utils/config";

export class ConsoleTransport implements Transport {
  constructor(private readonly opts: ResolvedLoggerOptions) {}

  log(record: LogRecord): void {
    const line = formatConsoleLine(record, {
      timezone: this.opts.timezone,
      consoleIncludeContext: this.opts.consoleIncludeContext,
      consoleColorMap: this.opts.consoleColorMap,
      consoleFormatter: this.opts.consoleFormatter
    });
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
