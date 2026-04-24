"""
Router do domínio Clientes.
"""
from datetime import date
from typing import Optional, List, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db
from sqlalchemy.orm import Session
from sqlalchemy import func

from .schemas import ClienteCreate, ClienteUpdate, ClienteDetail, ClienteListItem
from .service import ClienteService
from app.domains.pedidos.models import Pedido
from app.domains.pedidos.service import PedidoService


router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("", response_model=list[ClienteListItem])
def list_clientes(q: Optional[str] = None, db: Session = Depends(get_db)):
    """Lista clientes com busca opcional (nome, telefone, email)."""
    service = ClienteService(db)
    clientes = service.list_all(q=q)
    return [service.to_list_item(c) for c in clientes]


@router.post("", response_model=ClienteDetail, status_code=201)
def create_cliente(data: ClienteCreate, db: Session = Depends(get_db)):
    """Cria novo cliente. Nome deve ser único."""
    service = ClienteService(db)
    if service.repo.exists_by_nome(data.nome):
        raise HTTPException(
            status_code=400,
            detail="Já existe um cliente com este nome. O nome é a chave de busca e deve ser único.",
        )
    cliente = service.create(data)
    return service.to_detail(cliente)


@router.get("/{cliente_id}", response_model=ClienteDetail)
def get_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Retorna detalhes de um cliente."""
    service = ClienteService(db)
    cliente = service.get_by_id(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return service.to_detail(cliente)


@router.patch("/{cliente_id}", response_model=ClienteDetail)
def update_cliente(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    """Atualiza cliente. Nome deve ser único."""
    service = ClienteService(db)
    cliente = service.get_by_id(cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    if data.nome is not None and data.nome.strip():
        if service.repo.exists_by_nome(data.nome, exclude_id=cliente_id):
            raise HTTPException(
                status_code=400,
                detail="Já existe um cliente com este nome. O nome é a chave de busca e deve ser único.",
            )
    cliente = service.update(cliente_id, data)
    return service.to_detail(cliente)


@router.delete("/{cliente_id}", status_code=204)
def delete_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Remove cliente."""
    service = ClienteService(db)
    ok = service.delete(cliente_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")


@router.get("/{cliente_id}/pedidos")
def list_pedidos_cliente(
    cliente_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Lista últimos pedidos do cliente."""
    if not ClienteService(db).get_by_id(cliente_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    pedido_service = PedidoService(db)
    pedidos = pedido_service.repo.list_by_cliente(cliente_id, limit=limit)
    return [pedido_service.to_list_item(p) for p in pedidos]


@router.get("/{cliente_id}/valores-por-mes")
def get_valores_por_mes_cliente(
    cliente_id: int,
    meses: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db),
) -> List[dict[str, Any]]:
    """Valores gastos (valor_pecas) por mês para o cliente (últimos N meses)."""
    if not ClienteService(db).get_by_id(cliente_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    hoje = date.today()
    result = []
    for i in range(meses):
        ano = hoje.year
        num_mes = hoje.month - i
        while num_mes <= 0:
            num_mes += 12
            ano -= 1
        inicio = date(ano, num_mes, 1)
        fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
        total = (
            db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
            .filter(
                Pedido.cliente_id == cliente_id,
                Pedido.data_entrega >= inicio,
                Pedido.data_entrega < fim,
                Pedido.status.notin_(("Orçamento", "Canelado")),
            )
            .scalar() or 0
        )
        result.append({
            "mes": f"{ano}{num_mes:02d}",
            "label": f"{num_mes:02d}/{ano}",
            "valor": round(float(total), 2),
        })
    return list(reversed(result))
