"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SavedJielong } from "@/lib/types";
import { deleteJielong, getSavedJielongs } from "@/lib/storage";
import { sortByRecentDate } from "@/lib/sort";
import { formatBatchDisplayName, formatDateWithWeekday } from "@/lib/dateFormat";

export default function BatchesPage() {
  const [batches, setBatches] = useState<SavedJielong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await getSavedJielongs();
        if (active) setBatches([...saved].sort(sortByRecentDate));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (batchId: string) => {
    if (!window.confirm("确定删除此历史接龙？删除后无法恢复。")) return;
    try {
      await deleteJielong(batchId);
      const saved = await getSavedJielongs();
      setBatches([...saved].sort(sortByRecentDate));
    } catch (e) {
      window.alert(`删除失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">历史接龙</h1>
      </div>
      {loading ? (
        <div className="rounded-xl bg-white p-4 text-sm text-zinc-500 shadow-sm">正在加载...</div>
      ) : batches.length === 0 ? (
        <div className="rounded-xl bg-white p-4 text-sm text-zinc-600 shadow-sm">暂无接龙</div>
      ) : (
        batches.map((batch) => {
          const displayName = formatBatchDisplayName(batch.batch_name, batch.order_date);
          return (
            <div key={batch.batch_id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-sm text-zinc-600">
                    日期：{formatDateWithWeekday(batch.order_date)} · {(batch.total_amount ?? 0).toFixed(1)} · 客户{" "}
                    {(batch.customer_summary_rows ?? []).length}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleDelete(batch.batch_id)}
                    className="rounded-md bg-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-300"
                  >
                    删除
                  </button>
                  <Link
                    href={`/recognize?batch_id=${batch.batch_id}`}
                    className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    打开
                  </Link>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
