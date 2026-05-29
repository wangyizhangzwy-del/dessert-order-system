"use client";

import { useEffect, useState } from "react";
import { getSavedJielongs } from "@/lib/storage";
import { buildPerformanceAnalytics, PerformanceSummary } from "@/lib/performanceAnalytics";
import { BarChart, ChartLegend, LineChart } from "@/app/components/Charts";

function formatMoney(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(1);
}

const ORDERS_COLOR = "#6366f1";
const QUANTITY_COLOR = "#f59e0b";
const CUSTOMER_COLOR = "#0ea5e9";
const REVENUE_COLOR = "#10b981";

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceSummary | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await getSavedJielongs();
      if (active) setData(buildPerformanceAnalytics(saved));
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-zinc-500">正在加载...</p>
      </div>
    );
  }

  if (data.daily.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h1 className="text-xl font-bold">业绩分析</h1>
        </div>
        <div className="rounded-xl bg-white p-8 text-center text-sm text-zinc-600 shadow-sm">
          暂无历史接龙数据，请先保存接龙后查看业绩分析。
        </div>
      </div>
    );
  }

  const labels = data.daily.map((d) => d.date);
  const kpis = [
    { label: "总销售额", value: formatMoney(data.totalRevenue) },
    { label: "总订单数", value: String(data.totalOrders) },
    { label: "总客户数", value: String(data.totalCustomers) },
    { label: "平均客单价", value: formatMoney(data.avgOrderValue) },
    { label: "总商品数量", value: String(data.totalQuantity) },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">业绩分析</h1>
        <p className="mt-1 text-sm text-zinc-500">基于历史接龙的销售业绩（按日期时间顺序，已排除示例订单）</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">每日销售额趋势</h2>
        <LineChart labels={labels} values={data.daily.map((d) => d.revenue)} color={REVENUE_COLOR} formatValue={formatMoney} />
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">每日订单数 / 商品数量</h2>
        <ChartLegend
          series={[
            { name: "订单数", color: ORDERS_COLOR },
            { name: "商品数量", color: QUANTITY_COLOR },
          ]}
        />
        <BarChart
          labels={labels}
          series={[
            { name: "订单数", color: ORDERS_COLOR, values: data.daily.map((d) => d.orderCount) },
            { name: "商品数量", color: QUANTITY_COLOR, values: data.daily.map((d) => d.productQuantity) },
          ]}
        />
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">每日客户数</h2>
        <BarChart
          labels={labels}
          series={[{ name: "客户数", color: CUSTOMER_COLOR, values: data.daily.map((d) => d.customerCount) }]}
        />
      </div>
    </div>
  );
}
