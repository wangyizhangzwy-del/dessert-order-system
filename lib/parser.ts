import { MenuItem, OrderItem, ParsedOrder } from "@/lib/types";

export interface ParseResult {
  menu_items: MenuItem[];
  orders: ParsedOrder[];
  warning_count: number;
  failed_count: number;
}

const ORDER_LINE_RE = /^\s*\d+\.\s*/;
const PRICE_RE = /\d+(?:\.\d+)?/g;
const SKU1_FALLBACK_VARIANT_PRICES: Record<string, number> = {
  原味: 16.9,
  咸蛋黄: 21.9,
  芋泥: 19.9,
  麻薯: 19.9,
  奶贝: 19.9,
  芋泥奶贝: 21.9,
};

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[（(【\[]/g, " ")
    .replace(/[）)】\]]/g, " ")
    .replace(/[，,。.!！?？:：;；/]/g, " ")
    .replace(/\s+/g, "")
    .replaceAll("達", "达")
    .replaceAll("滋", "子");
}

function normalizeOrderPlusSymbols(input: string): string {
  return input
    .replace(/[＋➕﹢]/g, "+")
    .replace(/[X×＊*✖✕]/g, "x")
    .replace(/\uFE0F/g, "")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s*x\s*/g, "x");
}

/** 商品数量后缀：咸蛋黄*2 / 咸蛋黄 x2 / 焦糖泡芙×2 → base + quantity（非 SKU 乘法 11x3）。 */
export function parseProductQuantitySuffix(text: string): { base: string; quantity: number } {
  const trimmed = text.trim();
  if (!trimmed) return { base: trimmed, quantity: 1 };

  const m = trimmed.match(/^(.+?)x(\d+)$/i);
  if (m) {
    const base = m[1].trim();
    const qty = Number(m[2]);
    if (base && qty > 0 && /[^\d\s]/.test(base)) {
      return { base, quantity: qty };
    }
  }
  return { base: trimmed, quantity: 1 };
}

function stripProductQuantitySuffix(token: string): { token: string; quantity: number } {
  const normalized = normalizeOrderPlusSymbols(token.trim());
  const { base, quantity } = parseProductQuantitySuffix(normalized);
  return { token: base, quantity };
}

// 订单 SKU 区里，横杠（- – — －）位于两个数字之间时当作 +，例如 4-7 => 4+7。
// 只对已确认为下单 token 的内容做转换，避免影响客户名与备注/地址里的横杠。
function bridgeSkuHyphens(input: string): string {
  return input.replace(/(\d)[-–—－](?=\d)/g, "$1+");
}

const SKU_HYPHEN_TOKEN_RE = /^\d+(?:[-–—－]\d+)+$/;

function normalizeFlavorText(input: string): string {
  return normalizeOrderPlusSymbols(input)
    .replace(/[【\[\{｛]/g, "（")
    .replace(/[】\]\}｝]/g, "）");
}

function expandFlavorCounts(input: string, allowedVariants: string[]): string[] {
  const allowed = allowedVariants
    .map((v) => ({ raw: v, norm: normalizeText(v) }))
    .sort((a, b) => b.norm.length - a.norm.length);
  let remaining = normalizeText(normalizeFlavorText(input)).replace(/\+/g, "");
  const result: string[] = [];
  while (remaining.length > 0) {
    const prefixNum = remaining.match(/^(\d+)/);
    if (prefixNum) {
      const count = Number(prefixNum[1]);
      remaining = remaining.slice(prefixNum[1].length);
      const matched = allowed.find((v) => remaining.startsWith(v.norm));
      if (!matched) return [];
      for (let i = 0; i < count; i += 1) result.push(matched.raw);
      remaining = remaining.slice(matched.norm.length);
      continue;
    }
    const matched = allowed.find((v) => remaining.startsWith(v.norm));
    if (!matched) return [];
    remaining = remaining.slice(matched.norm.length);
    const suffixNum = remaining.match(/^x(\d+)/);
    const count = suffixNum ? Number(suffixNum[1]) : 1;
    for (let i = 0; i < count; i += 1) result.push(matched.raw);
    if (suffixNum) remaining = remaining.slice(1 + suffixNum[1].length);
  }
  return result;
}

const NOTE_KEYWORDS = [
  "自取",
  "取",
  "自提",
  "配送",
  "送",
  "kurve",
  "figueroa eight",
  "the eden",
  "the grand",
  "park fifth",
  "beaudry",
  "aven",
  "amp loft",
  "atelier",
];

function isLikelyNoteText(text: string): boolean {
  const raw = text.trim();
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  if (/^\d+$/.test(raw)) return true;
  if (/\d+\s+\w+/.test(normalized) || /\d+\s+[a-z]/.test(normalized)) return true; // address-like
  if (/周[一二三四五六日天]\s*送/.test(raw)) return true;
  return NOTE_KEYWORDS.some((k) => normalized.includes(k));
}

