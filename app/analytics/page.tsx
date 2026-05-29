"use client";

import { useMemo, useState } from "react";
import { getSavedJielongs } from "@/lib/storage";
import { buildProductAnalytics } from "@/lib/productAnalytics";

export default function AnalyticsPage() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildProductAnalytics(getSavedJielongs()), []);
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        `${r.sku} ${r.cake_name} ${r.variant} ${r.flavor_combo}`.toLowerCase().includes(query.toLowerCase())
      ),
    [rows, query]
  );
  const totalSales = filtered.reduce((s, r) => s + r.total_revenue, 0);
  const top = filtered[0];

  const copy = async () => {
    const table = [
      ["SKU", "商品名称", "口味", "口味组合", "总点单数量", "出现接龙次数", "总销售额", "最近一次被点日期"],
      ...filtered.map((r) => [
        r.sku,
        r.cake_name,
        r.variant,
        r.flavor_combo,
        String(r.total_quantity),
        String(r.batch_count),
        String(Math.round(r.total_revenue * 100) / 100),
        r.last_order_date,
      ]),
    ];
    await navigator.clipboard.writeText(table.map((r) => r.join("\t")).join("\n"));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">产品分析</h1>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded bg-white p-3 shadow-sm text-sm">历史接龙数量: {getSavedJielongs().length}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">总商品销量: {filtered.reduce((s, r) => s + r.total_quantity, 0)}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">总销售额: {(Math.round(totalSales * 10) / 10).toFixed(1)}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">被点最多: {top ? `${top.cake_name} (${top.total_quantity})` : "-"}</div>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex gap-2">
          <input
            className="w-full rounded border p-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="按 SKU/商品/口味搜索"
          />
          <button onClick={copy} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">复制产品分析到 Excel</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100">
                {["SKU", "商品名称", "口味", "口味组合", "总点单数量", "出现接龙次数", "总销售额", "最近一次被点日期"].map((h) => (
                  <th key={h} className="border px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key}>
                  <td className="border px-2 py-1">{r.sku}</td>
                  <td className="border px-2 py-1">{r.cake_name}</td>
                  <td className="border px-2 py-1">{r.variant}</td>
                  <td className="border px-2 py-1">{r.flavor_combo}</td>
                  <td className="border px-2 py-1">{r.total_quantity}</td>
                  <td className="border px-2 py-1">{r.batch_count}</td>
                  <td className="border px-2 py-1">{(Math.round(r.total_revenue * 10) / 10).toFixed(1)}</td>
                  <td className="border px-2 py-1">{r.last_order_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
