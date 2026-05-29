import { Customer, CustomerOrderHistory, SavedJielong } from "@/lib/types";
import { deriveAddressFromHistory, extractAddress, isPickupNote } from "@/lib/address";

// 保存接龙时：新客户若备注含真实地址且尚无 default_address，写入客户档案（不覆盖已有地址，不把自取当地址）。
function applyDefaultAddressFromJielong(customers: Customer[], jielong: SavedJielong): Customer[] {
  return customers.map((c) => {
    if (c.default_address?.trim()) return c;
    const order = (jielong.parsed_orders ?? []).find(
      (o) => o.wechat_id === c.wechat_id && !o.is_example
    );
    if (!order?.notes) return c;
    if (isPickupNote(order.notes)) return c;
    const addr = extractAddress(order.notes);
    if (!addr) return c;
    return { ...c, default_address: addr };
  });
}

// 纯函数：根据一次接龙，把（非示例）客户订单合并进客户列表。
// 同一 batch_id 的历史按 batch_id upsert，不重复。客户/服务端都复用这段逻辑。
// 同时从备注里提取公寓/楼名地址写入 default_address（自取/叫车不算地址，且不会覆盖已有真实地址）。
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
      const default_address =
        existing.default_address?.trim()
          ? existing.default_address
          : deriveAddressFromHistory(order_history) ?? undefined;
      next[idx] = { ...existing, order_history, default_address, updated_at: now };
    } else {
      const order_history = [history];
      next.push({
        id: makeId(),
        wechat_id: order.wechat_id,
        balance: 0,
        default_address: deriveAddressFromHistory(order_history) ?? undefined,
        order_history,
        created_at: now,
        updated_at: now,
      });
    }
  }
  return applyDefaultAddressFromJielong(next, jielong);
}
