export function formatNum(value: number): string {
  return value.toFixed(2);
}

export function formatCost(cost: number | undefined): string {
  if (cost == null) return "—";
  if (cost < 0.0001) return `$${cost.toExponential(1)}`;
  return `$${cost.toFixed(5)}`;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
