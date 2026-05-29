import {
  EditableOrderRow,
  OrderItem,
  ParsedOrder,
  SavedJielong,
} from "@/lib/types";
import { extractAddress, isPickupNote } from "@/lib/address";
import { chineseWeekday } from "@/lib/dateFormat";
import { resolveDeliveryMode } from "@/lib/deliveryMode";

export interface FebruaryCsvRow {
  order_date: string;
  wechat_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
  delivery_or_address: string;
  payment_status: string;
  delivery_status: string;
  production_status: string;
  source_line: string;
}

export interface FebruaryImportSummary {
  rowsRead: number;
  batchesCreatedOrUpdated: number;
  customerOrders: number;
  productLines: number;
  totalKnownSales: number;
  missingPriceRows: number;
  missingPriceDetails: string[];
  dates: string[];
}

const CSV_HEADERS = [
  "order_date",
  "wechat_id",
  "product_name",
  "quantity",
  "unit_price",
  "line_total",
  "delivery_or_address",
  "payment_status",
  "delivery_status",
  "production_status",
  "source_line",
] as const;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function parseOptionalNumber(raw: string): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredNumber(raw: string, fallback = 0): number {
  const n = parseOptionalNumber(raw);
  return n ?? fallback;
}

export function normalizeDeliveryOrAddress(raw: string | undefined | null): string {
  const s = (raw ?? "").trim();
  if (!s || s === "/") return "";
  return s;
}

export function parseFebruaryCsv(text: string): FebruaryCsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  if (header.join(",") !== CSV_HEADERS.join(",")) {
    throw new Error(`Unexpected CSV header. Expected: ${CSV_HEADERS.join(",")}`);
  }

  const rows: FebruaryCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 1 && !cols[0]?.trim()) continue;
    if (cols.length < CSV_HEADERS.length) {
      throw new Error(`Line ${i + 1}: expected ${CSV_HEADERS.length} columns, got ${cols.length}`);
    }
    const quantity = parseRequiredNumber(cols[3], 1);
    const unit_price = parseOptionalNumber(cols[4]);
    const line_total = parseOptionalNumber(cols[5]);
    rows.push({
      order_date: cols[0].trim(),
      wechat_id: cols[1].trim(),
      product_name: cols[2].trim(),
      quantity,
      unit_price,
      line_total,
      delivery_or_address: cols[6].trim(),
      payment_status: cols[7].trim() || "未付款",
      delivery_status: cols[8].trim() || "未送达",
      production_status: cols[9].trim() || "未制作",
      source_line: cols[10]?.trim() ?? "",
    });
  }
  return rows;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function batchIdForDate(orderDate: string): string {
  return `import_february_${orderDate}`;
}

function batchNameForDate(orderDate: string): string {
  const wd = chineseWeekday(orderDate);
  return wd ? `接龙-${orderDate}-${wd}-历史导入` : `接龙-${orderDate}-历史导入`;
}

interface CustomerGroup {
  wechat_id: string;
  lines: FebruaryCsvRow[];
}

function groupByDate(rows: FebruaryCsvRow[]): Map<string, FebruaryCsvRow[]> {
  const map = new Map<string, FebruaryCsvRow[]>();
  for (const row of rows) {
    const list = map.get(row.order_date) ?? [];
    list.push(row);
    map.set(row.order_date, list);
  }
  return map;
}

function groupByCustomer(rows: FebruaryCsvRow[]): CustomerGroup[] {
  const map = new Map<string, FebruaryCsvRow[]>();
  for (const row of rows) {
    const list = map.get(row.wechat_id) ?? [];
    list.push(row);
    map.set(row.wechat_id, list);
  }
  return [...map.entries()].map(([wechat_id, lines]) => ({ wechat_id, lines }));
}

/** First non-empty delivery/address in a customer's lines (legacy Excel often repeats on row 1 only). */
function customerDeliveryNotes(lines: FebruaryCsvRow[]): string {
  for (const line of lines) {
    const n = normalizeDeliveryOrAddress(line.delivery_or_address);
    if (n) return n;
  }
  return "";
}

function customerStatusField(
  lines: FebruaryCsvRow[],
  field: "payment_status" | "delivery_status"
): string {
  const val = lines.find((l) => l[field]?.trim())?.[field];
  return val?.trim() || (field === "payment_status" ? "未付款" : "未送达");
}

