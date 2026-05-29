"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSavedJielongs } from "@/lib/storage";
import {
  buildProductAnalytics,
  buildProductShareSlices,
  ProductAnalyticsRow,
  ProductTag,
} from "@/lib/productAnalytics";
import { productMatchesQuery } from "@/lib/productNormalize";
import { formatDateWithWeekday } from "@/lib/dateFormat";
import { formatMoney, formatPrice } from "@/lib/moneyFormat";
import { BarChart, DonutChart } from "@/app/components/Charts";
import { LoadingPanel } from "@/app/components/LoadingPanel";

type ViewMode = "detail" | "chart";

const TABLE_HEADERS = [
  "商品名称",
  "包含原始名称",
  "销量",
  "销售额",
  "销售占比",
  "出现接龙数",
  "平均单价",
  "标签",
  "最近一次被点日期",
] as const;

function tagClass(tag: ProductTag): string {
  if (tag === "爆品") return "bg-amber-100 text-amber-800";
  if (tag === "低销量") return "bg-zinc-200 text-zinc-600";
  return "bg-emerald-100 text-emerald-800";
}

function RawNamesCell({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  if (names.length <= 1) {
    return <span className="text-zinc-500">{names[0] ?? "-"}</span>;
  }
  const preview = names.slice(0, 2).join("、");
  const rest = names.length - 2;
  return (
    <div>
      <span className="text-zinc-600">{preview}{rest > 0 ? ` 等${names.length}种` : ""}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1 text-xs text-indigo-600 hover:underline"
      >
        {open ? "收起" : "展开"}
      </button>
      {open ? (
        <ul className="mt-1 max-w-xs list-inside list-disc text-xs text-zinc-500">
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("detail");
  const [rows, setRows] = useState<ProductAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadError("");
        const saved = await getSavedJielongs();
        if (!active) return;
        setRows(buildProductAnalytics(saved));
      } catch (e) {
        if (active) {
          setLoadError(e instanceof Error ? e.message : "加载失败，请刷新页面重试。");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => productMatchesQuery(r.normalized_name, r.raw_names, query)),
    [rows, query]
  );

  const totalSales = filtered.reduce((s, r) => s + r.total_revenue, 0);
  const totalQty = filtered.reduce((s, r) => s + r.total_quantity, 0);
  const topQty = useMemo(
    () => [...filtered].sort((a, b) => b.total_quantity - a.total_quantity)[0],
    [filtered]
  );
  const topRev = useMemo(
    () => [...filtered].sort((a, b) => b.total_revenue - a.total_revenue)[0],
    [filtered]
  );
  const chartTop = useMemo(
    () => (viewMode === "chart" ? filtered.slice(0, 10) : []),
    [filtered, viewMode]
  );
  const revenueShare = useMemo(
    () => (viewMode === "chart" ? buildProductShareSlices(filtered, "revenue", 10) : []),
    [filtered, viewMode]
  );
  const qtyShare = useMemo(
    () => (viewMode === "chart" ? buildProductShareSlices(filtered, "quantity", 10) : []),
    [filtered, viewMode]
  );

  const syncScroll = (source: "top" | "bottom") => {
    const top = topScrollRef.current;
    const bottom = tableScrollRef.current;
    if (!top || !bottom || syncingRef.current) return;
    syncingRef.current = true;
    if (source === "top") bottom.scrollLeft = top.scrollLeft;
    else top.scrollLeft = bottom.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  if (loading) {
    return <LoadingPanel />;
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  const copy = async () => {
    const table = [
      [...TABLE_HEADERS],
      ...filtered.map((r) => [
        r.normalized_name,
        r.raw_names.join("、"),
        String(r.total_quantity),
        formatMoney(r.total_revenue),
        `${Math.round(r.revenue_share * 1000) / 10}%`,
        String(r.batch_count),
        formatPrice(r.avg_unit_price),
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
        <div className="rounded bg-white p-3 shadow-sm text-sm">总销售额: {formatMoney(totalSales)}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">产品数量: {filtered.length}</div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">
          Top 1 销量: {topQty ? `${topQty.normalized_name} (${topQty.total_quantity})` : "-"}
        </div>
        <div className="rounded bg-white p-3 shadow-sm text-sm">
          Top 1 销售额: {topRev ? `${topRev.normalized_name} (${formatMoney(topRev.total_revenue)})` : "-"}
        </div>
      </div>

      {viewMode === "detail" ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex gap-2">
            <input
              className="w-full rounded border p-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按归一化名称或原始名称搜索（如 焦糖小泡芙、咸蛋黄小贝、香葱）"
            />
            <button onClick={copy} className="shrink-0 rounded bg-zinc-900 px-3 py-2 text-sm text-white">
              复制产品分析到 Excel
            </button>
          </div>

          {/* 顶部横向滚动条，与表格同步 */}
          <div
            ref={topScrollRef}
            onScroll={() => syncScroll("top")}
            className="mb-1 overflow-x-auto overflow-y-hidden"
            aria-hidden
          >
            <div className="h-3 min-w-[1100px]" />
          </div>

          <div
            ref={tableScrollRef}
            onScroll={() => syncScroll("bottom")}
            className="overflow-x-auto"
          >
            <table className="min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={h}
                      className={`border px-2 py-2 text-left ${i === 0 ? "min-w-[120px] bg-zinc-100 md:sticky md:left-0 md:z-20 md:shadow-[2px_0_4px_rgba(0,0,0,0.06)]" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key} className="group">
                    <td className="min-w-[120px] border bg-white px-2 py-1 font-medium md:sticky md:left-0 md:z-10 md:shadow-[2px_0_4px_rgba(0,0,0,0.06)] group-hover:bg-zinc-50">
                      {r.normalized_name}
                    </td>
                    <td className="border px-2 py-1">
                      <RawNamesCell names={r.raw_names} />
                    </td>
                    <td className="border px-2 py-1">{r.total_quantity}</td>
                    <td className="border px-2 py-1">{formatMoney(r.total_revenue)}</td>
                    <td className="border px-2 py-1">{(r.revenue_share * 100).toFixed(1)}%</td>
                    <td className="border px-2 py-1">{r.batch_count}</td>
                    <td className="border px-2 py-1">{formatPrice(r.avg_unit_price)}</td>
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
              labels={chartTop.map((r) =>
                r.normalized_name.length > 8 ? `${r.normalized_name.slice(0, 8)}…` : r.normalized_name
              )}
              series={[{ name: "销量", color: "#6366f1", values: chartTop.map((r) => r.total_quantity) }]}
              yAxisLabel="销量"
            />
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">产品销售额排行柱状图（Top 10）</h2>
            <BarChart
              labels={chartTop.map((r) =>
                r.normalized_name.length > 8 ? `${r.normalized_name.slice(0, 8)}…` : r.normalized_name
              )}
              series={[{ name: "销售额", color: "#10b981", values: chartTop.map((r) => r.total_revenue) }]}
              formatValue={formatMoney}
              yAxisLabel="销售额 ($)"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">产品销售占比图（销售额 Top 10 + 其他）</h2>
              <DonutChart slices={revenueShare} formatValue={formatMoney} />
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
