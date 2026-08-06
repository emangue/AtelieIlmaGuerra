"""
Router de catálogo — listas para preencher os selects do formulário.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import get_current_user_id

from .models import FormaPeca, FormaPecaMedida, TipoPedido, tipo_pedido_forma_peca
from .schemas import FormaPecaItem, TipoPedidoItem

router = APIRouter(
    prefix="/catalogo",
    tags=["Catálogo"],
    dependencies=[Depends(get_current_user_id)],
)


@router.get("/tipos", response_model=List[TipoPedidoItem])
def listar_tipos(db: Session = Depends(get_db)):
    tipos = db.query(TipoPedido).order_by(TipoPedido.nome.asc()).all()
    return [TipoPedidoItem(id=t.id, nome=t.nome) for t in tipos]


@router.get("/formas-peca", response_model=List[FormaPecaItem])
def listar_formas_peca(
    tipo_pedido_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Formas de peça válidas, com as medidas que cada uma pede."""
    query = db.query(FormaPeca)
    if tipo_pedido_id is not None:
        query = query.join(
            tipo_pedido_forma_peca,
            tipo_pedido_forma_peca.c.forma_peca_id == FormaPeca.id,
        ).filter(tipo_pedido_forma_peca.c.tipo_pedido_id == tipo_pedido_id)

    result = []
    for fp in query.order_by(FormaPeca.nome.asc()).all():
        medidas = (
            db.query(FormaPecaMedida.medida_key)
            .filter(FormaPecaMedida.forma_peca_id == fp.id)
            .all()
        )
        result.append(FormaPecaItem(id=fp.id, nome=fp.nome, medidas=[m[0] for m in medidas]))
    return result
