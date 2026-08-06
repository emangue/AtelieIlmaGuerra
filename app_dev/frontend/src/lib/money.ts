/**
 * Formatação de dinheiro com centavos.
 *
 * Diferente do formatMoney da tela de Financeiro, que arredonda para o real
 * inteiro: numa tela de conferência os centavos são o produto — sem eles
 * R$ 8.784,93 vira R$ 8.785 e o total deixa de bater com o que se está somando.
 */
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(valor: number): string {
  return BRL.format(valor ?? 0);
}

export function formatMoneySigned(valor: number): string {
  const s = BRL.format(Math.abs(valor ?? 0));
  return `${(valor ?? 0) < 0 ? "−" : "+"} ${s}`;
}
