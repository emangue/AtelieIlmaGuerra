"""
Router de Atendimentos (lado gestão) — fila de aprovação.

Só a Ilma (admin) revisa: aprovar cria um Pedido de verdade pelo mesmo caminho
do formulário normal (PedidoService.create), herdando cálculo de margem,
snapshot de parâmetros e os avisos de pedido atípico.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.historico.repository import registrar_alteracao
from app.domains.pedidos.schemas import PedidoCreate
from app.domains.pedidos.service import PedidoAtipicoWarning, PedidoService
from app.domains.users.models import User
from app.shared.dependencies import require_admin

from .models import STATUS_APROVADO, STATUS_PENDENTE, STATUS_RECUSADO, PedidoAtendimento
from .schemas import (
    AprovacaoResponse,
    AtendimentoDetail,
    AtendimentoListItem,
    AtendimentosPendentesCount,
    RecusaRequest,
)
from .service import to_detail, to_list_item

router = APIRouter(prefix="/atendimentos", tags=["Atendimentos"])


def _get_ou_404(db: Session, atendimento_id: int) -> PedidoAtendimento:
    a = db.query(PedidoAtendimento).filter(PedidoAtendimento.id == atendimento_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Atendimento não encontrado")
    return a


def _exigir_pendente(a: PedidoAtendimento) -> None:
    if a.status_aprovacao != STATUS_PENDENTE:
        raise HTTPException(
            status_code=409,
            detail=f"Este atendimento já foi {a.status_aprovacao}.",
        )


@router.get("/contagem-pendentes", response_model=AtendimentosPendentesCount)
def contar_pendentes(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Contador para o badge do menu."""
    total = (
        db.query(PedidoAtendimento)
        .filter(PedidoAtendimento.status_aprovacao == STATUS_PENDENTE)
        .count()
    )
    return AtendimentosPendentesCount(pendentes=total)


@router.get("", response_model=List[AtendimentoListItem])
def listar_atendimentos(
    status: Optional[str] = Query(None, description="pendente | aprovado | recusado"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Lista os registros enviados pelo site de atendimento."""
    query = db.query(PedidoAtendimento)
    if status:
        query = query.filter(PedidoAtendimento.status_aprovacao == status)
    registros = query.order_by(PedidoAtendimento.criado_em.desc()).limit(limit).all()
    return [to_list_item(db, a) for a in registros]


@router.get("/{atendimento_id}", response_model=AtendimentoDetail)
def obter_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return to_detail(db, _get_ou_404(db, atendimento_id))


@router.post("/{atendimento_id}/aprovar", response_model=AprovacaoResponse)
def aprovar_atendimento(
    atendimento_id: int,
    data: PedidoCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Cria o pedido definitivo a partir do atendimento revisado.

    O corpo é o pedido completo já ajustado pela Ilma (custos, horas, valor).
    `cliente_id` vem do registro de atendimento, não do payload, para o pedido
    não acabar em outra cliente por um erro de tela.
    """
    a = _get_ou_404(db, atendimento_id)
    _exigir_pendente(a)

    data = data.model_copy(update={"cliente_id": a.cliente_id})

    service = PedidoService(db)
    try:
        pedido = service.create(data)
    except PedidoAtipicoWarning as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "pedido_atipico",
                "avisos": [{"codigo": av.codigo, "mensagem": av.mensagem} for av in exc.avisos],
                "margem_real_calculada": exc.margem_real,
            },
        )

    db.flush()  # precisa do pedido.id antes de referenciá-lo
    a.status_aprovacao = STATUS_APROVADO
    a.pedido_id = pedido.id
    a.revisado_por_user_id = admin.id
    a.revisado_em = datetime.utcnow()
    a.motivo_recusa = None

    registrar_alteracao(
        db, user_id=admin.id, entidade="pedido", entidade_id=pedido.id, acao="criou",
        resumo=f"Pedido #{pedido.id} criado a partir do atendimento #{a.id}",
    )
    registrar_alteracao(
        db, user_id=admin.id, entidade="pedido_atendimento", entidade_id=a.id, acao="aprovou",
        resumo=f"Aprovado — virou o pedido #{pedido.id}",
    )
    db.commit()
    db.refresh(a)
    return AprovacaoResponse(pedido_id=pedido.id, atendimento=to_detail(db, a))


@router.post("/{atendimento_id}/recusar", response_model=AtendimentoDetail)
def recusar_atendimento(
    atendimento_id: int,
    data: RecusaRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Devolve o registro ao atendimento com um motivo."""
    a = _get_ou_404(db, atendimento_id)
    _exigir_pendente(a)

    a.status_aprovacao = STATUS_RECUSADO
    a.motivo_recusa = data.motivo.strip()
    a.revisado_por_user_id = admin.id
    a.revisado_em = datetime.utcnow()

    registrar_alteracao(
        db, user_id=admin.id, entidade="pedido_atendimento", entidade_id=a.id, acao="recusou",
        resumo=f"Recusado: {a.motivo_recusa}",
    )
    db.commit()
    db.refresh(a)
    return to_detail(db, a)
