"use client";

import { useEffect, useState } from "react";

/** 首帧后再渲染重组件，避免旧 iPhone 首屏卡死。 */
export function useDeferredRender(delayMs = 50): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window.requestAnimationFrame === "function") {
      const raf = window.requestAnimationFrame(() => {
        window.setTimeout(run, delayMs);
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(raf);
      };
    }

    const timer = window.setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  return ready;
}
