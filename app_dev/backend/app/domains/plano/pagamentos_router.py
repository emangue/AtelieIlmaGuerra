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
from app.domains.auth.router import get_user_id_from_token
from .custos_financeiros import (
    ORIGENS_CUSTO, TIPO_ITEM_DESCONTO_PIX, TIPO_ITEM_TAXA_CARTAO,
    is_pix, sync_custo_adiantamento, sync_custos_financeiros,
)
from .pagamentos_model import Pagamento
from .service import natureza_pagamento, subtipo_despesa_financeira
from .models import PlanoItem
from .schemas import (
    PagamentoCreate, PagamentoItem, PagamentosResponse, PagamentoUpdate,
    CobrancaItem, CobrancasResumo, CobrancasResponse,
)

router = APIRouter(prefix="/pagamentos", tags=["Pagamentos"], dependencies=[Depends(get_user_id_from_token)])

# Lançamentos gerados pelo sistema — só mudam junto com o pedido que os originou.
_ORIGENS_NAO_EDITAVEIS = ("pedido", "repasse_funcionaria", *ORIGENS_CUSTO)

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
        natureza=natureza_pagamento(pag),
        subtipo_financeiro=subtipo_despesa_financeira(pag),
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
        db.query(Pagamento, Cliente.nome.label("cliente_nome"), TipoPedido.nome.label("tipo_pedido"))
        .join(Pedido, Pedido.id == Pagamento.pedido_id)
        .outerjoin(Cliente, Cliente.id == Pedido.cliente_id)
        .outerjoin(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(Pagamento.tipo == "receita", Pagamento.pedido_id.isnot(None), Pagamento.valor > 0)
        .order_by(Pagamento.data_vencimento.asc().nullslast())
        .all()
    )

    em_atraso, vence_hoje, a_vencer, pagas, previstas_cartao = [], [], [], [], []

    for pag, cliente_nome, tipo_pedido in rows:
        venc = pag.data_vencimento
        pago = pag.data_pagamento
        automatica = bool(pag.liquidacao_automatica)
        # Parcela de cartão futura tem data de pagamento gravada, mas o dinheiro
        # ainda não entrou — usar `pendente_de_caixa`, não `data_pagamento`.
        pendente = pag.pendente_de_caixa

        item = CobrancaItem(
            id=pag.id,
            pedido_id=pag.pedido_id,
            cliente_nome=cliente_nome or "—",
            tipo_pedido=tipo_pedido or "Pedido",
            forma_pagamento=pag.forma_pagamento or (pag.pedido.forma_pagamento if pag.pedido else None),
            parcela_numero=pag.parcela_numero,
            parcela_total=pag.parcela_total,
            valor=pag.valor,
            data_vencimento=venc.isoformat() if venc else None,
            data_pagamento=pago.isoformat() if pago else None,
            status=(
                "previsto" if (automatica and pendente)
                else "pago" if not pendente
                else "em_atraso" if venc and venc < hoje
                else "vence_hoje" if venc == hoje
                else "a_vencer"
            ),
            dias_atraso=(hoje - venc).days if (pendente and not automatica and venc and venc < hoje) else 0,
            liquidacao_automatica=automatica,
            desconto_adiantamento=pag.desconto_adiantamento,
        )

        if automatica:
            # Cartão nunca é cobrança: ou já caiu, ou está previsto para cair.
            if pendente:
                if pag.anomes == mes:
                    previstas_cartao.append(item)
            elif pag.anomes == mes:
                pagas.append(item)
        elif not pendente:
            if pag.anomes == mes:
                pagas.append(item)
        elif venc and venc < hoje:
            em_atraso.append(item)
        elif venc == hoje:
            vence_hoje.append(item)
        else:
            a_vencer.append(item)

    sete_dias = hoje + timedelta(days=7)
    vence_7dias = vence_hoje + [
        x for x in a_vencer if x.data_vencimento and x.data_vencimento <= sete_dias.isoformat()
    ]

    custos = (
        db.query(Pagamento.tipo_item, sqlfunc.sum(Pagamento.valor))
        .filter(Pagamento.natureza == "despesa_financeira", Pagamento.anomes == mes)
        .group_by(Pagamento.tipo_item)
        .all()
    )
    custos_por_item = {item: float(total or 0) for item, total in custos}

    resumo = CobrancasResumo(
        total_em_atraso=round(sum(i.valor for i in em_atraso), 2),
        count_em_atraso=len(em_atraso),
        total_vence_7dias=round(sum(i.valor for i in vence_7dias), 2),
        count_vence_7dias=len(vence_7dias),
        total_a_vencer=round(sum(i.valor for i in a_vencer), 2),
        count_a_vencer=len(a_vencer),
        total_pago=round(sum(i.valor for i in pagas), 2),
        count_pago=len(pagas),
        total_previsto_cartao=round(sum(i.valor for i in previstas_cartao), 2),
        count_previsto_cartao=len(previstas_cartao),
        total_taxa_cartao=round(custos_por_item.get(TIPO_ITEM_TAXA_CARTAO, 0.0), 2),
        total_desconto_pix=round(custos_por_item.get(TIPO_ITEM_DESCONTO_PIX, 0.0), 2),
    )

    return CobrancasResponse(
        em_atraso=em_atraso,
        vence_hoje=vence_hoje,
        a_vencer=a_vencer,
        pagas=pagas,
        previstas_cartao=previstas_cartao,
        resumo=resumo,
    )