const CN_NUMERALS: Record<string, number> = {
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

// 解析菜单名里“一盒四个 / 4个”的每盒件数。
function parseBoxPieceCount(name: string): number | null {
  const m = name.match(/([0-9]+|[二两三四五六七八九十])\s*个/);
  if (!m) return null;
  const token = m[1];
  const n = /^[0-9]+$/.test(token) ? Number(token) : CN_NUMERALS[token] ?? null;
  return n && n >= 2 ? n : null;
}

// 判断是否为“多口味组合盒”（SKU 8 风格：一盒 N 件，N 个口味组合，flavor_combo 计费一份）。
// SKU 1 固定为一盒一口味（多口味=多盒），永不视为组合盒。
function comboPieceCount(menuItem: MenuItem | undefined): number | null {
  if (!menuItem) return null;
  if (menuItem.sku_code === "8") return 4;
  if ((menuItem.cake_name ?? "").includes("肉松小贝")) return null;
  if (menuItem.sku_code === "8") return 4;
  if (!menuItem.has_variants) return null;
  return parseBoxPieceCount(menuItem.cake_name);
}

// 把口味按盒内件数平均分配；当口味数不足且能整除时按 件数/口味数 平铺：
// 1 个口味 => 全部相同；四件盒 2 个口味 => 2+2；4 个口味 => 原样保留。
function distributeComboFlavors(flavors: string[], pieceCount: number): string[] {
  if (flavors.length === 0 || flavors.length >= pieceCount) return flavors;
  if (pieceCount % flavors.length !== 0) return flavors;
  const each = pieceCount / flavors.length;
  const out: string[] = [];
  for (const flavor of flavors) {
    for (let i = 0; i < each; i += 1) out.push(flavor);
  }
  return out;
}

function extractMenuPrices(body: string): number[] {
  const withoutLimitNotes = body.replace(
    /[（(][^）)]*(?:限量|仅剩|限)\s*\d+[^）)]*[）)]/g,
    ""
  );

  const slashUnitPrices =
    withoutLimitNotes
      .match(/\d+(?:\.\d+)?\s*\/\s*[块个盒份]/g)
      ?.map((m) => Number(m.match(/\d+(?:\.\d+)?/)?.[0] ?? 0))
      .filter((n) => n > 0) ?? [];
  if (slashUnitPrices.length > 0) return slashUnitPrices;

  const decimalPrices = withoutLimitNotes.match(/\d+\.\d+/g)?.map(Number) ?? [];
  if (decimalPrices.length > 0) return decimalPrices;

  const trailing = withoutLimitNotes.match(/(\d+(?:\.\d+)?)\s*$/);
  if (trailing) return [Number(trailing[1])];

  return (body.match(PRICE_RE) ?? []).map(Number);
}

function cleanMenuProductName(name: string): string {
  return name
    .replace(/\d+\.\d+(?:\s*\/\s*[块个盒份])?/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:\/\s*\d+(?:\.\d+)?)+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMenuItem(line: string): MenuItem | null {
  const match = line.match(/^\s*(\d+)\.\s*(.+)$/);
  if (!match) return null;
  const sku = match[1];
  const body = match[2];
  const prices = extractMenuPrices(body);
  const variantsMatch = body.match(/[（(]([^）)]+)[）)]/);
  const variantNames = variantsMatch
    ? variantsMatch[1]
        .split("/")
        .map((v) => v.trim())
        .filter((v) => v && !/^\d+$/.test(v) && !/限量|块|个/.test(v))
    : [];

  const name = cleanMenuProductName(
    body
      .replace(/[（(][^）)]+[）)]/g, "")
      .replace(/\d+(?:\.\d+)?(?:\s*\/\s*[个盒份])?\s*$/g, "")
      .replace(/\d+(?:\.\d+)?\s*(?:\/\s*\d+(?:\.\d+)?)+\s*$/g, "")
  );

  if (!name) return null;

  // “一盒四个（口味/口味/...）”这类组合盒即使只有一个价格，也按多口味组合盒处理（同 SKU 8）。
  const isComboBox = !isXiaoBeiMenuItem({ sku_code: sku, cake_name: name, has_variants: false, price: 0 }) &&
    parseBoxPieceCount(name) !== null;
  // 多口味选项：多个价格（如肉松小贝）或单一价格（如 9号 乌龙茶/香草 同价）均视为 has_variants。
  if (
    variantNames.length > 1 &&
    (prices.length >= variantNames.length || prices.length >= 1 || sku === "8" || isComboBox)
  ) {
    const variants = variantNames.map((variant_name, idx) => ({
      variant_name,
      price: prices[idx] ?? prices[0] ?? 0,
    }));
    return {
      sku_code: sku,
      cake_name: name,
      has_variants: true,
      default_variant: variants[0]?.variant_name ?? "原味",
      variants,
      price: prices[0] ?? 0,
    };
  }

  return {
    sku_code: sku,
    cake_name: name,
    has_variants: false,
    price: prices[0] ?? 0,
  };
}

function isLikelyOrderLine(line: string): boolean {
  if (!ORDER_LINE_RE.test(line)) return false;
  const body = line.replace(ORDER_LINE_RE, "").trim();
  if (!body) return false;
  if (/\d+\.\d+/.test(body)) return false;
  return /\+\d|^\S+\s+\d|(?:^|\s)\d+[^\d\s]+/.test(body);
}

function splitSections(rawText: string): { menuLines: string[]; orderLines: string[] } {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const numbered = lines.filter((l) => ORDER_LINE_RE.test(l));
  const nums = numbered.map((line) => Number((line.match(/^\s*(\d+)\./) ?? [])[1] ?? 0));

  // 规则优先：菜单编号通常是递增，客户区会从 1 重新开始
  let orderStart = -1;
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] === 1 && nums[i - 1] > 1) {
      orderStart = i;
      break;
    }
  }

  // 兜底：如果无法通过“编号重置”定位，再用内容特征判断
  if (orderStart < 0) {
    orderStart = numbered.findIndex((line, idx) => idx >= 3 && isLikelyOrderLine(line));
  }
  if (orderStart < 0) orderStart = numbered.length;

  return {
    menuLines: numbered.slice(0, orderStart),
    orderLines: numbered.slice(orderStart),
  };
}

function fuzzyFindMenuByKeyword(keyword: string, menu: MenuItem[]): { item?: MenuItem; warning?: string } {
  const key = normalizeText(keyword);
  if (!key) return { warning: `关键词为空: ${keyword}` };

  const matched = menu.filter((m) => normalizeText(m.cake_name).includes(key) || key.includes(normalizeText(m.cake_name)));
  if (matched.length === 1) return { item: matched[0] };
  if (matched.length > 1) return { warning: `关键词 "${keyword}" 匹配到多个商品` };
  return { warning: `未匹配到商品关键词 "${keyword}"` };
}

function hasCjk(input: string): boolean {
  return /[\u4e00-\u9fff]/.test(input);
}

