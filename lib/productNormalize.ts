/** 赠品/备注类商品名，不计入产品分析销量（除非有明确 quantity + line_total）。 */
export function isGiftProductName(raw: string | undefined | null): boolean {
  const name = (raw ?? "").trim();
  if (!name) return false;
  if (/^多送/.test(name)) return true;
  if (/^送?\s*\d{1,2}$/.test(name)) return true;
  if (/^[+＋]\s*\d+$/.test(name)) return true;
  if (/^送[^0-9]*$/.test(name) && /送/.test(name)) return true;
  if (/^送/.test(name) && !/\d/.test(name.replace(/[^\d]/g, ""))) return true;
  return false;
}

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/肉搜小贝/g, "肉松小贝")
    .replace(/[（）()【】\[\]]/g, "")
    .replace(/\s+/g, "");
}

/** 将原始商品名归一化为产品分析用的 canonical 名称。 */
export function normalizeProductName(raw: string | undefined | null): string {
  const name = cleanName(raw ?? "");
  if (!name) return "未命名商品";

  // A. 焦糖泡芙
  if (/焦糖/.test(name) && /(泡芙|小泡芙|脆壳)/.test(name)) return "焦糖泡芙";

  // B. 小贝 / 奶贝 → 肉松小贝
  if (/小贝|奶贝/.test(name)) return "肉松小贝";

  // C. 香葱卷
  if (/香葱卷/.test(name)) return "香葱卷";

  // G. 巴斯克（按口味保留，不合并）
  if (/巴斯克/.test(name)) {
    if (/开心果/.test(name)) return "开心果巴斯克";
    if (/咸蛋黄/.test(name)) return "咸蛋黄巴斯克";
    if (/黑松露/.test(name)) return "黑松露巴斯克";
    if (/芋泥麻薯/.test(name)) return "芋泥麻薯巴斯克";
    if (/抹茶/.test(name)) return "抹茶巴斯克";
    return name.includes("巴斯克") ? name : "巴斯克";
  }

  // F. 草莓蛋糕 vs 草莓杯 / trifle
  if (/草莓千层/.test(name)) return "草莓千层";
  if (/草莓杯|trifle|草莓trifle/i.test(name)) return "草莓杯";
  if (/草莓/.test(name) && /(切块|蛋糕)/.test(name)) return "草莓蛋糕";
  if (name === "切块" || name === "草莓切块") return "草莓蛋糕";

  // D. 泡芙（非焦糖）
  if (/泰奶/.test(name) && /泡芙/.test(name)) return "泰奶泡芙";
  if (/泰奶/.test(name)) return "泰奶泡芙";
  if (/开心果/.test(name) && /泡芙/.test(name)) return "开心果泡芙";
  if (/咸蛋黄/.test(name) && /泡芙/.test(name)) return "咸蛋黄泡芙";
  if (/小泡芙/.test(name)) return "小泡芙";
  if (/泡芙/.test(name)) return name;

  // E. 卷
  if (/玄米焙茶|玄米卷|焙茶卷/.test(name)) return "焙茶卷";
  if (/抹茶/.test(name) && /卷/.test(name)) return "抹茶卷";
  if (/黑芝麻/.test(name) && /卷/.test(name)) return "黑芝麻卷";

  return name;
}

/** 搜索时同时匹配 canonical 名与原始名。 */
export function productMatchesQuery(
  normalizedName: string,
  rawNames: string[],
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (normalizedName.toLowerCase().includes(q)) return true;
  return rawNames.some((n) => n.toLowerCase().includes(q));
}
