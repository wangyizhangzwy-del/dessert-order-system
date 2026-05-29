import {
  buildDeliveryRouteSummary,
  normalizeDeliveryLocation,
  type DeliveryRouteCustomerInput,
} from "../lib/deliveryRoute";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function routeLine(inputs: DeliveryRouteCustomerInput[]): string {
  return buildDeliveryRouteSummary(inputs).routeLabels.join(" → ");
}

// normalizeDeliveryLocation
assert(normalizeDeliveryLocation("The Grand") === "the grand", "The Grand");
assert(normalizeDeliveryLocation("F8") === "f8", "F8");
assert(normalizeDeliveryLocation("be dtla") === "bedtla", "be dtla");
assert(normalizeDeliveryLocation("Park Fifth") === "parkfifth", "Park Fifth");
assert(normalizeDeliveryLocation("Hope & Flower") === "hope&flower", "Hope & Flower");
assert(normalizeDeliveryLocation("") === null, "empty");
assert(normalizeDeliveryLocation("unknown apt") === null, "unknown");

// Case 1
assert(
  routeLine([
    { wechatId: "Chino", needsDelivery: true, deliveryMode: "custom", addressForMatch: "888" },
    { wechatId: "Frank", needsDelivery: true, deliveryMode: "custom", addressForMatch: "f8" },
    { wechatId: "Amy", needsDelivery: true, deliveryMode: "custom", addressForMatch: "perla" },
  ]) === "888 → f8 → perla",
  "Case 1"
);

// Case 2
assert(
  routeLine([
    { wechatId: "Alice", needsDelivery: true, deliveryMode: "custom", addressForMatch: "aven" },
    { wechatId: "Bob", needsDelivery: true, deliveryMode: "custom", addressForMatch: "1133" },
    { wechatId: "Carol", needsDelivery: true, deliveryMode: "custom", addressForMatch: "the grand" },
  ]) === "aven → 1133 → the grand",
  "Case 2"
);

// Case 3
assert(
  routeLine([
    { wechatId: "A", needsDelivery: true, deliveryMode: "default", addressForMatch: "F8" },
    { wechatId: "B", needsDelivery: true, deliveryMode: "custom", addressForMatch: "be dtla" },
    { wechatId: "C", needsDelivery: true, deliveryMode: "custom", addressForMatch: "Park Fifth" },
    { wechatId: "D", needsDelivery: true, deliveryMode: "custom", addressForMatch: "The Grand" },
  ]) === "f8 → bedtla → parkfifth → the grand",
  "Case 3"
);

// Case 4 pickup excluded
const case4 = buildDeliveryRouteSummary([
  { wechatId: "Self", needsDelivery: true, deliveryMode: "pickup", addressForMatch: "888" },
  { wechatId: "Amy", needsDelivery: true, deliveryMode: "custom", addressForMatch: "perla" },
]);
assert(case4.routeLabels.join(" → ") === "perla", "Case 4 route");
assert(case4.hasDelivery, "Case 4 has delivery");

// Case 5 needsDelivery=false excluded
const case5 = buildDeliveryRouteSummary([
  { wechatId: "No", needsDelivery: false, deliveryMode: "custom", addressForMatch: "888" },
  { wechatId: "Yes", needsDelivery: true, deliveryMode: "custom", addressForMatch: "f8" },
]);
assert(case5.routeLabels.join(" → ") === "f8", "Case 5");

// Case 6 unmatched
const case6 = buildDeliveryRouteSummary([
  { wechatId: "X", needsDelivery: true, deliveryMode: "custom", addressForMatch: "unknown apt" },
  { wechatId: "Y", needsDelivery: true, deliveryMode: "custom", addressForMatch: "888" },
]);
assert(case6.routeLabels.join(" → ") === "888", "Case 6 route");
assert(case6.unmatched.length === 1 && case6.unmatched[0].wechatId === "X", "Case 6 unmatched");

// Case 7 no delivery
const case7 = buildDeliveryRouteSummary([
  { wechatId: "A", needsDelivery: false, deliveryMode: "custom", addressForMatch: "888" },
  { wechatId: "B", needsDelivery: true, deliveryMode: "pickup", addressForMatch: "f8" },
]);
assert(!case7.hasDelivery, "Case 7");
assert(case7.routeLabels.length === 0, "Case 7 empty route");

// defensive
const case8 = buildDeliveryRouteSummary(null);
assert(!case8.hasDelivery && case8.stops.length === 0, "null input");

console.log("test-delivery-route: all passed");
