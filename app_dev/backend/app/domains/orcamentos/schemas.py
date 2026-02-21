"""
Schemas do domínio Orçamentos.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class OrcamentoCreate(BaseModel):
    cliente_id: int
    data: date
    descricao: Optional[str] = None
    valor: Optional[float] = None
    status: str = "Ativo"
    horas_trabalho: float = Field(default=0, ge=0)
    custo_materiais: float = Field(default=0, ge=0)
    custos_variaveis: float = Field(default=0, ge=0)


class OrcamentoUpdate(BaseModel):
    descricao: Optional[str] = None
    valor: Optional[float] = None
    status: Optional[str] = None
    horas_trabalho: Optional[float] = Field(None, ge=0)
    custo_materiais: Optional[float] = Field(None, ge=0)
    custos_variaveis: Optional[float] = Field(None, ge=0)


class OrcamentoListItem(BaseModel):
    id: int
    cliente_id: int
    cliente_nome: str
    data: date
    descricao: Optional[str] = None
    valor: Optional[float] = None
    status: str
    margem_20: Optional[float] = None
    margem_30: Optional[float] = None
    margem_40: Optional[float] = None

    class Config:
        from_attributes = True


class OrcamentoDetail(OrcamentoListItem):
    horas_trabalho: Optional[float] = None
    custo_materiais: Optional[float] = None
    custos_variaveis: Optional[float] = None
    created_at: datetime
