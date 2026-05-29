"use client";

import { Fragment } from "react";

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

const HEIGHT = 240;
const PAD_TOP = 28;
const PAD_BOTTOM = 32;
const SLOT_W = 76;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

function chartWidth(count: number): number {
  return Math.max(count * SLOT_W + 40, 320);
}

function axisMax(values: number[]): number {
  const max = Math.max(0, ...values);
  return max > 0 ? max : 1;
}

// 分组柱状图，柱顶始终显示数值（不依赖 hover）。
export function BarChart({
  labels,
  series,
  formatValue = (n) => String(n),
  yAxisLabel = "销售额",
}: {
  labels: string[];
  series: ChartSeries[];
  formatValue?: (n: number) => string;
  yAxisLabel?: string;
}) {
  const width = chartWidth(labels.length);
  const leftPad = 36;
  const max = axisMax(series.flatMap((s) => s.values));
  const groupW = SLOT_W * 0.6;
  const barW = groupW / Math.max(series.length, 1);
  const baseline = PAD_TOP + PLOT_H;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={HEIGHT} className="block" role="img">
        <line x1={leftPad} y1={PAD_TOP} x2={leftPad} y2={baseline} stroke="#e4e4e7" />
        <line x1={leftPad} y1={baseline} x2={width} y2={baseline} stroke="#e4e4e7" />
        <text x={8} y={PAD_TOP + 8} fontSize="10" fill="#71717a" transform={`rotate(-90 8 ${PAD_TOP + 8})`}>
          {yAxisLabel}
        </text>
        {labels.map((label, i) => {
          const slotX = leftPad + i * SLOT_W;
          return (
            <Fragment key={`${label}-${i}`}>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const h = (v / max) * PLOT_H;
                const x = slotX + (SLOT_W - groupW) / 2 + si * barW;
                const y = baseline - h;
                return (
                  <Fragment key={s.name}>
                    <rect x={x} y={y} width={Math.max(barW - 4, 2)} height={h} rx={2} fill={s.color} />
                    <text
                      x={x + Math.max(barW - 4, 2) / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="#3f3f46"
                    >
                      {formatValue(v)}
                    </text>
                  </Fragment>
                );
              })}
              <text x={slotX + SLOT_W / 2} y={HEIGHT - 11} textAnchor="middle" fontSize="10" fill="#71717a">
                {label}
              </text>
            </Fragment>
          );
        })}
      </svg>
    </div>
  );
}

// 折线图，数据点上方始终显示数值（不依赖 hover）。
export function LineChart({
  labels,
  values,
  color = "#10b981",
  formatValue = (n) => String(n),
  yAxisLabel = "销售额",
}: {
  labels: string[];
  values: number[];
  color?: string;
  formatValue?: (n: number) => string;
  yAxisLabel?: string;
}) {
  const width = chartWidth(labels.length);
  const max = axisMax(values);
  const baseline = PAD_TOP + PLOT_H;
  const leftPad = 36;
  const pointX = (i: number) => leftPad + i * SLOT_W + SLOT_W / 2;
  const pointY = (v: number) => baseline - (v / max) * PLOT_H;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${pointX(i)} ${pointY(v)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={HEIGHT} className="block" role="img">
        <line x1={leftPad} y1={PAD_TOP} x2={leftPad} y2={baseline} stroke="#e4e4e7" />
        <line x1={leftPad} y1={baseline} x2={width} y2={baseline} stroke="#e4e4e7" />
        <text x={8} y={PAD_TOP + 8} fontSize="10" fill="#71717a" transform={`rotate(-90 8 ${PAD_TOP + 8})`}>
          {yAxisLabel}
        </text>
        {values.length > 1 ? <path d={path} fill="none" stroke={color} strokeWidth={2} /> : null}
        {values.map((v, i) => (
          <Fragment key={`${labels[i]}-${i}`}>
            <circle cx={pointX(i)} cy={pointY(v)} r={3.5} fill={color} />
            <text x={pointX(i)} y={pointY(v) - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill="#3f3f46">
              {formatValue(v)}
            </text>
            <text x={pointX(i)} y={HEIGHT - 11} textAnchor="middle" fontSize="10" fill="#71717a">
              {labels[i]}
            </text>
          </Fragment>
        ))}
      </svg>
    </div>
  );
}

export function ChartLegend({ series }: { series: { name: string; color: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

// 环形占比图（Top N + 其他）。
export function DonutChart({
  slices,
  formatValue = (n) => String(n),
  size = 220,
}: {
  slices: DonutSlice[];
  formatValue?: (n: number) => string;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const ir = r * 0.55;
  let angle = -Math.PI / 2;

  const arcs = slices.map((slice) => {
    const frac = total > 0 ? slice.value / total : 0;
    const sweep = frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const ix1 = cx + ir * Math.cos(angle + sweep);
    const iy1 = cy + ir * Math.sin(angle + sweep);
    const ix2 = cx + ir * Math.cos(angle);
    const iy2 = cy + ir * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;
    angle += sweep;
    return { ...slice, d, pct: total > 0 ? Math.round(frac * 1000) / 10 : 0 };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} role="img">
        {arcs.map((a) => (
          <path key={a.label} d={a.d} fill={a.color} stroke="#fff" strokeWidth={1} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#3f3f46">
          合计
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#71717a">
          {formatValue(total)}
        </text>
      </svg>
      <div className="min-w-[160px] space-y-1 text-xs text-zinc-700">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: a.color }} />
              {a.label}
            </span>
            <span className="tabular-nums text-zinc-500">
              {a.pct}% · {formatValue(a.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
