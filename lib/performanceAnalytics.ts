import { SavedJielong } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";
import { buildProductAnalytics, ProductAnalyticsRow } from "@/lib/productAnalytics";

export interface DailyPerformance {
  date: string;
  revenue: number;
  orderCount: number;
  customerCount: number;
  productQuantity: number;
}

export interface BatchPerformance {
  batch_id: string;
  batch_name: string;
  order_date: string;
  revenue: number;
}

export interface PerformanceSummary {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  avgOrderValue: number;
  totalQuantity: number;
  totalBatches: number;
  avgRevenuePerBatch: number;
  bestDay: DailyPerformance | null;
  worstDay: DailyPerformance | null;
  bestBatch: BatchPerformance | null;
  worstBatch: BatchPerformance | null;
  daily: DailyPerformance[];
  batches: BatchPerformance[];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pickExtreme<T extends { revenue: number }>(
  items: T[],
  mode: "max" | "min"
): T | null {
  const valid = items.filter((i) => i.revenue > 0);
  if (valid.length === 0) return null;
  return valid.reduce((best, cur) =>
    mode === "max"
      ? cur.revenue > best.revenue
        ? cur
        : best
      : cur.revenue < best.revenue
        ? cur
        : best
  );
}

// 基于已保存的历史接龙，按 order_date 汇总业绩，排除示例订单（is_example）。
export function buildPerformanceAnalytics(saved: SavedJielong[]): PerformanceSummary {
  const byDate = new Map<
    string,
    { revenue: number; orderCount: number; customers: Set<string>; quantity: number }
  >();
  const batchList: BatchPerformance[] = [];
  const allCustomers = new Set<string>();
  let totalRevenue = 0;
  let totalOrders = 0;
  let totalQuantity = 0;

  for (const jielong of saved ?? []) {
    const orders = (jielong.parsed_orders ?? []).filter((order) => !order.is_example);
    let batchRevenue = 0;
    for (const order of orders) {
      const revenue = Number.isFinite(order.customer_total) ? order.customer_total : 0;
      const quantity = (order.items ?? []).reduce(
        (sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0),
        0
      );
      batchRevenue += revenue;

      const date = jielong.order_date?.trim() || "未标日期";
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
    batchList.push({
      batch_id: jielong.batch_id,
      batch_name: jielong.batch_name,
      order_date: jielong.order_date,
      revenue: roundMoney(batchRevenue),
    });
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

  const totalBatches = (saved ?? []).length;
  const totalRev = roundMoney(totalRevenue);

  return {
    totalRevenue: totalRev,
    totalOrders,
    totalCustomers: allCustomers.size,
    avgOrderValue: totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0,
    totalQuantity,
    totalBatches,
    avgRevenuePerBatch: totalBatches > 0 ? roundMoney(totalRevenue / totalBatches) : 0,
    bestDay: pickExtreme(daily, "max"),
    worstDay: pickExtreme(daily, "min"),
    bestBatch: pickExtreme(batchList, "max"),
    worstBatch: pickExtreme(batchList, "min"),
    daily,
    batches: batchList,
  };
}

export function buildPerformanceInsights(
  saved: SavedJielong[],
  summary: PerformanceSummary
): string[] {
  const notes: string[] = [];
  const products = buildProductAnalytics(saved);
  if (products.length === 0) return ["暂无足够数据生成经营洞察。"];

  const topRev = products[0];
  const byRev = [...products].sort((a, b) => b.total_revenue - a.total_revenue);
  const top3RevShare =
    summary.totalRevenue > 0
      ? byRev.slice(0, 3).reduce((s, p) => s + p.total_revenue, 0) / summary.totalRevenue
      : 0;

  if (summary.bestDay) {
    notes.push(`最高销售额出现在 ${summary.bestDay.date}（${summary.bestDay.revenue.toFixed(1)} 元）。`);
  }
  if (summary.bestBatch) {
    notes.push(
      `最高销售接龙：${summary.bestBatch.batch_name}（${summary.bestBatch.revenue.toFixed(1)} 元）。`
    );
  }
  if (topRev) {
    notes.push(`销量最高产品：${topRev.cake_name}（${topRev.total_quantity} 件）。`);
  }
  if (byRev[0]) {
    notes.push(`销售额最高产品：${byRev[0].cake_name}（${byRev[0].total_revenue.toFixed(1)} 元）。`);
  }
  if (top3RevShare >= divisorThreshold(products.length)) {
    notes.push(`销量/销售额集中在前 3 个产品（约占 ${Math.round(top3RevShare * 100)}% 销售额）。`);
  }
  const lowQty = products.filter((p) => p.total_quantity <= 1);
  if (lowQty.length > 0) {
    notes.push(`有 ${lowQty.length} 个低销量产品（≤1 件），可考虑减少备货或下架。`);
  }
  return notes;
}

function divisorThreshold(productCount: number): number {
  if (productCount <= 3) return 0.9;
  return 0.5;
}

export type { ProductAnalyticsRow };
