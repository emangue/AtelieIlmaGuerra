"""
Schemas do domínio Histórico.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HistoricoItem(BaseModel):
    id: int
    criado_em: datetime
    user_id: int
    user_nome: str
    entidade: str
    entidade_id: Optional[int]
    acao: str
    resumo: Optional[str]
    diff_json: Optional[str]

    class Config:
        from_attributes = True
