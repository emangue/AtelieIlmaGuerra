"""
Repository do domínio Pedidos.
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
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
STATUS_EXCLUIDOS_ATIVOS = ("Entregue", "Orçamento", "Cancelado", "Canelado")

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
    """Mantém a despesa realizada da Andrea alinhada com ajustes entregues."""
    from app.domains.plano.pagamentos_model import Pagamento
    from app.domains.plano.models import PlanoItem

    repasse = (
        db.query(Pagamento)
        .filter(
            Pagamento.origem == "repasse_funcionaria",
            Pagamento.pedido_id == pedido.id,
        )
        .first()
    )

    percentual_dono = pedido.percentual_lucro_dono
    if percentual_dono is None:
        percentual_dono = _percentual_por_tipo(db, pedido.tipo_pedido_id)

    valor_pedido = Decimal(str(pedido.valor_pecas or 0))
    percentual_repasse = max(0.0, min(100.0, 100.0 - float(percentual_dono)))
    valor_repasse = (
        valor_pedido * Decimal(str(percentual_repasse)) / Decimal("100")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tipo_nome = (pedido.tipo_pedido.nome if pedido.tipo_pedido else "").lower()
    deve_ter_repasse = (
        pedido.status == "Entregue"
        and tipo_nome in TIPOS_COM_REPASSE_50
        and valor_repasse > 0
    )

    if not deve_ter_repasse:
        if repasse:
            db.delete(repasse)
        return

    data_repasse = pedido.data_entrega or pedido.data_pedido or date.today()
    anomes = f"{data_repasse.year}{data_repasse.month:02d}"
    plano_item = (
        db.query(PlanoItem)
        .filter(
            PlanoItem.anomes == anomes,
            PlanoItem.tipo == "despesa",
            PlanoItem.tipo_item == "Colaboradores",
            PlanoItem.detalhe.in_(("Andrea", "Esli")),
        )
        .order_by(PlanoItem.detalhe.asc())
        .first()
    )
    if not plano_item:
        plano_item = PlanoItem(
            anomes=anomes,
            tipo="despesa",
            categoria="Custo Variável",
            tipo_item="Colaboradores",
            detalhe="Andrea",
            valor_planejado=0,
            valor_realizado=0,
        )
        db.add(plano_item)
        db.flush()
    elif plano_item.detalhe == "Esli":
        plano_item.detalhe = "Andrea"

    dados = {
        "anomes": anomes,
        "plano_item_id": plano_item.id,
        "data_vencimento": data_repasse,
        "data_pagamento": data_repasse,
        "categoria": plano_item.categoria or "Custo Variável",
        "tipo_item": "Colaboradores",
        "natureza": "despesa_operacional",
        "subtipo_financeiro": None,
        "valor": float(valor_repasse),
        "descricao": f"Andrea - Pedido #{pedido.id}",
    }
    if repasse:
        for campo, valor in dados.items():
            setattr(repasse, campo, valor)
    else:
        db.add(
            Pagamento(
                tipo="despesa",
                origem="repasse_funcionaria",
                natureza="despesa_operacional",
                pedido_id=pedido.id,
                **dados,
            )
        )


def _money_decimal(valor: Optional[float]) -> Decimal:
    return Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _split_money(total: Decimal, count: int) -> list[float]:
    total_cents = int((total * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))
    base = total_cents // count
    remainder = total_cents % count
    return [float(Decimal(base + (1 if i < remainder else 0)) / Decimal("100")) for i in range(count)]


def _scale_money(original_values: list[Decimal], total: Decimal) -> list[float]:
    original_total = sum(original_values, Decimal("0"))
    if original_total <= 0:
        return _split_money(total, len(original_values))

    valores: list[Decimal] = []
    acumulado = Decimal("0")
    for original in original_values[:-1]:
        valor = (total * original / original_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        valores.append(valor)
        acumulado += valor
    valores.append((total - acumulado).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return [float(v) for v in valores]


def _sync_receitas_pedido(db: Session, pedido: Pedido) -> None:
    """Mantém parcelas pendentes alinhadas ao valor atual do pedido."""
    from app.domains.plano.pagamentos_model import Pagamento

    pagamentos = (
        db.query(Pagamento)
        .filter(
            Pagamento.pedido_id == pedido.id,
            Pagamento.tipo == "receita",
            Pagamento.origem == "pedido",
        )
        .order_by(Pagamento.parcela_numero.asc().nullslast(), Pagamento.data_vencimento.asc().nullslast(), Pagamento.id.asc())
        .all()
    )
    # Parcela de cartão futura nasce com data_pagamento preenchida, mas ainda pode
    # ser reescalonada — só o dinheiro que já entrou trava o ajuste.
    if not pagamentos or any(not p.pendente_de_caixa for p in pagamentos):
        return

    total = _money_decimal(pedido.valor_pecas)
    if total <= 0:
        return

    originais = [_money_decimal(p.valor) for p in pagamentos]
    if len(pagamentos) == 1:
        novos_valores = [float(total)]
    elif all(v > 0 for v in originais):
        novos_valores = _scale_money(originais, total)
    else:
        novos_valores = _split_money(total, len(pagamentos))

    tipo_nome = pedido.tipo_pedido.nome if pedido.tipo_pedido else "Pedido"
    cliente_nome = pedido.cliente.nome if pedido.cliente else ""
    descricao_base = f"{tipo_nome} · {cliente_nome}" if cliente_nome else tipo_nome
    total_parcelas = len(pagamentos)
    tem_entrada = (pagamentos[0].descricao or "").lower().startswith("entrada")
    for index, pagamento in enumerate(pagamentos, start=1):
        pagamento.valor = novos_valores[index - 1]
        pagamento.parcela_numero = index
        pagamento.parcela_total = total_parcelas
        # A entrada é identificada pelo prefixo da descrição — reescrever tudo como
        # "Parcela N" faria o formulário perder a entrada ao recarregar.
        if index == 1 and tem_entrada:
            pagamento.descricao = f"Entrada · {descricao_base}"
        elif total_parcelas > 1:
            pagamento.descricao = f"Parcela {index - (1 if tem_entrada else 0)} · {descricao_base}"
        else:
            pagamento.descricao = descricao_base


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
            "canal_cartao", "taxa_cartao_valor", "desconto_pix_valor",
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
        kwargs["criado_como_orcamento"] = kwargs.get("status") == "Orçamento"
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
        tipo: Optional[str] = None,
        repasse_funcionaria: bool = False,
        percentual_lucro_dono: Optional[float] = None,
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

        if tipo:
            query = query.join(TipoPedido, Pedido.tipo_pedido_id == TipoPedido.id).filter(
                TipoPedido.nome.ilike(f"%{tipo.strip()}%")
            )

        if repasse_funcionaria:
            query = query.join(
                Pagamento,
                and_(
                    Pagamento.pedido_id == Pedido.id,
                    Pagamento.tipo == "despesa",
                    Pagamento.origem == "repasse_funcionaria",
                ),
            )

        if percentual_lucro_dono is not None:
            query = query.filter(Pedido.percentual_lucro_dono == percentual_lucro_dono)

        if q and q.strip():
            term = f"%{q.strip()}%"
            query = query.join(Cliente, Pedido.cliente_id == Cliente.id).filter(
                or_(
                    Cliente.nome.ilike(term),
                    Pedido.descricao_produto.ilike(term),
                    Pedido.status.ilike(term),
                )
            )

        resumo_items = query.all()
        total_valor_pecas = round(sum(float(p.valor_pecas or 0) for p in resumo_items), 2)
        percentuais_map = {}
        for p in resumo_items:
            percentual = float(p.percentual_lucro_dono if p.percentual_lucro_dono is not None else 100)
            atual = percentuais_map.setdefault(percentual, {"percentual": percentual, "quantidade": 0, "valor": 0.0})
            atual["quantidade"] = int(atual["quantidade"]) + 1
            atual["valor"] = round(float(atual["valor"]) + float(p.valor_pecas or 0), 2)
        percentuais_lucro_dono = sorted(percentuais_map.values(), key=lambda item: float(item["percentual"]))
        total = len(resumo_items)
        items = query.offset(offset).limit(limit).all()
        return items, total, total_valor_pecas, percentuais_lucro_dono

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
        # Flags de controle, não colunas — não devem virar atributo do modelo.
        update_data.pop("confirmado_atipico", None)
        update_data.pop("recalcular_custos", None)
        era_entregue = pedido.status == "Entregue"
        era_orcamento = pedido.status == "Orçamento"
        for key, value in update_data.items():
            setattr(pedido, key, value)
        if era_orcamento:
            pedido.criado_como_orcamento = True
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
        if "valor_pecas" in update_data:
            _sync_receitas_pedido(self.db, pedido)
        _sync_repasse_funcionaria(self.db, pedido)
        self.db.commit()
        self.db.refresh(pedido)
        return pedido

    def update_status(self, pedido_id: int, status: str) -> Optional[Pedido]:
        pedido = self.get_by_id(pedido_id)
        if not pedido:
            return None
        era_entregue = pedido.status == "Entregue"
        era_orcamento = pedido.status == "Orçamento"
        pedido.status = status
        if era_orcamento:
            pedido.criado_como_orcamento = True
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
