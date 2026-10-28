"""Contratos da API de aluguéis."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


CATEGORIAS = {"Vestido", "Acessório"}
STATUS = {"Reservado", "Retirado", "Devolvido", "Cancelado"}


class ItemAcervoBase(BaseModel):
    codigo: str = Field(min_length=1, max_length=50)
    nome: str = Field(min_length=1, max_length=255)
    categoria: str
    tamanho: Optional[str] = None
    cor: Optional[str] = None
    valor_reposicao: Optional[float] = Field(default=None, ge=0)
    observacao: Optional[str] = None
    ativo: bool = True

    @field_validator("categoria")
    @classmethod
    def categoria_valida(cls, value: str) -> str:
        if value not in CATEGORIAS:
            raise ValueError("Categoria deve ser Vestido ou Acessório")
        return value


class ItemAcervoCreate(ItemAcervoBase):
    pass


class ItemAcervoUpdate(BaseModel):
    codigo: Optional[str] = Field(default=None, min_length=1, max_length=50)
    nome: Optional[str] = Field(default=None, min_length=1, max_length=255)
    categoria: Optional[str] = None
    tamanho: Optional[str] = None
    cor: Optional[str] = None
    valor_reposicao: Optional[float] = Field(default=None, ge=0)
    observacao: Optional[str] = None
    ativo: Optional[bool] = None

    @field_validator("categoria")
    @classmethod
    def categoria_valida(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in CATEGORIAS:
            raise ValueError("Categoria deve ser Vestido ou Acessório")
        return value


class ItemAcervoOut(ItemAcervoBase):
    id: int
    disponivel: Optional[bool] = None

    class Config:
        from_attributes = True


class AluguelItemInput(BaseModel):
    item_acervo_id: int
    valor_aluguel: float = Field(ge=0)


class AluguelCreate(BaseModel):
    cliente_id: int
    data_reserva: date = Field(default_factory=date.today)
    data_retirada: date
    data_devolucao_prevista: date
    itens: list[AluguelItemInput] = Field(min_length=1)
    valor_caucao: float = Field(default=0, ge=0)
    forma_pagamento: Optional[str] = None
    observacao: Optional[str] = None

    @model_validator(mode="after")
    def validar_periodo_e_itens(self):
        if self.data_reserva > self.data_retirada:
            raise ValueError("A data da reserva não pode ser posterior à retirada")
        if self.data_devolucao_prevista < self.data_retirada:
            raise ValueError("A devolução deve ser igual ou posterior à retirada")
        ids = [i.item_acervo_id for i in self.itens]
        if len(ids) != len(set(ids)):
            raise ValueError("Um item do acervo não pode ser repetido")
        return self


class AluguelUpdate(BaseModel):
    data_retirada: Optional[date] = None
    data_devolucao_prevista: Optional[date] = None
    itens: Optional[list[AluguelItemInput]] = Field(default=None, min_length=1)
    valor_caucao: Optional[float] = Field(default=None, ge=0)
    forma_pagamento: Optional[str] = None
    observacao: Optional[str] = None


class AluguelStatusUpdate(BaseModel):
    status: str
    data_evento: Optional[date] = None

    @field_validator("status")
    @classmethod
    def status_valido(cls, value: str) -> str:
        if value not in STATUS:
            raise ValueError("Status inválido")
        return value


class AluguelItemOut(BaseModel):
    item_acervo_id: int
    codigo: str
    nome: str
    categoria: str
    valor_aluguel: float


class AluguelOut(BaseModel):
    id: int
    cliente_id: int
    cliente_nome: str
    data_reserva: date
    data_retirada: date
    data_devolucao_prevista: date
    data_retirada_real: Optional[date]
    data_devolucao_real: Optional[date]
    status: str
    valor_total: float
    valor_caucao: float
    forma_pagamento: Optional[str]
    observacao: Optional[str]
    itens: list[AluguelItemOut]
    created_at: datetime
    updated_at: datetime


class ReceitaAluguelItem(BaseModel):
    id: int
    tipo_pedido_nome: str = "Aluguel"
    valor_pecas: float
    data_entrega: date
    cliente_nome: str
