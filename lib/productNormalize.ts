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

/** 去标点/空格/括号/备注词，便于归一化匹配。 */
function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/肉搜小贝/g, "肉松小贝")
    .replace(/[（）()【】\[\]《》「」]/g, "")
    .replace(/不要葱/g, "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，,。.!！?？:：;；/／\\|｜\-–—－+＋]/g, "");
}

function hasAllWords(name: string, words: string[]): boolean {
  return words.every((w) => name.includes(w));
}

/** 蛋糕盲盒 variants。 */
function isCakeBlindBox(name: string): boolean {
  if (/蛋糕盲盒/.test(name)) return true;
  if (/满\d+可[选定]蛋糕盲盒/.test(name)) return true;
  return false;
}

/** 咸蛋黄 + 芋泥 + 盒子/奶酱 → 咸蛋黄芋泥盒子（优先于普通芋泥盒子）。 */
function isXianhuangniYuniBox(name: string): boolean {
  if (!/芋泥/.test(name)) return false;
  if (!/咸蛋黄/.test(name)) return false;
  return /(盒子|奶酱)/.test(name) || /酱多多/.test(name);
}

/** 酒酿 / 桂花酒酿 家族。 */
function isGuihuaJiuniangFamily(name: string): boolean {
  if (/酒酿桂花/.test(name)) return true;
  if (/^桂花酒酿$/.test(name)) return true;
  if (/^酒酿杯$/.test(name) || /^桂花酒酿杯$/.test(name)) return true;
  if (/^酒酿盒子$/.test(name)) return true;
  const hasJiuniang = /酒酿/.test(name);
  const hasGuihua = /桂花/.test(name);
  if (hasJiuniang && hasGuihua) return true;
  if (hasJiuniang && /(盒子|杯|蛋糕)/.test(name)) return true;
  if (hasGuihua && /酒酿/.test(name)) return true;
  return false;
}

/** 普通芋泥盒子（不含咸蛋黄）。 */
function isYuniBoxFamily(name: string): boolean {
  if (/咸蛋黄/.test(name)) return false;
  if (name === "奶酱盒子") return true;
  if (/芋泥/.test(name) && /(盒子|奶酱)/.test(name)) return true;
  if (/肉松酱多多芋泥/.test(name)) return true;
  return false;
}

/** 凤梨 / 菠萝 / 话梅 / 铁观音 卷家族。 */
function isFengliHuameiRollFamily(name: string): boolean {
  if (name === "凤梨卷" || name === "菠萝卷") return true;
  if (/^(凤梨|菠萝)(凤梨|菠萝)?卷$/.test(name)) return true;
  if (!/卷/.test(name)) return false;
  if (hasAllWords(name, ["凤梨", "话梅", "铁观音"])) return true;
  if (hasAllWords(name, ["菠萝", "话梅", "铁观音"])) return true;
  return false;
}

/** 达克瓦滋及历史 bundle 写法。 */
function isDakowazFamily(name: string): boolean {
  if (/达克瓦[兹滋]/.test(name)) return true;
  if (/^159盒[三3]个$/.test(name)) return true;
  if (/^159盒三个$/.test(name)) return true;
  return false;
}

/** savory 香葱卷 / 酱多多卷 / 肉松卷 家族（排除甜卷与凤梨卷）。 */
function isSavoryRollFamily(name: string): boolean {
  if (isFengliHuameiRollFamily(name)) return false;
  if (!/卷/.test(name)) return false;
  if (/抹茶|焙茶|玄米|黑芝麻|香梨|杏子|红薯/.test(name) && !/香葱/.test(name)) return false;
  if (/香葱卷/.test(name)) return true;
  if (/酱多多/.test(name) && /卷/.test(name)) return true;
  if (/肉松/.test(name) && /卷/.test(name)) return true;
  if (name === "肉松卷" || name === "酱多多卷") return true;
  return false;
}

/** 将原始商品名归一化为产品分析用的 canonical 名称。 */
export function normalizeProductName(raw: string | undefined | null): string {
  const name = cleanName(raw ?? "");
  if (!name) return "未命名商品";

  if (isCakeBlindBox(name)) return "蛋糕盲盒";

  if (isXianhuangniYuniBox(name)) return "咸蛋黄芋泥盒子";
  if (isGuihuaJiuniangFamily(name)) return "桂花酒酿盒子";
  if (isYuniBoxFamily(name)) return "芋泥盒子";

  if (isDakowazFamily(name)) return "达克瓦滋";

  if (isFengliHuameiRollFamily(name)) return "凤梨话梅铁观音卷";

  if (/雪花酥/.test(name)) {
    if (/咸蛋黄/.test(name)) return "咸蛋黄雪花酥";
    if (/抹茶/.test(name)) return "抹茶雪花酥";
  }

  if (/巴斯克/.test(name)) {
    if (/开心果/.test(name)) return "开心果巴斯克";
    if (/咸蛋黄/.test(name)) return "咸蛋黄巴斯克";
    if (/黑松露/.test(name)) return "黑松露巴斯克";
    if (/芋泥麻薯/.test(name)) return "芋泥麻薯巴斯克";
    if (/抹茶/.test(name)) return "抹茶巴斯克";
    return name.includes("巴斯克") ? name : "巴斯克";
  }

  if (/焦糖/.test(name) && /(泡芙|小泡芙|脆壳)/.test(name)) return "焦糖泡芙";
  if (/小贝|奶贝/.test(name)) return "肉松小贝";
  if (isSavoryRollFamily(name)) return "香葱卷";

  if (/草莓千层/.test(name)) return "草莓千层";
  if (/草莓杯|trifle|草莓trifle/i.test(name)) return "草莓杯";
  if (/草莓/.test(name) && /(切块|蛋糕)/.test(name)) return "草莓蛋糕";
  if (name === "切块" || name === "草莓切块") return "草莓蛋糕";

  if (/榛(果|子)/.test(name) && /泡芙/.test(name)) return "榛果泡芙";

  if (/泰奶/.test(name) && /泡芙/.test(name)) return "泰奶泡芙";
  if (/泰奶/.test(name)) return "泰奶泡芙";
  if (/开心果/.test(name) && /泡芙/.test(name)) return "开心果泡芙";
  if (/咸蛋黄/.test(name) && /泡芙/.test(name)) return "咸蛋黄泡芙";
  if (/小泡芙/.test(name)) return "小泡芙";
  if (/泡芙/.test(name)) return name;

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
  if (normalizeProductName(q).toLowerCase() === normalizedName.toLowerCase()) return true;
  return rawNames.some((n) => n.toLowerCase().includes(q));
}
