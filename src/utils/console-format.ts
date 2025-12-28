import { formatConsoleTimestamp } from "./time";
import { LogRecord } from "../types";

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

function levelStyle(lvl: string): string {
  const padded = lvl.padEnd(9, " ");
  switch (lvl) {
    case "ERROR":
    case "ASSERT":
      return color(padded, ANSI.bgRed + ANSI.white);
    case "WARN":
      return color(padded, ANSI.bgYellow + ANSI.white);
    case "INFO":
      return color(padded, ANSI.bgBlue + ANSI.white);
    case "DEBUG":
      return color(padded, ANSI.bgGreen + ANSI.white);
    case "VERBOSE":
      return color(padded, ANSI.bgMagenta + ANSI.white);
    case "SECURITY":
      return color(padded, ANSI.bgRed + ANSI.white);
    case "PERFORMANCE":
      return color(padded, ANSI.bgBlue + ANSI.white);
    default:
      return color(padded, ANSI.bgMagenta + ANSI.white);
  }
}

export function formatConsoleLine(record: LogRecord, timeZone: string, includeContext = true): string {
  const now = new Date(record.ts);
  const ts = formatConsoleTimestamp(now, timeZone);
  const tsPart = color(ts, ANSI.gray + ANSI.dim);
  const lvlPart = levelStyle(record.lvl);
  const appPart = color(record.app, ANSI.cyan);
  const modPart = record.mod ? ` ${color(record.mod, ANSI.blue)}` : "";
  const msgPart = color(record.msg, ANSI.white);

  let ctxPart = "";
  if (includeContext && record.ctx && Object.keys(record.ctx).length > 0) {
    try {
      const ctxText = JSON.stringify(record.ctx);
      ctxPart = " " + color(ctxText, ANSI.gray);
    } catch (err) {
      ctxPart = " " + color("[ctx_error]", ANSI.gray);
    }
  }
  return `${tsPart} ${lvlPart} ${appPart}${modPart} > ${msgPart}${ctxPart}`;
}
