"""Contratos da API de aluguéis."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


CATEGORIAS = {"Vestido", "Acessório"}
STATUS = {"Reservado", "Retirado", "Devolvido", "Cancelado"}
STATUS_ITEM = {"disponivel", "manutencao", "inativo"}
STATUS_CAUCAO = {"pendente", "devolvida", "retida", "parcialmente_retida"}


class ItemAcervoBase(BaseModel):
    codigo: str = Field(min_length=1, max_length=50)
    nome: str = Field(min_length=1, max_length=255)
    categoria: str
    tamanho: Optional[str] = None
    cor: Optional[str] = None
    valor_aluguel_padrao: Optional[float] = Field(default=None, ge=0)
    valor_reposicao: Optional[float] = Field(default=None, ge=0)
    status_item: str = "disponivel"
    foto_url: Optional[str] = None
    observacao: Optional[str] = None
    ativo: bool = True

    @field_validator("status_item")
    @classmethod
    def status_item_valido(cls, value: str) -> str:
        if value not in STATUS_ITEM:
            raise ValueError("Status do item inválido")
        return value

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
    valor_aluguel_padrao: Optional[float] = Field(default=None, ge=0)
    valor_reposicao: Optional[float] = Field(default=None, ge=0)
    status_item: Optional[str] = None
    foto_url: Optional[str] = None
    observacao: Optional[str] = None
    ativo: Optional[bool] = None

    @field_validator("status_item")
    @classmethod
    def status_item_valido(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in STATUS_ITEM:
            raise ValueError("Status do item inválido")
        return value

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
    status_caucao: Optional[str] = None

    @field_validator("status_caucao")
    @classmethod
    def status_caucao_valido(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in STATUS_CAUCAO:
            raise ValueError("Status da caução inválido")
        return value


class AluguelStatusUpdate(BaseModel):
    status: str
    data_evento: Optional[date] = None

    @field_validator("status")
    @classmethod
    def status_valido(cls, value: str) -> str:
        if value not in STATUS:
            raise ValueError("Status inválido")
        return value


class ItemDevolucaoInput(BaseModel):
    item_acervo_id: int
    observacao_devolucao: Optional[str] = None
    valor_dano: float = Field(default=0, ge=0)


class AluguelDevolucaoInput(BaseModel):
    data_evento: Optional[date] = None
    status_caucao: Optional[str] = None
    itens: list[ItemDevolucaoInput] = Field(min_length=1)

    @field_validator("status_caucao")
    @classmethod
    def status_caucao_valido(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in STATUS_CAUCAO:
            raise ValueError("Status da caução inválido")
        return value


class AluguelItemOut(BaseModel):
    item_acervo_id: int
    codigo: str
    nome: str
    categoria: str
    valor_aluguel: float
    foto_url: Optional[str] = None
    observacao_retirada: Optional[str] = None
    observacao_devolucao: Optional[str] = None
    valor_dano: Optional[float] = None


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
    status_caucao: str
    forma_pagamento: Optional[str]
    observacao: Optional[str]
    itens: list[AluguelItemOut]
    created_at: datetime
    updated_at: datetime
    alerta: Optional[str] = None


class ReceitaAluguelItem(BaseModel):
    id: int
    tipo_pedido_nome: str = "Aluguel"
    valor_pecas: float
    data_entrega: date
    cliente_nome: str
