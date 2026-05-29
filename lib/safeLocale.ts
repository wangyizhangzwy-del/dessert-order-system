/** localeCompare with fallback for older iOS Safari. */
export function safeLocaleCompare(a: string, b: string): number {
  try {
    return a.localeCompare(b, "zh-Hans-CN");
  } catch {
    try {
      return a.localeCompare(b, "zh-CN");
    } catch {
      return a.localeCompare(b);
    }
  }
}
