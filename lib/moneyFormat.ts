export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 金额展示（美金，带 $ 前缀）。 */
export function formatMoney(n: number): string {
  return `$${roundMoney(n).toFixed(1)}`;
}

/** 单价展示（美金，带 $ 前缀）。 */
export function formatPrice(n: number): string {
  const v = roundMoney(n);
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(1)}`;
}
