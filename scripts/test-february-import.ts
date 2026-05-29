import assert from "node:assert/strict";
import {
  buildFebruaryBatches,
  isImportableDefaultAddress,
  normalizeDeliveryOrAddress,
  parseFebruaryCsv,
} from "../lib/februaryImport";

const SAMPLE = `order_date,wechat_id,product_name,quantity,unit_price,line_total,delivery_or_address,payment_status,delivery_status,production_status,source_line
2026-02-01,alice,提拉米苏,1,10,10,be dtla,未付款,未送达,未制作,line1
2026-02-01,alice,巴斯克,2,8,16,be dtla,未付款,未送达,未制作,line2
2026-02-01,bob,曲奇,1,5,5,自取,未付款,未送达,未制作,line3
2026-02-02,carol,蛋糕,1,,,/,未付款,未送达,未制作,line4
2026-02-02,carol,泡芙,1,6,6,aven,未付款,未送达,未制作,line5
2026-02-13,chenyizen,司康,1,,,be dtla,未付款,未送达,未制作,line6
2026-02-13,chenyizen,玛德琳,2,4,8,be dtla,未付款,未送达,未制作,line7
`;

const rows = parseFebruaryCsv(SAMPLE);
assert.equal(rows.length, 7);

const { batches, summary } = buildFebruaryBatches(rows);
assert.equal(summary.rowsRead, 7);
assert.equal(summary.batchesCreatedOrUpdated, 3);
assert.equal(summary.customerOrders, 4);
assert.equal(summary.productLines, 7);
assert.equal(summary.missingPriceRows, 2);

assert.equal(batches[0].batch_id, "import_february_2026-02-01");
assert.match(batches[0].batch_name, /^接龙-2026-02-01-周.-历史导入$/);
assert.equal(batches[0].parsed_orders.length, 2);
assert.equal(batches[0].parsed_orders[0].items.length, 2);
assert.equal(batches[0].parsed_orders[1].notes, "自取");

assert.equal(normalizeDeliveryOrAddress("/"), "");
assert.equal(normalizeDeliveryOrAddress("  "), "");
assert.equal(isImportableDefaultAddress("be dtla"), true);
assert.equal(isImportableDefaultAddress("自取"), false);
assert.equal(isImportableDefaultAddress("/"), false);

const feb13 = batches.find((b) => b.order_date === "2026-02-13");
assert.ok(feb13);
assert.equal(feb13.parsed_orders[0].wechat_id, "chenyizen");
assert.equal(feb13.warning_count, 1);

console.log("february-import tests passed");
