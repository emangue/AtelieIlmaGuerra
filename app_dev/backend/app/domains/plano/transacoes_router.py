"""
Router de transações de despesa.
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from .models import PlanoItem
from .transacoes_models import DespesaTransacao
from .schemas import DespesaTransacaoCreate, DespesaTransacaoUpdate, DespesaTransacaoOut

router = APIRouter(prefix="/transacoes-despesas", tags=["Transações Despesas"])


def _to_out(t: DespesaTransacao) -> DespesaTransacaoOut:
    return DespesaTransacaoOut(
        id=t.id,
        anomes=t.anomes,
        plano_item_id=t.plano_item_id,
        valor=t.valor,
        data=t.data.isoformat() if t.data else None,
        descricao=t.descricao,
        tipo_item=t.plano_item.tipo_item if t.plano_item else None,
        detalhe=t.plano_item.detalhe if t.plano_item else None,
    )


@router.get("", response_model=List[DespesaTransacaoOut])
def list_transacoes(
    mes: str = Query(..., description="YYYYMM - mês de referência"),
    db: Session = Depends(get_db),
):
    """Lista transações de despesa do mês."""
    if len(mes) != 6 or not mes.isdigit():
        return []
    trans = (
        db.query(DespesaTransacao)
        .filter(DespesaTransacao.anomes == mes)
        .join(PlanoItem)
        .order_by(PlanoItem.categoria, PlanoItem.tipo_item, DespesaTransacao.created_at)
        .all()
    )
    return [_to_out(t) for t in trans]


@router.post("", response_model=DespesaTransacaoOut, status_code=201)
def create_transacao(
    data: DespesaTransacaoCreate,
    db: Session = Depends(get_db),
):
    """Cria transação de despesa. Usa plano_item_id ou cria item com tipo_item/detalhe/categoria."""
    if len(data.anomes) != 6 or not data.anomes.isdigit():
        raise HTTPException(status_code=400, detail="anomes deve ser YYYYMM")
    if data.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    def _get_or_create_item(anomes: str, ref: PlanoItem = None, ti=None, det=None, cat=None):
        tipo_item = ti or (ref.tipo_item if ref else "Outros")
        detalhe = det if det is not None else (ref.detalhe if ref else None)
        categoria = cat or (ref.categoria if ref else "Custo Fixo")
        existente = (
            db.query(PlanoItem)
            .filter(
                PlanoItem.anomes == anomes,
                PlanoItem.tipo == "despesa",
                PlanoItem.tipo_item == tipo_item,
                PlanoItem.detalhe == detalhe,
            )
            .first()
        )
        if existente:
            return existente
        novo = PlanoItem(
            anomes=anomes,
            tipo="despesa",
            categoria=categoria,
            tipo_item=tipo_item,
            detalhe=detalhe,
            valor_planejado=0,
            valor_realizado=None,
        )
        db.add(novo)
        db.flush()
        return novo

    plano_item = None
    if data.plano_item_id:
        ref = db.query(PlanoItem).filter(PlanoItem.id == data.plano_item_id).first()
        if not ref:
            raise HTTPException(status_code=404, detail="Item do plano não encontrado")
        plano_item = _get_or_create_item(data.anomes, ref=ref) if ref.anomes != data.anomes else ref
    else:
        plano_item = _get_or_create_item(
            data.anomes, ti=data.tipo_item, det=data.detalhe, cat=data.categoria
        )

    data_trans = None
    if data.data:
        try:
            data_trans = datetime.strptime(data.data, "%Y-%m-%d").date()
        except ValueError:
            pass

    trans = DespesaTransacao(
        anomes=data.anomes,
        plano_item_id=plano_item.id,
        valor=data.valor,
        data=data_trans,
        descricao=data.descricao,
    )
    db.add(trans)
    db.commit()
    db.refresh(trans)
    return _to_out(trans)


@router.patch("/{trans_id}", response_model=DespesaTransacaoOut)
def update_transacao(
    trans_id: int,
    data: DespesaTransacaoUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza transação."""
    trans = db.query(DespesaTransacao).filter(DespesaTransacao.id == trans_id).first()
    if not trans:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    if data.valor is not None:
        trans.valor = data.valor
    if data.data is not None:
        try:
            trans.data = datetime.strptime(data.data, "%Y-%m-%d").date()
        except ValueError:
            pass
    if data.descricao is not None:
        trans.descricao = data.descricao
    db.commit()
    db.refresh(trans)
    return _to_out(trans)


@router.delete("/{trans_id}", status_code=204)
def delete_transacao(
    trans_id: int,
    db: Session = Depends(get_db),
):
    """Remove transação."""
    trans = db.query(DespesaTransacao).filter(DespesaTransacao.id == trans_id).first()
    if not trans:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    db.delete(trans)
    db.commit()
