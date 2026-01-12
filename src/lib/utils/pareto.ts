export interface ParetoData {
  label: string;
  value: number;
  percentage: number;
  cumulative: number;
}

/**
 * Convert raw counts to Pareto data with percentages and cumulative totals
 */
export function toParetoData(
  items: { label: string; value: number }[]
): ParetoData[] {
  // Sort by value descending
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);

  let cumulative = 0;
  return sorted.map((item) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    cumulative += percentage;
    return {
      label: item.label,
      value: item.value,
      percentage,
      cumulative,
    };
  });
}
