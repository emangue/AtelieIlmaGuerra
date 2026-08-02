"""
Repository do domínio Histórico.

`registrar_alteracao` é o helper que cada rota de escrita dos outros domínios
chama para gravar uma linha de histórico. Não faz commit — quem chamar é
responsável por commitar (junto com a alteração principal, ou logo em
seguida).
"""
import json
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domains.users.models import User

from .models import HistoricoAlteracao


def _montar_diff(antes: dict, depois: dict) -> dict:
    diff = {}
    for campo, valor_novo in depois.items():
        valor_antigo = antes.get(campo)
        if valor_antigo != valor_novo:
            diff[campo] = {"de": valor_antigo, "para": valor_novo}
    return diff


def registrar_alteracao(
    db: Session,
    *,
    user_id: int,
    entidade: str,
    entidade_id: Optional[int],
    acao: str,
    resumo: str = "",
    antes: Optional[dict] = None,
    depois: Optional[dict] = None,
    app: str = "gestao",
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    user_nome = user.nome if user else f"Usuário #{user_id}"

    diff = _montar_diff(antes, depois) if antes is not None and depois is not None else None

    db.add(HistoricoAlteracao(
        user_id=user_id,
        user_nome=user_nome,
        entidade=entidade,
        entidade_id=entidade_id,
        acao=acao,
        resumo=resumo,
        diff_json=json.dumps(diff, ensure_ascii=False, default=str) if diff else None,
        app=app,
    ))


class HistoricoRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_por_entidade(
        self, entidade: str, entidade_id: Optional[int] = None, limit: int = 50
    ) -> List[HistoricoAlteracao]:
        query = self.db.query(HistoricoAlteracao).filter(HistoricoAlteracao.entidade == entidade)
        if entidade_id is not None:
            query = query.filter(HistoricoAlteracao.entidade_id == entidade_id)
        return query.order_by(HistoricoAlteracao.criado_em.desc()).limit(limit).all()
