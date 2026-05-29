import {
  AppSettings,
  Customer,
  CustomerOrderHistory,
  ParsedOrder,
  SavedJielong,
} from "@/lib/types";

const SAVED_JIELONGS_KEY = "dessert_app_saved_jielongs";
const CUSTOMERS_KEY = "dessert_app_customers";
const SETTINGS_KEY = "dessert_app_settings";
const DRAFT_KEY = "dessert_current_draft";

interface DraftPayload {
  raw_text: string;
  menu_items: SavedJielong["menu_items"];
  orders: ParsedOrder[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function getJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSavedJielongs(): SavedJielong[] {
  return getJson<SavedJielong[]>(SAVED_JIELONGS_KEY, []);
}

export function getSavedJielongById(batchId: string): SavedJielong | undefined {
  return getSavedJielongs().find((b) => b.batch_id === batchId);
}

export function saveJielong(jielong: SavedJielong): SavedJielong {
  const all = getSavedJielongs();
  const idx = all.findIndex((b) => b.batch_id === jielong.batch_id);
  const now = nowIso();
  const next: SavedJielong = {
    ...jielong,
    updated_at: now,
    created_at: idx >= 0 ? all[idx].created_at : jielong.created_at || now,
  };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  setJson(SAVED_JIELONGS_KEY, all);
  upsertCustomersFromJielong(next);
  return next;
}

export function deleteJielong(batchId: string): void {
  const all = getSavedJielongs().filter((b) => b.batch_id !== batchId);
  setJson(SAVED_JIELONGS_KEY, all);
  const customers = getCustomers().map((c) => ({
    ...c,
    order_history: c.order_history.filter((h) => h.batch_id !== batchId),
  }));
  saveCustomers(customers);
}

export function getCustomers(): Customer[] {
  const raw = getJson<Customer[]>(CUSTOMERS_KEY, []);
  return raw.map((c) => ({
    ...c,
    order_history: Array.isArray(c.order_history)
      ? c.order_history.filter((h) => typeof h === "object") as Customer["order_history"]
      : [],
  }));
}

export function saveCustomers(customers: Customer[]): void {
  setJson(CUSTOMERS_KEY, customers);
}

export function getSettings(): AppSettings {
  return getJson<AppSettings>(SETTINGS_KEY, { ignoreExampleOrder: true });
}

export function saveSettings(settings: AppSettings): void {
  setJson(SETTINGS_KEY, settings);
}

export function saveDraft(payload: DraftPayload): void {
  setJson(DRAFT_KEY, payload);
}

export function getDraft(): DraftPayload | null {
  return getJson<DraftPayload | null>(DRAFT_KEY, null);
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

export function upsertCustomersFromJielong(jielong: SavedJielong): void {
  const customers = getCustomers();
  const now = nowIso();
  const next = [...customers];
  for (const order of jielong.parsed_orders) {
    if (!order.wechat_id) continue;
    if (order.is_example) continue;
    const idx = next.findIndex((c) => c.wechat_id === order.wechat_id);
    const history: CustomerOrderHistory = {
      batch_id: jielong.batch_id,
      batch_name: jielong.batch_name,
      order_date: jielong.order_date,
      raw_line: order.raw_line,
      items: order.items,
      customer_total: order.customer_total,
      notes: order.notes,
      status: order.status,
      created_at: now,
      updated_at: now,
    };
    if (idx >= 0) {
      const existing = next[idx];
      const hIdx = existing.order_history.findIndex((h) => h.batch_id === jielong.batch_id);
      if (hIdx >= 0) existing.order_history[hIdx] = { ...history, created_at: existing.order_history[hIdx].created_at };
      else existing.order_history.unshift(history);
      existing.updated_at = now;
      next[idx] = existing;
    } else {
      next.push({
        id: `cus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        wechat_id: order.wechat_id,
        balance: 0,
        order_history: [history],
        created_at: now,
        updated_at: now,
      });
    }
  }
  saveCustomers(next);
}

export function exportAllData() {
  return {
    version: "1.0.0",
    exported_at: nowIso(),
    saved_jielongs: getSavedJielongs(),
    customers: getCustomers(),
    app_settings: getSettings(),
  };
}

export function importAllData(data: unknown): { ok: boolean; error?: string } {
  try {
    const parsed = data as {
      saved_jielongs?: SavedJielong[];
      customers?: Customer[];
      app_settings?: AppSettings;
    };
    if (!parsed || !Array.isArray(parsed.saved_jielongs) || !Array.isArray(parsed.customers)) {
      return { ok: false, error: "JSON 格式不正确" };
    }
    setJson(SAVED_JIELONGS_KEY, parsed.saved_jielongs);
    setJson(CUSTOMERS_KEY, parsed.customers);
    if (parsed.app_settings) setJson(SETTINGS_KEY, parsed.app_settings);
    return { ok: true };
  } catch {
    return { ok: false, error: "导入失败，JSON 解析异常" };
  }
}

// Backward compatibility
export const getBatches = getSavedJielongs;
export const getBatchById = getSavedJielongById;
export function upsertBatchFromDraft(
  name: string,
  raw_text: string,
  menu_items: SavedJielong["menu_items"],
  orders: ParsedOrder[]
) {
  const now = nowIso();
  return saveJielong({
    batch_id: `batch_${Date.now()}`,
    batch_name: name,
    order_date: new Date().toLocaleDateString(),
    raw_text,
    menu_items,
    parsed_orders: orders,
    editable_rows: [],
    customer_summary_rows: [],
    production_summary_rows: [],
    grouped_excel_rows: [],
    total_amount: orders.reduce((s, o) => s + o.customer_total, 0),
    warning_count: orders.filter((o) => o.status === "warning").length,
    failed_count: orders.filter((o) => o.status === "failed").length,
    ignore_example_order: true,
    created_at: now,
    updated_at: now,
  });
}
