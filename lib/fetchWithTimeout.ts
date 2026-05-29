const DEFAULT_TIMEOUT_MS = 12000;

export class FetchTimeoutError extends Error {
  constructor(message = "加载超时，请刷新页面重试。") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

/** 带超时的 fetch；旧手机网络慢时避免无限等待。 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  if (typeof AbortController === "undefined") {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
