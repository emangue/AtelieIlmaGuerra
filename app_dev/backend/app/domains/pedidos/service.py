"""
Service do domínio Pedidos.
"""
import re
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Pedido, TipoPedido
from .repository import PedidoRepository, TipoPedidoRepository
from .schemas import PedidoCreate, PedidoUpdate, PedidoListItem, TipoPedidoItem


def _norm_foto_url(url: Optional[str]) -> Optional[str]:
    """Converte URL localhost/absoluta em path relativo para funcionar em produção."""
    if not url or not url.strip():
        return None
    url = url.strip()
    # http://localhost:8000/uploads/pedidos/xxx.jpg -> /uploads/pedidos/xxx.jpg
    m = re.search(r"/uploads/pedidos/[^/]+$", url)
    if m:
        return m.group(0)
    return url if url.startswith("/") else url


class PedidoService:
    def __init__(self, db: Session):
        self.repo = PedidoRepository(db)
        self.tipo_repo = TipoPedidoRepository(db)

    def create(self, data: PedidoCreate) -> Pedido:
        return self.repo.create(data)

    def get_by_id(self, pedido_id: int) -> Optional[Pedido]:
        return self.repo.get_by_id(pedido_id)

    def list_all(self, mes: Optional[str] = None) -> List[Pedido]:
        """Lista todos os pedidos. Se mes=YYYYMM, filtra por data_entrega no mês."""
        return self.repo.list_all(mes=mes)

    def list_ativos(
        self,
        excluir_status: Optional[List[str]] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None,
    ) -> List[Pedido]:
        return self.repo.list_ativos(
            excluir_status=excluir_status,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )

    def update(self, pedido_id: int, data: PedidoUpdate) -> Optional[Pedido]:
        return self.repo.update(pedido_id, data)

    def update_status(self, pedido_id: int, status: str) -> Optional[Pedido]:
        return self.repo.update_status(pedido_id, status)

    def list_tipos(self) -> List[TipoPedido]:
        return self.tipo_repo.list_all()

    @staticmethod
    def to_list_item(p: Pedido) -> PedidoListItem:
        return PedidoListItem(
            id=p.id,
            cliente_id=p.cliente_id,
            cliente_nome=p.cliente.nome if p.cliente else "",
            tipo_pedido_id=p.tipo_pedido_id,
            tipo_pedido_nome=p.tipo_pedido.nome if p.tipo_pedido else None,
            descricao_produto=p.descricao_produto or "",
            status=p.status,
            data_pedido=p.data_pedido,
            data_entrega=p.data_entrega,
            foto_url=_norm_foto_url(p.foto_url),
        )
