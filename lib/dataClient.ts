import {
  AppSettings,
  BackupData,
  Customer,
  DraftPayload,
  SavedJielong,
} from "@/lib/types";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

function headers(): Record<string, string> {
  const base: Record<string, string> = { "content-type": "application/json" };
  const pw = process.env.NEXT_PUBLIC_APP_PASSWORD;
  if (pw) base["x-app-password"] = pw;
  return base;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(path, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`请求失败 ${res.status} ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function getSavedJielongs(): Promise<SavedJielong[]> {
  const { batches } = await api<{ batches?: SavedJielong[] }>("/api/batches");
  return Array.isArray(batches) ? batches : [];
}

export async function getSavedJielongById(batchId: string): Promise<SavedJielong | undefined> {
  const { batch } = await api<{ batch: SavedJielong | null }>(`/api/batches/${encodeURIComponent(batchId)}`);
  return batch ?? undefined;
}

export async function saveJielong(jielong: SavedJielong): Promise<SavedJielong> {
  const { batch } = await api<{ batch: SavedJielong }>("/api/batches", {
    method: "POST",
    body: JSON.stringify(jielong),
  });
  return batch;
}

export async function deleteJielong(batchId: string): Promise<void> {
  await api(`/api/batches/${encodeURIComponent(batchId)}`, { method: "DELETE" });
}

export async function getCustomers(): Promise<Customer[]> {
  const { customers } = await api<{ customers?: Customer[] }>("/api/customers");
  return Array.isArray(customers) ? customers : [];
}

export async function rebuildCustomerProfiles(): Promise<{ updated: number }> {
  const res = await api<{ ok: boolean; updated?: number }>("/api/customers/rebuild", { method: "POST" });
  return { updated: res.updated ?? 0 };
}

export async function updateCustomerAddress(wechatId: string, default_address: string): Promise<Customer> {
  const { customer } = await api<{ customer: Customer }>(
    `/api/customers/${encodeURIComponent(wechatId)}`,
    { method: "PUT", body: JSON.stringify({ default_address }) }
  );
  return customer;
}

export async function getSettings(): Promise<AppSettings> {
  const { settings } = await api<{ settings: AppSettings }>("/api/settings");
  return settings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await api("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
}

export async function saveDraft(payload: DraftPayload): Promise<void> {
  await api("/api/draft", { method: "PUT", body: JSON.stringify(payload) });
}

export async function getDraft(): Promise<DraftPayload | null> {
  const { draft } = await api<{ draft: DraftPayload | null }>("/api/draft");
  return draft;
}

export async function clearDraft(): Promise<void> {
  await api("/api/draft", { method: "DELETE" });
}

export async function exportAllData(): Promise<BackupData> {
  return api<BackupData>("/api/export");
}

export async function importAllData(data: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    return await api<{ ok: boolean; error?: string }>("/api/import", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "导入失败" };
  }
}
