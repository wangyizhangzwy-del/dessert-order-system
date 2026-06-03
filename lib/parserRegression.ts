import { parseWechatRelay } from "@/lib/parser";

export const REGRESSION_RELAY_TEXT = `#接龙

时间： 周日下午5点左右配送（dt满40/kt满60可送）自取/需要提前取的宝子请私信

地点： Atelier

付款方式： siqiwang228@gmail.com（付款完麻烦私信我截图～）

1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝/芋泥奶贝）16.9/21.9/19.9/19.9/19.9/21.9
2. 生巧焦糖香蕉布丁小方 22.9
3. 玄米焙茶杏子卷 19.9
4.酱多多麻薯香葱火腿蛋糕卷 19.9
5. 酱多多芋泥咸蛋黄肉松盒子 19.9
6. 代糖芋泥麻薯咸蛋黄巴斯克 24.9
7. 焦糖脆壳提拉米苏小泡芙 24.9/盒
8. 牛油酥皮小泡芙一盒四个  （原味/抹茶/黑芝麻/巧克力/焙茶） 26.9
9. 泰奶可可布丁泡芙 12.9
10. 百香果榛子泡芙（plus版） 12.9
11. 开心果酥粒泡芙 12.9
12. 肉松咸蛋黄芋泥泡芙 10.9
13. 火腿黑松露巴斯克 24.9
14. 满50可选蛋糕盲盒 5/个

1. Lumi Sweets 1+2+3
2. 不嘻嘻 麻薯的1 + 2 + 10 + 14
3. Yuisum 1咸蛋黄+2+4+7+9
4. Angia 2 + 3 + 5 + 8（抹茶/黑芝麻/巧克力/焙茶）
5. Montagne 5+12
6. Rain 13
7. Sarah 8 抹茶黑芝麻巧克力抹茶+4
8. 10000 4+6
9. Donphin 2+4
10. 🌑🌒🌓🌔🌕 1（原味+咸蛋黄+奶贝+芋泥） 888
11. .. 4➕11  aven`;

