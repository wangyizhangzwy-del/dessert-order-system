"use client";

import { MouseEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { parseWechatRelay } from "@/lib/parser";
import {
  clearDraft,
  deleteJielong,
  getCustomers,
  getSavedJielongById,
  isCloudBackend,
  saveDraft,
  saveJielong,
} from "@/lib/storage";
import { IGNORE_LUMI_EXAMPLE_ORDER } from "@/lib/constants";
import {
  deliveryModeLabel,
  DeliveryMode,
  DeliveryModeState,
  resolveDeliveryMode,
} from "@/lib/deliveryMode";
import {
  chineseWeekday,
  defaultOrderDateString,
  formatDateWithWeekday,
  generateBatchName,
  isAutoBatchName,
} from "@/lib/dateFormat";
import { MenuItem, ParsedOrder } from "@/lib/types";
import { formatMoney, formatPrice, roundMoney } from "@/lib/moneyFormat";
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
  production_status: string;
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
  production_status: string;
}

interface CustomerFlags {
  delivered: boolean;
  paid: boolean;
}

function compactNotes(input: string): string {
  const cleaned = input.replace(/[（）()]/g, " ").replace(/\s+/g, " ").trim();
  const giftMatch = cleaned.match(/送\s*(\d+)/);
  if (giftMatch) return giftMatch[1];
  return cleaned;
}

// 备注分类（用于客户汇总预览排序）：
// 公寓楼名（如 送888/888、送f8/f8，"送"前缀视为同一栋）放最上面并按楼名分组，
// 其次自取，再次叫车，最后无备注/其他。
function deliveryNoteKey(rawNotes: string): { category: number; group: string } {
  const note = (rawNotes ?? "").trim();
  if (!note) return { category: 3, group: "" };
  const core = note.replace(/^送\s*/, "").replace(/\s+/g, "").toLowerCase();
  if (core.includes("自取")) return { category: 1, group: "自取" };
  if (core.includes("叫车") || core.includes("打车")) return { category: 2, group: "叫车" };
  return { category: 0, group: core };
}

/** 订单记录表显示完整原始商品名（非 normalized、非仅 SKU）。 */
function getOrderRecordProductName(row: EditableRow): string {
  if (row.sku_code.trim() === "1" && row.variant.trim()) {
    return row.display_name.trim() || `${row.variant.trim()}小贝`;
  }
  if (row.sku_code.trim() === "8" && row.flavor_combo?.trim()) {
    const base = row.cake_name.trim() || row.display_name.trim();
    return base.includes(row.flavor_combo.trim())
      ? base
      : `${base}（${row.flavor_combo.trim()}）`;
  }
  return row.cake_name.trim() || row.display_name.trim();
}

function customerKey(wechatId: string): string {
  return wechatId.trim() || "未填写微信号";
}

/** 同一客户订单的制作状态保持一致（加载历史接龙时归一化）。 */
function normalizeProductionStatusByCustomer(rows: EditableRow[]): EditableRow[] {
  const statusByCustomer = new Map<string, string>();
  for (const row of rows) {
    const key = customerKey(row.wechat_id);
    if (!statusByCustomer.has(key)) {
      statusByCustomer.set(key, row.production_status ?? "未制作");
    }
  }
  return rows.map((row) => ({
    ...row,
    production_status: statusByCustomer.get(customerKey(row.wechat_id)) ?? "未制作",
  }));
}

function statusSelectClass(
  kind: "production" | "payment",
  value: string
): string {
  const base = "w-full min-w-0 rounded border px-1 py-1 text-xs text-center";
  if (kind === "production" && value === "已制作") {
    return `${base} border-red-200 bg-red-50 text-red-700`;
  }
  if (kind === "payment" && value === "已付款") {
    return `${base} border-green-200 bg-green-50 text-green-700`;
  }
  return `${base} border-zinc-200 bg-white text-zinc-700`;
}

function needsDeliveryFromMode(mode: DeliveryMode): boolean {
  return mode !== "pickup";
}

