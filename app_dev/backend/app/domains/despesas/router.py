"""
Router do domínio Despesas.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db
from app.domains.auth.router import get_user_id_from_token
from app.domains.historico.repository import registrar_alteracao
from sqlalchemy.orm import Session

from .schemas import DespesaDetalhadaItem, DespesaDetalhadaCreate, DespesaDetalhadaUpdate
from .repository import DespesaRepository

router = APIRouter(
    prefix="/despesas",
    tags=["Despesas"],
    dependencies=[Depends(get_user_id_from_token)],
)


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
def create_despesa(
    data: DespesaDetalhadaCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Cria nova despesa detalhada."""
    repo = DespesaRepository(db)
    d = repo.create(data)
    registrar_alteracao(
        db, user_id=user_id, entidade="despesa_detalhada", entidade_id=d.id, acao="criou",
        resumo=f"Despesa {d.detalhe} criada",
    )
    db.commit()
    return d


@router.patch("/{despesa_id}", response_model=DespesaDetalhadaItem)
def update_despesa(
    despesa_id: int,
    data: DespesaDetalhadaUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Atualiza despesa."""
    repo = DespesaRepository(db)
    antiga = repo.get_by_id(despesa_id)
    if not antiga:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    campos_alterados = data.model_dump(exclude_unset=True)
    antes = {k: getattr(antiga, k, None) for k in campos_alterados}
    d = repo.update(despesa_id, data)
    if not d:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    depois = {k: getattr(d, k, None) for k in campos_alterados}
    registrar_alteracao(
        db, user_id=user_id, entidade="despesa_detalhada", entidade_id=despesa_id, acao="editou",
        antes=antes, depois=depois,
    )
    db.commit()
    return d


@router.delete("/{despesa_id}", status_code=204)
def delete_despesa(
    despesa_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_user_id_from_token),
):
    """Remove despesa."""
    repo = DespesaRepository(db)
    d = repo.get_by_id(despesa_id)
    if not d:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    resumo = f"Despesa {d.detalhe} apagada"
    if not repo.delete(despesa_id):
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    registrar_alteracao(
        db, user_id=user_id, entidade="despesa_detalhada", entidade_id=despesa_id, acao="apagou",
        resumo=resumo,
    )
    db.commit()
