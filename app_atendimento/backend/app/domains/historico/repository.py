"""
Registro e consulta do histórico do atendimento.

`registrar_alteracao` não commita — quem chama commita junto com a alteração
principal, para o log nunca ficar dessincronizado do dado.
"""
import json
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domains.users.models import User

from .models import APP_ATENDIMENTO, HistoricoAlteracao


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
        app=APP_ATENDIMENTO,
    ))


def listar_do_atendimento(
    db: Session,
    entidade: Optional[str] = None,
    entidade_id: Optional[int] = None,
    limit: int = 50,
) -> List[HistoricoAlteracao]:
    """
    Só linhas originadas neste site.

    O filtro por `app` é fixo e não vem de parâmetro: é o que garante que a
    atividade da Ilma no sistema de gestão nunca apareça aqui.
    """
    query = db.query(HistoricoAlteracao).filter(HistoricoAlteracao.app == APP_ATENDIMENTO)
    if entidade:
        query = query.filter(HistoricoAlteracao.entidade == entidade)
    if entidade_id is not None:
        query = query.filter(HistoricoAlteracao.entidade_id == entidade_id)
    return query.order_by(HistoricoAlteracao.criado_em.desc()).limit(limit).all()
