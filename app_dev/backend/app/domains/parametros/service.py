"""
Service do domínio Parâmetros - cálculo de margens.
Fórmula: MargemX = CustoTotal / (1 - Impostos - CartaoCredito - X)
"""
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from .models import ParametrosOrcamento


def calcular_margens(
    preco_hora: float,
    impostos: float,
    cartao_credito: float,
    horas_trabalho: float,
    custo_materiais: float = 0,
    custos_variaveis: float = 0,
) -> Tuple[float, float, float, float]:
    """
    Retorna (margem_20, margem_30, margem_40, custo_total).
    MargemX = preço de venda sugerido para lucro de X% após impostos e taxas.
    """
    custo_total = (
        preco_hora * horas_trabalho + custo_materiais + custos_variaveis
    )

    def margem(x: float) -> float:
        denom = 1 - impostos - cartao_credito - x
        if denom <= 0:
            return 0.0
        return round(custo_total / denom, 2)

    return (
        margem(0.2),
        margem(0.3),
        margem(0.4),
        round(custo_total, 2),
    )


def get_parametros(db: Session) -> Optional[ParametrosOrcamento]:
    """Retorna o primeiro registro de parâmetros (singleton)."""
    return db.query(ParametrosOrcamento).first()


def get_total_despesas(db: Session) -> float:
    """Retorna a soma das despesas detalhadas."""
    from app.domains.despesas.repository import DespesaRepository
    return DespesaRepository(db).get_total()


def get_preco_hora_efetivo(db: Session) -> float:
    """Preço-hora usado em cálculos de margem: total_despesas/total_horas_mes quando
    disponível, senão o valor bruto configurado. Fonte única reaproveitada por
    /parametros, /calcular-margens e pelo cálculo de margem de pedidos."""
    p = get_or_create_parametros(db)
    total_despesas = get_total_despesas(db)
    total_horas = p.total_horas_mes or 0
    if total_horas > 0 and total_despesas > 0:
        return round(total_despesas / total_horas, 2)
    return p.preco_hora


def get_or_create_parametros(db: Session) -> ParametrosOrcamento:
    """Retorna parâmetros existentes ou cria com valores padrão."""
    p = get_parametros(db)
    if p:
        return p
    p = ParametrosOrcamento(
        preco_hora=50.0,
        impostos=0.06,
        cartao_credito=0.03,
        total_horas_mes=160.0,
        margem_target=0.25,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
