"""
Router de Atendimentos — o que o balcão registra e envia para aprovação.

Nada aqui vira pedido sozinho: os registros ficam pendentes até a Ilma revisar
no sistema de gestão.
"""
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.domains.clientes.models import Cliente
from app.domains.historico.repository import registrar_alteracao
from app.shared.dependencies import get_current_user_id

from .models import STATUS_PENDENTE, PedidoAtendimento
from .schemas import AtendimentoCreate, AtendimentoDetail, AtendimentoListItem, AtendimentoUpdate
from .service import resumo_do_registro, to_detail, to_list_item

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
EXTENSOES_PERMITIDAS = (".jpg", ".jpeg", ".png", ".webp")

# Mesmo diretório usado pelo gestão: a URL da foto continua válida depois que o
# atendimento vira pedido, sem precisar copiar arquivo na aprovação.
UPLOADS_SUBDIR = "atendimento"

router = APIRouter(
    prefix="/atendimentos",
    tags=["Atendimentos"],
    dependencies=[Depends(get_current_user_id)],
)


def _get_ou_404(db: Session, atendimento_id: int) -> PedidoAtendimento:
    a = db.query(PedidoAtendimento).filter(PedidoAtendimento.id == atendimento_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return a


def _exigir_editavel(a: PedidoAtendimento) -> None:
    if a.status_aprovacao != STATUS_PENDENTE:
        raise HTTPException(
            status_code=409,
            detail=f"Este registro já foi {a.status_aprovacao} e não pode mais ser alterado.",
        )


@router.post("/upload-foto")
async def upload_foto(file: UploadFile):
    """Salva a foto e devolve a URL relativa para gravar no registro."""
    ext = Path(file.filename or "img").suffix.lower()
    if ext not in EXTENSOES_PERMITIDAS:
        ext = ".jpg"
    conteudo = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(conteudo) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Máximo: 8 MB.")

    destino = Path(settings.UPLOADS_DIR) / UPLOADS_SUBDIR
    destino.mkdir(parents=True, exist_ok=True)
    nome = f"{uuid.uuid4().hex}{ext}"
    (destino / nome).write_bytes(conteudo)
    return {"url": f"/uploads/{UPLOADS_SUBDIR}/{nome}"}


@router.post("", response_model=AtendimentoDetail, status_code=201)
def criar_atendimento(
    data: AtendimentoCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    if not db.query(Cliente.id).filter(Cliente.id == data.cliente_id).first():
        raise HTTPException(status_code=400, detail="Cliente não encontrada")

    a = PedidoAtendimento(
        **data.model_dump(),
        status_aprovacao=STATUS_PENDENTE,
        criado_por_user_id=user_id,
    )
    db.add(a)
    db.flush()  # precisa do id para o log

    registrar_alteracao(
        db, user_id=user_id, entidade="pedido_atendimento", entidade_id=a.id, acao="criou",
        resumo=f"{resumo_do_registro(a)} enviado para aprovação",
    )
    db.commit()
    db.refresh(a)
    return to_detail(db, a)


@router.get("", response_model=List[AtendimentoListItem])
def listar_atendimentos(
    status: Optional[str] = Query(None, description="pendente | aprovado | recusado"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Tudo que já foi enviado, do mais recente para o mais antigo."""
    query = db.query(PedidoAtendimento)
    if status:
        query = query.filter(PedidoAtendimento.status_aprovacao == status)
    registros = query.order_by(PedidoAtendimento.criado_em.desc()).limit(limit).all()
    return [to_list_item(db, a) for a in registros]


@router.get("/{atendimento_id}", response_model=AtendimentoDetail)
def obter_atendimento(atendimento_id: int, db: Session = Depends(get_db)):
    return to_detail(db, _get_ou_404(db, atendimento_id))


@router.patch("/{atendimento_id}", response_model=AtendimentoDetail)
def atualizar_atendimento(
    atendimento_id: int,
    data: AtendimentoUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Ajusta um registro que ainda está aguardando aprovação."""
    a = _get_ou_404(db, atendimento_id)
    _exigir_editavel(a)

    campos = data.model_dump(exclude_unset=True)
    antes = {k: getattr(a, k, None) for k in campos}
    for campo, valor in campos.items():
        setattr(a, campo, valor)
    db.flush()
    depois = {k: getattr(a, k, None) for k in campos}

    registrar_alteracao(
        db, user_id=user_id, entidade="pedido_atendimento", entidade_id=a.id, acao="editou",
        resumo=f"{resumo_do_registro(a)} editado",
        antes=antes, depois=depois,
    )
    db.commit()
    db.refresh(a)
    return to_detail(db, a)


@router.delete("/{atendimento_id}", status_code=204)
def apagar_atendimento(
    atendimento_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Cancela um envio que ainda não foi revisado."""
    a = _get_ou_404(db, atendimento_id)
    _exigir_editavel(a)

    resumo = resumo_do_registro(a)
    db.delete(a)
    registrar_alteracao(
        db, user_id=user_id, entidade="pedido_atendimento", entidade_id=atendimento_id, acao="apagou",
        resumo=f"{resumo} cancelado antes da aprovação",
    )
    db.commit()
