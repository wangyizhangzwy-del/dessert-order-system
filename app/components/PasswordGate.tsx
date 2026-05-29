"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "dessert_app_password_ok";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const required = process.env.NEXT_PUBLIC_APP_PASSWORD;
  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(SESSION_KEY) === "1") setOk(true);
  }, []);

  if (!required) return <>{children}</>;
  // Avoid hydration mismatch: don't decide gate state until client mount.
  if (!mounted) return null;
  if (ok) return <>{children}</>;

  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl bg-white p-6 shadow">
      <h1 className="text-lg font-semibold">请输入访问密码</h1>
      <input
        type="password"
        className="mt-3 w-full rounded border p-2"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="访问密码"
      />
      <button
        className="mt-3 w-full rounded bg-zinc-900 px-4 py-2 text-white"
        onClick={() => {
          if (input === required) {
            sessionStorage.setItem(SESSION_KEY, "1");
            setOk(true);
            setErr("");
          } else {
            setErr("密码错误");
          }
        }}
      >
        进入系统
      </button>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
