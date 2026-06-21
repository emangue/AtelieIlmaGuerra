"""
Router de Pagamentos — tabela unificada de receitas e despesas realizadas.

Endpoints:
  GET    /pagamentos?mes=YYYYMM       → PagamentosResponse
  POST   /pagamentos/despesa          → PagamentoItem  (despesas manuais)
  PATCH  /pagamentos/{id}/confirmar   → PagamentoItem  (confirma recebimento de parcela)
  PATCH  /pagamentos/{id}             → PagamentoItem  (edita despesa manual)
  DELETE /pagamentos/{id}             → 204            (só despesas)
"""
from calendar import monthrange
from datetime import date as date_type, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from .pagamentos_model import Pagamento
from .models import PlanoItem
from .schemas import (
    PagamentoCreate, PagamentoItem, PagamentosResponse, PagamentoUpdate,
    CobrancaItem, CobrancasResumo, CobrancasResponse,
)

router = APIRouter(prefix="/pagamentos", tags=["Pagamentos"])

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
        tipo_item_val = pag.tipo_item
        detalhe_val = None
        cat_raw_val = None
    else:
        pi = pag.plano_item
        tipo_item_val = pag.tipo_item or (pi.tipo_item if pi else "")
        detalhe_val = pi.detalhe if pi else None
        cat_raw_val = pag.categoria or (pi.categoria if pi else "Despesa")
        categoria = f"{tipo_item_val} · {cat_raw_val}" if tipo_item_val else cat_raw_val
        icon_key = _icon_key_despesa(tipo_item_val)

    data_str = (pag.data_pagamento or pag.data_vencimento)
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
        data=data_str.isoformat() if data_str else "",
        icon_key=icon_key,
        pedido_id=pag.pedido_id,
        plano_item_id=pag.plano_item_id,
        despesa_id=None,
    )