const PRODUCT_FILLER_RE = /(脆壳|一盒|plus版|plus|版)/g;

// 产品名 normalization：复用 normalizeText（去空格/标点、達→达、滋→子），
// 再统一 兹→子，并去掉不影响匹配的小词，便于 fuzzy match。
function normalizeProductKeyword(input: string): string {
  return normalizeText(input).replace(/兹/g, "子").replace(PRODUCT_FILLER_RE, "");
}

function isSubsequence(needle: string, hay: string): boolean {
  if (!needle) return false;
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j += 1) {
    if (hay[j] === needle[i]) i += 1;
  }
  return i === needle.length;
}

// 根据当前菜单 fuzzy match 产品名。SKU 1 / SKU 8 有固定特殊规则，不参与产品名匹配。
function matchProductNameToMenuItem(
  keyword: string,
  menu: MenuItem[]
): { item?: MenuItem; ambiguous: boolean; matched: boolean } {
  const k = normalizeProductKeyword(keyword);
  if (k.length < 2) return { ambiguous: false, matched: false };

  const candidates = menu
    .filter((m) => m.sku_code !== "8" && !(m.cake_name ?? "").includes("肉松小贝"))
    .map((m) => ({ m, c: normalizeProductKeyword(m.cake_name) }))
    .filter((x) => x.c.length > 0);

  const pick = (list: { m: MenuItem }[]) => {
    if (list.length === 1) return { item: list[0].m, ambiguous: false, matched: true };
    if (list.length > 1) return { ambiguous: true, matched: true };
    return null;
  };

  const exact = pick(candidates.filter((x) => x.c === k));
  if (exact) return exact;

  const contains = pick(candidates.filter((x) => x.c.includes(k) || k.includes(x.c)));
  if (contains) return contains;

  const subseq = pick(candidates.filter((x) => isSubsequence(k, x.c)));
  if (subseq) return subseq;

  return { ambiguous: false, matched: false };
}

function extractVariantsFromText(tail: string, menuItem: MenuItem): string[] {
  if (!menuItem.has_variants || !menuItem.variants?.length) return [];
  const variants = menuItem.variants.map((v) => ({
    raw: v.variant_name,
    norm: normalizeText(v.variant_name),
  }));
  const sorted = [...variants].sort((a, b) => b.norm.length - a.norm.length);

  // 支持 8（抹茶/黑芝麻/巧克力）/ 8(抹茶/...)，以及尾部带少量噪声文本
  const exactBracketMatch = tail.match(/^[（(]([^）)]+)[）)]$/);
  const containsBracketMatch = tail.match(/[（(]([^）)]+)[）)]/);
  const bracketContent = exactBracketMatch?.[1] ?? containsBracketMatch?.[1];
  if (bracketContent) {
    return bracketContent
      .split(/[\/、，,\s]+/)
      .map((seg) => seg.trim())
      .filter(Boolean);
  }

  // 支持连续口味写法：抹茶黑芝麻巧克力抹茶
  let remaining = normalizeText(tail).replaceAll("/", "");
  if (!remaining) return [];
  const picked: string[] = [];
  while (remaining.length > 0) {
    const matched = sorted.find((v) => remaining.startsWith(v.norm));
    if (!matched) return [];
    picked.push(matched.raw);
    remaining = remaining.slice(matched.norm.length);
  }
  return picked;
}

function parseSku8FlavorCombo(tail: string, sku8: MenuItem): string[] {
  const allowed = sku8.variants ?? [];
  if (allowed.length === 0) return [];
  const normToRaw = new Map(allowed.map((v) => [normalizeText(v.variant_name), v.variant_name]));

  const exactBracketMatch = tail.match(/^[（(]([^）)]+)[）)]$/);
  const containsBracketMatch = tail.match(/[（(]([^）)]+)[）)]/);
  const content = exactBracketMatch?.[1] ?? containsBracketMatch?.[1] ?? tail;
  const normalized = normalizeFlavorText(content).replace(/[【】\[\]{}｛｝]/g, "");
  const segments = normalized
    .split(/[\/／、，,\s+➕＋]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const fromSegments: string[] = [];
  let segmentsAllValid = true;
  if (segments.length > 0) {
    for (const seg of segments) {
      const m = seg.match(/^(.+?)(?:\*|x|X|×)(\d+)$/);
      const base = (m?.[1] ?? seg).trim();
      const count = Number(m?.[2] ?? "1");
      const raw = normToRaw.get(normalizeText(base));
      if (!raw || !Number.isFinite(count) || count <= 0) {
        segmentsAllValid = false;
        break;
      }
      for (let i = 0; i < count; i += 1) fromSegments.push(raw);
    }
    if (segmentsAllValid && fromSegments.length > 0) return fromSegments;
  }

  const fromCompact = expandFlavorCounts(normalized, allowed.map((a) => a.variant_name));
  if (fromCompact.length > 0) return fromCompact;

  const variants = extractVariantsFromText(tail, sku8);
  if (variants.length === 0) return [];
  return variants.filter((v) => normToRaw.has(normalizeText(v)));
}

function convertVariantOfSku1(input: string): string {
  const match = input.match(/^(.+?)的1$/);
  if (!match) return input;
  const variant = match[1].trim();
  const allowed = ["原味", "咸蛋黄", "芋泥", "麻薯", "奶贝", "芋泥奶贝"];
  return allowed.includes(variant) ? `1${variant}` : input;
}

