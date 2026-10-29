"""
Distrato: pedido desfeito depois que já entrou dinheiro.

Regras:
- O que já foi pago continua no mês em que entrou.
- Cartão já passado continua caindo (a operadora credita normalmente), com as taxas.
- Parcelas pendentes que não são de cartão deixam de existir — não viram atraso.
- A devolução é uma receita NEGATIVA (origem "devolucao") no mês em que o
  dinheiro sai. Pode nascer agendada e é confirmada depois no Financeiro.
- retido = garantido (pago + cartão a cair) - devolvido.
- Visão entrega: o retido entra na data em que a devolução é paga; sem
  devolução, na data do distrato (ver plano/service.py).
- O repasse da funcionária é informado à mão.
"""
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domains.plano.pagamentos_model import Pagamento
from app.domains.plano.custos_financeiros import sync_custos_financeiros
from .models import Pedido
from .repository import STATUS_DISTRATO, gravar_repasse
from .schemas import DistratoCreate, DistratoOut, DistratoPreview

ORIGEM_DEVOLUCAO = "devolucao"
STATUS_SEM_DISTRATO = ("Orçamento", "Cancelado", "Canelado", STATUS_DISTRATO)


def _anomes(d: Optional[date]) -> Optional[str]:
    return f"{d.year}{d.month:02d}" if d else None


def _parcelas_receita(db: Session, pedido_id: int) -> list[Pagamento]:
    return (
        db.query(Pagamento)
        .filter(Pagamento.pedido_id == pedido_id, Pagamento.tipo == "receita", Pagamento.origem == "pedido")
        .all()
    )


def _classificar(parcelas: list[Pagamento]):
    recebidas = [p for p in parcelas if not p.pendente_de_caixa]
    cartao_a_cair = [p for p in parcelas if p.pendente_de_caixa and p.liquidacao_automatica]
    a_cancelar = [p for p in parcelas if p.pendente_de_caixa and not p.liquidacao_automatica]
    return recebidas, cartao_a_cair, a_cancelar


def _soma(pags: list[Pagamento]) -> float:
    return round(sum(float(p.valor or 0) for p in pags), 2)


def preview_distrato(db: Session, pedido: Pedido) -> DistratoPreview:
    recebidas, cartao_a_cair, a_cancelar = _classificar(_parcelas_receita(db, pedido.id))
    recebido, cartao = _soma(recebidas), _soma(cartao_a_cair)
    return DistratoPreview(
        valor_recebido=recebido,
        valor_cartao_a_cair=cartao,
        valor_garantido=round(recebido + cartao, 2),
        valor_a_cancelar=_soma(a_cancelar),
        parcelas_a_cancelar=len(a_cancelar),
        status_atual=pedido.status,
    )


def _devolucao(db: Session, pedido_id: int) -> Optional[Pagamento]:
    return (
        db.query(Pagamento)
        .filter(Pagamento.pedido_id == pedido_id, Pagamento.origem == ORIGEM_DEVOLUCAO)
        .first()
    )


def distrato_out(db: Session, pedido: Pedido) -> Optional[DistratoOut]:
    if pedido.status != STATUS_DISTRATO or pedido.distrato_data is None:
        return None
    dev = _devolucao(db, pedido.id)
    return DistratoOut(
        data=pedido.distrato_data,
        motivo=pedido.distrato_motivo or "outro",
        fase=pedido.distrato_fase or "em_producao",
        status_anterior=pedido.distrato_status_anterior,
        valor_garantido=float(pedido.distrato_valor_garantido or 0),
        valor_devolvido=float(pedido.distrato_valor_devolvido or 0),
        valor_retido=float(pedido.distrato_valor_retido or 0),
        repasse_funcionaria=float(pedido.distrato_repasse or 0),
        observacao=pedido.distrato_observacao,
        devolucao_pagamento_id=dev.id if dev else None,
        devolucao_data_prevista=dev.data_vencimento.isoformat() if dev and dev.data_vencimento else None,
        devolucao_data_pagamento=dev.data_pagamento.isoformat() if dev and dev.data_pagamento else None,
        devolucao_forma=dev.forma_pagamento if dev else None,
    )


def registrar_distrato(db: Session, pedido: Pedido, data: DistratoCreate) -> None:
    if pedido.status in STATUS_SEM_DISTRATO:
        raise HTTPException(status_code=400, detail=f"Pedido em {pedido.status} não pode ter distrato.")

    preview = preview_distrato(db, pedido)
    devolvido = round(data.valor_devolvido, 2)
    if devolvido > preview.valor_garantido + 0.005:
        raise HTTPException(
            status_code=422,
            detail=f"Devolução (R$ {devolvido:.2f}) maior que o valor recebido (R$ {preview.valor_garantido:.2f}).",
        )
    if devolvido > 0 and not (data.devolucao_data_prevista or data.devolucao_data_pagamento):
        raise HTTPException(status_code=422, detail="Informe a data da devolução.")

    _, _, a_cancelar = _classificar(_parcelas_receita(db, pedido.id))
    for p in a_cancelar:
        db.delete(p)

    if devolvido > 0:
        pago_em = data.devolucao_data_pagamento
        cliente = pedido.cliente.nome if pedido.cliente else ""
        db.add(Pagamento(
            tipo="receita",
            origem=ORIGEM_DEVOLUCAO,
            natureza="receita",
            pedido_id=pedido.id,
            valor=-devolvido,
            data_vencimento=data.devolucao_data_prevista or pago_em,
            data_pagamento=pago_em,
            anomes=_anomes(pago_em),
            forma_pagamento=data.devolucao_forma,
            liquidacao_automatica=False,
            descricao=f"Devolução distrato · {cliente}" if cliente else "Devolução distrato",
        ))

    repasse = (
        db.query(Pagamento)
        .filter(Pagamento.origem == "repasse_funcionaria", Pagamento.pedido_id == pedido.id)
        .first()
    )
    if data.repasse_funcionaria > 0:
        gravar_repasse(db, pedido, repasse, round(data.repasse_funcionaria, 2), data.data)
    elif repasse:
        db.delete(repasse)

    pedido.distrato_status_anterior = pedido.status
    pedido.status = STATUS_DISTRATO
    pedido.distrato_data = data.data
    pedido.distrato_motivo = data.motivo
    pedido.distrato_fase = data.fase
    pedido.distrato_valor_garantido = preview.valor_garantido
    pedido.distrato_valor_devolvido = devolvido
    pedido.distrato_valor_retido = round(preview.valor_garantido - devolvido, 2)
    pedido.distrato_repasse = round(data.repasse_funcionaria, 2)
    pedido.distrato_observacao = data.observacao
    pedido.data_entrega = None

    db.flush()
    sync_custos_financeiros(db, pedido)