@router.get("/cobrancas", response_model=CobrancasResponse)
def get_cobrancas(
    mes: str = Query(..., description="YYYYMM — mês para exibir parcelas pagas"),
    db: Session = Depends(get_db),
):
    """Retorna parcelas de pedidos agrupadas por status de cobrança."""
    from datetime import timedelta
    from app.domains.pedidos.models import Pedido, TipoPedido
    from app.domains.clientes.models import Cliente
    from sqlalchemy import func as sqlfunc

    hoje = date_type.today()

    rows = (
        db.query(
            Pagamento.id,
            Pagamento.pedido_id,
            Pagamento.parcela_numero,
            Pagamento.parcela_total,
            Pagamento.valor,
            Pagamento.data_vencimento,
            Pagamento.data_pagamento,
            Pagamento.anomes,
            Cliente.nome.label("cliente_nome"),
            TipoPedido.nome.label("tipo_pedido"),
            Pedido.forma_pagamento,
        )
        .join(Pedido, Pedido.id == Pagamento.pedido_id)
        .outerjoin(Cliente, Cliente.id == Pedido.cliente_id)
        .outerjoin(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(Pagamento.tipo == "receita", Pagamento.pedido_id.isnot(None))
        .order_by(Pagamento.data_vencimento.asc().nullslast())
        .all()
    )

    em_atraso, vence_hoje, a_vencer, pagas = [], [], [], []

    for r in rows:
        venc = r.data_vencimento
        pago = r.data_pagamento

        item = CobrancaItem(
            id=r.id,
            pedido_id=r.pedido_id,
            cliente_nome=r.cliente_nome or "—",
            tipo_pedido=r.tipo_pedido or "Pedido",
            forma_pagamento=r.forma_pagamento,
            parcela_numero=r.parcela_numero,
            parcela_total=r.parcela_total,
            valor=r.valor,
            data_vencimento=venc.isoformat() if venc else None,
            data_pagamento=pago.isoformat() if pago else None,
            status="pago" if pago else ("em_atraso" if venc and venc < hoje else ("vence_hoje" if venc == hoje else "a_vencer")),
            dias_atraso=(hoje - venc).days if (not pago and venc and venc < hoje) else 0,
        )

        if pago:
            if r.anomes == mes:
                pagas.append(item)
        elif venc and venc < hoje:
            em_atraso.append(item)
        elif venc == hoje:
            vence_hoje.append(item)
        else:
            a_vencer.append(item)

    sete_dias = hoje + timedelta(days=7)
    resumo = CobrancasResumo(
        total_em_atraso=round(sum(i.valor for i in em_atraso), 2),
        count_em_atraso=len(em_atraso),
        total_vence_7dias=round(sum(i.valor for i in vence_hoje + [x for x in a_vencer if x.data_vencimento and x.data_vencimento <= sete_dias.isoformat()]), 2),
        count_vence_7dias=len(vence_hoje) + len([x for x in a_vencer if x.data_vencimento and x.data_vencimento <= sete_dias.isoformat()]),
        total_a_vencer=round(sum(i.valor for i in a_vencer), 2),
        count_a_vencer=len(a_vencer),
        total_pago=round(sum(i.valor for i in pagas), 2),
        count_pago=len(pagas),
    )

    return CobrancasResponse(
        em_atraso=em_atraso,
        vence_hoje=vence_hoje,
        a_vencer=a_vencer,
        pagas=pagas,
        resumo=resumo,
    )


@router.get("", response_model=PagamentosResponse)
def list_pagamentos(
    mes: str = Query(..., description="YYYYMM — mês de referência"),
    db: Session = Depends(get_db),
):
    """Lista movimentações confirmadas do mês (data_pagamento no mês)."""
    if len(mes) != 6 or not mes.isdigit():
        raise HTTPException(status_code=400, detail="mes deve ser YYYYMM")

    pagamentos = (
        db.query(Pagamento)
        .filter(Pagamento.anomes == mes)
        .order_by(Pagamento.data_pagamento.desc(), Pagamento.id.desc())
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


@router.post("/despesa", response_model=PagamentoItem, status_code=201)
def create_despesa(data: PagamentoCreate, db: Session = Depends(get_db)):
    """Lança despesa manual diretamente em pagamentos."""
    if len(data.anomes) != 6 or not data.anomes.isdigit():
        raise HTTPException(status_code=400, detail="anomes deve ser YYYYMM")
    if data.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    plano_item = None
    if data.plano_item_id:
        plano_item = db.query(PlanoItem).filter(PlanoItem.id == data.plano_item_id).first()
        if not plano_item:
            raise HTTPException(status_code=404, detail="Item do plano não encontrado")

    if data.data:
        try:
            data_pag = datetime.strptime(data.data, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="data deve ser YYYY-MM-DD")
    else:
        ano, m = int(data.anomes[:4]), int(data.anomes[4:])
        data_pag = date_type(ano, m, monthrange(ano, m)[1])

    anomes = f"{data_pag.year}{data_pag.month:02d}"
    pag = Pagamento(
        anomes=anomes,
        tipo="despesa",
        origem="despesa_manual",
        plano_item_id=plano_item.id if plano_item else None,
        data_vencimento=data_pag,
        data_pagamento=data_pag,
        categoria=data.categoria,
        tipo_item=data.tipo_item,
        valor=data.valor,
        descricao=data.descricao,
    )
    db.add(pag)
    db.commit()
    db.refresh(pag)
    return _to_item(pag)


@router.patch("/{pagamento_id}/confirmar", response_model=PagamentoItem)
def confirmar_pagamento(
    pagamento_id: int,
    data: dict,
    db: Session = Depends(get_db),
):
    """Confirma recebimento de uma parcela. Preenche data_pagamento e atualiza anomes."""
    pag = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    data_str = data.get("data_pagamento")
    if not data_str:
        raise HTTPException(status_code=400, detail="data_pagamento é obrigatório")
    try:
        data_pag = datetime.strptime(data_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="data_pagamento deve ser YYYY-MM-DD")

    pag.data_pagamento = data_pag
    pag.anomes = f"{data_pag.year}{data_pag.month:02d}"
    db.commit()
    db.refresh(pag)
    return _to_item(pag)


@router.patch("/{pagamento_id}", response_model=PagamentoItem)
def update_pagamento(
    pagamento_id: int,
    data: PagamentoUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza despesa manual."""
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
            nova_data = datetime.strptime(data.data, "%Y-%m-%d").date()
            pag.data_pagamento = nova_data
            pag.anomes = f"{nova_data.year}{nova_data.month:02d}"
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
    """Remove despesa manual."""
    pag = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if pag.origem == "pedido":
        raise HTTPException(status_code=400, detail="Receitas de pedido não podem ser removidas aqui")
    db.delete(pag)
    db.commit()
