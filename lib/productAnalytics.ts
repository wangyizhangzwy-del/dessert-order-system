import { SavedJielong } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";
import { isGiftProductName, normalizeProductName } from "@/lib/productNormalize";
import { roundMoney } from "@/lib/moneyFormat";

export type ProductTag = "爆品" | "低销量" | "高销售额";

export interface ProductAnalyticsRow {
  key: string;
  normalized_name: string;
  /** @deprecated display alias — same as normalized_name */
  cake_name: string;
  raw_names: string[];
  total_quantity: number;
  batch_count: number;
  total_revenue: number;
  avg_unit_price: number;
  revenue_share: number;
  quantity_share: number;
  tags: ProductTag[];
  last_order_date: string;
}

function itemDisplayName(item: { cake_name?: string; display_name?: string }): string {
  return (item.display_name || item.cake_name || "").trim();
}

function shouldSkipItem(item: {
  cake_name?: string;
  display_name?: string;
  quantity: number;
  line_total: number;
}): boolean {
  const name = itemDisplayName(item);
  if (isGiftProductName(name)) {
    return item.quantity <= 0 || item.line_total <= 0;
  }
  return false;
}

function assignTags(
  rows: Omit<
    ProductAnalyticsRow,
    "tags" | "revenue_share" | "quantity_share" | "avg_unit_price" | "cake_name"
  >[],
  totalRevenue: number,
  totalQuantity: number
): ProductAnalyticsRow[] {
  if (rows.length === 0) return [];
  const maxQty = Math.max(...rows.map((r) => r.total_quantity));
  const maxRev = Math.max(...rows.map((r) => r.total_revenue));
  const qtyThreshold = Math.max(2, Math.ceil(maxQty * 0.6));
  const revThreshold = maxRev * 0.6;

  return rows.map((r) => {
    const tags: ProductTag[] = [];
    if (r.total_quantity >= qtyThreshold && r.total_quantity >= 3) tags.push("爆品");
    if (r.total_quantity <= 1) tags.push("低销量");
    if (r.total_revenue >= revThreshold && r.total_revenue > 0) tags.push("高销售额");
    return {
      ...r,
      cake_name: r.normalized_name,
      avg_unit_price:
        r.total_quantity > 0 ? roundMoney(r.total_revenue / r.total_quantity) : 0,
      revenue_share: totalRevenue > 0 ? roundMoney(r.total_revenue / totalRevenue) : 0,
      quantity_share: totalQuantity > 0 ? roundMoney(r.total_quantity / totalQuantity) : 0,
      tags,
    };
  });
}

export function buildProductAnalytics(saved: SavedJielong[]): ProductAnalyticsRow[] {
  const map = new Map<
    string,
    ProductAnalyticsRow & { _batches: Set<string>; _rawSet: Set<string> }
  >();

  for (const j of saved) {
    const orders = j.parsed_orders.filter((o) => !o.is_example);
    for (const order of orders) {
      for (const item of order.items) {
        if (shouldSkipItem(item)) continue;

        const rawName = itemDisplayName(item) || item.cake_name || "未命名商品";
        const normalized = normalizeProductName(rawName);
        const key = normalized;

        const existing = map.get(key);
        if (existing) {
          existing.total_quantity += item.quantity;
          existing.total_revenue += item.line_total;
          existing._batches.add(j.batch_id);
          existing._rawSet.add(rawName);
          if (j.order_date > existing.last_order_date) existing.last_order_date = j.order_date;
        } else {
          map.set(key, {
            key,
            normalized_name: normalized,
            cake_name: normalized,
            raw_names: [rawName],
            total_quantity: item.quantity,
            batch_count: 1,
            total_revenue: item.line_total,
            avg_unit_price: 0,
            revenue_share: 0,
            quantity_share: 0,
            tags: [],
            last_order_date: j.order_date,
            _batches: new Set([j.batch_id]),
            _rawSet: new Set([rawName]),
          });
        }
      }
    }
  }

  const base = [...map.values()]
    .map((r) => ({
      ...r,
      raw_names: [...r._rawSet].sort((a, b) => a.localeCompare(b, "zh-CN")),
      batch_count: r._batches.size,
    }))
    .sort((a, b) => {
      if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
      if (b.total_quantity !== a.total_quantity) return b.total_quantity - a.total_quantity;
      const da = parseOrderDate(a.last_order_date) ?? 0;
      const db = parseOrderDate(b.last_order_date) ?? 0;
      return db - da;
    });

  const totalRevenue = base.reduce((s, r) => s + r.total_revenue, 0);
  const totalQuantity = base.reduce((s, r) => s + r.total_quantity, 0);
  return assignTags(base, totalRevenue, totalQuantity);
}

export interface ProductShareSlice {
  label: string;
  value: number;
  color: string;
}

const PIE_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b",
];

export function buildProductShareSlices(
  rows: ProductAnalyticsRow[],
  mode: "revenue" | "quantity",
  topN = 10
): ProductShareSlice[] {
  const sorted = [...rows].sort((a, b) =>
    mode === "revenue" ? b.total_revenue - a.total_revenue : b.total_quantity - a.total_quantity
  );
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const valueKey = mode === "revenue" ? "total_revenue" : "total_quantity";
  const slices: ProductShareSlice[] = top.map((r, i) => ({
    label: r.normalized_name.length > 10 ? `${r.normalized_name.slice(0, 10)}…` : r.normalized_name,
    value: r[valueKey],
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const otherTotal = rest.reduce((s, r) => s + r[valueKey], 0);
  if (otherTotal > 0) {
    slices.push({ label: "其他", value: otherTotal, color: "#d4d4d8" });
  }
  return slices.filter((s) => s.value > 0);
}
