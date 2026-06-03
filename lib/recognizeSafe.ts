import { DeliveryMode } from "@/lib/deliveryMode";
import { roundMoney } from "@/lib/moneyFormat";

export function safeStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

export function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type RowStatus = "success" | "warning" | "failed";

export interface SafeEditableRow {
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

export function sanitizeEditableRow(raw: unknown, index: number): SafeEditableRow {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SafeEditableRow>;
  const quantity = safeNum(r.quantity, 0);
  const unitPrice = safeNum(r.unit_price, 0);
  const status = r.status;
  const normalizedStatus: RowStatus =
    status === "warning" || status === "failed" ? status : "success";
  return {
    row_id: safeStr(r.row_id) || `row_${index}`,
    sequence: safeNum(r.sequence, index + 1),
    raw_line: safeStr(r.raw_line),
    wechat_id: safeStr(r.wechat_id),
    sku_code: safeStr(r.sku_code),
    variant: safeStr(r.variant),
    flavor_combo: safeStr(r.flavor_combo),
    cake_name: safeStr(r.cake_name),
    display_name: safeStr(r.display_name),
    quantity,
    unit_price: unitPrice,
    line_total: safeNum(r.line_total, roundMoney(quantity * unitPrice)),
    notes: safeStr(r.notes),
    status: normalizedStatus,
    warning_reason: safeStr(r.warning_reason),
    is_example: Boolean(r.is_example),
    production_status: safeStr(r.production_status) || "未制作",
  };
}

export function sanitizeEditableRows(rows: unknown): SafeEditableRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => sanitizeEditableRow(row, index));
}

/** 订单记录表显示完整原始商品名（防御性读取，避免 undefined.trim crash）。 */
export function getOrderRecordProductName(row: SafeEditableRow): string {
  const sku = safeStr(row.sku_code).trim();
  const variant = safeStr(row.variant).trim();
  const flavorCombo = safeStr(row.flavor_combo).trim();
  const cakeName = safeStr(row.cake_name).trim();
  const displayName = safeStr(row.display_name).trim();

  if (sku === "1" && variant) {
    return displayName.includes(variant)
      ? displayName
      : cakeName
        ? `${cakeName}${variant}`
        : displayName || `${variant}小贝`;
  }
  if (cakeName.includes("肉松小贝") && variant) {
    return displayName.includes(variant) ? displayName : `${cakeName}${variant}`;
  }
  if (sku === "8" && flavorCombo) {
    const base = cakeName || displayName;
    return base.includes(flavorCombo) ? base : `${base}（${flavorCombo}）`;
  }
  return cakeName || displayName || "—";
}

export function customerKey(wechatId: string): string {
  return safeStr(wechatId).trim() || "未填写微信号";
}

export function safeRowSpan(count: number): number {
  const n = Math.floor(Number(count));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function needsDeliveryFromMode(mode: DeliveryMode | undefined): boolean {
  return mode !== "pickup";
}

export function emptyCustomerRow(wechatId: string, notes = ""): SafeEditableRow {
  return sanitizeEditableRow(
    {
      row_id: `empty_${wechatId}`,
      wechat_id: wechatId,
      notes,
      quantity: 0,
      unit_price: 0,
      line_total: 0,
      production_status: "未制作",
    },
    0
  );
}
