"""
Router do domínio Histórico - consulta de quem alterou o quê.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.auth.router import get_user_id_from_token

from .repository import HistoricoRepository
from .schemas import HistoricoItem

router = APIRouter(prefix="/historico", tags=["Histórico"])
_auth = Depends(get_user_id_from_token)


@router.get("", response_model=List[HistoricoItem])
def list_historico(
    entidade: str = Query(..., description="pedido, cliente, despesa, orcamento, parametro, contrato, plano_item, pagamento"),
    entidade_id: Optional[int] = Query(None, description="Filtra pelo id do registro. Sem isso, lista todo o histórico da entidade"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _u: int = _auth,
):
    """Lista o histórico de alterações de uma entidade (ex: todo histórico do pedido #412)."""
    repo = HistoricoRepository(db)
    return repo.list_por_entidade(entidade, entidade_id, limit)