function needsDeliverySelectClass(needs: boolean): string {
  const base = "h-6 w-full rounded border px-0.5 text-xs text-center leading-none";
  if (needs) return `${base} border-red-300 bg-red-100 font-medium text-red-800`;
  return `${base} border-zinc-200 bg-white text-zinc-600`;
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
        production_status: "未制作",
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
        production_status: "未制作",
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
  const [rawText, setRawText] = useState("");
  const [orderDate, setOrderDate] = useState(defaultOrderDateString);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customerFlags, setCustomerFlags] = useState<Record<string, CustomerFlags>>({});
  const [batchName, setBatchName] = useState(() => generateBatchName(defaultOrderDateString()));
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(editingBatchId ?? null);
  const [highlightRowId, setHighlightRowId] = useState<string>("");
  const [warningJumpIdx, setWarningJumpIdx] = useState(0);
  const [failedJumpIdx, setFailedJumpIdx] = useState(0);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [customerNotesEdits, setCustomerNotesEdits] = useState<Record<string, string>>({});
  const [customerAddresses, setCustomerAddresses] = useState<Record<string, string>>({});
  const [deliveryModes, setDeliveryModes] = useState<Record<string, DeliveryModeState>>({});
  const [deliveryModeManual, setDeliveryModeManual] = useState<Record<string, boolean>>({});
  const [customerNeedsDelivery, setCustomerNeedsDelivery] = useState<Record<string, boolean>>({});
  const [customerNeedsDeliveryManual, setCustomerNeedsDeliveryManual] = useState<Record<string, boolean>>({});
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveError, setAutosaveError] = useState("");
  const skipAutosaveRef = useRef(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExistingBatch = Boolean(editingBatchId && currentBatchId);

  useEffect(() => {
    setMounted(true);
    (async () => {
      const customers = await getCustomers();
      const addrMap: Record<string, string> = {};
      for (const c of customers) {
        if (c.default_address) addrMap[c.wechat_id] = c.default_address;
      }
      setCustomerAddresses(addrMap);
    })();
  }, []);

  useEffect(() => {
    if (!editingBatchId) return;
    let active = true;
    (async () => {
      const saved = await getSavedJielongById(editingBatchId);
      if (!active || !saved) return;
      setRawText(saved.raw_text ?? "");
      setOrderDate(saved.order_date ?? defaultOrderDateString());
      const loadedRows = normalizeProductionStatusByCustomer(
        ((saved.editable_rows as EditableRow[]) ?? []).map((r) => ({
          ...r,
          production_status: r.production_status ?? "未制作",
        }))
      );
      setRows(loadedRows);
      setMenuItems(saved.menu_items ?? []);
      setBatchName(saved.batch_name ?? generateBatchName(saved.order_date ?? defaultOrderDateString()));
      setCurrentBatchId(saved.batch_id);
      const flags: Record<string, CustomerFlags> = {};
      saved.grouped_excel_rows?.forEach((r) => {
        if (!r.customer) return;
        flags[r.customer] = {
          delivered: r.delivery_status === "已送达",
          paid: r.payment_status === "已付款",
        };
      });
      setCustomerFlags(flags);
      const notesEdits: Record<string, string> = {};
      const modes: Record<string, DeliveryModeState> = {};
      const manual: Record<string, boolean> = {};
      const needsDelivery: Record<string, boolean> = {};
      const needsDeliveryManual: Record<string, boolean> = {};
      saved.customer_summary_rows?.forEach((c) => {
        if (c.notes) notesEdits[c.wechat_id] = c.notes;
        if (c.delivery_mode) {
          modes[c.wechat_id] = {
            mode: c.delivery_mode,
            customText: c.delivery_custom ?? "",
          };
          manual[c.wechat_id] = true;
        }
        if (typeof c.needs_delivery === "boolean") {
          needsDelivery[c.wechat_id] = c.needs_delivery;
          needsDeliveryManual[c.wechat_id] = true;
        }
      });
      setCustomerNotesEdits(notesEdits);
      setDeliveryModes(modes);
      setDeliveryModeManual(manual);
      setCustomerNeedsDelivery(needsDelivery);
      setCustomerNeedsDeliveryManual(needsDeliveryManual);
      skipAutosaveRef.current = true;
      setMessage("已加载历史接龙，可继续编辑");
    })();
    return () => {
      active = false;
    };
  }, [editingBatchId]);

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
      setCustomerNotesEdits({});
      setDeliveryModes({});
      setDeliveryModeManual({});
      setCustomerNeedsDelivery({});
      setCustomerNeedsDeliveryManual({});
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

  // 客户汇总预览按备注分组排序：公寓楼（送888/888、送f8/f8 同栋）在最上面并按楼名相邻，
  // 然后自取，再然后叫车，最后无备注/其他。
  const customerSummaryByNotes = useMemo(
    () =>
      customerSummary
        .map((row, idx) => ({ row, idx, key: deliveryNoteKey(row.notes) }))
        .sort((a, b) => {
          if (a.key.category !== b.key.category) return a.key.category - b.key.category;
          if (a.key.group !== b.key.group) return a.key.group.localeCompare(b.key.group, "zh-Hans-CN");
          return a.idx - b.idx;
        })
        .map((x) => ({
          ...x.row,
          notes: customerNotesEdits[x.row.wechat_id] ?? x.row.notes,
        })),
    [customerSummary, customerNotesEdits]
  );

  const getCustomerNotes = (wechatId: string, fallback: string) =>
    customerNotesEdits[wechatId] ?? fallback;

  const getDeliveryModeForCustomer = (wechatId: string, notes: string): DeliveryModeState =>
    deliveryModes[wechatId] ??
    resolveDeliveryMode(notes, customerAddresses[wechatId]);

  const getNeedsDeliveryForCustomer = (wechatId: string, notes: string): boolean => {
    if (customerNeedsDeliveryManual[wechatId]) {
      return customerNeedsDelivery[wechatId] ?? true;
    }
    if (customerNeedsDelivery[wechatId] !== undefined) {
      return customerNeedsDelivery[wechatId];
    }
    const dm = getDeliveryModeForCustomer(wechatId, notes);
    return needsDeliveryFromMode(dm.mode);
  };

  const refreshCustomerAddresses = async () => {
    const customers = await getCustomers();
    const addrMap: Record<string, string> = {};
    for (const c of customers) {
      if (c.default_address) addrMap[c.wechat_id] = c.default_address;
    }
    setCustomerAddresses(addrMap);
  };

  const orderRecordEntries = useMemo(() => {
    const entries: {
      row: EditableRow;
      isFirst: boolean;
      rowSpan: number;
      customerTotal: number;
      wechatId: string;
      productionStatus: string;
    }[] = [];
    for (const customer of customerSummary) {
      const wechatId = customer.wechat_id;
      const customerRows = effectiveRows.filter(
        (r) => customerKey(r.wechat_id) === wechatId
      );
      const rowSpan = Math.max(customerRows.length, 1);
      const productionStatus = customerRows[0]?.production_status || "未制作";
      customerRows.forEach((row, idx) => {
        entries.push({
          row,
          isFirst: idx === 0,
          rowSpan,
          customerTotal: customer.customer_total,
          wechatId,
          productionStatus,
        });
      });
    }
    return entries;
  }, [effectiveRows, customerSummary]);

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
      const wechatId = customer.wechat_id;
      const customerRows = effectiveRows.filter(
        (r) => (r.wechat_id.trim() || "未填写微信号") === wechatId
      );
      const flags = customerFlags[wechatId] ?? { delivered: false, paid: false };
      const notes = getCustomerNotes(wechatId, customer.notes);
      customerRows.forEach((row, idx) => {
        output.push({
          date: idx === 0 ? formatDateWithWeekday(orderDate) : "",
          customer: idx === 0 ? wechatId : "",
          product: getOrderRecordProductName(row),
          quantity: String(row.quantity),
          unit_price: formatPrice(row.unit_price),
          customer_total: idx === 0 ? formatMoney(customer.customer_total) : "",
          notes: idx === 0 ? compactNotes(notes) : "",
          delivery_status: idx === 0 ? (flags.delivered ? "已送达" : "未送达") : "",
          payment_status: idx === 0 ? (flags.paid ? "已付款" : "未付款") : "",
          production_status: idx === 0 ? (customerRows[0]?.production_status || "未制作") : "",
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
        production_status: "",
      });
    }
    return output;
  };

  const toGroupedExcelTSV = (): string => {
    const table = [
      ["日期", "客户", "商品", "数量", "单价(美金)", "总金额(美金)", "备注", "制作状态", "付款状态"],
      ...buildGroupedExcelRows().map((r) => [
        r.date,
        r.customer,
        r.product,
        r.quantity,
        r.unit_price,
        r.customer_total,
        r.notes,
        r.production_status,
        r.payment_status,
      ]),
    ];
    return toTsv(table);
  };

  const copyCustomerSummary = async () => {
    const table = [
      ["客户", "商品汇总", "客户总金额(美金)", "配送", "派送"],
      ...customerSummaryByNotes.map((c) => [
        c.wechat_id,
        c.items_summary,
        formatMoney(c.customer_total),
        getNeedsDeliveryForCustomer(c.wechat_id, c.notes) ? "是" : "否",
        deliveryModeLabel(
          getDeliveryModeForCustomer(c.wechat_id, c.notes),
          customerAddresses[c.wechat_id]
        ),
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
      ["SKU", "口味", "商品名称", "显示名称", "总数量", "本次接龙总金额(美金)"],
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

  const orderDateWeekday = chineseWeekday(orderDate);

  const handleOrderDateChange = (value: string) => {
    setOrderDate(value);
    setBatchName((prev) => (isAutoBatchName(prev) ? generateBatchName(value) : prev));
  };

  const persistBatch = async (isAutosave: boolean) => {
    const orders = buildCurrentOrders();
    await saveDraft({ raw_text: rawText, menu_items: menuItems, orders });
    const summaryRows = customerSummary.map((c) => {
      const dm = getDeliveryModeForCustomer(
        c.wechat_id,
        getCustomerNotes(c.wechat_id, c.notes)
      );
      return {
        ...c,
        notes: getCustomerNotes(c.wechat_id, c.notes),
        delivery_mode: dm.mode,
        delivery_custom: dm.mode === "custom" ? dm.customText : undefined,
        needs_delivery: getNeedsDeliveryForCustomer(
          c.wechat_id,
          getCustomerNotes(c.wechat_id, c.notes)
        ),
      };
    });
    const groupedRows = buildGroupedExcelRows();
    const batchId = currentBatchId ?? `batch_${Date.now()}`;
    const resolvedBatchName = isAutoBatchName(batchName) ? generateBatchName(orderDate) : batchName;
    if (resolvedBatchName !== batchName) setBatchName(resolvedBatchName);
    const payload = {
      batch_id: batchId,
      batch_name: resolvedBatchName,
      order_date: orderDate,
      raw_text: rawText,
      menu_items: menuItems,
      parsed_orders: orders,
      editable_rows: normalizedRows,
      customer_summary_rows: summaryRows,
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
    const saved = await saveJielong(payload);
    setCurrentBatchId(saved.batch_id);
    await refreshCustomerAddresses();
    if (!isAutosave) {
      router.replace(`/recognize?batch_id=${saved.batch_id}`);
    }
    return saved;
  };

  const saveBatch = async () => {
    try {
      await persistBatch(false);
      setMessage(
        isCloudBackend()
          ? "已保存到云端 Supabase（可在历史接龙继续编辑）"
          : "已保存到本机（可在历史接龙继续编辑）"
      );
      setAutosaveStatus("saved");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setMessage(
        isCloudBackend()
          ? `保存到云端失败，数据未写入 Supabase：${detail}`
          : `保存失败，请重试：${detail}`
      );
    }
  };

  const deleteHistoricalBatch = async () => {
    if (!currentBatchId) return;
    if (!window.confirm("确定删除此历史接龙？删除后无法恢复。")) return;
    try {
      await deleteJielong(currentBatchId);
      await clearDraft();
      setMessage("已删除此历史接龙");
      router.push("/batches");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setMessage(`删除失败：${detail}`);
    }
  };

  const updateCustomerNotes = (wechatId: string, notes: string) => {
    setCustomerNotesEdits((prev) => ({ ...prev, [wechatId]: notes }));
    setDeliveryModeManual((prev) => ({ ...prev, [wechatId]: false }));
    setRows((prev) =>
      prev.map((r) =>
        (r.wechat_id.trim() || "未填写微信号") === wechatId ? { ...r, notes } : r
      )
    );
  };

  const updateProductionStatus = (wechatId: string, production_status: string) => {
    const key = customerKey(wechatId);
    setRows((prev) =>
      prev.map((r) => (customerKey(r.wechat_id) === key ? { ...r, production_status } : r))
    );
  };

  const updatePaymentStatus = (wechatId: string, paid: boolean) => {
    setCustomerFlags((prev) => ({
      ...prev,
      [wechatId]: { ...(prev[wechatId] ?? { delivered: false, paid: false }), paid },
    }));
  };

  const updateNeedsDelivery = (wechatId: string, needs: boolean) => {
    setCustomerNeedsDeliveryManual((prev) => ({ ...prev, [wechatId]: true }));
    setCustomerNeedsDelivery((prev) => ({ ...prev, [wechatId]: needs }));
  };

  const updateDeliveryMode = (wechatId: string, mode: DeliveryMode) => {
    setDeliveryModeManual((prev) => ({ ...prev, [wechatId]: true }));
    const notes = getCustomerNotes(
      wechatId,
      customerSummary.find((c) => c.wechat_id === wechatId)?.notes ?? ""
    );
    const resolved = resolveDeliveryMode(notes, customerAddresses[wechatId]);
    setDeliveryModes((prev) => ({
      ...prev,
      [wechatId]:
        mode === "custom"
          ? {
              mode: "custom",
              customText: prev[wechatId]?.customText || resolved.customText || notes.trim(),
            }
          : { mode, customText: "" },
    }));
    setCustomerNeedsDelivery((prev) => ({ ...prev, [wechatId]: needsDeliveryFromMode(mode) }));
    setCustomerNeedsDeliveryManual((prev) => ({ ...prev, [wechatId]: false }));
  };

  const updateDeliveryCustom = (wechatId: string, customText: string) => {
    setDeliveryModeManual((prev) => ({ ...prev, [wechatId]: true }));
    setDeliveryModes((prev) => ({
      ...prev,
      [wechatId]: { mode: "custom", customText },
    }));
  };

  useEffect(() => {
    setDeliveryModes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of customerSummary) {
        if (deliveryModeManual[c.wechat_id]) continue;
        const resolved = resolveDeliveryMode(
          getCustomerNotes(c.wechat_id, c.notes),
          customerAddresses[c.wechat_id]
        );
        const cur = next[c.wechat_id];
        if (!cur || cur.mode !== resolved.mode || cur.customText !== resolved.customText) {
          next[c.wechat_id] = resolved;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [customerSummary, customerNotesEdits, customerAddresses, deliveryModeManual]);

  useEffect(() => {
    setCustomerNeedsDelivery((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of customerSummary) {
        if (customerNeedsDeliveryManual[c.wechat_id]) continue;
        const mode =
          deliveryModes[c.wechat_id]?.mode ??
          resolveDeliveryMode(
            getCustomerNotes(c.wechat_id, c.notes),
            customerAddresses[c.wechat_id]
          ).mode;
        const resolved = needsDeliveryFromMode(mode);
        if (next[c.wechat_id] !== resolved) {
          next[c.wechat_id] = resolved;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    customerSummary,
    customerNotesEdits,
    customerAddresses,
    deliveryModes,
    deliveryModeManual,
    customerNeedsDeliveryManual,
  ]);

  // 历史接龙打开后，编辑内容 debounce 自动保存到 Supabase/local。
  useEffect(() => {
    if (!isExistingBatch || rows.length === 0) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    setAutosaveStatus("saving");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await persistBatch(true);
        setAutosaveStatus("saved");
        setAutosaveError("");
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        setAutosaveStatus("error");
        setAutosaveError(detail);
      }
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [
    rows,
    customerFlags,
    customerNotesEdits,
    customerNeedsDelivery,
    customerNeedsDeliveryManual,
    deliveryModes,
    deliveryModeManual,
    rawText,
    orderDate,
    batchName,
    menuItems,
    isExistingBatch,
  ]);

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
            onChange={(e) => handleOrderDateChange(e.target.value)}
            placeholder="如 2026-05-28 或 5/28"
          />
          {orderDateWeekday ? (
            <span className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-700">{orderDateWeekday}</span>
          ) : null}
          {orderDate ? (
            <span className="text-xs text-zinc-500">{formatDateWithWeekday(orderDate)}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">订单记录表</h2>
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
            onClick={copyGroupedExcel}
            className="rounded bg-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-300"
          >
            复制订单记录
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded border lg:overflow-x-visible">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm lg:min-w-0">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[34%]" />
              <col className="w-[5%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr className="bg-zinc-100">
                {["客户", "商品", "数量", "单价(美金)", "总金额(美金)", "备注", "制作状态", "付款状态"].map((h) => (
                  <th key={h} className="border bg-zinc-100 px-1.5 py-2 text-left text-xs font-medium leading-tight lg:px-2 lg:text-sm">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderRecordEntries.map(({ row, isFirst, rowSpan, customerTotal, wechatId, productionStatus }) => (
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
                  {isFirst ? (
                    <td rowSpan={rowSpan} className="border px-1.5 py-1.5 align-top break-words lg:px-2 lg:py-2">
                      {row.wechat_id}
                    </td>
                  ) : null}
                  <td className="border px-1.5 py-1.5 align-top text-xs leading-snug break-words whitespace-normal lg:px-2 lg:py-2 lg:text-sm">
                    {getOrderRecordProductName(row)}
                  </td>
                  <td className="border px-1 py-1.5 text-center align-top lg:px-2 lg:py-2">{row.quantity}</td>
                  <td className="border px-1 py-1.5 text-right align-top whitespace-nowrap lg:px-2 lg:py-2">
                    {formatPrice(row.unit_price)}
                  </td>
                  {isFirst ? (
                    <td rowSpan={rowSpan} className="border px-1 py-1.5 text-right align-top whitespace-nowrap lg:px-2 lg:py-2">
                      {formatMoney(customerTotal)}
                    </td>
                  ) : null}
                  {isFirst ? (
                    <td rowSpan={rowSpan} className="border px-1 py-1.5 align-top lg:px-2 lg:py-2">
                      <input
                        className="w-full max-w-full rounded border px-1 py-0.5 text-xs leading-snug lg:text-sm"
                        value={getCustomerNotes(wechatId, row.notes)}
                        onChange={(e) => updateCustomerNotes(wechatId, e.target.value)}
                      />
                    </td>
                  ) : null}
                  {isFirst ? (
                    <td rowSpan={rowSpan} className="border px-1 py-1.5 text-center align-top lg:px-2 lg:py-2">
                      <select
                        className={statusSelectClass("production", productionStatus)}
                        value={productionStatus}
                        onChange={(e) => updateProductionStatus(wechatId, e.target.value)}
                      >
                        <option value="未制作">未制作</option>
                        <option value="已制作">已制作</option>
                      </select>
                    </td>
                  ) : null}
                  {isFirst ? (
                    <td rowSpan={rowSpan} className="border px-1 py-1.5 text-center align-top lg:px-2 lg:py-2">
                      <select
                        className={statusSelectClass(
                          "payment",
                          customerFlags[wechatId]?.paid ? "已付款" : "未付款"
                        )}
                        value={customerFlags[wechatId]?.paid ? "已付款" : "未付款"}
                        onChange={(e) => updatePaymentStatus(wechatId, e.target.value === "已付款")}
                      >
                        <option value="未付款">未付款</option>
                        <option value="已付款">已付款</option>
                      </select>
                    </td>
                  ) : null}
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
        <div className="mt-3 overflow-x-auto lg:overflow-x-visible">
          <table className="w-full table-fixed border-collapse text-xs lg:min-w-0 lg:text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[36%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[34%]" />
            </colgroup>
            <thead>
              <tr className="bg-zinc-100">
                {["客户", "商品汇总", "金额", "配送", "派送"].map((h) => (
                  <th key={h} className="border px-1 py-1.5 text-left text-xs font-medium lg:px-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customerSummaryByNotes.map((row) => {
                const dm = getDeliveryModeForCustomer(row.wechat_id, row.notes);
                const defaultAddr = customerAddresses[row.wechat_id];
                const needsDelivery = getNeedsDeliveryForCustomer(row.wechat_id, row.notes);
                return (
                <tr key={`cs_${row.wechat_id}`} className="align-middle">
                  <td className="border px-1 py-1 truncate lg:px-1.5">{row.wechat_id}</td>
                  <td className="border px-1 py-1 leading-snug lg:px-1.5">
                    <span className="line-clamp-2 break-words">{row.items_summary}</span>
                  </td>
                  <td className="border px-1 py-1 whitespace-nowrap lg:px-1.5">
                    {formatMoney(row.customer_total)}
                  </td>
                  <td className="border px-1 py-1 lg:px-1.5">
                    <select
                      className={needsDeliverySelectClass(needsDelivery)}
                      value={needsDelivery ? "是" : "否"}
                      onChange={(e) =>
                        updateNeedsDelivery(row.wechat_id, e.target.value === "是")
                      }
                    >
                      <option value="是">是</option>
                      <option value="否">否</option>
                    </select>
                  </td>
                  <td className="border px-1 py-1 lg:px-1.5">
                    {dm.mode === "custom" ? (
                      <div className="flex min-w-0 items-center gap-0.5">
                        <input
                          className="h-6 min-w-0 flex-1 truncate rounded border px-1 text-xs leading-tight"
                          placeholder="地址"
                          title={dm.customText}
                          value={dm.customText}
                          onChange={(e) => updateDeliveryCustom(row.wechat_id, e.target.value)}
                        />
                        <select
                          aria-label="切换派送"
                          className="h-6 w-7 shrink-0 rounded border px-0 text-[10px] text-zinc-600"
                          defaultValue=""
                          onChange={(e) => {
                            const next = e.target.value as DeliveryMode;
                            if (next && next !== "custom") {
                              updateDeliveryMode(row.wechat_id, next);
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">⇄</option>
                          <option value="default">{defaultAddr?.trim() || "默认"}</option>
                          <option value="pickup">自取</option>
                        </select>
                      </div>
                    ) : (
                      <select
                        className="h-6 w-full truncate rounded border px-1 text-xs"
                        value={dm.mode}
                        title={
                          dm.mode === "default"
                            ? defaultAddr?.trim() || "默认地址"
                            : "自取"
                        }
                        onChange={(e) =>
                          updateDeliveryMode(row.wechat_id, e.target.value as DeliveryMode)
                        }
                      >
                        <option value="default">{defaultAddr?.trim() || "默认地址"}</option>
                        <option value="pickup">自取</option>
                        <option value="custom">…</option>
                      </select>
                    )}
                  </td>
                </tr>
                );
              })}
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
        <p className="mt-2 text-sm">
          数据存储：
          <span className={`font-semibold ${isCloudBackend() ? "text-emerald-700" : "text-amber-700"}`}>
            {isCloudBackend() ? "云端 Supabase（多设备共享）" : "本机 localStorage（仅本设备）"}
          </span>
        </p>
        <p className="mt-2 text-sm">总销售额(美金)：<span className="font-semibold">{formatMoney(totalSales)}</span></p>
        <p className="text-sm">warning 数量：<span className="font-semibold text-amber-700">{warningCount}</span></p>
        <p className="text-sm">failed 数量：<span className="font-semibold text-red-700">{failedCount}</span></p>
        {isExistingBatch ? (
          <>
            {autosaveStatus === "saving" ? (
              <p className="mt-2 text-xs text-zinc-500">自动保存中...</p>
            ) : null}
            {autosaveStatus === "saved" ? (
              <p className="mt-2 text-xs text-emerald-600">已自动保存</p>
            ) : null}
            {autosaveStatus === "error" ? (
              <p className="mt-2 text-xs text-red-600">自动保存失败: {autosaveError}</p>
            ) : null}
            <button
              onClick={deleteHistoricalBatch}
              className="mt-3 rounded-md bg-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-300"
            >
              删除本次接龙
            </button>
          </>
        ) : (
          <button onClick={saveBatch} className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white">
            保存本次接龙
          </button>
        )}
      </div>
    </div>
  );
}