function splitSku1BracketVariants(tail: string): string[] {
  const match = tail.match(/^[（(]([^）)]+)[）)]$/);
  if (!match) return [];
  return match[1]
    .split(/[+➕＋\/／、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitOrderParts(token: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of token) {
    if (ch === "（" || ch === "(") depth += 1;
    if (ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "+" && depth === 0) {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) parts.push(last);
  return parts;
}

function mergeBracketTokens(tokens: string[]): string[] {
  const merged: string[] = [];
  let buf = "";
  let depth = 0;
  for (const t of tokens) {
    const opens = (t.match(/[（(]/g) ?? []).length;
    const closes = (t.match(/[）)]/g) ?? []).length;
    if (depth > 0 || opens > closes) {
      buf = buf ? `${buf} ${t}` : t;
      depth += opens - closes;
      if (depth <= 0) {
        merged.push(buf.trim());
        buf = "";
        depth = 0;
      }
      continue;
    }
    if (buf) {
      merged.push(buf.trim());
      buf = "";
      depth = 0;
    }
    merged.push(t);
  }
  if (buf) merged.push(buf.trim());
  return merged;
}

// SKU 1 肉松小贝的口味短名（客户直接写商品名，而非 1原味/1（麻薯））。
const SKU1_FLAVOR_SHORTNAMES: Record<string, string> = {
  原味小贝: "原味",
  咸蛋黄小贝: "咸蛋黄",
  芋泥小贝: "芋泥",
  麻薯小贝: "麻薯",
  奶贝小贝: "奶贝",
  奶贝: "奶贝",
  芋泥奶贝小贝: "芋泥奶贝",
  芋泥奶贝: "芋泥奶贝",
};

// SKU 1 的合法口味（长口味在前，便于最长匹配）。
const SKU1_VARIANT_NAMES = ["芋泥奶贝", "咸蛋黄", "原味", "芋泥", "麻薯", "奶贝"];
// SKU 1 的产品名词，作为“这是肉松小贝”的信号。
const SKU1_PRODUCT_WORDS = ["肉松小贝", "小贝", "肉松"];

// SKU 1 口味与数字/产品名的顺序不重要，下列写法都识别为 SKU 1 + 对应口味：
//   1原味 / 原味1 / 原味小贝 / 原味肉松小贝 / 肉松小贝原味 / 芋泥1 / 奶贝1 / 芋泥奶贝1 ...
// 纯口味词（原味/咸蛋黄/芋泥/麻薯）必须带 SKU1 信号（产品名或数字1）才判定为 SKU1，
// 避免把通用口味词误判；奶贝 / 芋泥奶贝 作为独立商品名仍在短名表里单独命中。
function resolveSku1ShortVariant(token: string): string | null {
  const norm = normalizeText(token);
  if (!norm) return null;

  const short = SKU1_FLAVOR_SHORTNAMES[norm];
  if (short) return short;

  let rest = norm;
  let hasProductWord = false;
  for (const word of SKU1_PRODUCT_WORDS) {
    if (rest.includes(word)) {
      rest = rest.split(word).join("");
      hasProductWord = true;
    }
  }

  // 去掉一个 SKU 标识数字 “1”（位于口味前或后），但不要拆纯数字 token（如 11、13）。
  let hasOne = false;
  if (!/^\d+$/.test(rest)) {
    if (rest.startsWith("1")) {
      rest = rest.replace(/^1/, "");
      hasOne = true;
    } else if (rest.endsWith("1")) {
      rest = rest.replace(/1$/, "");
      hasOne = true;
    }
  }

  if (/\d/.test(rest)) return null;

  if (rest === "") {
    return hasProductWord || hasOne ? "原味" : null;
  }
  if (SKU1_VARIANT_NAMES.includes(rest)) {
    return hasProductWord || hasOne ? rest : null;
  }
  return null;
}

const SKU1_FLAVOR_ALTERNATION = "(?:芋泥奶贝|咸蛋黄|原味|芋泥|麻薯|奶贝)";

function joinXiaoBeiFlavorNumber(content: string, menu: MenuItem[]): string {
  const prefixes = xiaoBeiDigitPrefixes(menu);
  if (prefixes.length === 0) return content;
  let result = content;
  for (const prefix of prefixes) {
    const flavorThenOne = new RegExp(`(^|\\s)(${SKU1_FLAVOR_ALTERNATION})\\s+${prefix}(?=\\s|$)`, "g");
    const oneThenFlavor = new RegExp(`(^|\\s)${prefix}\\s+(${SKU1_FLAVOR_ALTERNATION})(?=\\s|$)`, "g");
    result = result
      .replace(flavorThenOne, (_, pre, flavor) => `${pre}${flavor}${prefix}`)
      .replace(oneThenFlavor, (_, pre, flavor) => `${pre}${prefix}${flavor}`);
  }
  return result;
}

/** @deprecated use joinXiaoBeiFlavorNumber */
const joinSku1FlavorNumber = joinXiaoBeiFlavorNumber;

function findXiaoBeiMenuItem(menu: MenuItem[]): MenuItem | undefined {
  return menu.find((m) => (m.cake_name ?? "").includes("肉松小贝"));
}

function isXiaoBeiMenuItem(menuItem: MenuItem | undefined): boolean {
  if (!menuItem) return false;
  return (menuItem.cake_name ?? "").includes("肉松小贝");
}

/** 肉松小贝口味数字前缀：本次菜单中肉松小贝的 SKU，以及常用的 5 缩写。 */
function xiaoBeiDigitPrefixes(menu: MenuItem[]): string[] {
  const item = findXiaoBeiMenuItem(menu);
  if (!item) return [];
  const prefixes = new Set<string>([item.sku_code]);
  if (item.sku_code !== "5") prefixes.add("5");
  return [...prefixes];
}

function matchXiaoBeiVariantName(rest: string): string | null {
  const norm = normalizeText(rest);
  if (!norm) return null;
  const short = SKU1_FLAVOR_SHORTNAMES[norm];
  if (short) return short;
  for (const v of SKU1_VARIANT_NAMES) {
    if (normalizeText(v) === norm) return v;
  }
  return resolveSku1ShortVariant(rest);
}

/** 肉松小贝口味 token：菜单含肉松小贝时，按本次 SKU / 5 缩写识别。 */
function resolveXiaoBeiVariantToken(
  token: string,
  menu: MenuItem[]
): { variant: string; quantity: number } | null {
  if (!findXiaoBeiMenuItem(menu)) return null;

  const { token: base, quantity } = stripProductQuantitySuffix(token);
  const norm = normalizeText(base);
  if (!norm) return null;

  const short = SKU1_FLAVOR_SHORTNAMES[norm];
  if (short) return { variant: short, quantity };

  const fromResolver = resolveSku1ShortVariant(base);
  if (fromResolver) return { variant: fromResolver, quantity };

  for (const prefix of xiaoBeiDigitPrefixes(menu)) {
    const prefixed = base.match(new RegExp(`^${prefix}(?:号|[-－])?(.+)$`));
    if (prefixed?.[1]) {
      const variant = matchXiaoBeiVariantName(prefixed[1]);
      if (variant) return { variant, quantity };
    }
    const suffix = base.match(new RegExp(`^(.+)${prefix}$`));
    if (suffix?.[1]) {
      const variant = matchXiaoBeiVariantName(suffix[1]);
      if (variant) return { variant, quantity };
    }
  }

  const bareVariant = SKU1_VARIANT_NAMES.find((v) => normalizeText(v) === norm);
  if (bareVariant) return { variant: bareVariant, quantity };

  return null;
}

function looksLikeOrderProductFragment(s: string): boolean {
  const t = normalizeOrderPlusSymbols(s.trim());
  if (!t || t === "+") return false;
  if (/^\d+(?:[-–—－]\d+)+$/.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^(\d+)[xX×][\d]+$/i.test(t)) return true;
  if (/^(?:1|5)(?:号|[-－])?[\u4e00-\u9fff]/.test(t)) return true;
  if (/^(\d+)[^\d\s]+/.test(t)) return true;
  if (/[\u4e00-\u9fff]/.test(t) && !isLikelyNoteText(t)) return true;
  return false;
}

/** 逗号/顿号连接的商品转为 +，不误拆地址备注。 */
function expandCommaProductSeparators(input: string): string {
  let out = input;
  let prev = "";
  const pattern = /([^\s，,、+（(]+)\s*[，,、]\s*([^\s，,、+）)]+)/;
  while (prev !== out) {
    prev = out;
    out = out.replace(pattern, (full, left: string, right: string) => {
      if (looksLikeOrderProductFragment(left) && looksLikeOrderProductFragment(right)) {
        return `${left.trim()}+${right.trim()}`;
      }
      return full;
    });
  }
  return out;
}

function makeSku1MenuItem(menu: MenuItem[]): MenuItem | undefined {
  const inMenu = findXiaoBeiMenuItem(menu);
  if (inMenu?.variants?.length) return inMenu;
  if (inMenu) {
    return {
      ...inMenu,
      has_variants: true,
      default_variant: "原味",
      variants: Object.entries(SKU1_FALLBACK_VARIANT_PRICES).map(([variant_name, price]) => ({
        variant_name,
        price,
      })),
    };
  }
  return undefined;
}

function orderItemFromSku(
  menuItem: MenuItem,
  quantity: number,
  variantInput?: string,
  flavorComboInput?: string
): { item?: OrderItem; warning?: string } {
  if (quantity <= 0) return { warning: `无效数量 ${quantity}` };

  if (isXiaoBeiMenuItem(menuItem)) {
    const sku1 = menuItem.variants?.length
      ? menuItem
      : makeSku1MenuItem([menuItem]) ?? menuItem;
    const variantName = variantInput?.trim() || sku1.default_variant || "原味";
    const variant =
      sku1.variants?.find((v) => normalizeText(v.variant_name) === normalizeText(variantName)) ??
      (SKU1_FALLBACK_VARIANT_PRICES[variantName]
        ? { variant_name: variantName, price: SKU1_FALLBACK_VARIANT_PRICES[variantName] }
        : undefined);
    if (!variant) return { warning: `肉松小贝口味 "${variantName}" 无法识别` };
    const line_total = roundMoney(variant.price * quantity);
    const cakeName = cleanMenuProductName(sku1.cake_name ?? "") || "肉松小贝一盒三个";
    return {
      item: {
        sku_code: sku1.sku_code,
        variant: variant.variant_name,
        cake_name: cakeName,
        display_name: `${cakeName}${variant.variant_name}`,
        quantity,
        unit_price: variant.price,
        line_total,
      },
    };
  }

  if (comboPieceCount(menuItem)) {
    const unitPrice = menuItem.price ?? 0;
    const flavor_combo = flavorComboInput?.trim();
    // 产品名取自本次菜单的 cake_name；组合盒（SKU 8 风格）按“一盒 N 件口味组合”计一份。
    const baseName = menuItem.cake_name || "牛油酥皮小泡芙";
    const display_name = flavor_combo ? `${baseName}（${flavor_combo}）` : baseName;
    return {
      item: {
        sku_code: menuItem.sku_code,
        cake_name: menuItem.cake_name,
        display_name,
        flavor_combo,
        quantity,
        unit_price: unitPrice,
        line_total: roundMoney(unitPrice * quantity),
      },
    };
  }

  if (menuItem.has_variants) {
    const variantName = variantInput?.trim() || menuItem.default_variant || "原味";
    const variant = menuItem.variants?.find(
      (v) => normalizeText(v.variant_name) === normalizeText(variantName)
    );
    if (!variant) {
      return { warning: `SKU ${menuItem.sku_code} 口味 "${variantName}" 无法识别` };
    }
    const line_total = roundMoney(variant.price * quantity);
    return {
      item: {
        sku_code: menuItem.sku_code,
        variant: variant.variant_name,
        cake_name: menuItem.cake_name,
        display_name: `${menuItem.cake_name} ${variant.variant_name}`,
        quantity,
        unit_price: variant.price,
        line_total,
      },
    };
  }

  const unitPrice = menuItem.price ?? 0;
  return {
    item: {
      sku_code: menuItem.sku_code,
      cake_name: menuItem.cake_name,
      display_name: menuItem.cake_name,
      quantity,
      unit_price: unitPrice,
      line_total: roundMoney(unitPrice * quantity),
    },
  };
}

// 从组合盒 token 的尾巴里取出口味列表（支持括号写法）与尾随备注。
function parseComboFlavorTail(
  skuItem: MenuItem,
  tail: string
): { flavors: string[]; suffixNote: string; recognized: boolean } {
  const bracket = tail.match(/[（(][^）)]+[）)]/);
  const flavorInput = bracket ? bracket[0] : tail;
  const suffixNote = bracket ? tail.replace(bracket[0], "").trim() : "";
  const flavors = parseSku8FlavorCombo(flavorInput, skuItem);
  return { flavors, suffixNote, recognized: flavors.length > 0 };
}

function parseOrderToken(token: string, menu: MenuItem[]): { items: OrderItem[]; warnings: string[] } {
  const clean = bridgeSkuHyphens(normalizeOrderPlusSymbols(token.trim()));
  if (!clean) return { items: [], warnings: [] };
  const normalizedToken = convertVariantOfSku1(clean).replace(/^(.+?)的(\d+)$/, "$2$1");
  const parts = splitOrderParts(normalizedToken)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p !== "+");
  const allItems: OrderItem[] = [];
  const warnings: string[] = [];
  // 组合盒（SKU 8 风格）按 SKU 汇总口味，支持 7原味+7抹茶 这类重复 SKU 的写法。
  const comboAcc = new Map<string, { menuItem: MenuItem; flavors: string[] }>();

  for (const part of parts) {
    const xiaoBeiItem = findXiaoBeiMenuItem(menu);
    const sku1Resolved = xiaoBeiItem ? resolveXiaoBeiVariantToken(part, menu) : null;
    if (sku1Resolved && xiaoBeiItem) {
      const parsed = orderItemFromSku(xiaoBeiItem, sku1Resolved.quantity, sku1Resolved.variant);
      if (parsed.item) allItems.push(parsed.item);
      if (parsed.warning) warnings.push(parsed.warning);
      continue;
    }

    const m = part.match(/^(\d+)(.*)$/);
    if (!m) {
      // 没有 SKU 数字前缀：按当前菜单做产品名 fuzzy match
      const { token: namePart, quantity: nameQty } = stripProductQuantitySuffix(part);
      if (hasCjk(namePart) && !isLikelyNoteText(namePart)) {
        const matched = matchProductNameToMenuItem(namePart, menu);
        if (matched.item) {
          const parsed = orderItemFromSku(matched.item, nameQty);
          if (parsed.item) allItems.push(parsed.item);
          if (parsed.warning) warnings.push(parsed.warning);
          continue;
        }
        if (matched.ambiguous) {
          warnings.push(`"${namePart}" 多个商品匹配，请人工确认`);
          continue;
        }
      }
      warnings.push(`无法识别 token "${part}"`);
      continue;
    }
    const n = Number(m[1]);
    let tail = m[2].trim();
    const tailQty = stripProductQuantitySuffix(tail);
    tail = tailQty.token;
    const itemQty = tailQty.quantity;
    const skuItem = menu.find((it) => it.sku_code === String(n));

    if (!tail) {
      if (!skuItem) {
        warnings.push(`SKU ${n} 不存在`);
        continue;
      }
      const parsed = orderItemFromSku(skuItem, itemQty);
      if (parsed.item) allItems.push(parsed.item);
      if (parsed.warning) warnings.push(parsed.warning);
      continue;
    }

    // 数量乘法：11x3 / 11*3 / 11×3 / 11＊3（仅 tail 为 xN，不含商品名）
    const multiply = tail.match(/^x(\d+)$/i);
    if (multiply) {
      if (!skuItem) {
        warnings.push(`SKU ${n} 不存在`);
        continue;
      }
      const qty = Number(multiply[1]);
      const parsed = orderItemFromSku(skuItem, qty);
      if (parsed.item) allItems.push(parsed.item);
      if (parsed.warning) warnings.push(parsed.warning);
      continue;
    }

    if (isXiaoBeiMenuItem(skuItem)) {
      const bracketVariants = splitSku1BracketVariants(tail);
      if (bracketVariants.length > 0) {
        bracketVariants.forEach((variantName) => {
          const parsed = orderItemFromSku(skuItem!, itemQty, variantName);
          if (parsed.item) allItems.push(parsed.item);
          if (parsed.warning) warnings.push(parsed.warning);
        });
        continue;
      }
      const sku1Tail = resolveXiaoBeiVariantToken(`${n}${tail}`, menu);
      if (sku1Tail) {
        const parsed = orderItemFromSku(skuItem!, sku1Tail.quantity, sku1Tail.variant);
        if (parsed.item) allItems.push(parsed.item);
        if (parsed.warning) warnings.push(parsed.warning);
        continue;
      }
    }

    if (skuItem && comboPieceCount(skuItem)) {
      const { flavors, suffixNote, recognized } = parseComboFlavorTail(skuItem, tail);
      if (!recognized) {
        warnings.push(`SKU ${n} 口味组合无法识别: "${tail}"`);
        continue;
      }
      const acc = comboAcc.get(skuItem.sku_code);
      if (acc) acc.flavors.push(...flavors);
      else comboAcc.set(skuItem.sku_code, { menuItem: skuItem, flavors: [...flavors] });
      if (suffixNote) warnings.push(`__NOTE__${suffixNote}`);
      continue;
    }

    // 例：7自取 / 2FigueroaEight，尾巴是备注时保留商品并把尾巴交给 notes
    if (skuItem && isLikelyNoteText(tail)) {
      const parsed = orderItemFromSku(skuItem, itemQty);
      if (parsed.item) allItems.push(parsed.item);
      if (parsed.warning) warnings.push(parsed.warning);
      warnings.push(`__NOTE__${tail}`);
      continue;
    }

    const isSingleVariant = skuItem?.has_variants
      ? skuItem.variants?.some((v) => normalizeText(v.variant_name) === normalizeText(tail))
      : false;
    if (skuItem && isSingleVariant) {
      const parsed = orderItemFromSku(skuItem, itemQty, tail);
      if (parsed.item) allItems.push(parsed.item);
      if (parsed.warning) warnings.push(parsed.warning);
      continue;
    }

    // 支持多口味一次性写法：8（抹茶/黑芝麻/巧克力/焙茶）或 8抹茶黑芝麻巧克力抹茶
    if (skuItem?.has_variants && skuItem.sku_code !== "8") {
      const extracted = extractVariantsFromText(tail, skuItem);
      if (extracted.length > 0) {
        extracted.forEach((variantName) => {
          const parsed = orderItemFromSku(skuItem, itemQty, variantName);
          if (parsed.item) allItems.push(parsed.item);
          if (parsed.warning) warnings.push(parsed.warning);
        });
        continue;
      }
    }

    const fuzzy = fuzzyFindMenuByKeyword(tail, menu);
    if (fuzzy.item) {
      const parsed = orderItemFromSku(fuzzy.item, itemQty);
      if (parsed.item) allItems.push(parsed.item);
      if (parsed.warning) warnings.push(parsed.warning);
      continue;
    }

    warnings.push(fuzzy.warning ?? `无法解析 token "${part}"`);
  }

  // 组合盒收尾：把累计口味按盒内件数平均分配，每个组合盒 SKU 输出一个 flavor_combo 商品。
  for (const acc of comboAcc.values()) {
    const pieceCount = comboPieceCount(acc.menuItem) ?? acc.flavors.length;
    const flavorList = distributeComboFlavors(acc.flavors, pieceCount);
    const combo = flavorList.length ? flavorList.join("/") : undefined;
    const parsed = orderItemFromSku(acc.menuItem, 1, undefined, combo);
    if (parsed.item) allItems.push(parsed.item);
    if (parsed.warning) warnings.push(parsed.warning);
    if (flavorList.length > 0 && flavorList.length !== pieceCount) {
      warnings.push(`SKU ${acc.menuItem.sku_code} 口味数量不是${pieceCount}个，请人工确认`);
    }
  }

  return { items: allItems, warnings };
}