function buildBatchForDate(orderDate: string, dateRows: FebruaryCsvRow[]): SavedJielong {
  const customerGroups = groupByCustomer(dateRows);
  const parsed_orders: ParsedOrder[] = [];
  const editable_rows: EditableOrderRow[] = [];
  const grouped_excel_rows: SavedJielong["grouped_excel_rows"] = [];
  const customer_summary_rows: SavedJielong["customer_summary_rows"] = [];
  const productionMap = new Map<string, SavedJielong["production_summary_rows"][number]>();

  let warningCount = 0;
  let totalAmount = 0;
  let sequence = 0;

  for (const group of customerGroups) {
    const notes = customerDeliveryNotes(group.lines);
    const paymentStatus = customerStatusField(group.lines, "payment_status");
    const deliveryStatus = customerStatusField(group.lines, "delivery_status");
    const items: OrderItem[] = [];
    let customerTotal = 0;
    let customerHasMissingPrice = false;

    group.lines.forEach((line, lineIdx) => {
      const unitPrice = line.unit_price ?? 0;
      const lineTotal =
        line.line_total ?? (line.unit_price != null ? roundMoney(line.unit_price * line.quantity) : 0);
      if (line.unit_price == null || line.line_total == null) {
        warningCount += 1;
        customerHasMissingPrice = true;
      }

      customerTotal = roundMoney(customerTotal + lineTotal);
      totalAmount = roundMoney(totalAmount + lineTotal);

      const item: OrderItem = {
        sku_code: "",
        cake_name: line.product_name,
        display_name: line.product_name,
        quantity: line.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
      };
      items.push(item);

      sequence += 1;
      editable_rows.push({
        row_id: `import_${orderDate}_${group.wechat_id}_${lineIdx}`,
        sequence,
        raw_line: line.source_line,
        wechat_id: group.wechat_id,
        sku_code: "",
        variant: "",
        flavor_combo: "",
        cake_name: line.product_name,
        display_name: line.product_name,
        quantity: line.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        notes: lineIdx === 0 ? notes : "",
        status: line.unit_price == null || line.line_total == null ? "warning" : "success",
        warning_reason:
          line.unit_price == null || line.line_total == null ? "历史导入：缺少单价或小计" : "",
        is_example: false,
        production_status: line.production_status || "未制作",
      });

      grouped_excel_rows.push({
        date: lineIdx === 0 ? orderDate : "",
        customer: lineIdx === 0 ? group.wechat_id : "",
        product: line.product_name,
        quantity: String(line.quantity),
        unit_price: unitPrice > 0 ? String(unitPrice) : "",
        customer_total: lineIdx === 0 ? String(roundMoney(customerTotal)) : "",
        notes: lineIdx === 0 ? notes : "",
        delivery_status: lineIdx === 0 ? deliveryStatus : "",
        payment_status: lineIdx === 0 ? paymentStatus : "",
        production_status: line.production_status || "未制作",
      });

      const prodKey = `import__${line.product_name}____`;
      const existingProd = productionMap.get(prodKey);
      if (existingProd) {
        existingProd.total_quantity += line.quantity;
      } else {
        productionMap.set(prodKey, {
          key: prodKey,
          sku_code: "",
          variant: "",
          cake_name: line.product_name,
          display_name: line.product_name,
          total_quantity: line.quantity,
        });
      }
    });

    const dm = resolveDeliveryMode(notes);
    customer_summary_rows.push({
      wechat_id: group.wechat_id,
      items_summary: items.map((it) => `${it.display_name}×${it.quantity}`).join("；"),
      customer_total: customerTotal,
      notes,
      status: customerHasMissingPrice ? "warning" : "success",
      delivery_mode: dm.mode,
      delivery_custom: dm.mode === "custom" ? dm.customText : undefined,
    });

    parsed_orders.push({
      id: `import_${orderDate}_${group.wechat_id}`,
      raw_line: group.lines.map((l) => l.source_line).filter(Boolean).join("\n"),
      wechat_id: group.wechat_id,
      items,
      customer_total: customerTotal,
      status: customerHasMissingPrice ? "warning" : "success",
      notes,
      warning_reason: customerHasMissingPrice ? "历史导入：部分商品缺少单价或小计" : undefined,
      is_example: false,
    });
  }

  const importTimestamp = `${orderDate}T20:00:00.000Z`;

  return {
    batch_id: batchIdForDate(orderDate),
    batch_name: batchNameForDate(orderDate),
    order_date: orderDate,
    raw_text: `[历史导入] February detailed CSV · ${dateRows.length} product lines · ${customerGroups.length} customers · ${parsed_orders.length} customer orders`,
    menu_items: [],
    parsed_orders,
    editable_rows,
    customer_summary_rows,
    production_summary_rows: [...productionMap.values()],
    grouped_excel_rows,
    total_amount: totalAmount,
    warning_count: warningCount,
    failed_count: 0,
    ignore_example_order: true,
    created_at: importTimestamp,
    updated_at: new Date().toISOString(),
  };
}

