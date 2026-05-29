import {
  getMemorySessionFlag,
  safeGetLocalStorage,
  safeGetSessionStorage,
  safeParseJson,
  safeSetLocalStorage,
  safeSetSessionStorage,
  setMemorySessionFlag,
} from "../lib/safeStorage";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// memory session survives remount
setMemorySessionFlag("test_auth", true);
assert(getMemorySessionFlag("test_auth"), "memory session flag");

// json fallback
assert(safeParseJson("{bad", { x: 1 }).x === 1, "bad json fallback");
assert(safeParseJson('{"a":2}', { x: 1 }).a === 2, "good json");

// storage roundtrip only when window exists (browser)
if (typeof window !== "undefined") {
  assert(safeSetLocalStorage("__test__", "ok"), "local set");
  assert(safeGetLocalStorage("__test__") === "ok", "local get");
  safeSetLocalStorage("__test__", "");
}

console.log("test-safe-storage: all passed");
