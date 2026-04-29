"""
Router de Despesas — fonte de verdade de despesas realizadas.

Cada despesa cria/atualiza/deleta automaticamente um registro em `pagamentos`.

Endpoints:
  GET    /despesas?mes=YYYYMM   → List[DespesaOut]
  POST   /despesas              → DespesaOut
  PATCH  /despesas/{id}         → DespesaOut
  DELETE /despesas/{id}         → 204
"""
from calendar import monthrange
from datetime import date as date_type, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from .despesas_model import Despesa
from .pagamentos_model import Pagamento
from .models import PlanoItem
from .schemas import DespesaCreate, DespesaOut, DespesaUpdate

router = APIRouter(prefix="/despesas", tags=["Despesas"])


def _resolve_plano_item(db: Session, anomes: str, plano_item_id=None,
                        tipo_item=None, detalhe=None, categoria=None) -> PlanoItem:
    """Retorna o PlanoItem existente ou cria um novo para o mês."""
    if plano_item_id:
        item = db.query(PlanoItem).filter(PlanoItem.id == plano_item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="plano_item não encontrado")
        if item.tipo != "despesa":
            raise HTTPException(status_code=400, detail="plano_item_id deve ser do tipo despesa")
        # Se o item é de outro mês, busca/cria o equivalente no mês correto
        if item.anomes != anomes:
            existente = (
                db.query(PlanoItem)
                .filter(
                    PlanoItem.anomes == anomes,
                    PlanoItem.tipo == "despesa",
                    PlanoItem.tipo_item == item.tipo_item,
                    PlanoItem.detalhe == item.detalhe,
                )
                .first()
            )
            if existente:
                return existente
            novo = PlanoItem(
                anomes=anomes, tipo="despesa", categoria=item.categoria,
                tipo_item=item.tipo_item, detalhe=item.detalhe, valor_planejado=0,
            )
            db.add(novo)
            db.flush()
            return novo
        return item

    if not tipo_item:
        raise HTTPException(status_code=400, detail="Informe plano_item_id ou tipo_item")

    cat = categoria or "Custo Fixo"
    det = detalhe or None
    existente = (
        db.query(PlanoItem)
        .filter(
            PlanoItem.anomes == anomes,
            PlanoItem.tipo == "despesa",
            PlanoItem.tipo_item == tipo_item,
            PlanoItem.detalhe == det,
        )
        .first()
    )
    if existente:
        return existente
    novo = PlanoItem(
        anomes=anomes, tipo="despesa", categoria=cat,
        tipo_item=tipo_item, detalhe=det, valor_planejado=0,
    )
    db.add(novo)
    db.flush()
    return novo


def _parse_data(anomes: str, data_str=None) -> date_type:
    if data_str:
        try:
            return datetime.strptime(data_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="data deve ser YYYY-MM-DD")
    ano, m = int(anomes[:4]), int(anomes[4:])
    return date_type(ano, m, monthrange(ano, m)[1])


def _to_out(d: Despesa) -> DespesaOut:
    return DespesaOut(
        id=d.id,
        anomes=d.anomes,
        plano_item_id=d.plano_item_id,
        tipo_item=d.tipo_item,
        detalhe=d.detalhe,
        categoria=d.categoria,
        data=d.data.isoformat(),
        valor=d.valor,
        descricao=d.descricao,
    )


def _icon_key(tipo_item: str) -> str:
    mapa = {
        "Colaboradores": "colab",
        "Espaço Físico": "espaco",
        "Transporte": "transp",
        "Contas": "contas",
        "Maquinário": "maq",
        "Marketing": "marketing",
    }
    for k, v in mapa.items():
        if k.lower() in (tipo_item or "").lower():
            return v
    return "outros"


def _sincronizar_pagamento(db: Session, despesa: Despesa) -> None:
    """Cria ou atualiza o Pagamento vinculado à despesa."""
    pag = db.query(Pagamento).filter(Pagamento.despesa_id == despesa.id).first()
    categoria = f"{despesa.tipo_item} · {despesa.categoria}"
    descricao = despesa.descricao or (
        f"{despesa.detalhe} · {despesa.tipo_item}" if despesa.detalhe else despesa.tipo_item
    )
    if pag:
        pag.anomes    = despesa.anomes
        pag.data      = despesa.data
        pag.valor     = despesa.valor
        pag.descricao = descricao
        pag.plano_item_id = despesa.plano_item_id
    else:
        pag = Pagamento(
            anomes        = despesa.anomes,
            tipo          = "despesa",
            origem        = "despesa_manual",
            despesa_id    = despesa.id,
            plano_item_id = despesa.plano_item_id,
            data          = despesa.data,
            valor         = despesa.valor,
            descricao     = descricao,
        )
        db.add(pag)


