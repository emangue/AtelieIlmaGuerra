"""
Router de Clientes do site de atendimento.

Base compartilhada com o gestão, mas superfície menor de propósito: não existe
DELETE (apagar cliente é decisão da Ilma), nem `/pedidos` ou
`/valores-por-mes` — o quanto cada cliente já gastou não é assunto do balcão.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.historico.repository import registrar_alteracao
from app.shared.dependencies import get_current_user_id

from .schemas import ClienteCreate, ClienteDetail, ClienteListItem, ClienteUpdate
from .service import ClienteService

router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"],
    dependencies=[Depends(get_current_user_id)],
)


@router.get("", response_model=list[ClienteListItem])
def listar_clientes(q: Optional[str] = None, db: Session = Depends(get_db)):
    """Lista clientes com busca opcional por nome, telefone ou email."""
    service = ClienteService(db)
    return [service.to_list_item(c) for c in service.list_all(q=q)]


@router.post("", response_model=ClienteDetail, status_code=201)
def criar_cliente(
    data: ClienteCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Cria cliente. O nome é a chave de busca do ateliê e precisa ser único."""
    service = ClienteService(db)
    if service.repo.exists_by_nome(data.nome):
        raise HTTPException(
            status_code=400,
            detail="Já existe uma cliente com este nome. O nome é a chave de busca e deve ser único.",
        )
    cliente = service.create(data)
    registrar_alteracao(
        db, user_id=user_id, entidade="cliente", entidade_id=cliente.id, acao="criou",
        resumo=f"Cliente {cliente.nome} cadastrada no atendimento",
    )
    db.commit()
    return service.to_detail(cliente)


@router.get("/{cliente_id}", response_model=ClienteDetail)
def obter_cliente(cliente_id: int, db: Session = Depends(get_db)):
    service = ClienteService(db)
    cliente = service.get_by_id(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrada")
    return service.to_detail(cliente)


@router.patch("/{cliente_id}", response_model=ClienteDetail)
def atualizar_cliente(
    cliente_id: int,
    data: ClienteUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    service = ClienteService(db)
    cliente_antes = service.get_by_id(cliente_id)
    if not cliente_antes:
        raise HTTPException(status_code=404, detail="Cliente não encontrada")
    if data.nome is not None and data.nome.strip():
        if service.repo.exists_by_nome(data.nome, exclude_id=cliente_id):
            raise HTTPException(
                status_code=400,
                detail="Já existe uma cliente com este nome. O nome é a chave de busca e deve ser único.",
            )
    campos_alterados = data.model_dump(exclude_unset=True)
    antes = {k: getattr(cliente_antes, k, None) for k in campos_alterados}
    cliente = service.update(cliente_id, data)
    depois = {k: getattr(cliente, k, None) for k in campos_alterados}
    registrar_alteracao(
        db, user_id=user_id, entidade="cliente", entidade_id=cliente_id, acao="editou",
        resumo=f"Cliente {cliente.nome} editada",
        antes=antes, depois=depois,
    )
    db.commit()
    return service.to_detail(cliente)
