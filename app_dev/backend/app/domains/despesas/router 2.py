"""
Router do domínio Despesas.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db
from sqlalchemy.orm import Session

from .schemas import DespesaDetalhadaItem, DespesaDetalhadaCreate, DespesaDetalhadaUpdate
from .repository import DespesaRepository

router = APIRouter(prefix="/despesas", tags=["Despesas"])


@router.get("", response_model=List[DespesaDetalhadaItem])
def list_despesas(db: Session = Depends(get_db)):
    """Lista todas as despesas detalhadas."""
    repo = DespesaRepository(db)
    return repo.list_all()


@router.get("/total")
def get_total_despesas(db: Session = Depends(get_db)):
    """Retorna a soma de todas as despesas (TotalDespesas)."""
    repo = DespesaRepository(db)
    return {"total_despesas": repo.get_total()}


@router.post("", response_model=DespesaDetalhadaItem, status_code=201)
def create_despesa(data: DespesaDetalhadaCreate, db: Session = Depends(get_db)):
    """Cria nova despesa detalhada."""
    repo = DespesaRepository(db)
    return repo.create(data)


@router.patch("/{despesa_id}", response_model=DespesaDetalhadaItem)
def update_despesa(despesa_id: int, data: DespesaDetalhadaUpdate, db: Session = Depends(get_db)):
    """Atualiza despesa."""
    repo = DespesaRepository(db)
    d = repo.update(despesa_id, data)
    if not d:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    return d


@router.delete("/{despesa_id}", status_code=204)
def delete_despesa(despesa_id: int, db: Session = Depends(get_db)):
    """Remove despesa."""
    repo = DespesaRepository(db)
    if not repo.delete(despesa_id):
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
