"use client";

import { useEffect, useMemo, useState } from "react";
import { getSavedJielongs } from "@/lib/storage";
import { buildPerformanceAnalytics, PerformanceSummary } from "@/lib/performanceAnalytics";
import { SavedJielong } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";
import { BarChart, LineChart } from "@/app/components/Charts";

function formatMoney(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(1);
}

const REVENUE_COLOR = "#10b981";
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDateWithWeekday(dateStr: string): string {
  const ts = parseOrderDate(dateStr);
  if (ts === null) return dateStr;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} 周${WEEKDAYS[d.getDay()]}`;
}

function toMd(dateStr: string): string {
  const ts = parseOrderDate(dateStr);
  if (ts === null) return dateStr;
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function batchMonth(orderDate?: string): number | null {
  const ts = parseOrderDate(orderDate);
  if (ts === null) return null;
  return new Date(ts).getMonth() + 1;
}

export default function PerformancePage() {
  const [savedBatches, setSavedBatches] = useState<SavedJielong[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await getSavedJielongs();
        if (active) setSavedBatches(saved);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const availableMonths = useMemo(() => {
    const set = new Set<number>();
    for (const b of savedBatches) {
      const m = batchMonth(b.order_date);
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a - b);
  }, [savedBatches]);

  const filteredBatches = useMemo(() => {
    if (selectedMonth === 0) return savedBatches;
    return savedBatches.filter((b) => batchMonth(b.order_date) === selectedMonth);
  }, [savedBatches, selectedMonth]);

  const data: PerformanceSummary | null = useMemo(
    () => (loading ? null : buildPerformanceAnalytics(filteredBatches)),
    [filteredBatches, loading]
  );

  if (loading || !data) {
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

  const labels = data.daily.map((d) => formatDateWithWeekday(d.date));
  const dateRange =
    data.daily.length > 0
      ? `${toMd(data.daily[0].date)} 至 ${toMd(data.daily[data.daily.length - 1].date)}`
      : "-";

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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedMonth(0)}
            className={`rounded px-3 py-1.5 text-sm ${selectedMonth === 0 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
          >
            全部
          </button>
          {availableMonths.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`rounded px-3 py-1.5 text-sm ${selectedMonth === m ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
            >
              {m}月
            </button>
          ))}
        </div>
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
        <h2 className="mb-2 text-lg font-semibold">销售额趋势</h2>
        <LineChart
          labels={labels}
          values={data.daily.map((d) => d.revenue)}
          color={REVENUE_COLOR}
          formatValue={formatMoney}
          yAxisLabel="销售额"
        />
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">销售额记录</h2>
        <BarChart
          labels={labels}
          series={[{ name: "销售额", color: REVENUE_COLOR, values: data.daily.map((d) => d.revenue) }]}
          formatValue={formatMoney}
          yAxisLabel="销售额"
        />
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm text-sm text-zinc-700">
        <p>
          日期范围：<span className="font-semibold">{dateRange}</span>
        </p>
        <p className="mt-1">
          总接龙数：<span className="font-semibold">{data.totalBatches}</span>
        </p>
        <p className="mt-1">
          总销售额：<span className="font-semibold">{formatMoney(data.totalRevenue)}</span>
        </p>
      </div>
    </div>
  );
}
