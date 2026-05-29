import assert from "node:assert/strict";
import {
  getOrderRecordProductName,
  sanitizeEditableRow,
  safeRowSpan,
} from "@/lib/recognizeSafe";

const partial = sanitizeEditableRow(
  { wechat_id: "test", sku_code: undefined, cake_name: undefined },
  0
);
assert.equal(partial.sku_code, "");
assert.equal(getOrderRecordProductName(partial), "—");

const hazelnut = sanitizeEditableRow(
  { cake_name: "百香果焦糖榛子泡芙", display_name: "百香果焦糖榛子泡芙" },
  1
);
assert.equal(getOrderRecordProductName(hazelnut), "百香果焦糖榛子泡芙");

assert.equal(safeRowSpan(0), 1);
assert.equal(safeRowSpan(3), 3);

console.log("recognize safe tests passed");