@router.get("", response_model=List[DespesaOut])
def list_despesas(
    mes: str = Query(..., description="YYYYMM"),
    db: Session = Depends(get_db),
):
    despesas = (
        db.query(Despesa)
        .filter(Despesa.anomes == mes)
        .order_by(Despesa.data.desc(), Despesa.id.desc())
        .all()
    )
    return [_to_out(d) for d in despesas]


@router.get("/{despesa_id}", response_model=DespesaOut)
def get_despesa(despesa_id: int, db: Session = Depends(get_db)):
    despesa = db.query(Despesa).filter(Despesa.id == despesa_id).first()
    if not despesa:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    return _to_out(despesa)


@router.post("", response_model=DespesaOut, status_code=201)
def create_despesa(data: DespesaCreate, db: Session = Depends(get_db)):
    """Lança despesa realizada e cria o pagamento correspondente."""
    if len(data.anomes) != 6 or not data.anomes.isdigit():
        raise HTTPException(status_code=400, detail="anomes deve ser YYYYMM")
    if data.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    plano_item = _resolve_plano_item(
        db, data.anomes, data.plano_item_id,
        data.tipo_item, data.detalhe, data.categoria,
    )
    data_pag = _parse_data(data.anomes, data.data)

    despesa = Despesa(
        anomes        = data.anomes,
        plano_item_id = plano_item.id,
        tipo_item     = plano_item.tipo_item,
        detalhe       = plano_item.detalhe,
        categoria     = plano_item.categoria,
        data          = data_pag,
        valor         = data.valor,
        descricao     = data.descricao,
    )
    db.add(despesa)
    db.flush()  # gera despesa.id antes de criar o pagamento
    _sincronizar_pagamento(db, despesa)
    db.commit()
    db.refresh(despesa)
    return _to_out(despesa)


@router.patch("/{despesa_id}", response_model=DespesaOut)
def update_despesa(
    despesa_id: int,
    data: DespesaUpdate,
    db: Session = Depends(get_db),
):
    despesa = db.query(Despesa).filter(Despesa.id == despesa_id).first()
    if not despesa:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    if data.valor is not None:
        if data.valor <= 0:
            raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")
        despesa.valor = data.valor
    if data.data is not None:
        despesa.data = _parse_data(despesa.anomes, data.data)
        despesa.anomes = f"{despesa.data.year}{despesa.data.month:02d}"
    if data.descricao is not None:
        despesa.descricao = data.descricao

    # Se tipo_item / detalhe / categoria mudam, re-resolver o PlanoItem
    novo_tipo   = data.tipo_item  if data.tipo_item  is not None else despesa.tipo_item
    novo_detalhe = data.detalhe   if data.detalhe    is not None else despesa.detalhe
    novo_cat    = data.categoria  if data.categoria  is not None else despesa.categoria
    if (
        novo_tipo   != despesa.tipo_item or
        novo_detalhe != despesa.detalhe  or
        novo_cat    != despesa.categoria
    ):
        novo_item = _resolve_plano_item(
            db, despesa.anomes, None, novo_tipo, novo_detalhe, novo_cat
        )
        despesa.plano_item_id = novo_item.id
        despesa.tipo_item     = novo_tipo
        despesa.detalhe       = novo_detalhe
        despesa.categoria     = novo_cat

    _sincronizar_pagamento(db, despesa)
    db.commit()
    db.refresh(despesa)
    return _to_out(despesa)


@router.delete("/{despesa_id}", status_code=204)
def delete_despesa(despesa_id: int, db: Session = Depends(get_db)):
    """Remove a despesa — o pagamento é deletado em cascata."""
    despesa = db.query(Despesa).filter(Despesa.id == despesa_id).first()
    if not despesa:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    db.delete(despesa)
    db.commit()
