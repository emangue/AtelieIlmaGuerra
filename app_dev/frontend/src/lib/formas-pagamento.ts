// Fonte única das formas de pagamento. Antes havia quatro listas divergentes
// espalhadas (pagamento-form, pedidos/page, pedidos/[id]/page), o que fazia a
// mesma forma aparecer com nomes diferentes dependendo da tela.

export const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Crediário", "Cartão de Débito", "Cartão Parcelado"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

// "Cartão de Crédito" é rótulo legado de registros antigos.
const CARTAO_CREDITO = ["cartão parcelado", "cartao parcelado", "cartão de crédito", "cartao de credito"];
const CARTAO_DEBITO = ["cartão de débito", "cartao de debito"];
const PIX = ["pix"];
const PARCELADAS = [...CARTAO_CREDITO, "crediário", "crediario"];

const norm = (f?: string | null) => (f ?? "").trim().toLowerCase();

/** Cartão de crédito: liquidação automática em D+30, sem confirmação manual. */
export function isCartao(forma?: string | null): boolean {
  return CARTAO_CREDITO.includes(norm(forma));
}

export function isCartaoDebito(forma?: string | null): boolean {
  return CARTAO_DEBITO.includes(norm(forma));
}

export function isCartaoComTaxa(forma?: string | null): boolean {
  return isCartao(forma) || isCartaoDebito(forma);
}

export function isPix(forma?: string | null): boolean {
  return PIX.includes(norm(forma));
}

/** Aceita mais de uma parcela (cartão e crediário). */
export function isParcelado(forma?: string | null): boolean {
  return PARCELADAS.includes(norm(forma));
}

/** Trata o rótulo legado como equivalente ao atual na hora de marcar o botão. */
export function formaSelecionada(atual: string | null | undefined, opcao: string): boolean {
  if (norm(atual) === norm(opcao)) return true;
  return opcao === "Cartão Parcelado" && isCartao(atual);
}

export const CANAIS_CARTAO = ["Maquininha", "Link de pagamento"] as const;
export type CanalCartao = (typeof CANAIS_CARTAO)[number];

export const CANAL_CARTAO_PADRAO: CanalCartao = "Maquininha";
