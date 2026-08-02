// Espelha app_dev/backend/app/domains/pedidos/margem.py — mantido em sincronia manual.
// Usado só para preview instantâneo no cliente; o backend é sempre a autoridade que decide
// se o pedido precisa de confirmação (confirmado_atipico) antes de salvar.

export const VALOR_MINIMO_POR_PECA = 20.0;
export const HORAS_MAXIMAS_SEM_CONFIRMACAO = 40.0;
export const MARGEM_BAIXA_LIMITE = 20.0;
export const MARGEM_ALTA_LIMITE = 500.0;

export interface ParametrosCalculo {
  preco_hora: number;
  impostos: number;
  cartao_credito: number;
}

export interface ResultadoMargem {
  custoTotal: number;
  margemReal: number;
  valorMargem20: number;
  valorMargem30: number;
  valorMargem40: number;
}

export function calcularMargem(
  valorPecas: number,
  horasTrabalho: number,
  custoMateriais: number,
  custosVariaveis: number,
  params: ParametrosCalculo,
  // Taxa de cartão + desconto Pix DESTE pedido, em reais — zero num pedido em
  // dinheiro. Quando não informado, cai no comportamento antigo (taxa de cartão
  // sobre o valor cheio), para não mudar a margem de pedidos legados.
  custoReceber?: number | null
): ResultadoMargem {
  const custoTotal = params.preco_hora * horasTrabalho + custoMateriais + custosVariaveis;
  const fracaoReceber =
    custoReceber != null && valorPecas > 0 ? custoReceber / valorPecas : params.cartao_credito;
  const margemReal =
    valorPecas > 0
      ? Math.round(
          ((valorPecas - custoTotal) / valorPecas - params.impostos - fracaoReceber) * 1000
        ) / 10
      : -100;

  const denom = (x: number) => 1 - params.impostos - params.cartao_credito - x;
  const margem = (x: number) => {
    const d = denom(x);
    return d <= 0 ? 0 : Math.round((custoTotal / d) * 100) / 100;
  };

  return {
    custoTotal,
    margemReal,
    valorMargem20: margem(0.2),
    valorMargem30: margem(0.3),
    valorMargem40: margem(0.4),
  };
}

export interface AvisoPedido {
  codigo: string;
  mensagem: string;
}

export function avaliarAvisosPedido(
  valorPecas: number,
  quantidadePecas: number,
  horasTrabalho: number,
  margemReal: number
): AvisoPedido[] {
  const avisos: AvisoPedido[] = [];

  if (valorPecas <= 0) {
    avisos.push({ codigo: "valor_zero", mensagem: "Valor da(s) peça(s) está zerado ou não informado." });
  } else if (quantidadePecas > 1 && valorPecas / quantidadePecas < VALOR_MINIMO_POR_PECA) {
    avisos.push({
      codigo: "valor_por_peca_baixo",
      mensagem: `Valor por peça (R$ ${(valorPecas / quantidadePecas).toFixed(2)}) parece baixo para ${quantidadePecas} peças.`,
    });
  }

  if (horasTrabalho <= 0) {
    avisos.push({ codigo: "horas_zero", mensagem: "Horas de trabalho não informadas (0h)." });
  } else if (horasTrabalho > HORAS_MAXIMAS_SEM_CONFIRMACAO) {
    avisos.push({
      codigo: "horas_altas",
      mensagem: `${horasTrabalho.toFixed(1)}h de trabalho é incomum (acima de ${HORAS_MAXIMAS_SEM_CONFIRMACAO.toFixed(0)}h).`,
    });
  }

  if (valorPecas > 0) {
    if (margemReal < 0) {
      avisos.push({ codigo: "margem_negativa", mensagem: `Margem negativa (${margemReal.toFixed(1)}%) — pedido terá prejuízo.` });
    } else if (margemReal < MARGEM_BAIXA_LIMITE) {
      avisos.push({ codigo: "margem_baixa", mensagem: `Margem baixa (${margemReal.toFixed(1)}%, abaixo de ${MARGEM_BAIXA_LIMITE.toFixed(0)}%).` });
    } else if (margemReal > MARGEM_ALTA_LIMITE) {
      avisos.push({ codigo: "margem_alta", mensagem: `Margem de ${margemReal.toFixed(1)}% é incomum (acima de ${MARGEM_ALTA_LIMITE.toFixed(0)}%).` });
    }
  }

  if ((!quantidadePecas || quantidadePecas <= 0) && valorPecas > 0) {
    avisos.push({ codigo: "quantidade_ausente", mensagem: "Quantidade de peças não informada — assumindo 1 peça." });
  }

  return avisos;
}
