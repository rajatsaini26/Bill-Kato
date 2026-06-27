export function calcLineTotals(
  quantity: number,
  unitPrice: number,
  discountPct: number
): number {
  return quantity * unitPrice * (1 - discountPct / 100);
}

export function calcInvoicePnL(
  saleTotal: number,
  costPrices: { costPrice: number; quantity: number }[]
): { revenue: number; cogs: number; profit: number; marginPct: number } {
  const cogs = costPrices.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const profit = saleTotal - cogs;
  const marginPct = saleTotal > 0 ? (profit / saleTotal) * 100 : 0;
  return { revenue: saleTotal, cogs, profit, marginPct };
}
