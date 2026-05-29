import { SavedJielong } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";

export interface ProductAnalyticsRow {
  key: string;
  sku: string;
  cake_name: string;
  variant: string;
  flavor_combo: string;
  total_quantity: number;
  batch_count: number;
  total_revenue: number;
  last_order_date: string;
}

export function buildProductAnalytics(saved: SavedJielong[]): ProductAnalyticsRow[] {
  const map = new Map<string, ProductAnalyticsRow & { _batches: Set<string> }>();
  for (const j of saved) {
    const orders = j.parsed_orders.filter((o) => !o.is_example);
    for (const order of orders) {
      for (const item of order.items) {
        const key = `${item.sku_code}__${item.cake_name}__${item.variant ?? ""}__${item.flavor_combo ?? ""}`;
        const existing = map.get(key);
        if (existing) {
          existing.total_quantity += item.quantity;
          existing.total_revenue += item.line_total;
          existing._batches.add(j.batch_id);
          if (j.order_date > existing.last_order_date) existing.last_order_date = j.order_date;
        } else {
          map.set(key, {
            key,
            sku: item.sku_code,
            cake_name: item.cake_name,
            variant: item.variant ?? "",
            flavor_combo: item.flavor_combo ?? "",
            total_quantity: item.quantity,
            batch_count: 1,
            total_revenue: item.line_total,
            last_order_date: j.order_date,
            _batches: new Set([j.batch_id]),
          });
        }
      }
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, batch_count: r._batches.size }))
    .sort((a, b) => {
      if (b.total_quantity !== a.total_quantity) return b.total_quantity - a.total_quantity;
      if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
      const da = parseOrderDate(a.last_order_date) ?? 0;
      const db = parseOrderDate(b.last_order_date) ?? 0;
      return db - da;
    });
}
