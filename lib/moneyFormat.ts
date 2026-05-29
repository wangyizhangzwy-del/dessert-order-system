export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 金额展示（美金，带 $ 前缀）。 */
export function formatMoney(n: number | null | undefined): string {
  const v = roundMoney(Number(n) || 0);
  return `$${v.toFixed(1)}`;
}

/** 单价展示（美金，带 $ 前缀）。 */
export function formatPrice(n: number | null | undefined): string {
  const v = roundMoney(Number(n) || 0);
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(1)}`;
}
