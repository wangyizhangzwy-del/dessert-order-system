"use client";

import { useEffect, useState } from "react";

const SLOW_MS = 15000;

export function LoadingPanel({
  message = "正在加载...",
  slowMessage = "加载时间过长，请刷新页面重试。",
}: {
  message?: string;
  slowMessage?: string;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-zinc-500">{message}</p>
      {slow ? <p className="mt-2 text-sm text-amber-700">{slowMessage}</p> : null}
    </div>
  );
}
