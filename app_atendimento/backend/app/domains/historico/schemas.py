"""
Schemas do domínio Histórico.

ESPELHO de app_dev/backend/app/domains/historico/schemas.py.
Cópia literal — se mexer lá, mexa aqui. O site de atendimento é um app separado
de propósito (isolamento de dados), e o preço disso é manter estes poucos
arquivos em sincronia.
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
