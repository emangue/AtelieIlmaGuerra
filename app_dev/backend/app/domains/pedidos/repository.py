"""
Repository do domínio Pedidos.
"""
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_

from .models import Pedido, TipoPedido
from .schemas import PedidoCreate, PedidoUpdate


# Status que NÃO aparecem em "pedidos ativos"
STATUS_EXCLUIDOS_ATIVOS = ("Entregue", "Orçamento")


class PedidoRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: PedidoCreate) -> Pedido:
        d = data.model_dump()
        base = {
            "cliente_id", "tipo_pedido_id", "forma_peca_id", "data_pedido", "data_entrega",
            "descricao_produto", "status", "valor_pecas", "quantidade_pecas",
            "horas_trabalho", "custo_materiais", "custos_variaveis",
        }
        extra = {
            "margem_real",
            "param_preco_hora", "param_impostos", "param_cartao_credito",
            "param_total_horas_mes", "param_margem_target",
            "forma_pagamento", "valor_entrada", "valor_restante",
            "detalhes_pagamento", "medidas_disponiveis", "observacao_pedido",
            "fotos_disponiveis", "foto_url", "foto_url_2", "foto_url_3",
            "comentario_foto_1", "comentario_foto_2", "comentario_foto_3",
            "medida_ombro", "medida_busto", "medida_cinto", "medida_quadril",
            "medida_comprimento_corpo", "medida_comprimento_vestido",
            "medida_distancia_busto", "medida_raio_busto", "medida_altura_busto",
            "medida_frente", "medida_costado", "medida_comprimento_calca",
            "medida_comprimento_blusa", "medida_largura_manga",
            "medida_comprimento_manga", "medida_punho",
            "medida_comprimento_saia", "medida_comprimento_bermuda",
            "comentario_medidas",
        }
        kwargs = {k: v for k, v in d.items() if k in base or (k in extra and v is not None)}
        kwargs.setdefault("descricao_produto", "")
        pedido = Pedido(**kwargs)
        self.db.add(pedido)
        self.db.commit()
        self.db.refresh(pedido)
        return pedido

    def get_by_id(self, pedido_id: int) -> Optional[Pedido]:
        return self.db.query(Pedido).filter(Pedido.id == pedido_id).first()

    def list_by_cliente(
        self, cliente_id: int, limit: int = 10
    ) -> List[Pedido]:
        """Lista últimos pedidos do cliente (mais recentes primeiro)."""
        return (
            self.db.query(Pedido)
            .filter(Pedido.cliente_id == cliente_id)
            .order_by(Pedido.data_pedido.desc(), Pedido.id.desc())
            .limit(limit)
            .all()
        )

    def list_all(
        self,
        mes: Optional[str] = None,
    ) -> List[Pedido]:
        """Lista todos os pedidos. Se mes=YYYYMM, filtra por data_entrega no mês."""
        query = (
            self.db.query(Pedido)
            .order_by(Pedido.data_entrega.asc().nullslast(), Pedido.data_pedido.asc())
        )
        if mes and len(mes) == 6:
            try:
                ano = int(mes[:4])
                num_mes = int(mes[4:6])
                inicio = date(ano, num_mes, 1)
                fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
                query = query.filter(
                    Pedido.data_entrega >= inicio,
                    Pedido.data_entrega < fim,
                )
            except (ValueError, TypeError):
                pass
        return query.all()

    def list_entregues(self, mes: str) -> List[Pedido]:
        """Lista pedidos entregues no mês (status=Entregue, data_entrega no mês)."""
        if not mes or len(mes) != 6:
            return []
        try:
            ano = int(mes[:4])
            num_mes = int(mes[4:6])
            inicio = date(ano, num_mes, 1)
            fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
        except (ValueError, TypeError):
            return []
        return (
            self.db.query(Pedido)
            .filter(
                Pedido.status == "Entregue",
                Pedido.data_entrega >= inicio,
                Pedido.data_entrega < fim,
            )
            .order_by(Pedido.data_entrega.asc(), Pedido.id.asc())
            .all()
        )

    def list_ativos(
        self,
        excluir_status: Optional[List[str]] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None,
    ) -> List[Pedido]:
        excluir = excluir_status or list(STATUS_EXCLUIDOS_ATIVOS)
        query = (
            self.db.query(Pedido)
            .filter(~Pedido.status.in_(excluir))
            .order_by(Pedido.data_entrega.asc().nullslast(), Pedido.data_pedido.asc())
        )
        if data_inicio:
            query = query.filter(Pedido.data_entrega >= data_inicio)
        if data_fim:
            query = query.filter(Pedido.data_entrega <= data_fim)
        return query.all()

    def update(self, pedido_id: int, data: PedidoUpdate) -> Optional[Pedido]:
        pedido = self.get_by_id(pedido_id)
        if not pedido:
            return None
        update_data = data.model_dump(exclude_unset=True)
        era_entregue = pedido.status == "Entregue"
        for key, value in update_data.items():
            setattr(pedido, key, value)
        # Se status foi alterado, garantir data_entrega consistente (valor realizado)
        if "status" in update_data:
            status = update_data["status"]
            if status == "Entregue" and pedido.data_entrega is None:
                pedido.data_entrega = date.today()
            elif status != "Entregue" and era_entregue:
                pedido.data_entrega = None
        self.db.commit()
        self.db.refresh(pedido)
        return pedido

    def update_status(self, pedido_id: int, status: str) -> Optional[Pedido]:
        pedido = self.get_by_id(pedido_id)
        if not pedido:
            return None
        era_entregue = pedido.status == "Entregue"
        pedido.status = status
        # Garantir que valor realizado (plano vs pedidos) seja sempre atualizado:
        # ao marcar como Entregue -> data_entrega = hoje (para contar no mês)
        # ao retirar de Entregue -> limpar data_entrega
        if status == "Entregue":
            if pedido.data_entrega is None:
                pedido.data_entrega = date.today()
        else:
            if era_entregue:
                pedido.data_entrega = None
        self.db.commit()
        self.db.refresh(pedido)
        return pedido


class TipoPedidoRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> List[TipoPedido]:
        return self.db.query(TipoPedido).order_by(TipoPedido.nome).all()

    def get_by_id(self, id: int) -> Optional[TipoPedido]:
        return self.db.query(TipoPedido).filter(TipoPedido.id == id).first()
