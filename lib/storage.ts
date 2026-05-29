import {
  AppSettings,
  BackupData,
  Customer,
  DraftPayload,
  SavedJielong,
} from "@/lib/types";
import * as local from "@/lib/storageLocal";
import * as remote from "@/lib/dataClient";

// 数据后端：NEXT_PUBLIC_DATA_BACKEND === "supabase" 走云端 API，否则用 localStorage。
// 未配置 Supabase 时自动回退到本地存储，保证本地开发/旧版行为不变。
// 注意：NEXT_PUBLIC_* 在「构建时」内联，修改后必须重新构建（Vercel 不能复用 build cache）。
// 这里做大小写/空白容错，避免 "Supabase"、" supabase " 之类的值导致回退到本地。
function useSupabase(): boolean {
  return (process.env.NEXT_PUBLIC_DATA_BACKEND ?? "").trim().toLowerCase() === "supabase";
}

export async function getSavedJielongs(): Promise<SavedJielong[]> {
  return useSupabase() ? remote.getSavedJielongs() : local.getSavedJielongs();
}

export async function getSavedJielongById(batchId: string): Promise<SavedJielong | undefined> {
  return useSupabase() ? remote.getSavedJielongById(batchId) : local.getSavedJielongById(batchId);
}

export async function saveJielong(jielong: SavedJielong): Promise<SavedJielong> {
  return useSupabase() ? remote.saveJielong(jielong) : local.saveJielong(jielong);
}

export async function deleteJielong(batchId: string): Promise<void> {
  if (useSupabase()) await remote.deleteJielong(batchId);
  else local.deleteJielong(batchId);
}

export async function getCustomers(): Promise<Customer[]> {
  return useSupabase() ? remote.getCustomers() : local.getCustomers();
}

export async function getSettings(): Promise<AppSettings> {
  return useSupabase() ? remote.getSettings() : local.getSettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (useSupabase()) await remote.saveSettings(settings);
  else local.saveSettings(settings);
}

export async function saveDraft(payload: DraftPayload): Promise<void> {
  if (useSupabase()) await remote.saveDraft(payload);
  else local.saveDraft(payload);
}

export async function getDraft(): Promise<DraftPayload | null> {
  return useSupabase() ? remote.getDraft() : local.getDraft();
}

export async function clearDraft(): Promise<void> {
  if (useSupabase()) await remote.clearDraft();
  else local.clearDraft();
}

export async function exportAllData(): Promise<BackupData> {
  return useSupabase() ? remote.exportAllData() : local.exportAllData();
}

export async function importAllData(data: unknown): Promise<{ ok: boolean; error?: string }> {
  return useSupabase() ? remote.importAllData(data) : local.importAllData(data);
}

// 读取本机 localStorage 原始数据，用于一键迁移到云端（始终读本地，与当前后端无关）。
export function readLocalRawForMigration(): BackupData | null {
  return local.readLocalRawForMigration();
}

export const isCloudBackend = useSupabase;
