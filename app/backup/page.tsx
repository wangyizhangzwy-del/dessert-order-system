"use client";

import { useState } from "react";
import { exportAllData, importAllData } from "@/lib/storage";

export default function BackupPage() {
  const [message, setMessage] = useState("");

  const download = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `dessert-order-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage("已导出备份");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">数据备份</h1>
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
                if (!window.confirm("导入会覆盖当前本地数据，是否继续？")) return;
                const text = await file.text();
                let parsed: unknown = null;
                try {
                  parsed = JSON.parse(text);
                } catch {
                  setMessage("导入失败：JSON 无法解析");
                  return;
                }
                const result = importAllData(parsed);
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
    </div>
  );
}
