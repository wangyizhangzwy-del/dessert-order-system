import { CustomerOrderHistory } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";

// 配送方式关键词（不作为地址）。
const DELIVERY_METHOD_WORDS = ["自取", "叫车", "打车", "外卖", "到付", "自提"];

// 从一条备注里提取公寓/楼名地址。返回 null 表示该备注不是地址（如 自取/叫车/空）。
// 规则：去掉"送"前缀与括号；命中配送方式关键词则视为非地址；其余视为楼名（如 F8、888、The Grand、ViewTree）。
export function extractAddress(rawNotes: string | undefined | null): string | null {
  const note = (rawNotes ?? "").trim();
  if (!note) return null;

  const segments = note
    .split(/[；;，,、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = segments.length > 0 ? segments : [note];

  for (const seg of candidates) {
    const core = seg
      .replace(/^送\s*/, "")
      .replace(/[（）()【】\[\]]/g, "")
      .trim();
    if (!core) continue;
    if (DELIVERY_METHOD_WORDS.some((w) => core.includes(w))) continue;
    return core;
  }
  return null;
}

// 从客户历史订单里取"最近一次"的真实地址（按 order_date 倒序，回退 updated_at）。
// 若没有任何真实地址，返回 null（不会把 自取/叫车 当地址）。
export function deriveAddressFromHistory(
  history: CustomerOrderHistory[] | undefined | null
): string | null {
  const list = [...(history ?? [])].sort((a, b) => {
    const ta = parseOrderDate(a.order_date) ?? Date.parse(a.updated_at ?? "") ?? 0;
    const tb = parseOrderDate(b.order_date) ?? Date.parse(b.updated_at ?? "") ?? 0;
    const na = Number.isFinite(ta) ? (ta as number) : 0;
    const nb = Number.isFinite(tb) ? (tb as number) : 0;
    return nb - na;
  });
  for (const h of list) {
    const addr = extractAddress(h.notes);
    if (addr) return addr;
  }
  return null;
}