export function runParserRegressionChecks(): string[] {
  const errors: string[] = [];
  const parsed = parseWechatRelay(REGRESSION_RELAY_TEXT);
  const rain = parsed.orders.find((o) => o.wechat_id === "Rain");
  const bx = parsed.orders.find((o) => o.wechat_id === "不嘻嘻");
  const moon = parsed.orders.find((o) => o.wechat_id === "🌑🌒🌓🌔🌕");
  const dots = parsed.orders.find((o) => o.wechat_id === "..");

  const rainItem13 = rain?.items.find((i) => i.sku_code === "13");
  if (!rainItem13) errors.push("Rain 缺少 SKU 13");
  if (rainItem13?.cake_name !== "火腿黑松露巴斯克") errors.push("Rain SKU13 不是火腿黑松露巴斯克");
  if (rainItem13?.unit_price !== 24.9) errors.push("Rain SKU13 单价不是 24.9");

  const bxItem14 = bx?.items.find((i) => i.sku_code === "14");
  if (!bxItem14) errors.push("不嘻嘻 缺少 SKU 14");
  if (bxItem14?.cake_name !== "满50可选蛋糕盲盒") errors.push("不嘻嘻 SKU14 不是盲盒");
  if (bxItem14?.unit_price !== 5) errors.push("不嘻嘻 SKU14 单价不是 5");

  if (!moon) {
    errors.push("缺少 🌑🌒🌓🌔🌕 订单");
  } else {
    if (moon.status !== "success") errors.push("🌑🌒🌓🌔🌕 订单状态不是 success");
    if (moon.warning_reason) errors.push("🌑🌒🌓🌔🌕 不应有 warning_reason");
    if (moon.customer_total !== 78.6) errors.push("🌑🌒🌓🌔🌕 customer_total 不是 78.6");
    const moonVariants = moon.items
      .filter((i) => i.sku_code === "1")
      .map((i) => i.variant)
      .filter(Boolean);
    const expected = ["原味", "咸蛋黄", "奶贝", "芋泥"];
    expected.forEach((v) => {
      if (!moonVariants.includes(v)) errors.push(`🌑🌒🌓🌔🌕 缺少 SKU1 口味 ${v}`);
    });
    if (!moon.notes.includes("888")) errors.push("🌑🌒🌓🌔🌕 notes 未保留 888");
  }

  if (!dots) {
    errors.push("缺少 .. 订单");
  } else {
    if (dots.status !== "success") errors.push(".. 订单状态不是 success");
    const sku4 = dots.items.find((i) => i.sku_code === "4");
    const sku11 = dots.items.find((i) => i.sku_code === "11");
    if (!sku4) errors.push(".. 缺少 SKU 4");
    if (!sku11) errors.push(".. 缺少 SKU 11");
    if (dots.notes !== "aven") errors.push(".. notes 不是 aven");
  }

  const regression2 = `#接龙
时间： 周三晚上八点左右配送 自取6-7点 需要提前取的宝子请私信
地点： Atelier
付款方式： siqiwang228@gmail.com（付款完麻烦私信我截图～）
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. 苔条 x 黑芝麻 x 柚子蛋糕切块 22.9
3. 青提抹茶芭乐卷 19.9
4. 苔条年糕咸蛋黄卷 19.9
5. 酱多多香葱麻薯火腿卷 19.9
6. 桂花酒酿蛋糕盒子 19.9
7. 焦糖脆壳香草小泡芙 19.9/盒
8. 牛油酥皮小泡芙一盒四个  （原味/抹茶/黑芝麻/巧克力/焙茶） 26.9
9. 泰奶可可布丁薄脆泡芙 12.9
10. 百香果榛子泡芙 12.9
11. 火腿黑松露巴斯克 24.9
1. Lumi Sweets 1+2+3
2. 阿支🌙 1（麻薯）+2+3+11x2
3. 🔆7
4. K 1（原味）+1（麻薯）+2+11*3
5. killua 4 自取
6. Yuisum 2 Figueroa Eight
7. 野生. 6+8 825 South Hill St
8. nici_7 3+7自取
9. .. 4➕11  aven
10. 东东 4+5 fig 8
11. Alice 9+10+11 beaudry
12. Lumi Sweets 1+2+3
13. … 8 （2抹茶2焙茶） aven`;
  const p2 = parseWechatRelay(regression2);
  const k = p2.orders.find((o) => o.wechat_id === "K");
  const az = p2.orders.find((o) => o.wechat_id === "阿支🌙");
  const emoji = p2.orders.find((o) => o.wechat_id === "🔆");
  const killua = p2.orders.find((o) => o.wechat_id === "killua");
  const yuisum = p2.orders.find((o) => o.wechat_id === "Yuisum");
  const wild = p2.orders.find((o) => o.wechat_id === "野生.");
  const nici = p2.orders.find((o) => o.wechat_id === "nici_7");
  const dots2 = p2.orders.find((o) => o.wechat_id === "..");
  const dd = p2.orders.find((o) => o.wechat_id === "东东");
  const alice = p2.orders.find((o) => o.wechat_id === "Alice");
  const ellipsis = p2.orders.find((o) => o.wechat_id === "…");
  const sku8Cases = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
3. A卷 10
4. B卷 10
8. 牛油酥皮小泡芙一盒四个（原味/抹茶/黑芝麻/巧克力/焙茶）26.9
1. Didiland 4+8（原味 抹茶 黑芝麻 巧克力）
2. Angia 3 + 4 + 8（抹茶/黑芝麻/焙茶*2）Kurve 周四送
3. Sarah 8 抹茶黑芝麻巧克力抹茶+4
4. … 8（2抹茶2焙茶） aven
5. 笑笑李♊️ 1（咸蛋黄）+8（黑芝麻）`;
  const p3 = parseWechatRelay(sku8Cases);
  const didi = p3.orders.find((o) => o.wechat_id === "Didiland");
  const angia = p3.orders.find((o) => o.wechat_id === "Angia");
  const sarah = p3.orders.find((o) => o.wechat_id === "Sarah");
  const elli3 = p3.orders.find((o) => o.wechat_id === "…");
  const smile = p3.orders.find((o) => o.wechat_id.includes("笑笑李"));

  if (!emoji || emoji.customer_total !== 19.9 || emoji.status !== "success") errors.push("🔆7 解析失败");
  if (!k || k.customer_total !== 134.4 || k.status !== "success") errors.push("K 数量乘法解析失败");
  if (!az || az.customer_total !== 112.5 || az.status !== "success") errors.push("阿支🌙 x2 解析失败");
  if (!killua || killua.notes !== "自取" || killua.status !== "success") errors.push("killua 自取 notes 失败");
  if (!yuisum || !yuisum.notes.toLowerCase().includes("figueroa eight")) errors.push("Yuisum 地址 notes 失败");
  if (!wild || !wild.notes.includes("825 South Hill St") || wild.customer_total !== 46.8) errors.push("野生. 地址 notes 失败");
  if (!nici || nici.customer_total !== 39.8 || !nici.notes.includes("自取")) errors.push("nici_7 自取尾缀失败");
  if (!dots2 || dots2.notes !== "aven" || dots2.status !== "success") errors.push(".. 4➕11 aven 失败");
  if (!dd || dd.status !== "success" || dd.notes !== "fig 8") errors.push("东东 4+5 fig 8 notes 边界失败");
  if (!dd?.items.find((i) => i.sku_code === "4") || !dd?.items.find((i) => i.sku_code === "5")) errors.push("东东 SKU 4/5 失败");
  if (dd?.items.find((i) => i.sku_code === "8")) errors.push("东东 不应解析出 SKU 8");
  if (!alice || alice.status !== "success" || !alice.notes.toLowerCase().includes("beaudry")) errors.push("Alice beaudry notes 失败");
  if (!alice?.items.find((i) => i.sku_code === "9") || !alice?.items.find((i) => i.sku_code === "10") || !alice?.items.find((i) => i.sku_code === "11")) {
    errors.push("Alice SKU 9/10/11 失败");
  }
  if (!ellipsis) {
    errors.push("… 订单缺失");
  } else {
    const sku8 = ellipsis.items.find((i) => i.sku_code === "8");
    if (!sku8) errors.push("… 缺少 SKU 8");
    if (sku8?.flavor_combo !== "抹茶/抹茶/焙茶/焙茶") errors.push("… SKU8 flavor_combo 解析失败");
    if (ellipsis.notes !== "aven") errors.push("… notes 不是 aven");
    if (ellipsis.status !== "success") errors.push("… 订单状态不是 success");
  }
  if (!didi?.items.find((i) => i.sku_code === "8" && i.flavor_combo === "原味/抹茶/黑芝麻/巧克力")) {
    errors.push("Didiland SKU8 空格口味失败");
  }
  if (!angia?.items.find((i) => i.sku_code === "8" && i.flavor_combo === "抹茶/黑芝麻/焙茶/焙茶")) {
    errors.push("Angia SKU8 混合写法失败");
  }
  if (!angia?.notes.includes("Kurve")) errors.push("Angia notes 保留失败");
  if (!sarah?.items.find((i) => i.sku_code === "8" && i.flavor_combo === "抹茶/黑芝麻/巧克力/抹茶")) {
    errors.push("Sarah SKU8 连续口味失败");
  }
  if (!sarah?.items.find((i) => i.sku_code === "4")) errors.push("Sarah +4 未识别");
  if (!elli3?.items.find((i) => i.sku_code === "8" && i.flavor_combo === "抹茶/抹茶/焙茶/焙茶")) {
    errors.push("… SKU8 2抹茶2焙茶失败");
  }
  if (elli3?.notes !== "aven") errors.push("… SKU8 后 notes 失败");
  // 新规则：四件组合盒只写 1 个口味时，自动补足为 4 个相同口味，成功（不再 warning）。
  const smileSku8 = smile?.items.find((i) => i.sku_code === "8");
  if (!smile || smile.status !== "success") {
    errors.push("笑笑李♊️ SKU8 单口味应自动补足4个并成功");
  }
  if (smileSku8?.flavor_combo !== "黑芝麻/黑芝麻/黑芝麻/黑芝麻") {
    errors.push("笑笑李♊️ SKU8 单口味应补足为 黑芝麻/黑芝麻/黑芝麻/黑芝麻");
  }

  // 横杠作为 SKU 连接符：4-7 => SKU4 + SKU7
  const hyphenCases = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. 生巧焦糖香蕉布丁小方 22.9
3. 玄米焙茶杏子卷 19.9
4. 酱多多麻薯香葱火腿蛋糕卷 19.9
5. 酱多多芋泥咸蛋黄肉松盒子 19.9
6. 代糖芋泥麻薯咸蛋黄巴斯克 24.9
7. 焦糖脆壳提拉米苏小泡芙 24.9/盒
1. Lumi Sweets 1+2
2. 🐷YEALIM LEE 4-7
3. dash家 7 Apt 3-2`;
  const p5 = parseWechatRelay(hyphenCases);
  const yealim = p5.orders.find((o) => o.wechat_id === "🐷YEALIM LEE");
  if (!yealim) {
    errors.push("🐷YEALIM LEE 订单缺失");
  } else {
    if (yealim.status !== "success") errors.push("🐷YEALIM LEE 状态不是 success");
    const s4 = yealim.items.find((i) => i.sku_code === "4");
    const s7 = yealim.items.find((i) => i.sku_code === "7");
    if (!s4 || s4.quantity !== 1) errors.push("🐷YEALIM LEE 缺少 SKU4 数量1");
    if (!s7 || s7.quantity !== 1) errors.push("🐷YEALIM LEE 缺少 SKU7 数量1");
    if (yealim.items.length !== 2) errors.push("🐷YEALIM LEE items 数量不是2");
    if (yealim.notes !== "") errors.push("🐷YEALIM LEE notes 应为空");
  }
  // 地址里的横杠不应被当作 SKU 连接符：Apt 3-2 进入 notes 后不再提取 SKU
  const dash = p5.orders.find((o) => o.wechat_id === "dash家");
  if (!dash) {
    errors.push("dash家 订单缺失");
  } else {
    if (!dash.items.find((i) => i.sku_code === "7")) errors.push("dash家 缺少 SKU7");
    if (dash.items.find((i) => i.sku_code === "3" || i.sku_code === "2")) {
      errors.push("dash家 地址 3-2 被误解析为 SKU");
    }
    if (!dash.notes.includes("3-2")) errors.push("dash家 notes 未保留 3-2");
  }

  // case 1 & 2：客户订单区第一行永远是示例订单（不依赖客户名）
  const exampleA = parseWechatRelay(`#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. 玄米焙茶杏子卷 19.9
3. 酱多多麻薯香葱火腿蛋糕卷 19.9
1. Lumi Sweets 1+2+3
2. 阿狗 2+3`);
  if (!exampleA.orders[0]?.is_example) errors.push("示例规则：第一行 Lumi 未标记 is_example");
  if (exampleA.orders[1]?.is_example) errors.push("示例规则：第二行不应是 example");

  const exampleB = parseWechatRelay(`#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. 玄米焙茶杏子卷 19.9
3. 酱多多麻薯香葱火腿蛋糕卷 19.9
1. 任意客户 1+2+3
2. 阿猫 2`);
  if (!exampleB.orders[0]?.is_example) errors.push("示例规则：非 Lumi 第一行也应是 example");

  // case 3 & 5：产品名 fuzzy match + 客户 ID 不被数字误切 + 模糊词 warning
  const productMenu = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. 焙茶草莓达克瓦兹 18.9
3. 玄米焙茶杏子卷 19.9
4. 酱多多麻薯香葱火腿蛋糕卷 19.9
5. 泰奶可可布丁泡芙 12.9
6. 百香果榛子泡芙 12.9
7. 焦糖脆壳香草小泡芙 19.9
8. 牛油酥皮小泡芙一盒四个（原味/抹茶/黑芝麻/巧克力/焙茶）26.9
1. Lumi Sweets 1+2
2. LBJ 23 焙茶草莓达克瓦滋 + 焦糖小泡芙
3. Bob 泡芙`;
  const pn = parseWechatRelay(productMenu);
  const lbj = pn.orders.find((o) => o.wechat_id === "LBJ 23");
  if (!lbj) {
    errors.push("LBJ 23 订单缺失（客户ID被数字误切）");
  } else {
    if (lbj.is_example) errors.push("LBJ 23 不应是 example");
    if (lbj.status !== "success") errors.push("LBJ 23 状态不是 success");
    if (lbj.notes !== "") errors.push("LBJ 23 notes 应为空");
    if (!lbj.items.find((i) => i.sku_code === "2")) errors.push("LBJ 23 未匹配到 焙茶草莓达克瓦滋(SKU2)");
    if (!lbj.items.find((i) => i.sku_code === "7")) errors.push("LBJ 23 未匹配到 焦糖小泡芙(SKU7)");
    if (lbj.items.length !== 2) errors.push("LBJ 23 items 数量不是2");
  }
  const bob = pn.orders.find((o) => o.wechat_id === "Bob");
  if (!bob) {
    errors.push("Bob 订单缺失");
  } else {
    if (bob.status !== "warning") errors.push('Bob 模糊"泡芙"应为 warning');
    if (!bob.warning_reason?.includes("多个商品匹配，请人工确认")) {
      errors.push("Bob warning_reason 缺少 多个商品匹配，请人工确认");
    }
  }

  // case 4：东东 4+5 fig 8 —— fig 8 是 notes，不要把 8 当 SKU（已有 dd 断言覆盖，补充独立校验）
  const ddCheck = p2.orders.find((o) => o.wechat_id === "东东");
  if (!ddCheck || ddCheck.notes !== "fig 8" || ddCheck.items.find((i) => i.sku_code === "8")) {
    errors.push("东东 4+5 fig 8 边界校验失败");
  }

  // SKU 1 口味短名 + 多空格客户 ID + SKU/产品名混合
  const sku1ShortRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝/芋泥奶贝）16.9/21.9/19.9/19.9/19.9/21.9
2. 生巧焦糖香蕉布丁小方 22.9
3. 玄米焙茶杏子卷 19.9
4. 酱多多麻薯香葱火腿蛋糕卷 19.9
5. 酱多多芋泥咸蛋黄肉松盒子 19.9
6. 代糖芋泥麻薯咸蛋黄巴斯克 24.9
7. 焦糖脆壳提拉米苏小泡芙 24.9
1. Lumi Sweets 1+2
2. z     y  i 原味小贝+奶贝+3+6+7`;
  const pz = parseWechatRelay(sku1ShortRelay);
  const zyi = pz.orders.find((o) => o.wechat_id === "z     y  i");
  if (!zyi) {
    errors.push("z y i 订单缺失（多空格客户ID被切错）");
  } else {
    if (zyi.is_example) errors.push("z y i 不应是 example");
    if (zyi.status !== "success") errors.push("z y i 状态不是 success");
    if (zyi.notes !== "") errors.push("z y i notes 应为空");
    const sku1Variants = zyi.items.filter((i) => i.sku_code === "1").map((i) => i.variant);
    if (!sku1Variants.includes("原味")) errors.push("z y i 缺少 SKU1 原味（原味小贝）");
    if (!sku1Variants.includes("奶贝")) errors.push("z y i 缺少 SKU1 奶贝");
    ["3", "6", "7"].forEach((s) => {
      if (!zyi.items.find((i) => i.sku_code === s)) errors.push(`z y i 缺少 SKU${s}`);
    });
    if (zyi.items.length !== 5) errors.push("z y i items 数量不是5");
  }

  // 数量乘法：*N / xN / ✖️N 均为数量乘 N（含多空格客户名与带空格的乘号）
  const multiplyRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. 生巧焦糖香蕉布丁小方 22.9
3. 玄米焙茶杏子卷 19.9
1. Lumi Sweets 1+2
2. abc def 2*2
3. ghi 2 *2
4. jkl 2✖️2+3`;
  const pm = parseWechatRelay(multiplyRelay);
  const checkMul = (id: string, expectName: string) => {
    const o = pm.orders.find((x) => x.wechat_id === expectName);
    if (!o) {
      errors.push(`${id}：客户名 "${expectName}" 解析错误`);
      return o;
    }
    if (o.status !== "success") errors.push(`${id}：状态不是 success`);
    if (o.notes !== "" && expectName !== "jkl") errors.push(`${id}：notes 应为空`);
    return o;
  };
  const mAbc = checkMul("2*2", "abc def");
  if (mAbc && !mAbc.items.find((i) => i.sku_code === "2" && i.quantity === 2)) {
    errors.push("2*2 应为 SKU2 数量2");
  }
  const mGhi = checkMul("2 *2", "ghi");
  if (mGhi && !mGhi.items.find((i) => i.sku_code === "2" && i.quantity === 2)) {
    errors.push("2 *2 应为 SKU2 数量2");
  }
  const mJkl = checkMul("2✖️2+3", "jkl");
  if (mJkl && !mJkl.items.find((i) => i.sku_code === "2" && i.quantity === 2)) {
    errors.push("2✖️2 应为 SKU2 数量2");
  }
  if (mJkl && !mJkl.items.find((i) => i.sku_code === "3" && i.quantity === 1)) {
    errors.push("2✖️2+3 应包含 SKU3 数量1");
  }

  // 每次接龙都按“当次菜单”建立 SKU 映射：数字 SKU 与产品名都指向同一个本次商品。
  // 不允许沿用历史/硬编码映射（SKU 4 不是永久巴斯克、SKU 7 不是永久焦糖泡芙等）。
  const rotatingMenu = `#接龙
1. 肉松小贝一盒三个（原味/芋泥/咸蛋黄/麻薯/奶贝/芋泥奶贝）16.9/19.9/21.9/19.9/19.9/22.9
2. 玄米焙茶香梨蛋糕卷 19.9
3. 咸蛋黄苔条年糕卷 19.9
4. 四寸红薯奶麻薯巴斯克 39.8
5. 傣味番茄生巧曲奇 15.9/盒
6. 酱多多辣松麻薯火腿香葱卷 19.9
7. 焦糖脆壳香草小泡芙 19.9/盒
8. 牛油酥皮小泡芙一盒四个 26.9
9. 百香果焦糖榛子泡芙 12.9
10. 泰奶可可布丁薄脆大泡芙 9.9
11. 开心果榛子酥粒泡芙 12.9
1. 示例 1+2
2. numCust 2+4+10+5
3. nameCust 玄米香梨蛋糕卷+麻薯巴斯克+泰奶可可布丁薄脆大泡芙+番茄生巧曲奇`;
  const pr = parseWechatRelay(rotatingMenu);
  const expectMap: Record<string, { name: string; price: number }> = {
    "2": { name: "玄米焙茶香梨蛋糕卷", price: 19.9 },
    "4": { name: "四寸红薯奶麻薯巴斯克", price: 39.8 },
    "10": { name: "泰奶可可布丁薄脆大泡芙", price: 9.9 },
    "5": { name: "傣味番茄生巧曲奇", price: 15.9 },
  };
  const numCust = pr.orders.find((o) => o.wechat_id === "numCust");
  const nameCust = pr.orders.find((o) => o.wechat_id === "nameCust");
  for (const [sku, exp] of Object.entries(expectMap)) {
    const ni = numCust?.items.find((i) => i.sku_code === sku);
    if (!ni || ni.cake_name !== exp.name || ni.unit_price !== exp.price) {
      errors.push(`轮换菜单：数字 ${sku} 未映射到本次菜单 ${exp.name}@${exp.price}`);
    }
    const mi = nameCust?.items.find((i) => i.sku_code === sku);
    if (!mi || mi.cake_name !== exp.name || mi.unit_price !== exp.price) {
      errors.push(`轮换菜单：产品名未映射到本次菜单 ${exp.name}(SKU ${sku})`);
    }
  }
  if (numCust && numCust.status !== "success") errors.push("轮换菜单 numCust 状态不是 success");
  if (nameCust && nameCust.status !== "success") errors.push("轮换菜单 nameCust 状态不是 success");

  // SKU 1 口味与数字/产品名顺序不限：原味1 / 1原味 / 原味肉松小贝 / 肉松小贝原味 /
  // 原味 1 / 1 原味 / 芋泥1 / 咸蛋黄1 / 麻薯1 / 奶贝1 / 芋泥奶贝1 都识别为 SKU1 + 对应口味，数量 1。
  const sku1OrderRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝/芋泥奶贝）16.9/21.9/19.9/19.9/19.9/21.9
2. 玄米焙茶杏子卷 19.9
1. Lumi Sweets 1+2
2. c1 1原味
3. c2 原味1
4. c3 原味肉松小贝
5. c4 原味小贝
6. c5 肉松小贝原味
7. c6 1 原味
8. c7 原味 1
9. c8 芋泥1
10. c9 咸蛋黄1
11. c10 麻薯1
12. c11 奶贝1
13. c12 芋泥奶贝1`;
  const ps1 = parseWechatRelay(sku1OrderRelay);
  const expectSku1: Record<string, string> = {
    c1: "原味",
    c2: "原味",
    c3: "原味",
    c4: "原味",
    c5: "原味",
    c6: "原味",
    c7: "原味",
    c8: "芋泥",
    c9: "咸蛋黄",
    c10: "麻薯",
    c11: "奶贝",
    c12: "芋泥奶贝",
  };
  for (const [id, variant] of Object.entries(expectSku1)) {
    const o = ps1.orders.find((x) => x.wechat_id === id);
    if (!o) {
      errors.push(`SKU1 口味写法：客户 ${id} 缺失`);
      continue;
    }
    if (o.status !== "success") errors.push(`SKU1 口味写法：${id} 状态不是 success`);
    const sku1Items = o.items.filter((i) => i.sku_code === "1");
    if (sku1Items.length !== 1) {
      errors.push(`SKU1 口味写法：${id} 应只有 1 个 SKU1 商品`);
      continue;
    }
    const item = sku1Items[0];
    if (item.variant !== variant) errors.push(`SKU1 口味写法：${id} 口味应为 ${variant}，实际 ${item.variant}`);
    if (item.quantity !== 1) errors.push(`SKU1 口味写法：${id} 数量应为 1`);
    if (o.items.length !== 1) errors.push(`SKU1 口味写法：${id} 不应解析出多余商品`);
  }

  // 数量写法 SKU×quantity：第一个数字是 SKU，第二个数字是数量；空格/加号/横杠都表示“和”。
  const qtyRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
2. A 19.9
3. B 19.9
10. C 12.9
1. Lumi Sweets 1+2
2. q1 10x2
3. q2 2 3
4. q3 2-3`;
  const pq = parseWechatRelay(qtyRelay);
  const q1 = pq.orders.find((o) => o.wechat_id === "q1");
  if (!q1 || !q1.items.find((i) => i.sku_code === "10" && i.quantity === 2)) {
    errors.push("数量写法：10x2 应为 SKU10 数量2");
  }
  if (q1?.items.find((i) => i.sku_code === "2" && i.quantity === 10)) {
    errors.push("数量写法：10x2 不应被解析为 SKU2 数量10");
  }
  const q2 = pq.orders.find((o) => o.wechat_id === "q2");
  if (!q2 || !q2.items.find((i) => i.sku_code === "2" && i.quantity === 1) || !q2.items.find((i) => i.sku_code === "3" && i.quantity === 1)) {
    errors.push("数量写法：空格 2 3 应为 SKU2 + SKU3 各数量1");
  }
  const q3 = pq.orders.find((o) => o.wechat_id === "q3");
  if (!q3 || !q3.items.find((i) => i.sku_code === "2") || !q3.items.find((i) => i.sku_code === "3")) {
    errors.push("数量写法：横杠 2-3 应为 SKU2 + SKU3");
  }

  // 组合盒（四件一盒）口味平均分配：
  //   2 个口味 => 2+2；1 个口味 => 全部相同；4 个口味 => 原样。
  //   支持重复 SKU 写法 8原味+8抹茶，也支持括号写法 8（原味/抹茶）。
  const comboRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
7. 焦糖脆壳香草小泡芙一盒四个（原味/抹茶/焙茶）19.9
8. 牛油酥皮小泡芙一盒四个（原味/抹茶/黑芝麻/巧克力/焙茶）26.9
1. Lumi Sweets 1+2
2. cA 8原味+8抹茶
3. cB 8（原味/抹茶）
4. cC 8原味
5. cD 7原味+7抹茶
6. cE 7抹茶+7焙茶
7. cF 7原味
8. cG 8（原味/抹茶/黑芝麻/巧克力）`;
  const pc = parseWechatRelay(comboRelay);
  const expectCombo: Record<string, { sku: string; combo: string }> = {
    cA: { sku: "8", combo: "原味/原味/抹茶/抹茶" },
    cB: { sku: "8", combo: "原味/原味/抹茶/抹茶" },
    cC: { sku: "8", combo: "原味/原味/原味/原味" },
    cD: { sku: "7", combo: "原味/原味/抹茶/抹茶" },
    cE: { sku: "7", combo: "抹茶/抹茶/焙茶/焙茶" },
    cF: { sku: "7", combo: "原味/原味/原味/原味" },
    cG: { sku: "8", combo: "原味/抹茶/黑芝麻/巧克力" },
  };
  for (const [id, exp] of Object.entries(expectCombo)) {
    const o = pc.orders.find((x) => x.wechat_id === id);
    if (!o) {
      errors.push(`组合盒分配：客户 ${id} 缺失`);
      continue;
    }
    if (o.status !== "success") errors.push(`组合盒分配：${id} 状态不是 success（${o.warning_reason ?? ""}）`);
    const comboItems = o.items.filter((i) => i.sku_code === exp.sku);
    if (comboItems.length !== 1) {
      errors.push(`组合盒分配：${id} 应只有 1 个 SKU${exp.sku} 组合盒（实际 ${comboItems.length}）`);
      continue;
    }
    if (comboItems[0].flavor_combo !== exp.combo) {
      errors.push(`组合盒分配：${id} flavor_combo 应为 ${exp.combo}，实际 ${comboItems[0].flavor_combo}`);
    }
    if (comboItems[0].quantity !== 1) errors.push(`组合盒分配：${id} 数量应为 1（一盒）`);
  }

  const qtySuffixRelay = `${REGRESSION_RELAY_TEXT}
23. 1Frank 1咸蛋黄*2
24. Frank2 1咸蛋黄 x2
25. Frank3 1咸蛋黄X2
26. Frank4 1咸蛋黄×2
27. multiA 咸蛋黄*2 原味小贝x1
28. multiB 焦糖泡芙×2 泰奶泡芙*1`;

  const qtyParsed = parseWechatRelay(qtySuffixRelay);

  function assertQtyOrder(
    wechatId: string,
    expectedItems: { nameIncludes: string; quantity: number }[],
    lineHint: string
  ) {
    const o = qtyParsed.orders.find((x) => x.wechat_id === wechatId);
    if (!o) {
      errors.push(`数量后缀：缺少客户 ${wechatId}（${lineHint}）`);
      return;
    }
    if (o.status !== "success") {
      errors.push(`数量后缀：${wechatId} 状态应为 success（${o.warning_reason ?? o.status}）`);
    }
    if (o.notes && /x\d+|\*\d+/i.test(o.notes)) {
      errors.push(`数量后缀：${wechatId} notes 不应含数量后缀（${o.notes}）`);
    }
    for (const exp of expectedItems) {
      const item = o.items.find((it) =>
        (it.display_name || it.cake_name || "").includes(exp.nameIncludes)
      );
      if (!item) {
        errors.push(`数量后缀：${wechatId} 缺少商品含 "${exp.nameIncludes}"（${lineHint}）`);
        continue;
      }
      if (item.quantity !== exp.quantity) {
        errors.push(
          `数量后缀：${wechatId} ${exp.nameIncludes} 数量应为 ${exp.quantity}，实际 ${item.quantity}（${lineHint}）`
        );
      }
      const label = item.display_name || item.cake_name || "";
      if (/x\d+|\*\d+|×\d+/i.test(label)) {
        errors.push(`数量后缀：${wechatId} 商品名不应含数量后缀（${label}）`);
      }
    }
  }

  assertQtyOrder("1Frank", [{ nameIncludes: "咸蛋黄", quantity: 2 }], "1咸蛋黄*2");
  assertQtyOrder("Frank2", [{ nameIncludes: "咸蛋黄", quantity: 2 }], "1咸蛋黄 x2");
  assertQtyOrder("Frank3", [{ nameIncludes: "咸蛋黄", quantity: 2 }], "1咸蛋黄X2");
  assertQtyOrder("Frank4", [{ nameIncludes: "咸蛋黄", quantity: 2 }], "1咸蛋黄×2");
  assertQtyOrder(
    "multiA",
    [
      { nameIncludes: "咸蛋黄", quantity: 2 },
      { nameIncludes: "原味", quantity: 1 },
    ],
    "咸蛋黄*2 原味小贝x1"
  );
  assertQtyOrder(
    "multiB",
    [
      { nameIncludes: "焦糖", quantity: 2 },
      { nameIncludes: "泰奶", quantity: 1 },
    ],
    "焦糖泡芙×2 泰奶泡芙*1"
  );

  const xiaoBeiMenuRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝/芋泥奶贝）16.9/21.9/19.9/19.9/19.9/21.9
2. 焦糖脆壳香草小泡芙 19.9
3. 泰奶可可布丁薄脆大泡芙 9.9
1. Lumi Sweets
2. Alice 5原味+5奶贝
3. Bob 5原味，5奶贝
4. Carol 5原味,5奶贝
5. Dave 5原味、5奶贝
6. Eve 5原味*2+5奶贝x1
7. Fay 5芋泥奶贝
8. Grace 5奶贝x2，5芋泥奶贝`;

  const xbParsed = parseWechatRelay(xiaoBeiMenuRelay);

  function assertXiaoBeiLine(
    wechatId: string,
    expected: { variant: string; quantity: number; price: number }[]
  ) {
    const o = xbParsed.orders.find((x) => x.wechat_id === wechatId);
    if (!o) {
      errors.push(`5号肉松小贝：缺少客户 ${wechatId}`);
      return;
    }
    if (o.status !== "success") {
      errors.push(`5号肉松小贝：${wechatId} 状态应为 success（${o.warning_reason ?? o.status}）`);
    }
    const xbItems = o.items.filter(
      (it) => (it.cake_name ?? "").includes("肉松小贝") || it.sku_code === "1" || it.sku_code === "5"
    );
    if (xbItems.length !== expected.length) {
      errors.push(
        `5号肉松小贝：${wechatId} 应有 ${expected.length} 个肉松小贝商品，实际 ${xbItems.length}`
      );
      return;
    }
    for (let i = 0; i < expected.length; i += 1) {
      const exp = expected[i];
      const item = xbItems[i];
      const label = item.display_name || item.cake_name || "";
      if (item.variant !== exp.variant) {
        errors.push(`5号肉松小贝：${wechatId}[${i}] 口味应为 ${exp.variant}，实际 ${item.variant}`);
      }
      if (item.quantity !== exp.quantity) {
        errors.push(`5号肉松小贝：${wechatId}[${i}] 数量应为 ${exp.quantity}，实际 ${item.quantity}`);
      }
      if (item.unit_price !== exp.price) {
        errors.push(`5号肉松小贝：${wechatId}[${i}] 单价应为 ${exp.price}，实际 ${item.unit_price}`);
      }
      if (!label.includes("肉松小贝一盒三个") || !label.includes(exp.variant)) {
        errors.push(`5号肉松小贝：${wechatId}[${i}] 商品名应含完整名称，实际 "${label}"`);
      }
    }
  }

  const twoFlavors = [
    { variant: "原味", quantity: 1, price: 16.9 },
    { variant: "奶贝", quantity: 1, price: 19.9 },
  ];
  assertXiaoBeiLine("Alice", twoFlavors);
  assertXiaoBeiLine("Bob", twoFlavors);
  assertXiaoBeiLine("Carol", twoFlavors);
  assertXiaoBeiLine("Dave", twoFlavors);
  assertXiaoBeiLine("Eve", [
    { variant: "原味", quantity: 2, price: 16.9 },
    { variant: "奶贝", quantity: 1, price: 19.9 },
  ]);
  assertXiaoBeiLine("Fay", [{ variant: "芋泥奶贝", quantity: 1, price: 21.9 }]);
  assertXiaoBeiLine("Grace", [
    { variant: "奶贝", quantity: 2, price: 19.9 },
    { variant: "芋泥奶贝", quantity: 1, price: 21.9 },
  ]);

  const commaProductRelay = `#接龙
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝/芋泥奶贝）16.9/21.9/19.9/19.9/19.9/21.9
2. 焦糖脆壳香草小泡芙 19.9
3. 泰奶可可布丁薄脆大泡芙 9.9
1. Lumi Sweets
2. Alice 焦糖泡芙，泰奶泡芙`;
  const cpParsed = parseWechatRelay(commaProductRelay);
  const aliceCp = cpParsed.orders.find((o) => o.wechat_id === "Alice");
  if (!aliceCp || aliceCp.status !== "success") {
    errors.push("逗号商品：Alice 应 success");
  } else {
    if (!aliceCp.items.find((i) => (i.cake_name ?? "").includes("焦糖"))) {
      errors.push("逗号商品：Alice 缺少焦糖泡芙");
    }
    if (!aliceCp.items.find((i) => (i.cake_name ?? "").includes("泰奶"))) {
      errors.push("逗号商品：Alice 缺少泰奶泡芙");
    }
    if (aliceCp.items.length !== 2) errors.push("逗号商品：Alice 应有 2 个商品");
  }

  const menuDefRelay = `#接龙
5. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝/芋泥奶贝）16.9/21.9/19.9/19.9/19.9/21.9
2. 玄米焙茶杏子卷 19.9
1. Lumi Sweets
2. Alice 2`;
  const mdParsed = parseWechatRelay(menuDefRelay);
  const menuOnlyOrder = mdParsed.orders.find(
    (o) => !o.is_example && o.items.some((i) => (i.cake_name ?? "").includes("肉松小贝"))
  );
  if (menuOnlyOrder && menuOnlyOrder.wechat_id !== "Alice") {
    errors.push("菜单定义行：不应把菜单行 5 识别为客户订单");
  }
  const aliceMd = mdParsed.orders.find((o) => o.wechat_id === "Alice");
  if (!aliceMd?.items.find((i) => i.sku_code === "2")) {
    errors.push("菜单定义行：Alice 应只订购 SKU2");
  }

  return errors;
}
