"""
Router do domínio Plano (receitas e despesas planejadas).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from .models import PlanoItem
from .schemas import PlanoItemOut, PlanoResumoMes

router = APIRouter(prefix="/plano", tags=["Plano"])


@router.get("", response_model=List[PlanoItemOut])
def list_plano(
    anomes: Optional[str] = Query(None, description="YYYYMM - filtrar por mês"),
    tipo: Optional[str] = Query(None, description="receita | despesa"),
    ano: Optional[int] = Query(None, description="Ano (ex: 2026) - todos os meses do ano"),
    db: Session = Depends(get_db),
):
    """Lista itens do plano. Filtros: anomes, tipo, ano."""
    q = db.query(PlanoItem)
    if anomes:
        q = q.filter(PlanoItem.anomes == anomes)
    if ano:
        q = q.filter(PlanoItem.anomes.like(f"{ano}%"))
    if tipo:
        q = q.filter(PlanoItem.tipo == tipo)
    q = q.order_by(PlanoItem.anomes, PlanoItem.tipo, PlanoItem.categoria, PlanoItem.tipo_item)
    return q.all()


@router.get("/resumo-mensal", response_model=List[PlanoResumoMes])
def resumo_mensal(
    ano: Optional[int] = Query(None, description="Ano (ex: 2026). Default: ano atual"),
    db: Session = Depends(get_db),
):
    """Resumo por mês: receita planejada, despesas planejadas, lucro planejado."""
    from datetime import date
    y = ano or date.today().year
    prefix = str(y)

    # Receita por mês
    rec = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.tipo == "receita", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    rec_map = {r.anomes: float(r.total) for r in rec}

    # Despesas por mês
    desp = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.tipo == "despesa", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    desp_map = {d.anomes: float(d.total) for d in desp}

    # Meses únicos
    meses = sorted(set(rec_map.keys()) | set(desp_map.keys()))
    return [
        PlanoResumoMes(
            anomes=m,
            receita_planejada=rec_map.get(m, 0),
            despesas_planejadas=desp_map.get(m, 0),
            lucro_planejado=rec_map.get(m, 0) - desp_map.get(m, 0),
        )
        for m in meses
    ]
