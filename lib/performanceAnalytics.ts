import { SavedJielong } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";

export interface DailyPerformance {
  date: string;
  revenue: number;
  orderCount: number;
  customerCount: number;
  productQuantity: number;
}

export interface PerformanceSummary {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  avgOrderValue: number;
  totalQuantity: number;
  daily: DailyPerformance[];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// 基于已保存的历史接龙，按 order_date 汇总业绩，排除示例订单（is_example）。
// daily 按日期升序（时间顺序）排列，供趋势图使用。
export function buildPerformanceAnalytics(saved: SavedJielong[]): PerformanceSummary {
  const byDate = new Map<
    string,
    { revenue: number; orderCount: number; customers: Set<string>; quantity: number }
  >();
  const allCustomers = new Set<string>();
  let totalRevenue = 0;
  let totalOrders = 0;
  let totalQuantity = 0;

  for (const jielong of saved ?? []) {
    const date = jielong.order_date?.trim() || "未标日期";
    const orders = (jielong.parsed_orders ?? []).filter((order) => !order.is_example);
    for (const order of orders) {
      const revenue = Number.isFinite(order.customer_total) ? order.customer_total : 0;
      const quantity = (order.items ?? []).reduce(
        (sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0),
        0
      );

      let bucket = byDate.get(date);
      if (!bucket) {
        bucket = { revenue: 0, orderCount: 0, customers: new Set(), quantity: 0 };
        byDate.set(date, bucket);
      }
      bucket.revenue += revenue;
      bucket.orderCount += 1;
      bucket.quantity += quantity;
      if (order.wechat_id) {
        bucket.customers.add(order.wechat_id);
        allCustomers.add(order.wechat_id);
      }

      totalRevenue += revenue;
      totalOrders += 1;
      totalQuantity += quantity;
    }
  }

  const daily: DailyPerformance[] = [...byDate.entries()]
    .map(([date, bucket]) => ({
      date,
      revenue: roundMoney(bucket.revenue),
      orderCount: bucket.orderCount,
      customerCount: bucket.customers.size,
      productQuantity: bucket.quantity,
    }))
    .sort((a, b) => {
      const ta = parseOrderDate(a.date) ?? Number.POSITIVE_INFINITY;
      const tb = parseOrderDate(b.date) ?? Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return a.date.localeCompare(b.date);
    });

  return {
    totalRevenue: roundMoney(totalRevenue),
    totalOrders,
    totalCustomers: allCustomers.size,
    avgOrderValue: totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0,
    totalQuantity,
    daily,
  };
}
