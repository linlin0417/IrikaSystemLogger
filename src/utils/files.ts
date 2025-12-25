import fs from "fs";
import path from "path";

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function generateLogFileName(params: {
  app: string;
  version: string;
  dateKey: string;
  timestamp: number;
  pid: number;
  sequence: number;
}): string {
  const { app, version, dateKey, timestamp, pid, sequence } = params;
  return `${app}_v${version}_${dateKey}_${timestamp}_${pid}_${sequence}.log`;
}

export async function cleanupLogs(params: {
  logDir: string;
  maxTotalSizeBytes: number;
  maxFiles: number | null;
  maxFileAgeDays: number;
}): Promise<void> {
  const { logDir, maxTotalSizeBytes, maxFiles, maxFileAgeDays } = params;
  const now = Date.now();
  const maxAgeMs = maxFileAgeDays * 24 * 60 * 60 * 1000;
  const entries = await fs.promises.readdir(logDir, { withFileTypes: true }).catch(() => []);

  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".log"))
    .map((e) => path.join(logDir, e.name));

  const stats: { path: string; size: number; mtimeMs: number }[] = [];
  for (const file of files) {
    try {
      const st = await fs.promises.stat(file);
      stats.push({ path: file, size: st.size, mtimeMs: st.mtimeMs });
    } catch (err) {
      // ignore broken entries
    }
  }

  // Age-based removal
  for (const s of stats) {
    if (now - s.mtimeMs > maxAgeMs) {
      try {
        await fs.promises.unlink(s.path);
      } catch (err) {
        // ignore errors
      }
    }
  }

  // Recompute after age purge
  const remaining: { path: string; size: number; mtimeMs: number }[] = [];
  for (const s of stats) {
    if (fs.existsSync(s.path)) {
      const st = await fs.promises.stat(s.path).catch(() => null);
      if (st) remaining.push({ path: s.path, size: st.size, mtimeMs: st.mtimeMs });
    }
  }

  // Sort oldest first
  remaining.sort((a, b) => a.mtimeMs - b.mtimeMs);

  let totalSize = remaining.reduce((acc, cur) => acc + cur.size, 0);

  async function deleteOldest(): Promise<void> {
    const victim = remaining.shift();
    if (!victim) return;
    try {
      await fs.promises.unlink(victim.path);
      totalSize -= victim.size;
    } catch (err) {
      // ignore errors
    }
  }

  while (totalSize > maxTotalSizeBytes) {
    await deleteOldest();
  }

  if (maxFiles !== null && maxFiles > 0) {
    while (remaining.length > maxFiles) {
      await deleteOldest();
    }
  }
}
