import fs from "fs";
import readline from "readline";
import { LogRecord, LogLevel, levelPriority } from "./types";

export interface LogFilterOptions {
  minLevel?: LogLevel;
  maxLines?: number;
  traceId?: string;
  contains?: string;
}

export async function* createLogStream(filePath: string, filter: LogFilterOptions = {}): AsyncGenerator<LogRecord, void, void> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let count = 0;
  const minScore = filter.minLevel && filter.minLevel !== "SYSTEM" ? levelPriority[filter.minLevel] : null;

  for await (const line of rl) {
    if (filter.maxLines && count >= filter.maxLines) break;
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as LogRecord & { type?: string };
      if (obj.type === "EOF") continue;
      const lvlScore = obj.lvl === "SYSTEM" ? Number.POSITIVE_INFINITY : levelPriority[obj.lvl as keyof typeof levelPriority];
      if (minScore && lvlScore < minScore) continue;
      if (filter.traceId && obj.traceId !== filter.traceId) continue;
      if (filter.contains && !JSON.stringify(obj).includes(filter.contains)) continue;
      count += 1;
      yield obj;
    } catch (err) {
      continue;
    }
  }
  rl.close();
}
