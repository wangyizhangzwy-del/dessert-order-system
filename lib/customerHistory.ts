import { Customer, CustomerOrderHistory, SavedJielong } from "@/lib/types";

// 纯函数：根据一次接龙，把（非示例）客户订单合并进客户列表。
// 同一 batch_id 的历史按 batch_id upsert，不重复。客户/服务端都复用这段逻辑。
export function applyJielongToCustomers(
  customers: Customer[],
  jielong: SavedJielong,
  now: string,
  makeId: () => string
): Customer[] {
  const next = [...customers];
  for (const order of jielong.parsed_orders ?? []) {
    if (!order.wechat_id) continue;
    if (order.is_example) continue;

    const history: CustomerOrderHistory = {
      batch_id: jielong.batch_id,
      batch_name: jielong.batch_name,
      order_date: jielong.order_date,
      raw_line: order.raw_line,
      items: order.items,
      customer_total: order.customer_total,
      notes: order.notes,
      status: order.status,
      created_at: now,
      updated_at: now,
    };

    const idx = next.findIndex((c) => c.wechat_id === order.wechat_id);
    if (idx >= 0) {
      const existing = next[idx];
      const order_history = [...existing.order_history];
      const hIdx = order_history.findIndex((h) => h.batch_id === jielong.batch_id);
      if (hIdx >= 0) order_history[hIdx] = { ...history, created_at: order_history[hIdx].created_at };
      else order_history.unshift(history);
      next[idx] = { ...existing, order_history, updated_at: now };
    } else {
      next.push({
        id: makeId(),
        wechat_id: order.wechat_id,
        balance: 0,
        order_history: [history],
        created_at: now,
        updated_at: now,
      });
    }
  }
  return next;
}
