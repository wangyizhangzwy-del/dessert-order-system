"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Customer } from "@/lib/types";
import { getCustomers, updateCustomerAddress } from "@/lib/storage";
import { sortByRecentDate } from "@/lib/sort";
import { formatDateWithWeekday } from "@/lib/dateFormat";

export default function CustomerDetailPage() {
  const params = useParams<{ wechat_id: string }>();
  const wechatId = decodeURIComponent(params.wechat_id);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressDraft, setAddressDraft] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getCustomers();
        if (active) setCustomers(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const customer = useMemo(() => customers.find((c) => c.wechat_id === wechatId), [customers, wechatId]);
  const sortedHistory = useMemo(
    () => [...(customer?.order_history ?? [])].sort(sortByRecentDate),
    [customer]
  );
  const orderCount = new Set(sortedHistory.map((h) => h.batch_id)).size;

  useEffect(() => {
    setAddressDraft(customer?.default_address ?? "");
  }, [customer?.default_address, customer?.wechat_id]);

  const saveDefaultAddress = async () => {
    if (!customer) return;
    setAddressSaving(true);
    setAddressMessage("");
    try {
      const updated = await updateCustomerAddress(customer.wechat_id, addressDraft);
      setCustomers((prev) =>
        prev.map((c) => (c.wechat_id === updated.wechat_id ? updated : c))
      );
      setAddressMessage("默认地址已保存");
    } catch (e) {
      setAddressMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setAddressSaving(false);
    }
  };

  if (loading) return <div className="rounded-xl bg-white p-4 text-sm text-zinc-500 shadow-sm">正在加载...</div>;
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
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <p className="text-sm">点单次数：{orderCount}</p>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">默认地址</span>
            <input
              className="rounded border px-2 py-2"
              placeholder="输入客户默认派送地址（如 F8、888、The Grand）"
              value={addressDraft}
              onChange={(e) => setAddressDraft(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={saveDefaultAddress}
            disabled={addressSaving}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {addressSaving ? "保存中..." : "保存默认地址"}
          </button>
        </div>
        {addressMessage ? <p className="mt-2 text-sm text-zinc-600">{addressMessage}</p> : null}
        <button onClick={copyHistory} className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white">复制该客户历史订单到 Excel</button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">查看历史订单记录</h2>
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
                    <td className="border px-2 py-1">{idx === 0 ? formatDateWithWeekday(h.order_date) : ""}</td>
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
