"""
Schemas do domínio Parâmetros.
"""
from typing import Optional

from pydantic import BaseModel, Field


class ParametrosOrcamentoSchema(BaseModel):
    preco_hora: float = Field(ge=0, description="Preço por hora (calculado: total_despesas/total_horas_mes)")
    impostos: float = Field(ge=0, le=1, description="Taxa de impostos (ex: 0.06 = 6%)")
    cartao_credito: float = Field(ge=0, le=1, description="Taxa cartão crédito (ex: 0.03 = 3%)")
    total_horas_mes: Optional[float] = None
    margem_target: Optional[float] = Field(None, ge=0, le=1)
    total_despesas: Optional[float] = Field(None, description="Soma das despesas detalhadas (somente leitura)")
    faturamento_target: Optional[float] = Field(None, description="Calculado: total_despesas/(1-impostos-cartao-margem)")


class ParametrosOrcamentoUpdate(BaseModel):
    """Campos editáveis - preco_hora, total_despesas e faturamento_target são calculados."""
    impostos: Optional[float] = Field(None, ge=0, le=1)
    cartao_credito: Optional[float] = Field(None, ge=0, le=1)
    total_horas_mes: Optional[float] = None
    margem_target: Optional[float] = Field(None, ge=0, le=1)


class CalcularMargensRequest(BaseModel):
    horas_trabalho: float = Field(ge=0)
    custo_materiais: float = Field(default=0, ge=0)
    custos_variaveis: float = Field(default=0, ge=0)


class CalcularMargensResponse(BaseModel):
    margem_20: float
    margem_30: float
    margem_40: float
    custo_total: float
