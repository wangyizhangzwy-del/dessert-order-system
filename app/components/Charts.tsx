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
}: {
  labels: string[];
  series: ChartSeries[];
  formatValue?: (n: number) => string;
}) {
  const width = chartWidth(labels.length);
  const max = axisMax(series.flatMap((s) => s.values));
  const groupW = SLOT_W * 0.6;
  const barW = groupW / Math.max(series.length, 1);
  const baseline = PAD_TOP + PLOT_H;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={HEIGHT} className="block" role="img">
        <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="#e4e4e7" />
        {labels.map((label, i) => {
          const slotX = 20 + i * SLOT_W;
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
              <text x={slotX + SLOT_W / 2} y={HEIGHT - 11} textAnchor="middle" fontSize="11" fill="#71717a">
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
}: {
  labels: string[];
  values: number[];
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const width = chartWidth(labels.length);
  const max = axisMax(values);
  const baseline = PAD_TOP + PLOT_H;
  const pointX = (i: number) => 20 + i * SLOT_W + SLOT_W / 2;
  const pointY = (v: number) => baseline - (v / max) * PLOT_H;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${pointX(i)} ${pointY(v)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={HEIGHT} className="block" role="img">
        <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="#e4e4e7" />
        {values.length > 1 ? <path d={path} fill="none" stroke={color} strokeWidth={2} /> : null}
        {values.map((v, i) => (
          <Fragment key={`${labels[i]}-${i}`}>
            <circle cx={pointX(i)} cy={pointY(v)} r={3.5} fill={color} />
            <text x={pointX(i)} y={pointY(v) - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill="#3f3f46">
              {formatValue(v)}
            </text>
            <text x={pointX(i)} y={HEIGHT - 11} textAnchor="middle" fontSize="11" fill="#71717a">
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
