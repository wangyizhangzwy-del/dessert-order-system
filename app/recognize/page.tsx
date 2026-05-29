"use client";

import { MouseEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { parseWechatRelay } from "@/lib/parser";
import {
  getSavedJielongById,
  saveDraft,
  saveJielong,
} from "@/lib/storage";
import { IGNORE_LUMI_EXAMPLE_ORDER } from "@/lib/constants";
import { deliveryStatusSelectClass, paymentStatusSelectClass } from "@/lib/statusStyles";
import { TEST_RELAY_TEXT } from "@/lib/testRelay";
import { MenuItem, ParsedOrder } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";

type RowStatus = "success" | "warning" | "failed";

interface EditableRow {
  row_id: string;
  sequence: number;
  raw_line: string;
  wechat_id: string;
  sku_code: string;
  variant: string;
  flavor_combo: string;
  cake_name: string;
  display_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string;
  status: RowStatus;
  warning_reason: string;
  is_example: boolean;
}

interface CustomerSummaryRow {
  wechat_id: string;
  items_summary: string;
  customer_total: number;
  notes: string;
  status: RowStatus;
}

interface ProductionSummaryRow {
  key: string;
  sku_code: string;
  variant: string;
  cake_name: string;
  display_name: string;
  total_quantity: number;
}

interface GroupedExcelRow {
  date: string;
  customer: string;
  product: string;
  quantity: string;
  unit_price: string;
  customer_total: string;
  notes: string;
  delivery_status: string;
  payment_status: string;
}

interface CustomerFlags {
  delivered: boolean;
  paid: boolean;
}

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(n: number): string {
  return roundMoney(n).toFixed(1);
}

function formatPrice(n: number): string {
  const v = roundMoney(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function compactNotes(input: string): string {
  const cleaned = input.replace(/[（）()]/g, " ").replace(/\s+/g, " ").trim();
  const giftMatch = cleaned.match(/送\s*(\d+)/);
  if (giftMatch) return giftMatch[1];
  return cleaned;
}

// 产品名一律使用本次菜单解析出的标准名（display_name / cake_name），不做永久硬编码映射。
// 唯一例外：SKU 1 肉松小贝的口味短名。
function getShortProductName(row: EditableRow): string {
  if (row.sku_code.trim() === "1") {
    const variant = row.variant.trim();
    return variant ? `${variant}小贝` : row.display_name || row.cake_name || "肉松小贝";
  }
  if (row.sku_code.trim() === "8" && row.flavor_combo?.trim()) {
    const base = row.cake_name.trim() || row.display_name.trim();
    return `${base}（${row.flavor_combo.trim()}）`;
  }
  return row.display_name.trim() || row.cake_name.trim() || `SKU ${row.sku_code || "-"}`;
}

function toRows(orders: ParsedOrder[]): EditableRow[] {
  const rows: EditableRow[] = [];
  let sequence = 1;
  for (let oi = 0; oi < orders.length; oi += 1) {
    const order = orders[oi];
    const isExample = order.is_example ?? oi === 0;
    if (order.items.length === 0) {
      rows.push({
        row_id: `${order.id}_empty`,
        sequence,
        raw_line: order.raw_line,
        wechat_id: order.wechat_id,
        sku_code: "",
        variant: "",
        flavor_combo: "",
        cake_name: "",
        display_name: "",
        quantity: 1,
        unit_price: 0,
        line_total: 0,
        notes: order.notes,
        status: order.status,
        warning_reason: order.warning_reason ?? "",
        is_example: isExample,
      });
      sequence += 1;
      continue;
    }
    for (const item of order.items) {
      rows.push({
        row_id: `${order.id}_${sequence}`,
        sequence,
        raw_line: order.raw_line,
        wechat_id: order.wechat_id,
        sku_code: item.sku_code,
        variant: item.variant ?? "",
        flavor_combo: item.flavor_combo ?? "",
        cake_name: item.cake_name,
        display_name: item.display_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: roundMoney(item.quantity * item.unit_price),
        notes: order.notes,
        status: order.status,
        warning_reason: order.warning_reason ?? "",
        is_example: isExample,
      });
      sequence += 1;
    }
  }
  return rows;
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
}

function RecognizeLoading() {
  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-500">正在加载...</p>
      </div>
    </main>
  );
}

export default function RecognizePage() {
  return (
    <Suspense fallback={<RecognizeLoading />}>
      <RecognizePageInner />
    </Suspense>
  );
}

function RecognizePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingBatchId = searchParams.get("batch_id");
  const initialSaved = editingBatchId ? getSavedJielongById(editingBatchId) : undefined;
  const [rawText, setRawText] = useState(initialSaved?.raw_text ?? "");
  const [orderDate, setOrderDate] = useState(initialSaved?.order_date ?? "5.28");
  const [message, setMessage] = useState(initialSaved ? "已加载历史接龙，可继续编辑" : "");
  const [rows, setRows] = useState<EditableRow[]>((initialSaved?.editable_rows as EditableRow[]) ?? []);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialSaved?.menu_items ?? []);
  const [customerFlags, setCustomerFlags] = useState<Record<string, CustomerFlags>>(() => {
    const flags: Record<string, CustomerFlags> = {};
    initialSaved?.grouped_excel_rows?.forEach((r) => {
      if (!r.customer) return;
      flags[r.customer] = {
        delivered: r.delivery_status === "已送达",
        paid: r.payment_status === "已付款",
      };
    });
    return flags;
  });
  const [tableExpanded, setTableExpanded] = useState(false);
  const [batchName, setBatchName] = useState(initialSaved?.batch_name ?? `接龙-${new Date().toLocaleString()}`);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(
    initialSaved?.batch_id ?? editingBatchId ?? null
  );
  const [highlightRowId, setHighlightRowId] = useState<string>("");
  const [warningJumpIdx, setWarningJumpIdx] = useState(0);
  const [failedJumpIdx, setFailedJumpIdx] = useState(0);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onParse = () => {
    if (!rawText.trim()) {
      setMessage("请先粘贴接龙文本");
      return;
    }
    try {
      const parsed = parseWechatRelay(rawText);
      setMenuItems(parsed.menu_items);
      setRows(toRows(parsed.orders));
      setCustomerFlags(() => {
        const flags: Record<string, CustomerFlags> = {};
        parsed.orders.forEach((o) => {
          const key = o.wechat_id.trim();
          if (!key) return;
          flags[key] = { delivered: false, paid: false };
        });
        return flags;
      });
      setMessage(`识别完成：${parsed.orders.length} 行，warning ${parsed.warning_count}，failed ${parsed.failed_count}`);
    } catch {
      setRows([]);
      setMessage("识别失败，请检查文本格式");
    }
  };

  const normalizedRows = useMemo(
    () =>
      rows.map((row, idx) => ({
        ...row,
        sequence: idx + 1,
        quantity: Number.isFinite(row.quantity) ? row.quantity : 0,
        unit_price: Number.isFinite(row.unit_price) ? row.unit_price : 0,
        line_total: roundMoney((Number.isFinite(row.quantity) ? row.quantity : 0) * (Number.isFinite(row.unit_price) ? row.unit_price : 0)),
      })),
    [rows]
  );
  const effectiveRows = useMemo(
    () => normalizedRows.filter((r) => !r.is_example),
    [normalizedRows]
  );

  const customerSummary = useMemo(() => {
    const map = new Map<string, CustomerSummaryRow & { _items: string[] }>();
    for (const row of effectiveRows) {
      const key = row.wechat_id.trim() || "未填写微信号";
      const existing = map.get(key);
      const itemLabel = `${row.display_name || row.cake_name || `SKU ${row.sku_code || "-"}`}×${row.quantity}`;
      if (!existing) {
        map.set(key, {
          wechat_id: key,
          _items: [itemLabel],
          items_summary: "",
          customer_total: row.line_total,
          notes: row.notes,
          status: row.status,
        });
      } else {
        existing._items.push(itemLabel);
        existing.customer_total = roundMoney(existing.customer_total + row.line_total);
        if (row.notes && !existing.notes.includes(row.notes)) {
          existing.notes = `${existing.notes}${existing.notes ? "；" : ""}${row.notes}`;
        }
        if (existing.status !== "failed" && row.status === "failed") existing.status = "failed";
        else if (existing.status === "success" && row.status === "warning") existing.status = "warning";
      }
    }
    return [...map.values()].map((v) => ({
      wechat_id: v.wechat_id,
      items_summary: v._items.join("；"),
      customer_total: roundMoney(v.customer_total),
      notes: v.notes,
      status: v.status,
    }));
  }, [effectiveRows]);

  const productionSummary = useMemo(() => {
    const map = new Map<string, ProductionSummaryRow>();
    for (const row of effectiveRows) {
      const key = `${row.sku_code}__${row.variant}__${row.flavor_combo}__${row.cake_name}`;
      const display_name =
        row.display_name ||
        (row.sku_code === "8" && row.flavor_combo
          ? `${row.cake_name || "牛油酥皮小泡芙"}（${row.flavor_combo}）`
          : `${row.cake_name}${row.variant ? `-${row.variant}` : ""}`);
      const existing = map.get(key);
      if (existing) {
        existing.total_quantity += row.quantity;
      } else {
        map.set(key, {
          key,
          sku_code: row.sku_code,
          variant: row.variant,
          cake_name: row.cake_name,
          display_name,
          total_quantity: row.quantity,
        });
      }
    }
    return [...map.values()].sort((a, b) => Number(a.sku_code || 0) - Number(b.sku_code || 0));
  }, [effectiveRows]);

  const totalSales = useMemo(
    () => roundMoney(customerSummary.reduce((sum, c) => sum + c.customer_total, 0)),
    [customerSummary]
  );

  const warningCount = useMemo(
    () => effectiveRows.filter((r) => r.status === "warning").length,
    [effectiveRows]
  );
  const failedCount = useMemo(
    () => effectiveRows.filter((r) => r.status === "failed").length,
    [effectiveRows]
  );
  const warningRows = useMemo(() => effectiveRows.filter((r) => r.status === "warning"), [effectiveRows]);
  const failedRows = useMemo(() => effectiveRows.filter((r) => r.status === "failed"), [effectiveRows]);

  const jumpToRow = (rowId: string) => {
    const el = rowRefs.current[rowId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightRowId(rowId);
    window.setTimeout(() => setHighlightRowId(""), 2000);
  };

  const updateRow = (rowId: string, key: keyof EditableRow, value: string | number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.row_id !== rowId) return row;
        const next = { ...row, [key]: value } as EditableRow;
        if (key === "quantity" || key === "unit_price") {
          next.line_total = roundMoney(Number(next.quantity) * Number(next.unit_price));
        }
        if (key === "cake_name" || key === "variant" || key === "display_name") {
          if (!String(next.display_name).trim()) {
            if (next.sku_code === "8") {
              const base = next.cake_name.trim() || "牛油酥皮小泡芙";
              next.display_name = next.flavor_combo ? `${base}（${next.flavor_combo}）` : base;
            } else {
              next.display_name = `${next.cake_name}${next.variant ? `-${next.variant}` : ""}`;
            }
          }
        }
        if (key === "flavor_combo") {
          if (next.sku_code === "8") {
            const base = next.cake_name.trim() || "牛油酥皮小泡芙";
            next.display_name = next.flavor_combo ? `${base}（${next.flavor_combo}）` : base;
          }
        }
        return next;
      })
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        row_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sequence: prev.length + 1,
        raw_line: "",
        wechat_id: "",
        sku_code: "",
        variant: "",
        flavor_combo: "",
        cake_name: "",
        display_name: "",
        quantity: 1,
        unit_price: 0,
        line_total: 0,
        notes: "",
        status: "success",
        warning_reason: "",
        is_example: false,
      },
    ]);
  };

  const deleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.row_id !== rowId));
  };

  const buildCurrentOrders = (): ParsedOrder[] => {
    const map = new Map<string, EditableRow[]>();
    for (const row of effectiveRows) {
      const key = row.wechat_id.trim() || `unknown_${row.row_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(row);
    }
    return [...map.values()].map((group) => {
      const first = group[0];
      const items = group
        .filter((g) => g.sku_code || g.cake_name || g.display_name)
        .map((g) => ({
          sku_code: g.sku_code,
          variant: g.variant || undefined,
          flavor_combo: g.flavor_combo || undefined,
          cake_name: g.cake_name,
          display_name: g.display_name || `${g.cake_name}${g.variant ? `-${g.variant}` : ""}`,
          quantity: Number(g.quantity),
          unit_price: Number(g.unit_price),
          line_total: roundMoney(Number(g.quantity) * Number(g.unit_price)),
        }));
      const status =
        group.some((g) => g.status === "failed")
          ? "failed"
          : group.some((g) => g.status === "warning")
            ? "warning"
            : "success";
      return {
        id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        raw_line: first.raw_line,
        wechat_id: first.wechat_id,
        items,
        customer_total: roundMoney(items.reduce((sum, i) => sum + i.line_total, 0)),
        status,
        notes: group.map((g) => g.notes).filter(Boolean).join("；"),
        warning_reason: group.map((g) => g.warning_reason).filter(Boolean).join("；"),
      };
    });
  };

  const toTsv = (table: string[][]): string => table.map((r) => r.join("\t")).join("\n");

  const buildGroupedExcelRows = (): GroupedExcelRow[] => {
    const output: GroupedExcelRow[] = [];
    for (const customer of customerSummary) {
      const customerRows = effectiveRows.filter((r) => r.wechat_id === customer.wechat_id);
      const flags = customerFlags[customer.wechat_id] ?? { delivered: false, paid: false };
      customerRows.forEach((row, idx) => {
        output.push({
          date: idx === 0 ? orderDate : "",
          customer: idx === 0 ? customer.wechat_id : "",
          product: getShortProductName(row),
          quantity: String(row.quantity),
          unit_price: formatPrice(row.unit_price),
          customer_total: idx === 0 ? formatMoney(customer.customer_total) : "",
          notes: idx === 0 ? compactNotes(customer.notes) : "",
          delivery_status: idx === 0 ? (flags.delivered ? "已送达" : "未送达") : "",
          payment_status: idx === 0 ? (flags.paid ? "已付款" : "未付款") : "",
        });
      });
      output.push({
        date: "",
        customer: "",
        product: "",
        quantity: "",
        unit_price: "",
        customer_total: "",
        notes: "",
        delivery_status: "",
        payment_status: "",
      });
    }
    return output;
  };

  const toGroupedExcelTSV = (): string => {
    const table = [
      ["日期", "客户", "商品", "数量", "单价", "总金额", "备注", "配送状态", "付款状态"],
      ...buildGroupedExcelRows().map((r) => [
        r.date,
        r.customer,
        r.product,
        r.quantity,
        r.unit_price,
        r.customer_total,
        r.notes,
        r.delivery_status,
        r.payment_status,
      ]),
    ];
    return toTsv(table);
  };

  const copyOrderDetail = async () => {
    const header = [
      "序号",
      "raw_line",
      "wechat_id",
      "sku_code",
      "variant",
      "flavor_combo",
      "cake_name",
      "display_name",
      "quantity",
      "unit_price",
      "line_total",
      "notes",
      "status",
      "warning_reason",
    ];
    const table = [
      header,
      ...normalizedRows.map((r) => [
        String(r.sequence),
        r.raw_line,
        r.wechat_id,
        r.sku_code,
        r.variant,
        r.flavor_combo,
        r.cake_name,
        r.display_name,
        String(r.quantity),
        formatPrice(r.unit_price),
        formatMoney(r.line_total),
        r.notes,
        r.status,
        r.warning_reason,
      ]),
    ];
    try {
      await copyText(toTsv(table));
      setMessage("已复制订单明细到剪贴板，可以粘贴到 Excel");
    } catch {
      setMessage("复制失败，请重试");
    }
  };

  const copyCustomerSummary = async () => {
    const table = [
      ["客户", "商品汇总", "客户总金额", "备注", "状态"],
      ...customerSummary.map((c) => [
        c.wechat_id,
        c.items_summary,
        formatMoney(c.customer_total),
        c.notes,
        c.status,
      ]),
    ];
    try {
      await copyText(toTsv(table));
      setMessage("已复制客户汇总到剪贴板，可以粘贴到 Excel");
    } catch {
      setMessage("复制失败，请重试");
    }
  };

  const copyProduction = async () => {
    const table = [
      ["SKU", "口味", "商品名称", "显示名称", "总数量", "本次接龙总金额"],
      ...productionSummary.map((r, idx) => [
        r.sku_code,
        r.variant,
        r.cake_name,
        r.display_name,
        String(r.total_quantity),
        idx === 0 ? String(roundMoney(totalSales)) : "",
      ]),
    ];
    try {
      await copyText(toTsv(table));
      setMessage("已复制到剪贴板，可以粘贴到 Excel");
    } catch {
      setMessage("复制失败，请重试");
    }
  };

  const copyGroupedExcel = async () => {
    try {
      await copyText(toGroupedExcelTSV());
      setMessage("已复制到剪贴板，可以粘贴到 Excel");
    } catch {
      setMessage("复制失败，请重试");
    }
  };

  const saveBatch = () => {
    try {
      const orders = buildCurrentOrders();
      saveDraft({ raw_text: rawText, menu_items: menuItems, orders });
      const groupedRows = buildGroupedExcelRows();
      const batchId = currentBatchId ?? `batch_${Date.now()}`;
      const payload = {
        batch_id: batchId,
        batch_name: batchName,
        order_date: orderDate,
        raw_text: rawText,
        menu_items: menuItems,
        parsed_orders: orders,
        editable_rows: normalizedRows,
        customer_summary_rows: customerSummary,
        production_summary_rows: productionSummary.map((r) => ({
          key: r.key,
          sku_code: r.sku_code,
          variant: r.variant,
          cake_name: r.cake_name,
          display_name: r.display_name,
          total_quantity: r.total_quantity,
        })),
        grouped_excel_rows: groupedRows,
        total_amount: totalSales,
        warning_count: warningCount,
        failed_count: failedCount,
        ignore_example_order: IGNORE_LUMI_EXAMPLE_ORDER,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const saved = saveJielong(payload);
      setCurrentBatchId(saved.batch_id);
      router.replace(`/recognize?batch_id=${saved.batch_id}`);
      setMessage("已保存本次接龙（可在历史接龙继续编辑）");
    } catch {
      setMessage("保存失败，请重试");
    }
  };

  const updateCustomerFlag = (wechatId: string, key: keyof CustomerFlags, value: boolean) => {
    setCustomerFlags((prev) => ({
      ...prev,
      [wechatId]: {
        delivered: prev[wechatId]?.delivered ?? false,
        paid: prev[wechatId]?.paid ?? false,
        [key]: value,
      },
    }));
  };

  const onAnyButtonClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      setMessage("操作已执行");
    }
  };

  if (!mounted) {
    return <RecognizeLoading />;
  }

  return (
    <div className="space-y-4" onClickCapture={onAnyButtonClick}>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <textarea
          className="min-h-[360px] w-full rounded-lg border p-3 text-sm"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="在这里粘贴接龙文本"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              setRawText(TEST_RELAY_TEXT);
              setMessage("已加载测试接龙");
            }}
            className="rounded-lg bg-zinc-200 px-4 py-3 text-sm font-medium"
          >
            加载测试接龙
          </button>
          <button onClick={onParse} className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white">
            识别接龙
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-zinc-700">{message}</p> : null}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="接龙名称"
          />
          <label className="text-sm font-medium">订单日期</label>
          <input
            className="rounded border px-3 py-2 text-sm"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            placeholder="如 5.28"
          />
          <button
            onClick={copyGroupedExcel}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            复制订单记录表到 Excel
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <h2 className="text-lg font-semibold">订单明细可编辑表格</h2>
          <button
            disabled={warningRows.length === 0}
            onClick={() => {
              if (warningRows.length === 0) return;
              const row = warningRows[warningJumpIdx % warningRows.length];
              jumpToRow(row.row_id);
              setWarningJumpIdx((i) => i + 1);
            }}
            className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-700 disabled:opacity-50"
          >
            Warning: {warningRows.length}
          </button>
          <button
            disabled={failedRows.length === 0}
            onClick={() => {
              if (failedRows.length === 0) return;
              const row = failedRows[failedJumpIdx % failedRows.length];
              jumpToRow(row.row_id);
              setFailedJumpIdx((i) => i + 1);
            }}
            className="rounded bg-red-100 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            Failed: {failedRows.length}
          </button>
          <button
            onClick={() => setTableExpanded((v) => !v)}
            className="rounded bg-indigo-100 px-3 py-2 text-sm text-indigo-700"
          >
            {tableExpanded ? "缩小到3行" : "完全展开"}
          </button>
          <button onClick={addRow} className="rounded bg-zinc-200 px-3 py-2 text-sm">新增明细行</button>
          <button
            onClick={copyOrderDetail}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            复制订单明细到 Excel
          </button>
        </div>
        <div
          className={`mt-3 overflow-x-auto overflow-y-auto border rounded ${
            tableExpanded ? "max-h-none" : "max-h-[230px]"
          }`}
        >
          <table className="min-w-[1500px] border-collapse text-sm">
            <thead>
              <tr>
                {["序号", "raw_line", "wechat_id", "sku_code", "variant", "flavor_combo", "cake_name", "display_name", "quantity", "unit_price", "line_total", "notes", "status", "warning_reason", "操作"].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 border bg-zinc-100 px-2 py-2 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizedRows.map((row) => (
                <tr
                  key={row.row_id}
                  ref={(el) => {
                    rowRefs.current[row.row_id] = el;
                  }}
                  className={
                    highlightRowId === row.row_id
                      ? "ring-2 ring-indigo-400"
                      : row.is_example
                      ? "bg-blue-50"
                      : row.status === "failed"
                      ? "bg-red-50"
                      : row.status === "warning"
                        ? "bg-amber-50"
                        : "bg-white"
                  }
                >
                  <td className="border px-2 py-1">{row.sequence}</td>
                  <td className="border px-2 py-1"><input className="w-56 rounded border p-1" value={row.raw_line} onChange={(e) => updateRow(row.row_id, "raw_line", e.target.value)} /></td>
                  <td className="border px-2 py-1"><input className="w-36 rounded border p-1" value={row.wechat_id} onChange={(e) => updateRow(row.row_id, "wechat_id", e.target.value)} /></td>
                  <td className="border px-2 py-1"><input className="w-20 rounded border p-1" value={row.sku_code} onChange={(e) => updateRow(row.row_id, "sku_code", e.target.value)} /></td>
                  <td className="border px-2 py-1"><input className="w-20 rounded border p-1" value={row.variant} onChange={(e) => updateRow(row.row_id, "variant", e.target.value)} /></td>
                  <td className="border px-2 py-1"><input className="w-44 rounded border p-1" value={row.flavor_combo} onChange={(e) => updateRow(row.row_id, "flavor_combo", e.target.value)} placeholder="口味组合" /></td>
                  <td className="border px-2 py-1"><input className="w-44 rounded border p-1" value={row.cake_name} onChange={(e) => updateRow(row.row_id, "cake_name", e.target.value)} /></td>
                  <td className="border px-2 py-1"><input className="w-44 rounded border p-1" value={row.display_name} onChange={(e) => updateRow(row.row_id, "display_name", e.target.value)} /></td>
                  <td className="border px-2 py-1"><input type="number" className="w-20 rounded border p-1" value={row.quantity} onChange={(e) => updateRow(row.row_id, "quantity", Number(e.target.value || 0))} /></td>
                  <td className="border px-2 py-1"><input type="number" step="0.01" className="w-24 rounded border p-1" value={row.unit_price} onChange={(e) => updateRow(row.row_id, "unit_price", Number(e.target.value || 0))} /></td>
                  <td className="border px-2 py-1">{formatMoney(row.line_total)}</td>
                  <td className="border px-2 py-1"><input className="w-28 rounded border p-1" value={row.notes} onChange={(e) => updateRow(row.row_id, "notes", e.target.value)} /></td>
                  <td className="border px-2 py-1">
                    {row.is_example ? (
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">example</span>
                    ) : (
                      <select className="rounded border p-1" value={row.status} onChange={(e) => updateRow(row.row_id, "status", e.target.value as RowStatus)}>
                      <option value="success">success</option>
                      <option value="warning">warning</option>
                      <option value="failed">failed</option>
                      </select>
                    )}
                  </td>
                  <td className="border px-2 py-1"><input className="w-40 rounded border p-1" value={row.warning_reason} onChange={(e) => updateRow(row.row_id, "warning_reason", e.target.value)} /></td>
                  <td className="border px-2 py-1">
                    <button onClick={() => deleteRow(row.row_id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">订单记录表预览</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100">
                {["日期", "客户", "商品", "数量", "单价", "总金额", "备注", "配送状态", "付款状态"].map((h) => (
                  <th key={h} className="border px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildGroupedExcelRows().map((row, idx) => (
                <tr key={`grouped_${idx}`}>
                  <td className="border px-2 py-1">{row.date}</td>
                  <td className="border px-2 py-1">{row.customer}</td>
                  <td className="border px-2 py-1">{row.product}</td>
                  <td className="border px-2 py-1">{row.quantity}</td>
                  <td className="border px-2 py-1">{row.unit_price}</td>
                  <td className="border px-2 py-1">{row.customer_total}</td>
                  <td className="border px-2 py-1">{row.notes}</td>
                  <td className="border px-2 py-1">
                    {row.customer ? (
                      <select
                        className={deliveryStatusSelectClass(
                          customerFlags[row.customer]?.delivered ?? false
                        )}
                        value={(customerFlags[row.customer]?.delivered ?? false) ? "已送达" : "未送达"}
                        onChange={(e) =>
                          updateCustomerFlag(row.customer, "delivered", e.target.value === "已送达")
                        }
                      >
                        <option value="未送达">未送达</option>
                        <option value="已送达">已送达</option>
                      </select>
                    ) : null}
                  </td>
                  <td className="border px-2 py-1">
                    {row.customer ? (
                      <select
                        className={paymentStatusSelectClass(customerFlags[row.customer]?.paid ?? false)}
                        value={(customerFlags[row.customer]?.paid ?? false) ? "已付款" : "未付款"}
                        onChange={(e) =>
                          updateCustomerFlag(row.customer, "paid", e.target.value === "已付款")
                        }
                      >
                        <option value="未付款">未付款</option>
                        <option value="已付款">已付款</option>
                      </select>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <h2 className="text-lg font-semibold">客户汇总预览</h2>
          <button onClick={copyCustomerSummary} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">复制客户汇总到 Excel</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100">
                {["客户", "商品汇总", "客户总金额", "备注", "状态"].map((h) => (
                  <th key={h} className="border px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customerSummary.map((row) => (
                <tr key={`cs_${row.wechat_id}`}>
                  <td className="border px-2 py-1">{row.wechat_id}</td>
                  <td className="border px-2 py-1">{row.items_summary}</td>
                  <td className="border px-2 py-1">{formatMoney(row.customer_total)}</td>
                  <td className="border px-2 py-1">{row.notes}</td>
                  <td className="border px-2 py-1">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <h2 className="text-lg font-semibold">制作汇总预览</h2>
          <button onClick={copyProduction} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">复制制作汇总到 Excel</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-100">
                {["sku_code", "display_name", "total_quantity", "total_revenue"].map((h) => (
                  <th key={h} className="border px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productionSummary.map((row, idx) => (
                <tr key={row.key}>
                  <td className="border px-2 py-1">{row.sku_code}</td>
                  <td className="border px-2 py-1">{row.display_name}</td>
                  <td className="border px-2 py-1">{row.total_quantity}</td>
                  <td className="border px-2 py-1">{idx === 0 ? formatMoney(totalSales) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">统计与保存</h2>
        <p className="mt-2 text-sm">总销售额：<span className="font-semibold">{formatMoney(totalSales)}</span></p>
        <p className="text-sm">warning 数量：<span className="font-semibold text-amber-700">{warningCount}</span></p>
        <p className="text-sm">failed 数量：<span className="font-semibold text-red-700">{failedCount}</span></p>
        <button onClick={saveBatch} className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white">
          保存本次接龙
        </button>
      </div>
    </div>
  );
}
