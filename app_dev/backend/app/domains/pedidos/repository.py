"""
Repository do domínio Pedidos.
"""
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import and_, or_

from .models import Pedido, TipoPedido
from .schemas import PedidoCreate, PedidoUpdate

MEDIDAS_CAMPOS = [
    "medida_ombro", "medida_busto", "medida_cinto", "medida_quadril",
    "medida_comprimento_corpo", "medida_comprimento_vestido",
    "medida_distancia_busto", "medida_raio_busto", "medida_altura_busto",
    "medida_frente", "medida_costado", "medida_comprimento_calca",
    "medida_comprimento_blusa", "medida_largura_manga", "medida_comprimento_manga",
    "medida_punho", "medida_comprimento_saia", "medida_comprimento_bermuda",
]


def _sync_medidas_cliente(db: Session, pedido: Pedido) -> None:
    """Copia as medidas do pedido para o cadastro do cliente (fonte de verdade atual)."""
    from app.domains.clientes.models import Cliente
    cliente = db.query(Cliente).filter(Cliente.id == pedido.cliente_id).first()
    if not cliente:
        return
    atualizado = False
    for campo in MEDIDAS_CAMPOS:
        valor = getattr(pedido, campo, None)
        if valor is not None:
            setattr(cliente, campo, valor)
            atualizado = True
    if atualizado:
        db.flush()


# Status que NÃO aparecem em "pedidos ativos"
STATUS_EXCLUIDOS_ATIVOS = ("Entregue", "Orçamento")

TIPOS_COM_REPASSE_50 = {"ajustes", "ajuste"}


def _percentual_por_tipo(db: Session, tipo_pedido_id) -> float:
    """Retorna o percentual de lucro do dono: 50% para Ajustes, 100% para o resto."""
    if not tipo_pedido_id:
        return 100.0
    tipo = db.query(TipoPedido).filter(TipoPedido.id == tipo_pedido_id).first()
    if tipo and tipo.nome.lower() in TIPOS_COM_REPASSE_50:
        return 50.0
    return 100.0


def _sync_repasse_funcionaria(db: Session, pedido: Pedido) -> None:
    """Mantém uma despesa pendente de repasse para funcionária ligada ao pedido."""
    from app.domains.plano.pagamentos_model import Pagamento

    pendente = (
        db.query(Pagamento)
        .filter(
            Pagamento.origem == "repasse_funcionaria",
            Pagamento.pedido_id == pedido.id,
            Pagamento.data_pagamento.is_(None),
        )
        .first()
    )

    percentual_dono = pedido.percentual_lucro_dono
    if percentual_dono is None:
        percentual_dono = _percentual_por_tipo(db, pedido.tipo_pedido_id)

    valor_pedido = float(pedido.valor_pecas or 0)
    percentual_repasse = max(0.0, min(100.0, 100.0 - float(percentual_dono)))
    valor_repasse = round(valor_pedido * percentual_repasse / 100.0, 2)

    deve_ter_repasse = pedido.status == "Entregue" and valor_repasse > 0
    if not deve_ter_repasse:
        if pendente:
            db.delete(pendente)
        return

    vencimento = pedido.data_entrega or pedido.data_pedido or date.today()
    descricao = f"Repasse funcionária - Pedido #{pedido.id}"

    if pendente:
        pendente.valor = valor_repasse
        pendente.data_vencimento = vencimento
        pendente.categoria = "Colaboradores"
        pendente.tipo_item = "Repasse funcionária"
        pendente.descricao = descricao
    else:
        db.add(
            Pagamento(
                anomes=None,
                tipo="despesa",
                origem="repasse_funcionaria",
                pedido_id=pedido.id,
                data_vencimento=vencimento,
                data_pagamento=None,
                categoria="Colaboradores",
                tipo_item="Repasse funcionária",
                valor=valor_repasse,
                descricao=descricao,
            )
        )


class PedidoRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        data: PedidoCreate,
        *,
        margem_real: float,
        param_preco_hora: float,
        param_impostos: float,
        param_cartao_credito: float,
        param_total_horas_mes: Optional[float],
        param_margem_target: Optional[float],
    ) -> Pedido:
        d = data.model_dump()
        base = {
            "cliente_id", "tipo_pedido_id", "forma_peca_id", "data_pedido", "data_entrega",
            "descricao_produto", "status", "valor_pecas", "quantidade_pecas",
            "horas_trabalho", "custo_materiais", "custos_variaveis",
        }
        extra = {
            "percentual_lucro_dono",
            "forma_pagamento", "valor_entrada", "valor_restante", "pagamento_na_entrega",
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
        kwargs["margem_real"] = margem_real
        kwargs["param_preco_hora"] = param_preco_hora
        kwargs["param_impostos"] = param_impostos
        kwargs["param_cartao_credito"] = param_cartao_credito
        kwargs["param_total_horas_mes"] = param_total_horas_mes
        kwargs["param_margem_target"] = param_margem_target
        pedido = Pedido(**kwargs)
        if pedido.percentual_lucro_dono is None:
            pedido.percentual_lucro_dono = _percentual_por_tipo(self.db, pedido.tipo_pedido_id)
        if pedido.status == "Entregue" and pedido.data_entrega is None:
            pedido.data_entrega = date.today()
        self.db.add(pedido)
        self.db.flush()
        _sync_medidas_cliente(self.db, pedido)
        _sync_repasse_funcionaria(self.db, pedido)
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
        status: Optional[str] = None,
    ) -> List[Pedido]:
        """Lista todos os pedidos. Filtra opcionalmente por mes (YYYYMM) e/ou status."""
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
        if status:
            query = query.filter(Pedido.status == status)
        return query.all()

    def search_historico(
        self,
        q: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
        mes: Optional[str] = None,
        status: Optional[str] = None,
    ):
        """Busca paginada com eager loading para evitar N+1. Retorna (items, total)."""
        from app.domains.clientes.models import Cliente
        from app.domains.plano.pagamentos_model import Pagamento

        query = (
            self.db.query(Pedido)
            .options(
                joinedload(Pedido.cliente),
                joinedload(Pedido.tipo_pedido),
                selectinload(Pedido.pagamentos),
            )
            .order_by(Pedido.data_entrega.desc().nullslast(), Pedido.data_pedido.desc())
        )

        if mes and len(mes) == 6:
            try:
                ano = int(mes[:4])
                num_mes = int(mes[4:6])
                inicio = date(ano, num_mes, 1)
                fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
                query = query.filter(Pedido.data_entrega >= inicio, Pedido.data_entrega < fim)
            except (ValueError, TypeError):
                pass

        if status:
            query = query.filter(Pedido.status == status)

        if q and q.strip():
            term = f"%{q.strip()}%"
            query = query.join(Cliente, Pedido.cliente_id == Cliente.id).filter(
                or_(
                    Cliente.nome.ilike(term),
                    Pedido.descricao_produto.ilike(term),
                    Pedido.status.ilike(term),
                )
            )

        total = query.count()
        items = query.offset(offset).limit(limit).all()
        return items, total

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

    def update(
        self,
        pedido_id: int,
        data: PedidoUpdate,
        *,
        margem_real: float,
        param_preco_hora: Optional[float] = None,
        param_impostos: Optional[float] = None,
        param_cartao_credito: Optional[float] = None,
        param_total_horas_mes: Optional[float] = None,
        param_margem_target: Optional[float] = None,
    ) -> Optional[Pedido]:
        pedido = self.get_by_id(pedido_id)
        if not pedido:
            return None
        update_data = data.model_dump(exclude_unset=True)
        update_data.pop("confirmado_atipico", None)
        era_entregue = pedido.status == "Entregue"
        for key, value in update_data.items():
            setattr(pedido, key, value)
        if "tipo_pedido_id" in update_data and "percentual_lucro_dono" not in update_data:
            pedido.percentual_lucro_dono = _percentual_por_tipo(self.db, update_data["tipo_pedido_id"])
        if "status" in update_data:
            status = update_data["status"]
            if status == "Entregue" and pedido.data_entrega is None:
                pedido.data_entrega = pedido.data_pedido or date.today()
            elif status != "Entregue" and era_entregue:
                pedido.data_entrega = None
        pedido.margem_real = margem_real
        if param_preco_hora is not None:
            pedido.param_preco_hora = param_preco_hora
            pedido.param_impostos = param_impostos
            pedido.param_cartao_credito = param_cartao_credito
            pedido.param_total_horas_mes = param_total_horas_mes
            pedido.param_margem_target = param_margem_target
        _sync_medidas_cliente(self.db, pedido)
        _sync_repasse_funcionaria(self.db, pedido)
        self.db.commit()
        self.db.refresh(pedido)
        return pedido

    def update_status(self, pedido_id: int, status: str) -> Optional[Pedido]:
        pedido = self.get_by_id(pedido_id)
        if not pedido:
            return None
        era_entregue = pedido.status == "Entregue"
        pedido.status = status
        if status == "Entregue":
            if pedido.data_entrega is None:
                pedido.data_entrega = pedido.data_pedido or date.today()
        else:
            if era_entregue:
                pedido.data_entrega = None
        _sync_repasse_funcionaria(self.db, pedido)
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
