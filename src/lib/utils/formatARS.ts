const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Reserved for future use with Intl currency style
void arsFormatter;

/** Formatea montos en pesos argentinos. Ej: 150000 -> "$150.000 ARS" */
export function formatARS(amount: number): string {
  const hasDecimals = Math.abs(amount % 1) > 0.001;
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `$${formatted} ARS`;
}

/** Formato corto para presupuestos diarios: "$150.000 ARS/día" */
export function formatARSDaily(amount: number): string {
  return `${formatARS(amount)}/día`;
}

/** Formato mensual estimado: "$4.500.000 ARS/mes" */
export function formatARSMonthly(amount: number): string {
  return `${formatARS(amount)}/mes`;
}

export function estimateMonthlyARS(dailyBudgetARS: number): number {
  return dailyBudgetARS * 30;
}
