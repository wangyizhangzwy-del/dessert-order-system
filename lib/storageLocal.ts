import {
  AppSettings,
  BackupData,
  Customer,
  DraftPayload,
  ParsedOrder,
  SavedJielong,
} from "@/lib/types";
import { applyJielongToCustomers } from "@/lib/customerHistory";
import { deriveAddressFromHistory } from "@/lib/address";

const SAVED_JIELONGS_KEY = "dessert_app_saved_jielongs";
const CUSTOMERS_KEY = "dessert_app_customers";
const SETTINGS_KEY = "dessert_app_settings";
const DRAFT_KEY = "dessert_current_draft";

function nowIso(): string {
  return new Date().toISOString();
}

function makeCustomerId(): string {
  return `cus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

export function getCustomers(): Customer[] {
  const raw = getJson<Customer[]>(CUSTOMERS_KEY, []);
  return raw.map((c) => ({
    ...c,
    order_history: Array.isArray(c.order_history)
      ? (c.order_history.filter((h) => typeof h === "object") as Customer["order_history"])
      : [],
  }));
}

export function saveCustomers(customers: Customer[]): void {
  setJson(CUSTOMERS_KEY, customers);
}

export function updateCustomerAddress(wechatId: string, default_address: string): Customer {
  const customers = getCustomers();
  const idx = customers.findIndex((c) => c.wechat_id === wechatId);
  if (idx < 0) throw new Error("客户不存在");
  const updated: Customer = {
    ...customers[idx],
    default_address: default_address.trim() || undefined,
    updated_at: nowIso(),
  };
  customers[idx] = updated;
  saveCustomers(customers);
  return updated;
}

export function upsertCustomersFromJielong(jielong: SavedJielong): void {
  const updated = applyJielongToCustomers(getCustomers(), jielong, nowIso(), makeCustomerId);
  saveCustomers(updated);
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

export function exportAllData(): BackupData {
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
    const parsed = data as Partial<BackupData>;
    if (!parsed || !Array.isArray(parsed.saved_jielongs) || !Array.isArray(parsed.customers)) {
      return { ok: false, error: "JSON 格式不正确" };
    }
    setJson(SAVED_JIELONGS_KEY, parsed.saved_jielongs);
    const customers = parsed.customers.map((c) => ({
      ...c,
      default_address: c.default_address || deriveAddressFromHistory(c.order_history) || undefined,
    }));
    setJson(CUSTOMERS_KEY, customers);
    if (parsed.app_settings) setJson(SETTINGS_KEY, parsed.app_settings);
    return { ok: true };
  } catch {
    return { ok: false, error: "导入失败，JSON 解析异常" };
  }
}

// 回填：根据历史订单备注提取地址写入 default_address。
export function backfillCustomerAddresses(): { updated: number } {
  const customers = getCustomers();
  let updated = 0;
  const next = customers.map((c) => {
    const derived = deriveAddressFromHistory(c.order_history);
    if (derived && derived !== c.default_address) {
      updated += 1;
      return { ...c, default_address: derived, updated_at: nowIso() };
    }
    return c;
  });
  if (updated > 0) saveCustomers(next);
  return { updated };
}

// 读取本机 localStorage 原始数据（用于迁移到云端）。
export function readLocalRawForMigration(): BackupData | null {
  if (typeof window === "undefined") return null;
  const jielongs = getSavedJielongs();
  const customers = getCustomers();
  if (jielongs.length === 0 && customers.length === 0) return null;
  return {
    version: "1.0.0",
    exported_at: nowIso(),
    saved_jielongs: jielongs,
    customers,
    app_settings: getSettings(),
  };
}

export function upsertBatchFromDraft(
  name: string,
  raw_text: string,
  menu_items: SavedJielong["menu_items"],
  orders: ParsedOrder[]
): SavedJielong {
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
