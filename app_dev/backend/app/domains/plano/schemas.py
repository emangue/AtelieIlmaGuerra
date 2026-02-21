"""
Schemas do domínio Plano.
"""
from pydantic import BaseModel
from typing import Optional


class PlanoItemOut(BaseModel):
    id: int
    anomes: str
    tipo: str
    categoria: str
    tipo_item: str
    detalhe: Optional[str] = None
    quantidade: Optional[int] = None
    ticket_medio: Optional[float] = None
    valor_planejado: float
    valor_realizado: Optional[float] = None

    class Config:
        from_attributes = True


class PlanoResumoMes(BaseModel):
    """Resumo por mês: receita planejada, despesas planejadas, lucro planejado."""
    anomes: str
    receita_planejada: float
    despesas_planejadas: float
    lucro_planejado: float
