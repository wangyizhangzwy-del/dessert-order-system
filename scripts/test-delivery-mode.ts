import assert from "node:assert/strict";
import { extractAddress, isPickupNote } from "../lib/address";
import { addressesMatch, resolveDeliveryMode } from "../lib/deliveryMode";
import { applyJielongToCustomers } from "../lib/customerHistory";
import { SavedJielong } from "../lib/types";

function testAddressExtraction() {
  assert.equal(extractAddress("自取"), null);
  assert.equal(extractAddress("叫车"), null);
  assert.equal(extractAddress("送2"), null);
  assert.equal(extractAddress("+2"), null);
  assert.equal(extractAddress("多送一个"), null);
  assert.equal(extractAddress("送888"), "888");
  assert.equal(extractAddress("F8"), "F8");
  assert.equal(extractAddress("The Grand"), "The Grand");
  assert.equal(isPickupNote("今天自取"), true);
}

function testDeliveryModeResolution() {
  // Case A: has default_address, empty notes -> 默认地址
  assert.deepEqual(resolveDeliveryMode("", "888"), { mode: "default", customText: "" });
  assert.deepEqual(resolveDeliveryMode("送2", "888"), { mode: "default", customText: "" });

  // Case A: matches default
  assert.deepEqual(resolveDeliveryMode("送888", "888"), { mode: "default", customText: "" });
  assert.deepEqual(resolveDeliveryMode("888", "888"), { mode: "default", customText: "" });

  // Case A: 自取
  assert.deepEqual(resolveDeliveryMode("自取", "888"), { mode: "pickup", customText: "" });

  // Case A: different address -> 自定义
  assert.deepEqual(resolveDeliveryMode("F8", "888"), { mode: "custom", customText: "F8" });

  // Case B: no default, real address
  assert.deepEqual(resolveDeliveryMode("ViewTree", undefined), { mode: "custom", customText: "ViewTree" });

  // Case B: no default, 自取
  assert.deepEqual(resolveDeliveryMode("自取", undefined), { mode: "pickup", customText: "" });

  // Case B: no default, no address
  assert.deepEqual(resolveDeliveryMode("", undefined), { mode: "custom", customText: "" });

  assert.equal(addressesMatch("送888", "888"), true);
  assert.equal(addressesMatch("F8", "888"), false);
}

function testCustomerDefaultAddressOnSave() {
  const jielong: SavedJielong = {
    batch_id: "b1",
    batch_name: "test",
    order_date: "5.28",
    raw_text: "",
    parsed_orders: [
      {
        id: "o1",
        wechat_id: "user_a",
        raw_line: "",
        items: [],
        customer_total: 10,
        notes: "送888",
        status: "success",
        is_example: false,
      },
      {
        id: "o2",
        wechat_id: "user_b",
        raw_line: "",
        items: [],
        customer_total: 10,
        notes: "自取",
        status: "success",
        is_example: false,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const updated = applyJielongToCustomers([], jielong, new Date().toISOString(), () => "id1");
  const a = updated.find((c) => c.wechat_id === "user_a");
  const b = updated.find((c) => c.wechat_id === "user_b");
  assert.equal(a?.default_address, "888");
  assert.equal(b?.default_address, undefined);

  // existing default_address not overwritten by 自取 in new order
  const existing = applyJielongToCustomers(
    [{ id: "x", wechat_id: "user_c", balance: 0, default_address: "F8", order_history: [], created_at: "", updated_at: "" }],
    {
      ...jielong,
      batch_id: "b2",
      parsed_orders: [
        {
          id: "o3",
          wechat_id: "user_c",
          raw_line: "",
          items: [],
          customer_total: 10,
          notes: "自取",
          status: "success",
          is_example: false,
        },
      ],
    },
    new Date().toISOString(),
    () => "id2"
  );
  assert.equal(existing.find((c) => c.wechat_id === "user_c")?.default_address, "F8");
}

testAddressExtraction();
testDeliveryModeResolution();
testCustomerDefaultAddressOnSave();
console.log("delivery-mode tests passed");
