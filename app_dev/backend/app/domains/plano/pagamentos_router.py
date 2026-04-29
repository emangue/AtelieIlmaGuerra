"""
Router de Pagamentos — tabela unificada de receitas e despesas realizadas.

Endpoints:
  GET    /pagamentos?mes=YYYYMM  → PagamentosResponse
  POST   /pagamentos             → PagamentoItem  (despesas manuais)
  PATCH  /pagamentos/{id}        → PagamentoItem  (só despesas)
  DELETE /pagamentos/{id}        → 204            (só despesas)
"""
from calendar import monthrange
from datetime import date as date_type, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from .pagamentos_model import Pagamento
from .models import PlanoItem
from .schemas import PagamentoCreate, PagamentoItem, PagamentosResponse, PagamentoUpdate

router = APIRouter(prefix="/pagamentos", tags=["Pagamentos"])

# Mapeamento tipo_item → icon_key (para despesas)
_ICON_KEY_MAP = {
    "Colaboradores": "colab",
    "Espaço Físico": "espaco",
    "Transporte": "transp",
    "Contas": "contas",
    "Maquinário": "maq",
    "Marketing": "marketing",
}


def _icon_key_despesa(tipo_item: Optional[str]) -> str:
    if not tipo_item:
        return "outros"
    for k, v in _ICON_KEY_MAP.items():
        if k.lower() in tipo_item.lower():
            return v
    return "outros"


def _to_item(pag: Pagamento) -> PagamentoItem:
    if pag.tipo == "receita":
        categoria = "Receita · Pedido"
        icon_key = "receita"
        tipo_item_val = None
        detalhe_val = None
        cat_raw_val = None
    else:
        pi = pag.plano_item
        tipo_item_val = pi.tipo_item if pi else ""
        detalhe_val   = pi.detalhe   if pi else None
        cat_raw_val   = pi.categoria if pi else "Despesa"
        categoria = f"{tipo_item_val} · {cat_raw_val}" if tipo_item_val else cat_raw_val
        icon_key = _icon_key_despesa(tipo_item_val)

    return PagamentoItem(
        id=pag.id,
        tipo=pag.tipo,
        origem=pag.origem,
        descricao=pag.descricao or "",
        categoria=categoria,
        tipo_item=tipo_item_val,
        detalhe=detalhe_val,
        cat_raw=cat_raw_val,
        valor=pag.valor,
        data=pag.data.isoformat(),
        icon_key=icon_key,
        pedido_id=pag.pedido_id,
        plano_item_id=pag.plano_item_id,
        despesa_id=pag.despesa_id,
    )


@router.get("", response_model=PagamentosResponse)
def list_pagamentos(
    mes: str = Query(..., description="YYYYMM — mês de referência"),
    db: Session = Depends(get_db),
):
    """Lista todas as movimentações realizadas do mês (receitas + despesas)."""
    if len(mes) != 6 or not mes.isdigit():
        raise HTTPException(status_code=400, detail="mes deve ser YYYYMM")

    pagamentos = (
        db.query(Pagamento)
        .filter(Pagamento.anomes == mes)
        .order_by(Pagamento.data.desc(), Pagamento.id.desc())
        .all()
    )

    itens = [_to_item(p) for p in pagamentos]
    total_receitas = sum(i.valor for i in itens if i.tipo == "receita")
    total_despesas = sum(i.valor for i in itens if i.tipo == "despesa")

    return PagamentosResponse(
        mes=mes,
        total_receitas=total_receitas,
        total_despesas=total_despesas,
        saldo=total_receitas - total_despesas,
        itens=itens,
    )


@router.post("", response_model=PagamentoItem, status_code=201)
def create_pagamento(data: PagamentoCreate, db: Session = Depends(get_db)):
    """Cria despesa manual na tabela pagamentos."""
    if len(data.anomes) != 6 or not data.anomes.isdigit():
        raise HTTPException(status_code=400, detail="anomes deve ser YYYYMM")
    if data.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    # Resolver plano_item
    if data.plano_item_id:
        plano_item = db.query(PlanoItem).filter(PlanoItem.id == data.plano_item_id).first()
        if not plano_item:
            raise HTTPException(status_code=404, detail="Item do plano não encontrado")
        if plano_item.tipo != "despesa":
            raise HTTPException(status_code=400, detail="plano_item_id deve ser do tipo despesa")
    elif data.tipo_item:
        # get or create pelo tipo_item/detalhe/categoria (igual transacoes_router)
        tipo_item = data.tipo_item
        detalhe   = data.detalhe or None
        categoria = data.categoria or "Custo Fixo"
        plano_item = (
            db.query(PlanoItem)
            .filter(
                PlanoItem.anomes == data.anomes,
                PlanoItem.tipo == "despesa",
                PlanoItem.tipo_item == tipo_item,
                PlanoItem.detalhe == detalhe,
            )
            .first()
        )
        if not plano_item:
            plano_item = PlanoItem(
                anomes=data.anomes,
                tipo="despesa",
                categoria=categoria,
                tipo_item=tipo_item,
                detalhe=detalhe,
                valor_planejado=0,
            )
            db.add(plano_item)
            db.flush()
    else:
        raise HTTPException(status_code=400, detail="Informe plano_item_id ou tipo_item")

    if data.data:
        try:
            data_pag = datetime.strptime(data.data, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="data deve ser YYYY-MM-DD")
    else:
        ano, m = int(data.anomes[:4]), int(data.anomes[4:])
        data_pag = date_type(ano, m, monthrange(ano, m)[1])

    pag = Pagamento(
        anomes=data.anomes,
        tipo="despesa",
        origem="despesa_manual",
        plano_item_id=plano_item.id,
        data=data_pag,
        valor=data.valor,
        descricao=data.descricao,
    )
    db.add(pag)
    db.commit()
    db.refresh(pag)
    return _to_item(pag)


@router.patch("/{pagamento_id}", response_model=PagamentoItem)
def update_pagamento(
    pagamento_id: int,
    data: PagamentoUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza despesa manual. Receitas (origem=pedido) não são editáveis aqui."""
    pag = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if pag.origem == "pedido":
        raise HTTPException(status_code=400, detail="Receitas de pedido não são editáveis aqui")

    if data.valor is not None:
        if data.valor <= 0:
            raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")
        pag.valor = data.valor
    if data.data is not None:
        try:
            pag.data = datetime.strptime(data.data, "%Y-%m-%d").date()
            pag.anomes = f"{pag.data.year}{pag.data.month:02d}"
        except ValueError:
            raise HTTPException(status_code=400, detail="data deve ser YYYY-MM-DD")
    if data.descricao is not None:
        pag.descricao = data.descricao

    db.commit()
    db.refresh(pag)
    return _to_item(pag)


@router.delete("/{pagamento_id}", status_code=204)
def delete_pagamento(
    pagamento_id: int,
    db: Session = Depends(get_db),
):
    """Remove despesa manual. Receitas (origem=pedido) não podem ser removidas aqui."""
    pag = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if pag.origem == "pedido":
        raise HTTPException(status_code=400, detail="Receitas de pedido não podem ser removidas aqui")
    db.delete(pag)
    db.commit()
