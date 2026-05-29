import assert from "node:assert/strict";
import {
  isGiftProductName,
  normalizeProductName,
  productMatchesQuery,
} from "@/lib/productNormalize";
import { buildProductAnalytics } from "@/lib/productAnalytics";
import { SavedJielong } from "@/lib/types";

function testNormalization() {
  // 焦糖泡芙
  assert.equal(normalizeProductName("焦糖脆壳香草小泡芙"), "焦糖泡芙");
  assert.equal(normalizeProductName("焦糖泡芙"), "焦糖泡芙");
  assert.equal(normalizeProductName("焦糖小泡芙"), "焦糖泡芙");
  assert.equal(normalizeProductName("焦糖脆壳小泡芙"), "焦糖泡芙");

  // 小贝 / 奶贝
  assert.equal(normalizeProductName("原味小贝"), "肉松小贝");
  assert.equal(normalizeProductName("咸蛋黄小贝"), "肉松小贝");
  assert.equal(normalizeProductName("芋泥小贝"), "肉松小贝");
  assert.equal(normalizeProductName("麻薯小贝"), "肉松小贝");
  assert.equal(normalizeProductName("原味奶贝"), "肉松小贝");
  assert.equal(normalizeProductName("肉搜小贝"), "肉松小贝");

  // 1. 榛果 / 榛子泡芙
  assert.equal(normalizeProductName("榛果泡芙"), "榛果泡芙");
  assert.equal(normalizeProductName("榛子泡芙"), "榛果泡芙");

  // 2. 桂花酒酿
  assert.equal(normalizeProductName("桂花酒酿盒子"), "桂花酒酿盒子");
  assert.equal(normalizeProductName("酒酿盒子"), "桂花酒酿盒子");
  assert.equal(normalizeProductName("桂花酒酿麻薯蛋糕杯"), "桂花酒酿盒子");
  assert.equal(normalizeProductName("酒酿桂花"), "桂花酒酿盒子");
  assert.equal(normalizeProductName("桂花酒酿"), "桂花酒酿盒子");
  assert.equal(normalizeProductName("酒酿蛋糕盒子"), "桂花酒酿盒子");

  // 3. 芋泥盒子
  assert.equal(normalizeProductName("芋泥麻薯盒子"), "芋泥盒子");
  assert.equal(normalizeProductName("奶酱盒子"), "芋泥盒子");
  assert.equal(normalizeProductName("肉松酱多多芋泥麻薯盒子"), "芋泥盒子");
  assert.equal(normalizeProductName("芋泥盒子"), "芋泥盒子");

  // 4. 香葱卷 / 酱多多卷 / 肉松卷
  assert.equal(normalizeProductName("酱多多卷"), "香葱卷");
  assert.equal(normalizeProductName("酱多多卷不要葱"), "香葱卷");
  assert.equal(normalizeProductName("肉松卷"), "香葱卷");
  assert.equal(normalizeProductName("酱多多香葱麻薯火腿卷"), "香葱卷");
  assert.equal(normalizeProductName("香葱卷"), "香葱卷");
  assert.equal(normalizeProductName("麻薯香葱卷"), "香葱卷");
  assert.equal(normalizeProductName("酱多多辣松麻薯火腿香葱卷"), "香葱卷");

  // 5. 咸蛋黄芋泥盒子
  assert.equal(normalizeProductName("咸蛋黄芋泥盒子"), "咸蛋黄芋泥盒子");
  assert.equal(normalizeProductName("酱多多芋泥咸蛋黄肉松盒子"), "咸蛋黄芋泥盒子");
  assert.equal(normalizeProductName("芋泥咸蛋黄奶酱盒子"), "咸蛋黄芋泥盒子");
  assert.equal(normalizeProductName("芋泥咸蛋黄盒子"), "咸蛋黄芋泥盒子");

  // plain 芋泥盒子 must not merge with 咸蛋黄芋泥盒子
  assert.equal(normalizeProductName("芋泥奶酱盒子"), "芋泥盒子");

  // 6. 凤梨话梅铁观音卷
  assert.equal(normalizeProductName("凤梨话梅铁观音卷"), "凤梨话梅铁观音卷");
  assert.equal(normalizeProductName("铁观音话梅凤梨卷"), "凤梨话梅铁观音卷");
  assert.equal(normalizeProductName("话梅凤梨铁观音卷"), "凤梨话梅铁观音卷");

  // 泡芙 / 卷 / 草莓 / 巴斯克
  assert.equal(normalizeProductName("泰奶巧克力泡芙"), "泰奶泡芙");
  assert.equal(normalizeProductName("开心果泡芙"), "开心果泡芙");
  assert.equal(normalizeProductName("肉松咸蛋黄泡芙"), "咸蛋黄泡芙");
  assert.equal(normalizeProductName("小泡芙（2抹茶2巧克力"), "小泡芙");
  assert.equal(normalizeProductName("玄米焙茶卷"), "焙茶卷");
  assert.equal(normalizeProductName("抹茶蛋糕卷"), "抹茶卷");
  assert.equal(normalizeProductName("黑芝麻红薯奶冻卷"), "黑芝麻卷");
  assert.equal(normalizeProductName("草莓蛋糕切块"), "草莓蛋糕");
  assert.equal(normalizeProductName("草莓杯"), "草莓杯");
  assert.equal(normalizeProductName("trifle"), "草莓杯");
  assert.equal(normalizeProductName("咸蛋黄巴斯克"), "咸蛋黄巴斯克");
  assert.equal(normalizeProductName("开心果巴斯克"), "开心果巴斯克");

  // 甜卷不应被归入香葱卷
  assert.equal(normalizeProductName("抹茶卷"), "抹茶卷");
  assert.equal(normalizeProductName("焙茶卷"), "焙茶卷");

  assert.equal(isGiftProductName("送咸蛋黄巴斯克"), true);
  assert.equal(isGiftProductName("送2"), true);
  assert.equal(isGiftProductName("焦糖泡芙"), false);

  assert.equal(productMatchesQuery("焦糖泡芙", ["焦糖小泡芙", "焦糖脆壳小泡芙"], "焦糖小泡芙"), true);
  assert.equal(productMatchesQuery("肉松小贝", ["咸蛋黄小贝"], "咸蛋黄"), true);
  assert.equal(productMatchesQuery("香葱卷", ["麻薯香葱卷"], "香葱"), true);
  assert.equal(productMatchesQuery("桂花酒酿盒子", ["酒酿盒子"], "酒酿盒子"), true);
  assert.equal(productMatchesQuery("榛果泡芙", ["榛子泡芙"], "榛子泡芙"), true);
}

