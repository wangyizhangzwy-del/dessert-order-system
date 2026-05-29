import { buildPerformanceAnalytics } from "@/lib/performanceAnalytics";
import { ParsedOrder, SavedJielong } from "@/lib/types";

function makeOrder(
  wechat_id: string,
  customer_total: number,
  quantity: number,
  is_example = false
): ParsedOrder {
  return {
    id: `o_${wechat_id}_${customer_total}`,
    raw_line: "",
    wechat_id,
    items: [
      {
        sku_code: "1",
        cake_name: "测试商品",
        display_name: "测试商品",
        quantity,
        unit_price: quantity > 0 ? customer_total / quantity : 0,
        line_total: customer_total,
      },
    ],
    customer_total,
    status: "success",
    notes: "",
    is_example,
  };
}

function makeBatch(order_date: string, orders: ParsedOrder[]): SavedJielong {
  return {
    batch_id: `b_${order_date}_${Math.random()}`,
    batch_name: order_date,
    order_date,
    raw_text: "",
    menu_items: [],
    parsed_orders: orders,
    editable_rows: [],
    customer_summary_rows: [],
    production_summary_rows: [],
    grouped_excel_rows: [],
    total_amount: 0,
    warning_count: 0,
    failed_count: 0,
    ignore_example_order: true,
    created_at: "",
    updated_at: "",
  };
}

function checks(): string[] {
  const errors: string[] = [];

  const saved: SavedJielong[] = [
    makeBatch("5.28", [
      makeOrder("示例", 999, 9, true),
      makeOrder("alice", 10, 1),
      makeOrder("carol", 40, 4),
    ]),
    makeBatch("5.27", [
      makeOrder("示例", 999, 9, true),
      makeOrder("alice", 20, 2),
      makeOrder("bob", 30, 3),
    ]),
    makeBatch("5.28", [makeOrder("dave", 50, 5)]),
  ];

  const result = buildPerformanceAnalytics(saved);

  if (result.totalRevenue !== 150) errors.push(`总销售额应为 150，实际 ${result.totalRevenue}`);
  if (result.totalOrders !== 5) errors.push(`总订单数应为 5（排除示例），实际 ${result.totalOrders}`);
  if (result.totalCustomers !== 4) errors.push(`总客户数应为 4（唯一），实际 ${result.totalCustomers}`);
  if (result.avgOrderValue !== 30) errors.push(`平均客单价应为 30，实际 ${result.avgOrderValue}`);
  if (result.totalQuantity !== 15) errors.push(`总商品数量应为 15，实际 ${result.totalQuantity}`);
  if (result.totalBatches !== 3) errors.push(`总接龙数应为 3，实际 ${result.totalBatches}`);
  if (result.avgRevenuePerBatch !== 50) {
    errors.push(`平均每场接龙销售额应为 50，实际 ${result.avgRevenuePerBatch}`);
  }

  const dates = result.daily.map((d) => d.date);
  if (dates.join(",") !== "5.27,5.28") errors.push(`daily 应按日期升序 [5.27,5.28]，实际 [${dates.join(",")}]`);

  const d27 = result.daily.find((d) => d.date === "5.27");
  if (!d27 || d27.revenue !== 50 || d27.orderCount !== 2 || d27.customerCount !== 2 || d27.productQuantity !== 5) {
    errors.push(`5.27 聚合错误：${JSON.stringify(d27)}`);
  }

  const d28 = result.daily.find((d) => d.date === "5.28");
  // 跨 batch 同日期合并：alice/carol(批1) + dave(批2)
  if (!d28 || d28.revenue !== 100 || d28.orderCount !== 3 || d28.customerCount !== 3 || d28.productQuantity !== 10) {
    errors.push(`5.28 跨批次聚合错误：${JSON.stringify(d28)}`);
  }

  const empty = buildPerformanceAnalytics([]);
  if (empty.daily.length !== 0 || empty.totalRevenue !== 0 || empty.avgOrderValue !== 0) {
    errors.push("空数据应返回空 daily 与 0 指标");
  }

  const onlyExample = buildPerformanceAnalytics([makeBatch("6.1", [makeOrder("示例", 100, 1, true)])]);
  if (onlyExample.daily.length !== 0 || onlyExample.totalOrders !== 0) {
    errors.push("仅含示例订单的日期不应进入 daily 统计");
  }

  return errors;
}

function main() {
  const errors = checks();
  if (errors.length > 0) {
    console.error("Performance analytics test failed:");
    errors.forEach((e, idx) => console.error(`${idx + 1}. ${e}`));
    process.exit(1);
  }
  console.log("Performance analytics test passed.");
  process.exit(0);
}

main();
