"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Customer } from "@/lib/types";
import { getCustomers } from "@/lib/storage";
import { parseOrderDate } from "@/lib/sort";

function orderCount(c: Customer): number {
  return new Set(c.order_history.map((h) => h.batch_id)).size;
}

function lastOrderTimestamp(c: Customer): number {
  return c.order_history.reduce((max, h) => {
    const ts = parseOrderDate(h.order_date) ?? Date.parse(h.updated_at ?? "") ?? 0;
    return Number.isFinite(ts) && ts > max ? ts : max;
  }, 0);
}

export default function CustomersPage() {
  const [customers] = useState<Customer[]>(() => getCustomers());
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      customers
        .filter((c) => c.wechat_id.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => {
          const countDiff = orderCount(b) - orderCount(a);
          if (countDiff !== 0) return countDiff;
          const dateDiff = lastOrderTimestamp(b) - lastOrderTimestamp(a);
          if (dateDiff !== 0) return dateDiff;
          return a.wechat_id.localeCompare(b.wechat_id, "zh-Hans-CN");
        }),
    [customers, query]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">客户管理</h1>
        <div className="mt-2">
          <input
            className="w-full rounded border p-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索微信号"
          />
        </div>
      </div>

      {filtered.map((c) => (
        <div key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{c.wechat_id}</p>
              <p className="text-xs text-zinc-600">
                点单次数: {new Set(c.order_history.map((h) => h.batch_id)).size}
              </p>
            </div>
            <Link
              className="rounded bg-zinc-900 px-3 py-1 text-xs text-white"
              href={`/customers/${encodeURIComponent(c.wechat_id)}`}
            >
              查看历史订单
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
