"use client";

import { useState } from "react";
import Link from "next/link";
import { SavedJielong } from "@/lib/types";
import { deleteJielong, getSavedJielongs } from "@/lib/storage";
import { sortByRecentDate } from "@/lib/sort";

function parseOrderDateForIndex(orderDate?: string): number {
  if (!orderDate) return 0;
  const ts = Date.parse(orderDate);
  if (!Number.isNaN(ts)) return ts;
  const md = orderDate.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (md) {
    const y = new Date().getFullYear();
    return new Date(y, Number(md[1]) - 1, Number(md[2])).getTime();
  }
  return 0;
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<SavedJielong[]>(() => getSavedJielongs().sort(sortByRecentDate));
  const nameMap = (() => {
    const asc = [...batches].sort((a, b) => {
      const ta = parseOrderDateForIndex(a.order_date) || Date.parse(a.created_at ?? "") || 0;
      const tb = parseOrderDateForIndex(b.order_date) || Date.parse(b.created_at ?? "") || 0;
      if (ta !== tb) return ta - tb;
      return (Date.parse(a.created_at ?? "") || 0) - (Date.parse(b.created_at ?? "") || 0);
    });
    const map = new Map<string, string>();
    const year = new Date().getFullYear();
    asc.forEach((batch, idx) => {
      map.set(batch.batch_id, `${year}-${idx + 1}-${batch.order_date || "未标日期"}`);
    });
    return map;
  })();

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">历史接龙</h1>
      </div>
      {batches.length === 0 ? (
        <div className="rounded-xl bg-white p-4 text-sm text-zinc-600 shadow-sm">暂无接龙</div>
      ) : (
        batches.map((batch) => (
          <div key={batch.batch_id} className="rounded-xl bg-white p-4 shadow-sm">
            <Link href={`/recognize?batch_id=${batch.batch_id}`} className="block">
              <p className="font-semibold">{nameMap.get(batch.batch_id) ?? batch.batch_name}</p>
              <p className="text-sm text-zinc-600">
                {batch.order_date} · {(batch.total_amount ?? 0).toFixed(1)} · 客户 {(batch.customer_summary_rows ?? []).length}
              </p>
            </Link>
            <div className="mt-2 flex gap-2">
              <Link href={`/recognize?batch_id=${batch.batch_id}`} className="rounded bg-zinc-900 px-3 py-1 text-xs text-white">打开</Link>
              <button
                onClick={() => {
                  deleteJielong(batch.batch_id);
                  setBatches(getSavedJielongs().sort(sortByRecentDate));
                }}
                className="rounded bg-red-100 px-3 py-1 text-xs text-red-700"
              >
                删除
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
