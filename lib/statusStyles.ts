const DELIVERY_ACTIVE =
  "bg-blue-600 text-white border-blue-600 hover:bg-blue-700";
const PAYMENT_ACTIVE = "bg-red-600 text-white border-red-600 hover:bg-red-700";

export function deliveryStatusSelectClass(delivered: boolean): string {
  return `rounded border px-2 py-1 text-xs ${delivered ? DELIVERY_ACTIVE : ""}`;
}

export function paymentStatusSelectClass(paid: boolean): string {
  return `rounded border px-2 py-1 text-xs ${paid ? PAYMENT_ACTIVE : ""}`;
}
