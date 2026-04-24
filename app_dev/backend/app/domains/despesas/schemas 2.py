"""
Schemas do domínio Despesas.
"""
from typing import Optional

from pydantic import BaseModel, Field


class DespesaDetalhadaCreate(BaseModel):
    detalhe: str = Field(..., min_length=1)
    valor: float = Field(ge=0)
    grupo: Optional[str] = None


class DespesaDetalhadaUpdate(BaseModel):
    detalhe: Optional[str] = Field(None, min_length=1)
    valor: Optional[float] = Field(None, ge=0)
    grupo: Optional[str] = None


class DespesaDetalhadaItem(BaseModel):
    id: int
    detalhe: str
    valor: float
    grupo: Optional[str] = None

    class Config:
        from_attributes = True
