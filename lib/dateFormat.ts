const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export interface ParsedLocalDate {
  year: number;
  month: number;
  day: number;
}

// 按本地年月日解析，避免 Date("YYYY-MM-DD") 的 UTC 时区偏移。
export function parseLocalDate(input?: string | null): ParsedLocalDate | null {
  if (!input?.trim()) return null;
  const s = input.trim();

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day };
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (m) {
    const year = new Date().getFullYear();
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day };
  }

  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) {
    const d = new Date(ts);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  return null;
}

export function parsedToTimestamp(p: ParsedLocalDate): number {
  return new Date(p.year, p.month - 1, p.day).getTime();
}

export function parseOrderDateTimestamp(orderDate?: string): number | null {
  const p = parseLocalDate(orderDate);
  if (p) return parsedToTimestamp(p);
  return null;
}

function weekdayFromParts(p: ParsedLocalDate): string {
  return WEEKDAYS[new Date(p.year, p.month - 1, p.day).getDay()];
}

export function chineseWeekday(input?: string | null): string {
  const p = parseLocalDate(input);
  if (p) return weekdayFromParts(p);
  const ts = Date.parse(input ?? "");
  if (!Number.isNaN(ts)) return WEEKDAYS[new Date(ts).getDay()];
  return "";
}

export function formatDateWithWeekday(input?: string | null): string {
  const raw = input?.trim();
  if (!raw) return "-";
  const p = parseLocalDate(raw);
  if (!p) return raw;
  const wd = weekdayFromParts(p);
  if (/^\d{4}-/.test(raw)) {
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${wd}`;
  }
  if (/^\d{4}\//.test(raw)) {
    return `${p.year}/${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")} ${wd}`;
  }
  return `${p.month}/${p.day} ${wd}`;
}

export function formatDateRangeMd(start?: string, end?: string): string {
  const fmt = (s: string) => {
    const p = parseLocalDate(s);
    if (!p) return s;
    return `${String(p.month).padStart(2, "0")}/${String(p.day).padStart(2, "0")}`;
  };
  if (!start || !end) return "-";
  return `${fmt(start)} 至 ${fmt(end)}`;
}

export function formatBatchDisplayName(batchName: string, orderDate?: string): string {
  if (/周[一二三四五六日]/.test(batchName)) return batchName;
  const wd = chineseWeekday(orderDate);
  if (!wd) return batchName;
  const p = parseLocalDate(orderDate);
  if (p && !batchName.includes(String(p.year))) {
    return `${batchName}（${formatDateWithWeekday(orderDate)}）`;
  }
  return batchName;
}

export function generateBatchName(orderDate: string, now = new Date()): string {
  const p = parseLocalDate(orderDate);
  if (p) {
    const wd = weekdayFromParts(p);
    const datePart = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}-${wd}`;
    return `接龙-${datePart}`;
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const wd = WEEKDAYS[now.getDay()];
  return `接龙-${y}-${m}-${d}-${wd}`;
}

export function isAutoBatchName(name: string): boolean {
  return /^接龙-\d{4}-\d{2}-\d{2}-周[一二三四五六日]/.test(name.trim());
}

export function defaultOrderDateString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function orderDateFromTimestamp(iso?: string): string {
  if (!iso) return defaultOrderDateString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultOrderDateString();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
