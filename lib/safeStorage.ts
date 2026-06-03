/** 当前标签页内存会话（组件 remount 后仍有效，不依赖 storage）。 */
let memorySessionFlags: Record<string, boolean> = {};

export function setMemorySessionFlag(key: string, value: boolean): void {
  memorySessionFlags[key] = value;
}

export function getMemorySessionFlag(key: string): boolean {
  return memorySessionFlags[key] === true;
}

function hasWindowStorage(storage: "local" | "session"): boolean {
  if (typeof window === "undefined") return false;
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__storage_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function safeGetSessionStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.warn("[safeStorage] sessionStorage get failed", error);
    return null;
  }
}

export function safeSetSessionStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("[safeStorage] sessionStorage set failed", error);
    return false;
  }
}

export function safeRemoveSessionStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn("[safeStorage] sessionStorage remove failed", error);
    return false;
  }
}

export function safeGetLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn("[safeStorage] localStorage get failed", error);
    return null;
  }
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("[safeStorage] localStorage set failed", error);
    return false;
  }
}

export function safeRemoveLocalStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn("[safeStorage] localStorage remove failed", error);
    return false;
  }
}

export function isSessionStorageAvailable(): boolean {
  return hasWindowStorage("session");
}

export function isLocalStorageAvailable(): boolean {
  return hasWindowStorage("local");
}

export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn("[safeStorage] JSON.parse failed", error);
    return fallback;
  }
}

/** 读取 auth 标记：内存 → sessionStorage → localStorage。 */
export function readAuthFlag(key: string): boolean {
  if (getMemorySessionFlag(key)) return true;
  if (safeGetSessionStorage(key) === "1") return true;
  if (safeGetLocalStorage(key) === "1") return true;
  return false;
}

/** 写入 auth 标记；任一成功即可，全失败也不抛错。 */
export function writeAuthFlag(key: string): boolean {
  setMemorySessionFlag(key, true);
  const sessionOk = safeSetSessionStorage(key, "1");
  const localOk = safeSetLocalStorage(key, "1");
  return sessionOk || localOk;
}
