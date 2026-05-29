import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  assertBatchHasItemLevelDetail,
  buildFebruaryBatches,
  getCustomerOrderFromBatch,
  isImportableDefaultAddress,
  normalizeDeliveryOrAddress,
  parseFebruaryCsv,
} from "../lib/februaryImport";

const SAMPLE = `order_date,wechat_id,product_name,quantity,unit_price,line_total,delivery_or_address,payment_status,delivery_status,production_status,source_line
2026-02-01,怡,草莓蛋糕,1,10,10,be dtla,未付款,未送达,未制作,line1
2026-02-01,怡,巴斯克,2,8,16,be dtla,未付款,未送达,未制作,line2
2026-02-01,bob,曲奇,1,5,5,自取,未付款,未送达,未制作,line3
2026-02-02,carol,蛋糕,1,,,/,未付款,未送达,未制作,line4
2026-02-13,chenyizen,司康,1,,,be dtla,未付款,未送达,未制作,line6
`;

const rows = parseFebruaryCsv(SAMPLE);
const { batches, summary } = buildFebruaryBatches(rows);
assert.equal(summary.productLines, 5);
assert.equal(summary.customerOrders, 4);

for (const batch of batches) {
  const errors = assertBatchHasItemLevelDetail(batch);
  assert.equal(errors.length, 0, errors.join("; "));
}

assert.equal(normalizeDeliveryOrAddress("/"), "");
assert.equal(isImportableDefaultAddress("be dtla"), true);
assert.equal(isImportableDefaultAddress("自取"), false);

// Real CSV spot-checks when file is present (怡 ×4, pzzzy ×3 on 2026-02-01).
const csvPath = join(process.cwd(), "data/february_orders_normalized.csv");
if (existsSync(csvPath)) {
  const realRows = parseFebruaryCsv(readFileSync(csvPath, "utf8"));
  const { batches: realBatches } = buildFebruaryBatches(realRows);
  const feb01 = realBatches.find((b) => b.batch_id === "import_february_2026-02-01");
  assert.ok(feb01, "missing import_february_2026-02-01");

  const detailErrors = assertBatchHasItemLevelDetail(feb01);
  assert.equal(detailErrors.length, 0, detailErrors.join("; "));

  assert.equal(feb01.editable_rows.filter((r) => !r.is_example).length, 22);
  assert.equal(feb01.parsed_orders.filter((o) => !o.is_example).length, 9);

  const yi = getCustomerOrderFromBatch(feb01, "怡");
  assert.ok(yi);
  assert.equal(yi.items.length, 4);
  assert.equal(yi.notes, "be dtla");
  assert.equal(yi.customer_total, 86.6);
  assert.deepEqual(
    yi.items.map((i) => i.product_name),
    ["草莓蛋糕", "咸蛋黄小贝", "开心果泡芙", "小泡芙（原味 抹茶 黑芝麻 巧克力"]
  );
  assert.equal(yi.items[0].unit_price, 24.9);

  const pzzzy = getCustomerOrderFromBatch(feb01, "pzzzy");
  assert.ok(pzzzy);
  assert.equal(pzzzy.items.length, 3);
  assert.equal(pzzzy.notes, "自取");
  assert.deepEqual(
    pzzzy.items.map((i) => i.product_name),
    ["咸蛋黄泡芙", "咸蛋黄芋泥盒子", "玄米焙茶卷"]
  );
  assert.equal(isImportableDefaultAddress(pzzzy.notes), false);

  const kaixi = getCustomerOrderFromBatch(feb01, "凯西余");
  assert.ok(kaixi);
  assert.equal(kaixi.notes, "aven");
  assert.equal(kaixi.items.length, 6);
}

console.log("february-import tests passed");