@router.get("/repasses")
def get_repasses_funcionaria(
    mes: str = Query(..., description="YYYYMM — mês para exibir repasses pagos"),
    db: Session = Depends(get_db),
):
    """Lista acertos com funcionária: pendentes + pagos no mês selecionado."""
    if len(mes) != 6 or not mes.isdigit():
        raise HTTPException(status_code=400, detail="mes deve ser YYYYMM")

    from app.domains.pedidos.models import Pedido
    from app.domains.clientes.models import Cliente
    from app.domains.pedidos.models import TipoPedido

    rows = (
        db.query(Pagamento, Pedido, Cliente, TipoPedido)
        .join(Pedido, Pedido.id == Pagamento.pedido_id)
        .outerjoin(Cliente, Cliente.id == Pedido.cliente_id)
        .outerjoin(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(
            Pagamento.tipo == "despesa",
            Pagamento.origem == "repasse_funcionaria",
            (Pagamento.data_pagamento.is_(None)) | (Pagamento.anomes == mes),
        )
        .order_by(Pagamento.data_pagamento.asc().nullsfirst(), Pagamento.data_vencimento.asc().nullslast())
        .all()
    )

    itens = []
    for pag, pedido, cliente, tipo in rows:
        status = "pago" if pag.data_pagamento else (
            "em_atraso" if pag.data_vencimento and pag.data_vencimento < date_type.today() else "a_pagar"
        )
        percentual_dono = float(pedido.percentual_lucro_dono or 100)
        itens.append({
            "id": pag.id,
            "pedido_id": pedido.id,
            "cliente_nome": cliente.nome if cliente else "—",
            "tipo_pedido": tipo.nome if tipo else "Pedido",
            "valor_pedido": float(pedido.valor_pecas or 0),
            "percentual_lucro_dono": percentual_dono,
            "percentual_repasse": round(100 - percentual_dono, 2),
            "valor": float(pag.valor),
            "data_vencimento": pag.data_vencimento.isoformat() if pag.data_vencimento else None,
            "data_pagamento": pag.data_pagamento.isoformat() if pag.data_pagamento else None,
            "status": status,
        })

    pendentes = [i for i in itens if i["status"] != "pago"]
    pagos = [i for i in itens if i["status"] == "pago"]
    return {
        "mes": mes,
        "pendentes": pendentes,
        "pagos": pagos,
        "resumo": {
            "total_pendente": round(sum(i["valor"] for i in pendentes), 2),
            "count_pendente": len(pendentes),
            "total_pago": round(sum(i["valor"] for i in pagos), 2),
            "count_pago": len(pagos),
        },
    }


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
        natureza="despesa_operacional",
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

    # A despesa do desconto Pix só pode ser lançada agora, que a data existe.
    if is_pix(pag.forma_pagamento) and pag.pedido_id:
        db.flush()
        sync_custos_financeiros(db, pag.pedido)

    db.commit()
    db.refresh(pag)
    return _to_item(pag)


@router.patch("/{pagamento_id}/adiantar", response_model=PagamentoItem)
def adiantar_pagamento(
    pagamento_id: int,
    data: dict,
    db: Session = Depends(get_db),
):
    """Antecipa o recebimento de uma parcela de cartão.

    O desconto informado é o que a adquirente cobrou para adiantar. Ele vira despesa
    e é adicional à taxa flat da compra.
    """
    pag = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if not pag.liquidacao_automatica:
        raise HTTPException(status_code=400, detail="Só parcelas de cartão podem ser adiantadas")
    if pag.data_vencimento and pag.data_vencimento <= date_type.today():
        raise HTTPException(status_code=400, detail="Esta parcela já venceu — não há o que adiantar")

    data_str = data.get("data_recebimento")
    if not data_str:
        raise HTTPException(status_code=400, detail="Informe a data em que você recebeu")
    try:
        data_receb = datetime.strptime(data_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="data_recebimento deve ser YYYY-MM-DD")

    try:
        desconto = float(data.get("desconto") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Desconto inválido")
    if desconto < 0:
        raise HTTPException(status_code=400, detail="O desconto não pode ser negativo")
    if desconto >= pag.valor:
        raise HTTPException(status_code=400, detail="O desconto não pode ser maior ou igual ao valor da parcela")

    pag.data_pagamento = data_receb
    pag.anomes = f"{data_receb.year}{data_receb.month:02d}"
    pag.desconto_adiantamento = round(desconto, 2)

    if pag.pedido_id:
        db.flush()
        sync_custo_adiantamento(db, pag.pedido, pag)

    db.commit()
    db.refresh(pag)
    return _to_item(pag)


@router.patch("/{pagamento_id}/estornar", response_model=PagamentoItem)
def estornar_pagamento(pagamento_id: int, db: Session = Depends(get_db)):
    """Desfaz a confirmação ou o adiantamento de uma parcela.

    Sem isso, uma data digitada errada ficaria presa — não havia caminho de volta.
    Parcela de cartão volta para a data prevista de crédito, não para "não paga".
    """
    pag = db.query(Pagamento).filter(Pagamento.id == pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if pag.origem not in ("pedido", "repasse_funcionaria"):
        raise HTTPException(status_code=400, detail="Só parcelas de pedido e acertos podem ser estornados")

    pedido = pag.pedido
    pag.desconto_adiantamento = None
    if pag.liquidacao_automatica:
        pag.data_pagamento = pag.data_vencimento
        pag.anomes = (
            f"{pag.data_vencimento.year}{pag.data_vencimento.month:02d}" if pag.data_vencimento else None
        )
    else:
        pag.data_pagamento = None
        pag.anomes = None

    filhas = db.query(Pagamento).filter(Pagamento.pagamento_pai_id == pag.id).all()
    for filha in filhas:
        db.delete(filha)

    if pedido:
        db.flush()
        sync_custos_financeiros(db, pedido)

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
    if pag.origem in _ORIGENS_NAO_EDITAVEIS:
        raise HTTPException(status_code=400, detail="Lançamentos gerados por pedido não são editáveis aqui")

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
    if pag.origem in _ORIGENS_NAO_EDITAVEIS:
        raise HTTPException(status_code=400, detail="Lançamentos gerados por pedido não podem ser removidos aqui")
    db.delete(pag)
    db.commit()
