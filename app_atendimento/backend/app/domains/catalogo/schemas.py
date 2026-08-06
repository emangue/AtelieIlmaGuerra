"""
Schemas do catálogo.
"""
from typing import List

from pydantic import BaseModel


class TipoPedidoItem(BaseModel):
    id: int
    nome: str


class FormaPecaItem(BaseModel):
    id: int
    nome: str
    medidas: List[str] = []
