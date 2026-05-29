import { DeliveryMode } from "@/lib/deliveryMode";
import { safeStr } from "@/lib/recognizeSafe";

export interface DeliveryRouteEntry {
  key: string;
  label: string;
  aliases: string[];
}

export const DELIVERY_ROUTE_ORDER: DeliveryRouteEntry[] = [
  { key: "aven", label: "aven", aliases: ["aven"] },
  { key: "wren", label: "wren", aliases: ["wren"] },
  {
    key: "hope&flower",
    label: "hope&flower",
    aliases: ["hope&flower", "hope & flower", "hope and flower", "hopeflower"],
  },
  { key: "1133", label: "1133", aliases: ["1133"] },
  { key: "888", label: "888", aliases: ["888"] },
  { key: "f8", label: "f8", aliases: ["f8", "F8"] },
  { key: "alina", label: "alina", aliases: ["alina"] },
  { key: "beaudry", label: "beaudry", aliases: ["beaudry"] },
  {
    key: "bedtla",
    label: "bedtla",
    aliases: ["bedtla", "be dtla", "beDTLA", "be-dtla", "be dtla"],
  },
  {
    key: "parkfifth",
    label: "parkfifth",
    aliases: ["parkfifth", "park fifth", "park-fifth"],
  },
  {
    key: "the grand",
    label: "the grand",
    aliases: ["the grand", "thegrand"],
  },
  { key: "perla", label: "perla", aliases: ["perla"] },
];

/** 匹配用：小写、去空格/短横线、&/and 归一。 */
export function compactDeliveryKey(value: string): string {
  return safeStr(value)
    .trim()
    .toLowerCase()
    .replace(/^送\s*/, "")
    .replace(/\band\b/g, "")
    .replace(/&/g, "")
    .replace(/[-\s_]+/g, "");
}

/** 将派送地址匹配到固定路线 key；匹配不到返回 null。 */
export function normalizeDeliveryLocation(value: string | null | undefined): string | null {
  const raw = safeStr(value).trim();
  if (!raw) return null;

  const compact = compactDeliveryKey(raw);
  if (!compact) return null;

  for (const route of DELIVERY_ROUTE_ORDER) {
    for (const alias of route.aliases) {
      if (compact === compactDeliveryKey(alias)) {
        return route.key;
      }
    }
  }
  return null;
}

export interface DeliveryRouteCustomerInput {
  wechatId?: string;
  customerName?: string;
  name?: string;
  needsDelivery?: boolean;
  deliveryNeeded?: boolean;
  deliveryMode?: DeliveryMode | string;
  addressForMatch?: string;
  deliveryValue?: string;
  deliveryAddress?: string;
  address?: string;
  deliveryDisplay?: string;
  notes?: string;
}

export interface DeliveryRouteCustomer {
  wechatId: string;
  notes: string;
}

export interface DeliveryRouteStop {
  key: string;
  label: string;
  customers: DeliveryRouteCustomer[];
}

export interface DeliveryRouteUnmatched {
  wechatId: string;
  rawAddress: string;
}

export interface DeliveryRouteSummary {
  hasDelivery: boolean;
  routeLabels: string[];
  stops: DeliveryRouteStop[];
  unmatched: DeliveryRouteUnmatched[];
}

function customerId(input: DeliveryRouteCustomerInput): string {
  return safeStr(input.wechatId || input.customerName || input.name).trim() || "未知客户";
}

function needsDelivery(input: DeliveryRouteCustomerInput): boolean {
  if (typeof input.needsDelivery === "boolean") return input.needsDelivery;
  if (typeof input.deliveryNeeded === "boolean") return input.deliveryNeeded;
  return true;
}

function isPickup(input: DeliveryRouteCustomerInput): boolean {
  const mode = safeStr(input.deliveryMode).toLowerCase();
  return mode === "pickup" || mode === "自取";
}

function resolveAddressForMatching(input: DeliveryRouteCustomerInput): string {
  const explicit = safeStr(input.addressForMatch).trim();
  if (explicit) return explicit;

  const display = safeStr(input.deliveryDisplay).trim();
  if (display && display !== "默认地址" && display !== "自取") return display;

  const candidates = [input.deliveryValue, input.deliveryAddress, input.address];
  for (const c of candidates) {
    const s = safeStr(c).trim();
    if (s && s !== "默认地址" && s !== "自取") return s;
  }
  return "";
}

function routeLabelForKey(key: string): string {
  const entry = DELIVERY_ROUTE_ORDER.find((r) => r.key === key);
  return entry?.label ?? key;
}

/** 基于客户汇总预览数据生成送货路线（固定顺序，跳过无单公寓）。 */
export function buildDeliveryRouteSummary(
  customerSummaries: DeliveryRouteCustomerInput[] | null | undefined
): DeliveryRouteSummary {
  const summaries = Array.isArray(customerSummaries) ? customerSummaries : [];
  const grouped = new Map<string, DeliveryRouteCustomer[]>();
  const unmatched: DeliveryRouteUnmatched[] = [];
  let deliveryCustomerCount = 0;

  for (const summary of summaries) {
    if (!summary || typeof summary !== "object") continue;
    if (!needsDelivery(summary)) continue;
    if (isPickup(summary)) continue;

    deliveryCustomerCount += 1;
    const wechatId = customerId(summary);
    const rawAddress = resolveAddressForMatching(summary);
    const notes = safeStr(summary.notes).trim();
    const routeKey = normalizeDeliveryLocation(rawAddress);

    if (routeKey) {
      const list = grouped.get(routeKey) ?? [];
      list.push({ wechatId, notes });
      grouped.set(routeKey, list);
    } else {
      unmatched.push({
        wechatId,
        rawAddress: rawAddress || "地址为空",
      });
    }
  }

  const stops: DeliveryRouteStop[] = [];
  const routeLabels: string[] = [];

  for (const route of DELIVERY_ROUTE_ORDER) {
    const customers = grouped.get(route.key);
    if (!customers || customers.length === 0) continue;
    stops.push({
      key: route.key,
      label: route.label,
      customers,
    });
    routeLabels.push(route.label);
  }

  return {
    hasDelivery: deliveryCustomerCount > 0,
    routeLabels,
    stops,
    unmatched,
  };
}
