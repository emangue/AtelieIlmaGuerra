"""
Router do histórico do atendimento — a tela de "o que foi feito".
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import get_current_user_id

from .repository import listar_do_atendimento
from .schemas import HistoricoItem

router = APIRouter(
    prefix="/historico",
    tags=["Histórico"],
    dependencies=[Depends(get_current_user_id)],
)


@router.get("", response_model=List[HistoricoItem])
def listar_historico(
    entidade: Optional[str] = Query(None, description="cliente | pedido_atendimento"),
    entidade_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Alterações feitas por este site. Sem filtro, devolve as mais recentes."""
    return listar_do_atendimento(db, entidade=entidade, entidade_id=entidade_id, limit=limit)