export function buildFebruaryBatches(rows: FebruaryCsvRow[]): {
  batches: SavedJielong[];
  summary: FebruaryImportSummary;
} {
  const missingPriceDetails: string[] = [];
  for (const row of rows) {
    if (row.unit_price == null || row.line_total == null) {
      missingPriceDetails.push(
        `${row.order_date} ${row.wechat_id} ${row.product_name} (unit_price=${row.unit_price ?? "∅"}, line_total=${row.line_total ?? "∅"})`
      );
    }
  }

  const byDate = groupByDate(rows);
  const dates = [...byDate.keys()].sort();
  const batches = dates.map((date) => buildBatchForDate(date, byDate.get(date) ?? []));

  const customerOrders = new Set(rows.map((r) => `${r.order_date}__${r.wechat_id}`)).size;
  const totalKnownSales = roundMoney(
    rows.reduce((sum, r) => sum + (r.line_total ?? (r.unit_price != null ? r.unit_price * r.quantity : 0)), 0)
  );

  return {
    batches,
    summary: {
      rowsRead: rows.length,
      batchesCreatedOrUpdated: batches.length,
      customerOrders,
      productLines: rows.length,
      totalKnownSales,
      missingPriceRows: missingPriceDetails.length,
      missingPriceDetails,
      dates,
    },
  };
}

/** True when delivery_or_address should be saved as default_address for a new customer. */
export function isImportableDefaultAddress(raw: string | undefined | null): boolean {
  const notes = normalizeDeliveryOrAddress(raw);
  if (!notes) return false;
  if (isPickupNote(notes)) return false;
  return extractAddress(notes) != null;
}

export interface CustomerOrderDetail {
  wechat_id: string;
  notes: string;
  customer_total: number;
  payment_status: string;
  delivery_status: string;
  items: { product_name: string; quantity: number; unit_price: number; line_total: number; production_status: string }[];
}

export function getCustomerOrderFromBatch(
  batch: SavedJielong,
  wechatId: string
): CustomerOrderDetail | null {
  const order = batch.parsed_orders.find((o) => o.wechat_id === wechatId && !o.is_example);
  if (!order) return null;
  const rows = batch.editable_rows.filter((r) => r.wechat_id === wechatId && !r.is_example);
  const grouped = batch.grouped_excel_rows.filter((r) => r.customer === wechatId || rows.some((er) => er.display_name === r.product));
  const payment_status = grouped.find((g) => g.payment_status)?.payment_status || "未付款";
  const delivery_status = grouped.find((g) => g.delivery_status)?.delivery_status || "未送达";
  return {
    wechat_id: wechatId,
    notes: order.notes,
    customer_total: order.customer_total,
    payment_status,
    delivery_status,
    items: order.items.map((it, idx) => ({
      product_name: it.display_name || it.cake_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total,
      production_status: rows[idx]?.production_status || "未制作",
    })),
  };
}

export function assertBatchHasItemLevelDetail(batch: SavedJielong): string[] {
  const errors: string[] = [];
  const productLinesInEditable = batch.editable_rows.filter((r) => !r.is_example).length;
  const productLinesInParsed = batch.parsed_orders
    .filter((o) => !o.is_example)
    .reduce((n, o) => n + o.items.length, 0);
  if (productLinesInEditable === 0) errors.push(`${batch.batch_id}: editable_rows is empty`);
  if (productLinesInParsed === 0) errors.push(`${batch.batch_id}: parsed_orders has no items`);
  if (productLinesInEditable !== productLinesInParsed) {
    errors.push(
      `${batch.batch_id}: editable_rows (${productLinesInEditable}) != parsed item count (${productLinesInParsed})`
    );
  }
  if (batch.grouped_excel_rows.length !== productLinesInEditable) {
    errors.push(
      `${batch.batch_id}: grouped_excel_rows (${batch.grouped_excel_rows.length}) != editable_rows (${productLinesInEditable})`
    );
  }
  for (const order of batch.parsed_orders.filter((o) => !o.is_example)) {
    if (order.items.length === 0) {
      errors.push(`${batch.batch_id}: customer ${order.wechat_id} has zero items`);
    }
  }
  return errors;
}
