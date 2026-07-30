"""
Service do domínio Pedidos.
"""
import re
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domains.parametros.service import get_or_create_parametros, get_preco_hora_efetivo

from .margem import AvisoPedido, ParametrosCalculo, avaliar_avisos, calcular_margem_real
from .models import Pedido, TipoPedido
from .repository import PedidoRepository, TipoPedidoRepository
from .schemas import PedidoCreate, PedidoUpdate, PedidoListItem, PedidoEntregueItem, TipoPedidoItem


class PedidoAtipicoWarning(Exception):
    """Levantada quando o pedido tem valores atípicos e o cliente não confirmou explicitamente."""

    def __init__(self, avisos: List[AvisoPedido], margem_real: float):
        self.avisos = avisos
        self.margem_real = margem_real
        super().__init__(f"Pedido com valores atípicos: {[a.codigo for a in avisos]}")


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
        db = self.repo.db
        p = get_or_create_parametros(db)
        preco_hora = get_preco_hora_efetivo(db)
        params = ParametrosCalculo(preco_hora, p.impostos, p.cartao_credito)
        resultado = calcular_margem_real(
            data.valor_pecas, data.horas_trabalho, data.custo_materiais, data.custos_variaveis, params
        )
        avisos = avaliar_avisos(data.valor_pecas, data.quantidade_pecas, data.horas_trabalho, resultado.margem_real)
        if avisos and not data.confirmado_atipico:
            raise PedidoAtipicoWarning(avisos, resultado.margem_real)
        return self.repo.create(
            data,
            margem_real=resultado.margem_real,
            param_preco_hora=preco_hora,
            param_impostos=p.impostos,
            param_cartao_credito=p.cartao_credito,
            param_total_horas_mes=p.total_horas_mes,
            param_margem_target=p.margem_target,
        )

    def get_by_id(self, pedido_id: int) -> Optional[Pedido]:
        return self.repo.get_by_id(pedido_id)

    def list_all(self, mes: Optional[str] = None, status: Optional[str] = None) -> List[Pedido]:
        """Lista todos os pedidos. Filtra opcionalmente por mes (YYYYMM) e/ou status."""
        return self.repo.list_all(mes=mes, status=status)

    def search_historico(
        self,
        q: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
        mes: Optional[str] = None,
        status: Optional[str] = None,
    ):
        return self.repo.search_historico(q=q, offset=offset, limit=limit, mes=mes, status=status)

    def list_entregues(self, mes: str) -> List[Pedido]:
        """Lista pedidos entregues no mês (para transações do financeiro)."""
        return self.repo.list_entregues(mes)

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
        db = self.repo.db
        pedido = self.repo.get_by_id(pedido_id)
        if not pedido:
            return None

        fields = data.model_dump(exclude_unset=True)
        valor_pecas = fields.get("valor_pecas", pedido.valor_pecas)
        horas_trabalho = fields.get("horas_trabalho", pedido.horas_trabalho)
        custo_materiais = fields.get("custo_materiais", pedido.custo_materiais)
        custos_variaveis = fields.get("custos_variaveis", pedido.custos_variaveis)
        quantidade_pecas = fields.get("quantidade_pecas", pedido.quantidade_pecas)

        # Reaproveita o snapshot histórico do pedido (fidelidade ao orçamento original);
        # pedidos legados sem snapshot usam os parâmetros atuais e recebem o backfill.
        snapshot_extra = {}
        if pedido.param_preco_hora is not None:
            params = ParametrosCalculo(
                pedido.param_preco_hora, pedido.param_impostos or 0, pedido.param_cartao_credito or 0
            )
        else:
            p = get_or_create_parametros(db)
            preco_hora = get_preco_hora_efetivo(db)
            params = ParametrosCalculo(preco_hora, p.impostos, p.cartao_credito)
            snapshot_extra = dict(
                param_preco_hora=preco_hora,
                param_impostos=p.impostos,
                param_cartao_credito=p.cartao_credito,
                param_total_horas_mes=p.total_horas_mes,
                param_margem_target=p.margem_target,
            )

        resultado = calcular_margem_real(valor_pecas, horas_trabalho, custo_materiais, custos_variaveis, params)
        avisos = avaliar_avisos(valor_pecas, quantidade_pecas, horas_trabalho, resultado.margem_real)
        if avisos and not data.confirmado_atipico:
            raise PedidoAtipicoWarning(avisos, resultado.margem_real)

        return self.repo.update(pedido_id, data, margem_real=resultado.margem_real, **snapshot_extra)

    def update_status(self, pedido_id: int, status: str) -> Optional[Pedido]:
        return self.repo.update_status(pedido_id, status)

    def list_tipos(self) -> List[TipoPedido]:
        return self.tipo_repo.list_all()

    @staticmethod
    def to_list_item(p: Pedido) -> PedidoListItem:
        parcelas = p.pagamentos or []
        pagas = [x for x in parcelas if x.data_pagamento is not None]
        pendentes = [x for x in parcelas if x.data_pagamento is None]

        if not parcelas:
            status_pag = None
        elif len(pendentes) == 0:
            status_pag = "confirmado"
        elif any(
            x.data_vencimento and x.data_vencimento < __import__("datetime").date.today()
            for x in pendentes
        ):
            status_pag = "em_atraso"
        else:
            status_pag = "aguardando"

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
            valor_pecas=p.valor_pecas,
            quantidade_pecas=p.quantidade_pecas,
            forma_pagamento=p.forma_pagamento,
            pagamento_na_entrega=p.pagamento_na_entrega,
            status_pagamento=status_pag,
            parcelas_pagas=len(pagas) if parcelas else None,
            parcelas_total=len(parcelas) if parcelas else None,
        )
