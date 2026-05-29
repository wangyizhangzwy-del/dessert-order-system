"use client";

import { useState } from "react";
import { exportAllData, importAllData, isCloudBackend, readLocalRawForMigration } from "@/lib/storage";

export default function BackupPage() {
  const [message, setMessage] = useState("");
  const [migrating, setMigrating] = useState(false);
  const cloud = isCloudBackend();

  const download = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `dessert-order-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage("已导出备份");
  };

  const migrateLocalToCloud = async () => {
    const local = readLocalRawForMigration();
    if (!local) {
      setMessage("本机没有可迁移的历史数据");
      return;
    }
    const count = local.saved_jielongs.length;
    if (!window.confirm(`将把本机 ${count} 条历史接龙及客户数据上传到云端（按 ID 合并，不会重复），是否继续？`)) {
      return;
    }
    setMigrating(true);
    try {
      const result = await importAllData(local);
      setMessage(result.ok ? "迁移成功，云端已同步本机数据" : result.error ?? "迁移失败");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "迁移失败");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">数据备份</h1>
        <p className="mt-1 text-sm text-zinc-500">
          当前数据存储：{cloud ? "云端（Supabase，多设备共享）" : "本机浏览器（localStorage）"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={download} className="rounded bg-zinc-900 px-4 py-2 text-white">
            导出全部数据 JSON
          </button>
          <label className="rounded bg-zinc-200 px-4 py-2">
            导入全部数据 JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const target = cloud ? "云端数据（按 ID 合并）" : "当前本地数据";
                if (!window.confirm(`导入会写入${target}，是否继续？`)) return;
                const text = await file.text();
                let parsed: unknown = null;
                try {
                  parsed = JSON.parse(text);
                } catch {
                  setMessage("导入失败：JSON 无法解析");
                  return;
                }
                const result = await importAllData(parsed);
                if (!result.ok) {
                  setMessage(result.error ?? "导入失败");
                  return;
                }
                setMessage("导入成功，请刷新页面");
              }}
            />
          </label>
        </div>
        {message ? <p className="mt-2 text-sm text-zinc-600">{message}</p> : null}
      </div>

      {cloud ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">迁移本机历史数据到云端</h2>
          <p className="mt-1 text-sm text-zinc-600">
            如果你以前在本设备用旧版本（localStorage）保存过接龙，可以一键上传到云端共享。可重复执行，不会产生重复数据。
          </p>
          <button
            onClick={migrateLocalToCloud}
            disabled={migrating}
            className="mt-3 rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {migrating ? "迁移中..." : "迁移本机数据到云端"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
