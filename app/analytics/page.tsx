"use client";

import { useEffect, useMemo, useState } from "react";
import { getSavedJielongs } from "@/lib/storage";
import {
  buildProductAnalytics,
  buildProductShareSlices,
  ProductAnalyticsRow,
  ProductTag,
} from "@/lib/productAnalytics";
import { formatDateWithWeekday } from "@/lib/dateFormat";
import { BarChart, DonutChart } from "@/app/components/Charts";

type ViewMode = "detail" | "chart";

function tagClass(tag: ProductTag): string {
  if (tag === "爆品") return "bg-amber-100 text-amber-800";
  if (tag === "低销量") return "bg-zinc-200 text-zinc-600";
  return "bg-emerald-100 text-emerald-800";
}

export default function AnalyticsPage() {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("detail");
  const [rows, setRows] = useState<ProductAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await getSavedJielongs();
        if (!active) return;
        setRows(buildProductAnalytics(saved));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        `${r.sku} ${r.cake_name} ${r.variant} ${r.flavor_combo}`.toLowerCase().includes(query.toLowerCase())
      ),
    [rows, query]
  );

  const totalSales = filtered.reduce((s, r) => s + r.total_revenue, 0);
  const totalQty = filtered.reduce((s, r) => s + r.total_quantity, 0);
  const topQty = filtered[0];
  const topRev = useMemo(
    () => [...filtered].sort((a, b) => b.total_revenue - a.total_revenue)[0],
    [filtered]
  );
  const chartTop = useMemo(() => filtered.slice(0, 10), [filtered]);
  const revenueShare = useMemo(
    () => buildProductShareSlices(filtered, "revenue", 10),
    [filtered]
  );
  const qtyShare = useMemo(
    () => buildProductShareSlices(filtered, "quantity", 10),
    [filtered]
  );

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">正在加载...</p>
      </div>
    );
  }

  const copy = async () => {
    const table = [
      ["SKU", "商品名称", "口味", "口味组合", "销量", "销售额", "销售占比", "出现接龙数", "平均单价", "标签", "最近一次被点日期"],
      ...filtered.map((r) => [
        r.sku,
        r.cake_name,
        r.variant,
        r.flavor_combo,
        String(r.total_quantity),
        String(Math.round(r.total_revenue * 100) / 100),
        `${Math.round(r.revenue_share * 1000) / 10}%`,
        String(r.batch_count),
        String(r.avg_unit_price),
        r.tags.join("、"),
        formatDateWithWeekday(r.last_order_date),
      ]),
    ];
    await navigator.clipboard.writeText(table.map((r) => r.join("\t")).join("\n"));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">产品分析</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode("detail")}
            className={`rounded px-4 py-2 text-sm font-medium ${viewMode === "detail" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
          >
            产品分析明细
          </button>
          <button
            onClick={() => setViewMode("chart")}
            className={`rounded px-4 py-2 text-sm font-medium ${viewMode === "chart" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
          >
            图表分析
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded bg-white p-3 shadow-sm text-sm">总销量: {totalQty}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">总销售额: {(Math.round(totalSales * 10) / 10).toFixed(1)}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">产品数量: {filtered.length}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">
          Top 1 销量: {topQty ? `${topQty.cake_name} (${topQty.total_quantity})` : "-"}
        </div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">
          Top 1 销售额: {topRev ? `${topRev.cake_name} (${topRev.total_revenue.toFixed(1)})` : "-"}
        </div>
      </div>

      {viewMode === "detail" ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex gap-2">
            <input
              className="w-full rounded border p-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按 SKU/商品/口味搜索"
            />
            <button onClick={copy} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
              复制产品分析到 Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  {["SKU", "商品名称", "口味", "口味组合", "销量", "销售额", "销售占比", "出现接龙数", "平均单价", "标签", "最近一次被点日期"].map((h) => (
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
                    <td className="border px-2 py-1">{(Math.round(r.total_revenue * 10) / 10).toFixed(1)}</td>
                    <td className="border px-2 py-1">{(r.revenue_share * 100).toFixed(1)}%</td>
                    <td className="border px-2 py-1">{r.batch_count}</td>
                    <td className="border px-2 py-1">{r.avg_unit_price.toFixed(1)}</td>
                    <td className="border px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        {r.tags.length === 0 ? (
                          <span className="text-zinc-400">-</span>
                        ) : (
                          r.tags.map((t) => (
                            <span key={t} className={`rounded px-1.5 py-0.5 text-xs ${tagClass(t)}`}>
                              {t}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="border px-2 py-1">{formatDateWithWeekday(r.last_order_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">产品销量排行柱状图（Top 10）</h2>
            <BarChart
              labels={chartTop.map((r) => (r.cake_name.length > 8 ? `${r.cake_name.slice(0, 8)}…` : r.cake_name))}
              series={[{ name: "销量", color: "#6366f1", values: chartTop.map((r) => r.total_quantity) }]}
              yAxisLabel="销量"
            />
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">产品销售额排行柱状图（Top 10）</h2>
            <BarChart
              labels={chartTop.map((r) => (r.cake_name.length > 8 ? `${r.cake_name.slice(0, 8)}…` : r.cake_name))}
              series={[{ name: "销售额", color: "#10b981", values: chartTop.map((r) => r.total_revenue) }]}
              formatValue={(n) => (Math.round(n * 10) / 10).toFixed(1)}
              yAxisLabel="销售额"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">产品销售占比图（销售额 Top 10 + 其他）</h2>
              <DonutChart
                slices={revenueShare}
                formatValue={(n) => (Math.round(n * 10) / 10).toFixed(1)}
              />
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">产品销量占比图（Top 10 + 其他）</h2>
              <DonutChart slices={qtyShare} formatValue={(n) => String(Math.round(n))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
