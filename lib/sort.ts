import { parseOrderDateTimestamp } from "@/lib/dateFormat";

interface HasDateLikeFields {
  order_date?: string;
  updated_at?: string;
  created_at?: string;
}

export function parseOrderDate(orderDate?: string): number | null {
  return parseOrderDateTimestamp(orderDate);
}

function fallbackTimestamp(v: HasDateLikeFields): number {
  const u = Date.parse(v.updated_at ?? "");
  if (!Number.isNaN(u)) return u;
  const c = Date.parse(v.created_at ?? "");
  if (!Number.isNaN(c)) return c;
  return 0;
}

export function sortByRecentDate<T extends HasDateLikeFields>(a: T, b: T): number {
  const ta = parseOrderDate(a.order_date) ?? fallbackTimestamp(a);
  const tb = parseOrderDate(b.order_date) ?? fallbackTimestamp(b);
  if (tb !== ta) return tb - ta;
  return fallbackTimestamp(b) - fallbackTimestamp(a);
}
