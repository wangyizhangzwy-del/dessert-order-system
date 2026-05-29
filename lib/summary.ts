import { Batch, OrderItem } from "@/lib/types";

export interface ProductionSummaryRow {
  key: string;
  sku_code: string;
  variant?: string;
  cake_name: string;
  quantity: number;
}

export function calcTotalSales(batch: Batch): number {
  return Math.round(
    (batch.orders.reduce((sum, order) => sum + order.customer_total, 0) + Number.EPSILON) * 100
  ) / 100;
}

export function calcProductionSummary(batch: Batch): ProductionSummaryRow[] {
  const map = new Map<string, ProductionSummaryRow>();
  batch.orders.forEach((order) => {
    order.items.forEach((item: OrderItem) => {
      const key = `${item.sku_code}__${item.variant ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        map.set(key, {
          key,
          sku_code: item.sku_code,
          variant: item.variant,
          cake_name: item.cake_name,
          quantity: item.quantity,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => Number(a.sku_code) - Number(b.sku_code));
}
