import { CustomerOrderHistory } from "@/lib/types";
import { parseOrderDate } from "@/lib/sort";

// 配送方式关键词（不作为地址）。
const DELIVERY_METHOD_WORDS = ["自取", "叫车", "打车", "外卖", "到付", "自提"];

// 数量/赠品类备注，不作为永久地址（送2、+2、多送一个 等）。
const GIFT_QUANTITY_PATTERNS = [
  /^送?\s*\d{1,2}$/,
  /^[+＋]\s*\d+$/,
  /多送一个/,
  /加一个/,
];

export function isPickupNote(rawNotes: string | undefined | null): boolean {
  return (rawNotes ?? "").trim().includes("自取");
}

function isGiftOrQuantityNote(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return GIFT_QUANTITY_PATTERNS.some((p) => p.test(t));
}

function isDeliveryMethodOnly(text: string): boolean {
  const core = text.replace(/^送\s*/, "").trim();
  return DELIVERY_METHOD_WORDS.some((w) => core.includes(w));
}

// 从一条备注里提取公寓/楼名地址。返回 null 表示该备注不是地址（如 自取/叫车/赠品/空）。
export function extractAddress(rawNotes: string | undefined | null): string | null {
  const note = (rawNotes ?? "").trim();
  if (!note) return null;
  if (isPickupNote(note)) return null;

  const segments = note
    .split(/[；;，,、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = segments.length > 0 ? segments : [note];

  for (const seg of candidates) {
    if (isGiftOrQuantityNote(seg)) continue;
    const core = seg
      .replace(/^送\s*/, "")
      .replace(/[（）()【】\[\]]/g, "")
      .trim();
    if (!core) continue;
    if (isGiftOrQuantityNote(core)) continue;
    if (isDeliveryMethodOnly(core)) continue;
    if (DELIVERY_METHOD_WORDS.some((w) => core.includes(w))) continue;
    return core;
  }
  return null;
}

// 从客户历史订单里取"最近一次"的真实地址（按 order_date 倒序，回退 updated_at）。
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
