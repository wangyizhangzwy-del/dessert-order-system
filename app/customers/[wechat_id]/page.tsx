"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getCustomers } from "@/lib/storage";
import { sortByRecentDate } from "@/lib/sort";

export default function CustomerDetailPage() {
  const params = useParams<{ wechat_id: string }>();
  const wechatId = decodeURIComponent(params.wechat_id);
  const [customers] = useState(() => getCustomers());
  const customer = useMemo(() => customers.find((c) => c.wechat_id === wechatId), [customers, wechatId]);
  const sortedHistory = useMemo(
    () => [...(customer?.order_history ?? [])].sort(sortByRecentDate),
    [customer]
  );

  if (!customer) return <div className="rounded-xl bg-white p-4 shadow-sm">客户不存在</div>;

  const copyHistory = async () => {
    const rows = [["日期", "接龙名称", "商品名称", "SKU", "口味", "flavor_combo", "数量", "单价", "小计", "本单总金额", "notes"]];
    sortedHistory.forEach((h) => {
      h.items.forEach((it, idx) => {
        rows.push([
          idx === 0 ? h.order_date : "",
          idx === 0 ? h.batch_name : "",
          it.display_name,
          it.sku_code,
          it.variant ?? "",
          it.flavor_combo ?? "",
          String(it.quantity),
          String(it.unit_price),
          String(it.line_total),
          idx === 0 ? String(h.customer_total) : "",
          idx === 0 ? h.notes : "",
        ]);
      });
    });
    await navigator.clipboard.writeText(rows.map((r) => r.join("\t")).join("\n"));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold">{customer.wechat_id}</h1>
          <Link href="/customers" className="rounded bg-zinc-200 px-3 py-1 text-sm">返回客户列表</Link>
        </div>
        <p className="mt-2 text-sm">点单次数：{new Set(sortedHistory.map((h) => h.batch_id)).size}</p>
        <button onClick={copyHistory} className="mt-2 rounded bg-zinc-900 px-3 py-2 text-sm text-white">复制该客户历史订单到 Excel</button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">历史订单</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100">
                {["日期", "接龙名称", "商品名称", "SKU", "口味", "flavor_combo", "数量", "单价", "小计", "本单总金额", "notes"].map((h) => (
                  <th key={h} className="border px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((h) =>
                h.items.map((it, idx) => (
                  <tr key={`${h.batch_id}_${idx}`}>
                    <td className="border px-2 py-1">{idx === 0 ? h.order_date : ""}</td>
                    <td className="border px-2 py-1">{idx === 0 ? h.batch_name : ""}</td>
                    <td className="border px-2 py-1">{it.display_name}</td>
                    <td className="border px-2 py-1">{it.sku_code}</td>
                    <td className="border px-2 py-1">{it.variant ?? ""}</td>
                    <td className="border px-2 py-1">{it.flavor_combo ?? ""}</td>
                    <td className="border px-2 py-1">{it.quantity}</td>
                    <td className="border px-2 py-1">{it.unit_price}</td>
                    <td className="border px-2 py-1">{it.line_total}</td>
                    <td className="border px-2 py-1">{idx === 0 ? h.customer_total : ""}</td>
                    <td className="border px-2 py-1">{idx === 0 ? h.notes : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
