import { extractAddress, isPickupNote } from "@/lib/address";

export type DeliveryMode = "default" | "pickup" | "custom";

export interface DeliveryModeState {
  mode: DeliveryMode;
  customText: string;
}

function normalizeAddressKey(s: string): string {
  return s
    .replace(/^送\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function addressesMatch(a: string, b: string): boolean {
  const ka = normalizeAddressKey(a.trim());
  const kb = normalizeAddressKey(b.trim());
  return ka.length > 0 && ka === kb;
}

// 根据接龙备注与客户已存 default_address 推断派送方式（未手动覆盖时使用）。
export function resolveDeliveryMode(orderNotes: string, defaultAddr?: string): DeliveryModeState {
  const notes = (orderNotes ?? "").trim();

  if (isPickupNote(notes)) {
    return { mode: "pickup", customText: "" };
  }

  const realAddr = extractAddress(notes);
  const saved = defaultAddr?.trim();

  if (saved) {
    // Case A — 客户已有 default_address
    if (!notes || !realAddr) {
      return { mode: "default", customText: "" };
    }
    if (addressesMatch(realAddr, saved) || addressesMatch(notes, saved)) {
      return { mode: "default", customText: "" };
    }
    return { mode: "custom", customText: realAddr || notes };
  }

  // Case B — 客户尚无 default_address
  if (realAddr) {
    return { mode: "custom", customText: realAddr };
  }
  if (!notes) {
    return { mode: "custom", customText: "" };
  }
  return { mode: "custom", customText: notes };
}

export function deliveryModeLabel(state: DeliveryModeState, defaultAddr?: string): string {
  if (state.mode === "pickup") return "自取";
  if (state.mode === "custom") return state.customText.trim();
  return defaultAddr?.trim() || "默认地址";
}
