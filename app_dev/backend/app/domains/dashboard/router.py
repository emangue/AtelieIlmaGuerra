"""
Router do Dashboard.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from sqlalchemy.orm import Session

from .service import (
    get_kpis,
    get_kpis_year,
    get_mix_status,
    get_mix_status_year,
    get_lucro_mensal,
    get_pecas_entregues_por_tipo,
    get_pecas_entregues_por_tipo_year,
)


def _mes_atual() -> str:
    d = date.today()
    return f"{d.year}{d.month:02d}"


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/kpis")
def dashboard_kpis(
    mes: Optional[str] = Query(None, description="YYYYMM (default: mês atual)"),
    year: Optional[int] = Query(None, description="Ano (YTD, ignora mes se informado)"),
    db: Session = Depends(get_db),
):
    """KPIs: faturamento, horas, quantidade. Use year para visão anual (YTD)."""
    if year is not None:
        return get_kpis_year(db, year)
    return get_kpis(db, mes or _mes_atual())


@router.get("/mix-status")
def dashboard_mix_status(
    mes: Optional[str] = Query(None, description="YYYYMM (default: mês atual)"),
    year: Optional[int] = Query(None, description="Ano (YTD)"),
    db: Session = Depends(get_db),
):
    """Mix de status (Entregue, Pronto, Encomenda, etc.) para gráfico donut."""
    if year is not None:
        return get_mix_status_year(db, year)
    return get_mix_status(db, mes or _mes_atual())


@router.get("/lucro-mensal")
def dashboard_lucro_mensal(
    meses: int = Query(12, ge=1, le=24),
    year: Optional[int] = Query(None, description="Ano específico (12 meses do ano)"),
    db: Session = Depends(get_db),
):
    """Lucro por mês - últimos N meses ou 12 meses do ano informado."""
    return get_lucro_mensal(db, meses, year)


@router.get("/pecas-por-tipo")
def dashboard_pecas_tipo(
    mes: Optional[str] = Query(None, description="YYYYMM (default: mês atual)"),
    year: Optional[int] = Query(None, description="Ano (YTD)"),
    db: Session = Depends(get_db),
):
    """Peças entregues no mês/ano por tipo de pedido."""
    if year is not None:
        return get_pecas_entregues_por_tipo_year(db, year)
    return get_pecas_entregues_por_tipo(db, mes or _mes_atual())
