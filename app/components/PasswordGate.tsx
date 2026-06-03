"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  readAuthFlag,
  setMemorySessionFlag,
  writeAuthFlag,
} from "@/lib/safeStorage";

const SESSION_KEY = "dessert_app_password_ok";

function configuredPassword(): string {
  return (process.env.NEXT_PUBLIC_APP_PASSWORD ?? "").trim();
}

function normalizePassword(value: string): string {
  return value.trim().normalize("NFC");
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const required = configuredPassword();
  // SSR 与首帧保持一致，避免 hydration mismatch（不在 useState 初始值读 storage）。
  const [ok, setOk] = useState(() => !required);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (!required) {
      setOk(true);
      return;
    }
    if (readAuthFlag(SESSION_KEY)) {
      setOk(true);
      console.warn("[auth] restored session from storage/memory");
    }
  }, [required]);

  const handleLogin = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      setErr("");
      setNotice("");
      setLoginLoading(true);

      try {
        console.warn("[auth] login submit fired");

        if (!required) {
          setMemorySessionFlag(SESSION_KEY, true);
          setOk(true);
          console.warn("[auth] password validation passed (no password configured)");
          console.warn("[auth] authenticated state updated");
          return;
        }

        const entered = normalizePassword(input);
        const expected = normalizePassword(required);
        if (entered !== expected) {
          setErr("密码验证失败，请重试。");
          console.warn("[auth] password validation failed");
          return;
        }

        console.warn("[auth] password validation passed");
        setMemorySessionFlag(SESSION_KEY, true);
        setOk(true);
        console.warn("[auth] authenticated state updated");

        const stored = writeAuthFlag(SESSION_KEY);
        console.warn(`[auth] storage set ${stored ? "success" : "failed"}`);
        if (!stored) {
          setNotice("登录状态保存失败，但已允许本次访问。");
        }
      } catch (error) {
        console.warn("[auth] login error", error);
        setErr("登录失败，请重试。");
      } finally {
        setLoginLoading(false);
      }
    },
    [input, required]
  );

  if (!required || ok) return <>{children}</>;

  if (!hydrated) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">请输入访问密码</h1>
        <p className="mt-3 text-sm text-zinc-500">正在加载...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl bg-white p-6 shadow">
      <h1 className="text-lg font-semibold">请输入访问密码</h1>
      <form className="mt-3" onSubmit={handleLogin} noValidate>
        <input
          type="password"
          name="app-password"
          autoComplete="current-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="w-full rounded border p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="访问密码"
          disabled={loginLoading}
        />
        <button
          type="submit"
          disabled={loginLoading}
          className="mt-3 w-full rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loginLoading ? "验证中..." : "进入系统"}
        </button>
      </form>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      {notice ? <p className="mt-2 text-sm text-amber-700">{notice}</p> : null}
    </div>
  );
}
