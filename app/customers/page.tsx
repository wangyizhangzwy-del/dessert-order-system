"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Customer } from "@/lib/types";
import { getCustomers, rebuildCustomerProfiles } from "@/lib/storage";
import { parseOrderDate } from "@/lib/sort";
import { deriveAddressFromHistory } from "@/lib/address";

function customerAddress(c: Customer): string {
  return c.default_address || deriveAddressFromHistory(c.order_history) || "-";
}

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const rebuiltRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let data = await getCustomers();
      // 已有历史但 default_address 缺失时，自动回填一次并重新拉取（无需手动编辑）。
      const needsRebuild = data.some(
        (c) => !c.default_address && deriveAddressFromHistory(c.order_history)
      );
      if (needsRebuild && !rebuiltRef.current) {
        rebuiltRef.current = true;
        try {
          await rebuildCustomerProfiles();
          data = await getCustomers();
        } catch {
          // 回填失败不阻塞展示，下方仍会用派生地址兜底显示。
        }
      }
      if (active) setCustomers(data);
    })();
    return () => {
      active = false;
    };
  }, []);

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
                <span>点单次数: {new Set(c.order_history.map((h) => h.batch_id)).size}</span>
                <span className="ml-4">地址: {customerAddress(c)}</span>
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
