"""
Cálculo de margem real e avaliação de valores atípicos em pedidos.
Módulo puro (sem dependência de DB/FastAPI) para ficar fácil de revisar/testar isoladamente.
"""
from dataclasses import dataclass
from typing import List, Optional

VALOR_MINIMO_POR_PECA = 20.0
HORAS_MAXIMAS_SEM_CONFIRMACAO = 40.0
MARGEM_BAIXA_LIMITE = 20.0
MARGEM_ALTA_LIMITE = 500.0


@dataclass
class ParametrosCalculo:
    preco_hora: float
    impostos: float
    cartao_credito: float


@dataclass
class ResultadoMargem:
    custo_total: float
    margem_real: float  # sempre float, nunca None


def calcular_margem_real(
    valor_pecas: Optional[float],
    horas_trabalho: Optional[float],
    custo_materiais: Optional[float],
    custos_variaveis: Optional[float],
    params: ParametrosCalculo,
    custo_receber: Optional[float] = None,
) -> ResultadoMargem:
    """MargemReal = (valor - custo_total)/valor - impostos - custo de receber, em %.

    `custo_receber` é a taxa de cartão + desconto Pix **em reais** daquele pedido —
    zero num pedido pago em dinheiro. Quando não é informado (pedidos antigos, sem
    as colunas preenchidas), cai no comportamento anterior de aplicar a taxa de
    cartão sobre o valor cheio, para não alterar a margem histórica.

    Se valor_pecas <= 0, não há como calcular uma fração: trata-se como perda total (-100%),
    nunca como None — requisito explícito de nunca deixar margem_real nula."""
    horas = horas_trabalho or 0.0
    materiais = custo_materiais or 0.0
    variaveis = custos_variaveis or 0.0
    custo_total = params.preco_hora * horas + materiais + variaveis
    valor = valor_pecas or 0.0

    if valor <= 0:
        margem_real = -100.0
    else:
        fracao_receber = (custo_receber / valor) if custo_receber is not None else params.cartao_credito
        fracao = (valor - custo_total) / valor - params.impostos - fracao_receber
        margem_real = round(fracao * 100, 1)

    return ResultadoMargem(custo_total=round(custo_total, 2), margem_real=margem_real)


@dataclass
class AvisoPedido:
    codigo: str
    mensagem: str


def avaliar_avisos(
    valor_pecas: Optional[float],
    quantidade_pecas: Optional[int],
    horas_trabalho: Optional[float],
    margem_real: float,
) -> List[AvisoPedido]:
    """Avalia se o pedido tem valores atípicos que merecem confirmação explícita do usuário.
    Não bloqueia nada — só sinaliza. O chamador decide se exige confirmado_atipico."""
    avisos: List[AvisoPedido] = []
    valor = valor_pecas or 0.0
    horas = horas_trabalho or 0.0

    if valor <= 0:
        avisos.append(AvisoPedido("valor_zero", "Valor da(s) peça(s) está zerado ou não informado."))
    elif quantidade_pecas and quantidade_pecas > 1 and (valor / quantidade_pecas) < VALOR_MINIMO_POR_PECA:
        avisos.append(AvisoPedido(
            "valor_por_peca_baixo",
            f"Valor por peça (R$ {valor / quantidade_pecas:.2f}) parece baixo para {quantidade_pecas} peças.",
        ))

    if horas <= 0:
        avisos.append(AvisoPedido("horas_zero", "Horas de trabalho não informadas (0h)."))
    elif horas > HORAS_MAXIMAS_SEM_CONFIRMACAO:
        avisos.append(AvisoPedido(
            "horas_altas",
            f"{horas:.1f}h de trabalho é incomum (acima de {HORAS_MAXIMAS_SEM_CONFIRMACAO:.0f}h).",
        ))

    if valor > 0:  # evita duplicar aviso quando valor_zero já cobre a causa raiz
        if margem_real < 0:
            avisos.append(AvisoPedido("margem_negativa", f"Margem negativa ({margem_real:.1f}%) — pedido terá prejuízo."))
        elif margem_real < MARGEM_BAIXA_LIMITE:
            avisos.append(AvisoPedido("margem_baixa", f"Margem baixa ({margem_real:.1f}%, abaixo de {MARGEM_BAIXA_LIMITE:.0f}%)."))
        elif margem_real > MARGEM_ALTA_LIMITE:
            avisos.append(AvisoPedido("margem_alta", f"Margem de {margem_real:.1f}% é incomum (acima de {MARGEM_ALTA_LIMITE:.0f}%)."))

    if (quantidade_pecas is None or quantidade_pecas == 0) and valor > 0:
        avisos.append(AvisoPedido("quantidade_ausente", "Quantidade de peças não informada — assumindo 1 peça."))

    return avisos
