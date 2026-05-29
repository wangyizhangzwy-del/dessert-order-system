"use client";

import { FormEvent, useCallback, useState } from "react";
import {
  getMemorySessionFlag,
  safeGetSessionStorage,
  safeSetSessionStorage,
  setMemorySessionFlag,
} from "@/lib/safeStorage";

const SESSION_KEY = "dessert_app_password_ok";

function configuredPassword(): string {
  return (process.env.NEXT_PUBLIC_APP_PASSWORD ?? "").trim();
}

function readInitialOk(): boolean {
  const required = configuredPassword();
  if (!required) return true;
  if (getMemorySessionFlag(SESSION_KEY)) return true;
  return safeGetSessionStorage(SESSION_KEY) === "1";
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const required = configuredPassword();
  const [ok, setOk] = useState(readInitialOk);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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

        const entered = input.trim();
        if (entered !== required) {
          setErr("密码验证失败，请重试。");
          console.warn("[auth] password validation failed");
          return;
        }

        console.warn("[auth] password validation passed");
        setMemorySessionFlag(SESSION_KEY, true);
        const stored = safeSetSessionStorage(SESSION_KEY, "1");
        console.warn(`[auth] storage set ${stored ? "success" : "failed"}`);

        setOk(true);
        console.warn("[auth] authenticated state updated");

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