function orderTokenBase(token: string): string {
  return stripProductQuantitySuffix(normalizeOrderPlusSymbols(token)).token;
}

function parseSingleOrder(line: string, menu: MenuItem[]): ParsedOrder {
  const content = expandCommaProductSeparators(
    joinXiaoBeiFlavorNumber(line.replace(ORDER_LINE_RE, "").trim(), menu)
  );
  const parts = content.split(/\s+/).filter(Boolean);
  const maxSku = Math.max(...menu.map((m) => Number(m.sku_code)), 0);
  const canBeOrderStart = (token: string): boolean => {
    if (!token) return false;
    if (/^.+的\d+$/.test(token)) return true; // 麻薯的1
    if (token.includes("+")) return true;
    if (SKU_HYPHEN_TOKEN_RE.test(token)) {
      // 4-7 / 11-3：横杠连接的纯 SKU token
      return token.split(/[-–—－]/).every((n) => Number(n) > 0 && Number(n) <= maxSku);
    }
    const mul = token.replace(/\uFE0F/g, "").match(/^(\d+)[xX×＊*✖✕](\d+)$/);
    if (mul) return Number(mul[1]) > 0 && Number(mul[1]) <= maxSku; // 2*2 / 11x3 数量乘法
    if (/^\d+$/.test(token)) return Number(token) > 0 && Number(token) <= maxSku;
    if (/^\d+[^\d\s]+$/.test(token)) return true; // 1芋泥, 8（抹茶/..）
    if (resolveXiaoBeiVariantToken(token, menu)) return true;
    if (resolveSku1ShortVariant(orderTokenBase(token))) return true; // 原味小贝 / 奶贝 ...
    // 产品名直接点单：焙茶草莓达克瓦滋 / 焦糖小泡芙 / 咸蛋黄x2
    const productBase = orderTokenBase(token);
    if (hasCjk(productBase) && matchProductNameToMenuItem(productBase, menu).matched) return true;
    return false;
  };

  let splitIndex = parts.findIndex((p, idx) => idx > 0 && canBeOrderStart(p));
  if (splitIndex < 0 && parts.length > 1) {
    // 兜底：至少保留第一个 token 为 wechat_id，避免把纯数字/数字开头昵称误判为下单 token
    splitIndex = 1;
  }
  if (splitIndex < 0) splitIndex = parts.length;

  // 支持无空格：🔆7（客户名 + SKU）
  if (parts.length === 1) {
    const mNoSpace = content.match(/^(.+?)(\d+)$/);
    if (mNoSpace) {
      const skuNum = Number(mNoSpace[2]);
      if (skuNum > 0 && skuNum <= maxSku && !/^\d+$/.test(mNoSpace[1])) {
        splitIndex = 1;
      }
    }
  }

  // 客户 ID 可以包含多个空格，按订单 token 在原文里的偏移切分以保留原始空格。
  const tokenOffsets: number[] = [];
  const offsetRe = /\S+/g;
  let offsetMatch: RegExpExecArray | null;
  while ((offsetMatch = offsetRe.exec(content)) !== null) tokenOffsets.push(offsetMatch.index);
  const orderStartOffset = tokenOffsets[splitIndex] ?? content.length;
  let wechat_id = content.slice(0, orderStartOffset).trimEnd();
  let restParts = mergeBracketTokens(parts.slice(splitIndex).map((p) => normalizeOrderPlusSymbols(p)));
  if (parts.length === 1) {
    const mNoSpace = content.match(/^(.+?)(\d+)$/);
    if (mNoSpace) {
      const skuNum = Number(mNoSpace[2]);
      if (skuNum > 0 && skuNum <= maxSku && !/^\d+$/.test(mNoSpace[1])) {
        wechat_id = mNoSpace[1];
        restParts = [mNoSpace[2]];
      }
    }
  }
  const parseTokens: string[] = [];
  const notesParts: string[] = [];
  let notesMode = false;
  let hasParsedSkuHead = false;
  const isOrderToken = (token: string): boolean => {
    if (!token) return false;
    if (token === "+") return false;
    if (/^.+的1$/.test(token)) return true;
    if (token.includes("+")) return true;
    if (resolveXiaoBeiVariantToken(token, menu)) return true;
    const mm = token.match(/^(\d+)(.*)$/);
    if (!mm) {
      const base = orderTokenBase(token);
      if (resolveSku1ShortVariant(base)) return true;
      return hasCjk(base) && !isLikelyNoteText(base) && matchProductNameToMenuItem(base, menu).matched;
    }
    const num = Number(mm[1]);
    const tail = mm[2].trim();
    if (!tail) return num > 0 && num <= maxSku;
    if (num > maxSku && num !== 1) return false;
    return true;
  };

  for (let idx = 0; idx < restParts.length; idx += 1) {
    const p = restParts[idx];
    if (!p || p === "+") continue;
    if (notesMode) {
      notesParts.push(p.replace(/[（()）]/g, ""));
      continue;
    }
    const prev = parseTokens[parseTokens.length - 1];
    if (prev === "8" && !/^\d/.test(p)) {
      parseTokens[parseTokens.length - 1] = `${prev}${p}`;
      hasParsedSkuHead = true;
      continue;
    }
    if (isOrderToken(p)) {
      parseTokens.push(p);
      hasParsedSkuHead = true;
      continue;
    }

    // 悬挂的数量乘法：把 "x3"（来自 "2 *3"）合并到前一个纯 SKU token，例如 "2"+"x3" => "2x3"
    // 或把 "x2" 合并到前一个商品 token，例如 "1咸蛋黄"+"x2" => "1咸蛋黄x2"
    const normP = normalizeOrderPlusSymbols(p);
    if (/^x\d+$/i.test(normP) && prev) {
      if (/^\d+$/.test(prev)) {
        parseTokens[parseTokens.length - 1] = `${prev}${normP}`;
        hasParsedSkuHead = true;
        continue;
      }
      if (/[\u4e00-\u9fff]/.test(prev)) {
        parseTokens[parseTokens.length - 1] = `${prev}${normP}`;
        hasParsedSkuHead = true;
        continue;
      }
    }

    // 支持：8 抹茶黑芝麻巧克力抹茶+4（把前一个 SKU token 和当前 token 拼接）
    
    const prevSkuMatch = prev?.match(/^(\d+)$/);
    if (prevSkuMatch) {
      const sku = menu.find((m) => m.sku_code === prevSkuMatch[1]);
      if (sku?.has_variants || sku?.sku_code === "8") {
        const variantHints = sku.variants?.some((v) => normalizeText(p).includes(normalizeText(v.variant_name)));
        const sku8FlavorLike =
          prevSkuMatch[1] === "8" &&
          (variantHints || /^[（(]/.test(p) || /^\d/.test(p));
        if (variantHints || p.includes("+") || sku8FlavorLike) {
          parseTokens[parseTokens.length - 1] = `${prev}${p}`;
          hasParsedSkuHead = true;
          continue;
        }
      }
    }

    // 支持：2+3+5+8 （抹茶/黑芝麻/...）这种写法，把括号 token 绑定到最后一个 SKU
    const prevEndSkuMatch = prev?.match(/(\d+)$/);
    const bracketToken = p.match(/^[（(][^）)]+[）)]$/);
    if (prevEndSkuMatch && bracketToken) {
      const sku = menu.find((m) => m.sku_code === prevEndSkuMatch[1]);
      if (sku?.has_variants) {
        parseTokens[parseTokens.length - 1] = `${prev}${p}`;
        hasParsedSkuHead = true;
        continue;
      }
    }

    if (hasParsedSkuHead || isLikelyNoteText(p)) {
      notesMode = true;
      notesParts.push(p.replace(/[（()）]/g, ""));
      continue;
    }

    notesParts.push(p.replace(/[（()）]/g, ""));
  }

  const items: OrderItem[] = [];
  const warnings: string[] = [];
  parseTokens.forEach((t) => {
    const result = parseOrderToken(t, menu);
    items.push(...result.items);
    result.warnings.forEach((w) => {
      if (w.startsWith("__NOTE__")) {
        notesParts.push(w.replace("__NOTE__", ""));
      } else {
        warnings.push(w);
      }
    });
  });

  const customer_total = roundMoney(items.reduce((sum, item) => sum + item.line_total, 0));
  let status: ParsedOrder["status"] = "success";
  if (warnings.length > 0) {
    const nonFatal = warnings.every((w) => w.includes("未匹配到商品关键词") || w.includes("无法解析 token"));
    if (nonFatal && items.length > 0) {
      warnings.forEach((w) => {
        const m = w.match(/"(.*)"/);
        if (m?.[1] && isLikelyNoteText(m[1])) notesParts.push(m[1]);
      });
      status = "success";
    } else {
      status = "warning";
    }
  } else if (items.length === 0) {
    status = "failed";
  }
  const notes = notesParts.join(" ").trim();

  return {
    id: uid("order"),
    raw_line: line,
    wechat_id: wechat_id || "未识别客户",
    items,
    customer_total,
    status,
    notes,
    warning_reason: warnings.length ? warnings.join("；") : undefined,
  };
}

export function parseWechatRelay(rawText: string): ParseResult {
  const { menuLines, orderLines } = splitSections(rawText);
  const menu_items = menuLines.map(parseMenuItem).filter((m): m is MenuItem => !!m);
  const orders = orderLines.map((line) => parseSingleOrder(line, menu_items));

  // 客户订单区第一行永远是示例订单，不进入正式统计（不依赖客户名）。
  if (orders.length > 0) orders[0].is_example = true;

  return {
    menu_items,
    warning_count: orders.filter((o) => !o.is_example && o.status === "warning").length,
    failed_count: orders.filter((o) => !o.is_example && o.status === "failed").length,
    orders,
  };
}
