import { formatConsoleTimestamp } from "./time";
import { LogRecord } from "../types";
import { safeStringify } from "./safe-stringify";

const ANSI = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  gray: "\u001b[90m",
  white: "\u001b[37m",
  cyan: "\u001b[36m",
  blue: "\u001b[34m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  magenta: "\u001b[35m",
  bgRed: "\u001b[41m",
  bgYellow: "\u001b[43m",
  bgBlue: "\u001b[44m",
  bgMagenta: "\u001b[45m",
  bgGreen: "\u001b[42m"
};

function color(text: string, code: string): string {
  return `${code}${text}${ANSI.reset}`;
}

function levelStyle(lvl: string, colorMap?: Record<string, string>): string {
  const padded = lvl.padEnd(9, " ");
  if (colorMap && colorMap[lvl]) {
    return color(padded, colorMap[lvl]);
  }
  switch (lvl) {
    case "ERROR":
    case "ASSERT":
    case "SECURITY":
      return color(padded, ANSI.bgRed + ANSI.white);
    case "WARN":
      return color(padded, ANSI.bgYellow + ANSI.white);
    case "INFO":
    case "PERFORMANCE":
      return color(padded, ANSI.bgBlue + ANSI.white);
    case "SUCCESS":
      return color(padded, ANSI.bgGreen + ANSI.white);
    case "DEBUG":
      return color(padded, ANSI.cyan);
    case "VERBOSE":
      return color(padded, ANSI.magenta);
    default:
      return color(padded, ANSI.gray);
  }
}

export interface ConsoleFormatOptions {
  timezone: string;
  consoleIncludeContext?: boolean;
  consoleColorMap?: Record<string, string>;
  consoleFormatter?: (record: LogRecord) => string;
}

export function formatConsoleLine(record: LogRecord, opts: ConsoleFormatOptions): string {
  if (opts.consoleFormatter) {
    return opts.consoleFormatter(record);
  }

  const now = new Date(record.ts);
  const ts = formatConsoleTimestamp(now, opts.timezone);
  const tsPart = color(ts, ANSI.gray + ANSI.dim);
  const lvlPart = levelStyle(record.lvl, opts.consoleColorMap);
  const appPart = color(record.app, ANSI.cyan);
  const modPart = record.mod ? ` ${color(record.mod, ANSI.blue)}` : "";
  const msgPart = color(record.msg, ANSI.white);

  let ctxPart = "";
  if (opts.consoleIncludeContext !== false && record.ctx && Object.keys(record.ctx).length > 0) {
    try {
      const ctxText = safeStringify(record.ctx);
      ctxPart = " " + color(ctxText, ANSI.gray);
    } catch (err) {
      ctxPart = " " + color("[ctx_error]", ANSI.gray);
    }
  }
  return `${tsPart} ${lvlPart} ${appPart}${modPart} > ${msgPart}${ctxPart}`;
}