function testAggregation() {
  const batch: SavedJielong = {
    batch_id: "b1",
    batch_name: "test",
    order_date: "2026-01-07",
    raw_text: "",
    menu_items: [],
    parsed_orders: [
      {
        id: "o1",
        wechat_id: "a",
        raw_line: "",
        items: [
          { sku_code: "7", cake_name: "焦糖小泡芙", display_name: "焦糖小泡芙", quantity: 2, unit_price: 10, line_total: 20 },
          { sku_code: "7", cake_name: "焦糖脆壳香草小泡芙", display_name: "焦糖脆壳香草小泡芙", quantity: 1, unit_price: 10, line_total: 10 },
          { sku_code: "1", cake_name: "咸蛋黄小贝", display_name: "咸蛋黄小贝", quantity: 3, unit_price: 5, line_total: 15 },
          { sku_code: "1", cake_name: "原味小贝", display_name: "原味小贝", quantity: 1, unit_price: 5, line_total: 5 },
          { sku_code: "9", cake_name: "榛子泡芙", display_name: "榛子泡芙", quantity: 2, unit_price: 12, line_total: 24 },
          { sku_code: "9", cake_name: "榛果泡芙", display_name: "榛果泡芙", quantity: 1, unit_price: 12, line_total: 12 },
          { sku_code: "10", cake_name: "酒酿盒子", display_name: "酒酿盒子", quantity: 1, unit_price: 18, line_total: 18 },
          { sku_code: "10", cake_name: "桂花酒酿麻薯蛋糕杯", display_name: "桂花酒酿麻薯蛋糕杯", quantity: 2, unit_price: 18, line_total: 36 },
          { sku_code: "", cake_name: "送咸蛋黄巴斯克", display_name: "送咸蛋黄巴斯克", quantity: 0, unit_price: 0, line_total: 0 },
        ],
        customer_total: 140,
        status: "success",
        notes: "",
        is_example: false,
      },
    ],
    editable_rows: [],
    customer_summary_rows: [],
    production_summary_rows: [],
    grouped_excel_rows: [],
    total_amount: 140,
    warning_count: 0,
    failed_count: 0,
    ignore_example_order: true,
    created_at: "",
    updated_at: "",
  };

  const rows = buildProductAnalytics([batch]);

  const caramel = rows.find((r) => r.normalized_name === "焦糖泡芙");
  assert.ok(caramel);
  assert.equal(caramel.total_quantity, 3);
  assert.equal(caramel.total_revenue, 30);

  const xiaobei = rows.find((r) => r.normalized_name === "肉松小贝");
  assert.ok(xiaobei);
  assert.equal(xiaobei.total_quantity, 4);

  const hazelnut = rows.find((r) => r.normalized_name === "榛果泡芙");
  assert.ok(hazelnut);
  assert.equal(hazelnut.total_quantity, 3);
  assert.ok(hazelnut.raw_names.includes("榛子泡芙"));
  assert.ok(hazelnut.raw_names.includes("榛果泡芙"));

  const jiuniang = rows.find((r) => r.normalized_name === "桂花酒酿盒子");
  assert.ok(jiuniang);
  assert.equal(jiuniang.total_quantity, 3);
  assert.ok(jiuniang.raw_names.includes("酒酿盒子"));

  assert.equal(rows.some((r) => r.normalized_name.includes("送")), false);

  // sorted by revenue desc
  assert.ok(rows[0].total_revenue >= rows[1]?.total_revenue);
}

testNormalization();
testAggregation();
console.log("product analytics tests passed");
