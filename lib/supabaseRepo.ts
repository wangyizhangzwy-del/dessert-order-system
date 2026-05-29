import {
  AppSettings,
  BackupData,
  Customer,
  DraftPayload,
  SavedJielong,
} from "@/lib/types";
import { applyJielongToCustomers } from "@/lib/customerHistory";
import { deriveAddressFromHistory } from "@/lib/address";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function nowIso(): string {
  return new Date().toISOString();
}

function makeCustomerId(): string {
  return `cus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface CustomerRow {
  wechat_id: string;
  phone: string | null;
  default_address: string | null;
  default_delivery_method: string | null;
  balance: number | string | null;
  notes: string | null;
  order_history: Customer["order_history"];
  created_at: string;
  updated_at: string;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.wechat_id,
    wechat_id: row.wechat_id,
    phone: row.phone ?? undefined,
    default_address: row.default_address ?? undefined,
    default_delivery_method: row.default_delivery_method ?? undefined,
    balance: Number(row.balance ?? 0),
    notes: row.notes ?? undefined,
    order_history: Array.isArray(row.order_history) ? row.order_history : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function customerToRow(customer: Customer): CustomerRow {
  return {
    wechat_id: customer.wechat_id,
    phone: customer.phone ?? null,
    default_address: customer.default_address ?? null,
    default_delivery_method: customer.default_delivery_method ?? null,
    balance: customer.balance ?? 0,
    notes: customer.notes ?? null,
    order_history: customer.order_history ?? [],
    created_at: customer.created_at || nowIso(),
    updated_at: customer.updated_at || nowIso(),
  };
}

export async function listBatches(): Promise<SavedJielong[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("batches").select("payload").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.payload as SavedJielong);
}

export async function getBatch(batchId: string): Promise<SavedJielong | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("batches").select("payload").eq("batch_id", batchId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as SavedJielong) ?? null;
}

async function upsertCustomersForBatch(jielong: SavedJielong): Promise<void> {
  const db = getSupabaseAdmin();
  const wechatIds = [
    ...new Set(
      (jielong.parsed_orders ?? [])
        .filter((o) => !o.is_example && o.wechat_id)
        .map((o) => o.wechat_id)
    ),
  ];
  if (wechatIds.length === 0) return;

  const { data, error } = await db.from("customers").select("*").in("wechat_id", wechatIds);
  if (error) throw new Error(error.message);
  const existing = (data ?? []).map((r) => rowToCustomer(r as CustomerRow));

  const updated = applyJielongToCustomers(existing, jielong, nowIso(), makeCustomerId);
  const rows = updated.map(customerToRow);
  const { error: upsertError } = await db.from("customers").upsert(rows, { onConflict: "wechat_id" });
  if (upsertError) throw new Error(upsertError.message);
}

export async function upsertBatch(jielong: SavedJielong): Promise<SavedJielong> {
  const db = getSupabaseAdmin();
  const now = nowIso();

  const { data: existing } = await db
    .from("batches")
    .select("created_at, payload")
    .eq("batch_id", jielong.batch_id)
    .maybeSingle();
  const createdAt =
    existing?.created_at ?? (existing?.payload as SavedJielong | undefined)?.created_at ?? jielong.created_at ?? now;

  const stored: SavedJielong = { ...jielong, created_at: createdAt, updated_at: now };

  const { error } = await db.from("batches").upsert(
    {
      batch_id: stored.batch_id,
      batch_name: stored.batch_name,
      order_date: stored.order_date,
      total_amount: stored.total_amount ?? 0,
      warning_count: stored.warning_count ?? 0,
      failed_count: stored.failed_count ?? 0,
      ignore_example_order: stored.ignore_example_order ?? true,
      payload: stored,
      created_at: createdAt,
      updated_at: now,
    },
    { onConflict: "batch_id" }
  );
  if (error) throw new Error(error.message);

  await upsertCustomersForBatch(stored);
  return stored;
}

export async function removeBatch(batchId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("batches").delete().eq("batch_id", batchId);
  if (error) throw new Error(error.message);

  const { data, error: readError } = await db.from("customers").select("*");
  if (readError) throw new Error(readError.message);
  const changed: CustomerRow[] = [];
  for (const raw of data ?? []) {
    const customer = rowToCustomer(raw as CustomerRow);
    const filtered = customer.order_history.filter((h) => h.batch_id !== batchId);
    if (filtered.length !== customer.order_history.length) {
      changed.push(customerToRow({ ...customer, order_history: filtered, updated_at: nowIso() }));
    }
  }
  if (changed.length > 0) {
    const { error: upsertError } = await db.from("customers").upsert(changed, { onConflict: "wechat_id" });
    if (upsertError) throw new Error(upsertError.message);
  }
}

export async function listCustomers(): Promise<Customer[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("customers").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToCustomer(r as CustomerRow));
}

export async function updateCustomerAddress(wechatId: string, default_address: string): Promise<Customer> {
  const db = getSupabaseAdmin();
  const customers = await listCustomers();
  const existing = customers.find((c) => c.wechat_id === wechatId);
  if (!existing) throw new Error("客户不存在");
  const updated: Customer = {
    ...existing,
    default_address: default_address.trim() || undefined,
    updated_at: nowIso(),
  };
  const { error } = await db.from("customers").upsert(customerToRow(updated), { onConflict: "wechat_id" });
  if (error) throw new Error(error.message);
  return updated;
}

// 回填：根据客户历史订单备注提取地址，写入 default_address（已有真实地址不被空值覆盖）。
export async function backfillCustomerAddresses(): Promise<{ updated: number }> {
  const db = getSupabaseAdmin();
  const customers = await listCustomers();
  const changed: CustomerRow[] = [];
  for (const customer of customers) {
    const derived = deriveAddressFromHistory(customer.order_history);
    if (derived && derived !== customer.default_address) {
      changed.push(customerToRow({ ...customer, default_address: derived, updated_at: nowIso() }));
    }
  }
  if (changed.length > 0) {
    const { error } = await db.from("customers").upsert(changed, { onConflict: "wechat_id" });
    if (error) throw new Error(error.message);
  }
  return { updated: changed.length };
}

export async function getSettings(): Promise<AppSettings> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("app_settings").select("settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.settings as AppSettings) ?? { ignoreExampleOrder: true };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("app_settings")
    .upsert({ id: 1, settings, updated_at: nowIso() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function getDraft(): Promise<DraftPayload | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("app_draft").select("payload").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as DraftPayload) ?? null;
}

export async function saveDraft(payload: DraftPayload): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("app_draft")
    .upsert({ id: 1, payload, updated_at: nowIso() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function clearDraft(): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("app_draft")
    .upsert({ id: 1, payload: null, updated_at: nowIso() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function exportAll(): Promise<BackupData> {
  const [saved_jielongs, customers, app_settings] = await Promise.all([
    listBatches(),
    listCustomers(),
    getSettings(),
  ]);
  return { version: "1.0.0", exported_at: nowIso(), saved_jielongs, customers, app_settings };
}

// 合并导入（按 batch_id / wechat_id upsert），不破坏未包含的数据，迁移可重复执行。
export async function importAll(data: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = data as Partial<BackupData>;
  if (!parsed || !Array.isArray(parsed.saved_jielongs) || !Array.isArray(parsed.customers)) {
    return { ok: false, error: "JSON 格式不正确" };
  }
  const db = getSupabaseAdmin();

  if (parsed.saved_jielongs.length > 0) {
    const batchRows = parsed.saved_jielongs.map((j) => ({
      batch_id: j.batch_id,
      batch_name: j.batch_name,
      order_date: j.order_date,
      total_amount: j.total_amount ?? 0,
      warning_count: j.warning_count ?? 0,
      failed_count: j.failed_count ?? 0,
      ignore_example_order: j.ignore_example_order ?? true,
      payload: j,
      created_at: j.created_at || nowIso(),
      updated_at: j.updated_at || nowIso(),
    }));
    const { error } = await db.from("batches").upsert(batchRows, { onConflict: "batch_id" });
    if (error) return { ok: false, error: error.message };
  }

  if (parsed.customers.length > 0) {
    const customerRows = parsed.customers.map((c) =>
      customerToRow({ ...c, default_address: c.default_address || deriveAddressFromHistory(c.order_history) || undefined })
    );
    const { error } = await db.from("customers").upsert(customerRows, { onConflict: "wechat_id" });
    if (error) return { ok: false, error: error.message };
  }

  if (parsed.app_settings) {
    await saveSettings(parsed.app_settings);
  }

  // 迁移/导入后，根据历史备注回填客户地址。
  await backfillCustomerAddresses();
  return { ok: true };
}
