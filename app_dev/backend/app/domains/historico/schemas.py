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
    app: str = "gestao"  # gestao | atendimento — de qual site veio a alteração

    class Config:
        from_attributes = True
