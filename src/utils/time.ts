const datePartsFormatterCache: Record<string, Intl.DateTimeFormat> = {};
const offsetFormatterCache: Record<string, Intl.DateTimeFormat> = {};

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  if (!datePartsFormatterCache[timeZone]) {
    try {
      datePartsFormatterCache[timeZone] = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        fractionalSecondDigits: 3
      });
    } catch (err) {
      datePartsFormatterCache[timeZone] = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        fractionalSecondDigits: 3
      });
    }
  }
  return datePartsFormatterCache[timeZone];
}

function getOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  if (!offsetFormatterCache[timeZone]) {
    try {
      offsetFormatterCache[timeZone] = new Intl.DateTimeFormat("en", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "shortOffset"
      });
    } catch (err) {
      offsetFormatterCache[timeZone] = new Intl.DateTimeFormat("en", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "shortOffset"
      });
    }
  }
  return offsetFormatterCache[timeZone];
}

function parseOffset(offsetLabel: string): string {
  // offsetLabel example: "GMT+8", "GMT+08:00"
  const match = offsetLabel.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return "+00:00";
  const sign = match[1];
  const hh = match[2].padStart(2, "0");
  const mm = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function formatTimestamp(date: Date, timeZone: string): { ts: string; dateKey: string } {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const byType: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") byType[p.type] = p.value;
  }

  const year = byType.year ?? "0000";
  const month = byType.month ?? "00";
  const day = byType.day ?? "00";
  const hour = byType.hour ?? "00";
  const minute = byType.minute ?? "00";
  const second = byType.second ?? "00";
  const ms = byType.fractionalSecond ?? "000";

  const offsetFormatter = getOffsetFormatter(timeZone);
  const offsetLabel = offsetFormatter.format(date);
  const offset = parseOffset(offsetLabel);

  return {
    ts: `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${offset}`,
    dateKey: `${year}-${month}-${day}`
  };
}

export function formatConsoleTimestamp(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const byType: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") byType[p.type] = p.value;
  }
  return `${byType.month ?? "00"}-${byType.day ?? "00"} ${byType.hour ?? "00"}:${byType.minute ?? "00"}:${byType.second ?? "00"}`;
}

export function toMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
