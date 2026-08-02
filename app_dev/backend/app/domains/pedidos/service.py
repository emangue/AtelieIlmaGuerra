"""
Service do domínio Pedidos.
"""
import re
from datetime import date
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domains.parametros.service import get_or_create_parametros, get_preco_hora_efetivo
from app.domains.parametros.taxas import resolver_percentual_padrao
from app.domains.plano.custos_financeiros import (
    aplicar_custos, custo_receber_total, sync_custos_financeiros,
)

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


def _normalizar_valor_pedido(valor: Optional[float]) -> Optional[float]:
    if valor is None:
        return None
    decimal = Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    centavos = decimal - decimal.to_integral_value(rounding=ROUND_CEILING) + Decimal("1")
    if centavos == Decimal("0.99"):
        return float(decimal.to_integral_value(rounding=ROUND_CEILING))
    return float(decimal)


class PedidoService:
    def __init__(self, db: Session):
        self.repo = PedidoRepository(db)
        self.tipo_repo = TipoPedidoRepository(db)

    def create(self, data: PedidoCreate) -> Pedido:
        db = self.repo.db
        data.valor_pecas = _normalizar_valor_pedido(data.valor_pecas)
        p = get_or_create_parametros(db)
        preco_hora = get_preco_hora_efetivo(db)
        taxa_padrao = resolver_percentual_padrao(db)
        params = ParametrosCalculo(preco_hora, p.impostos, taxa_padrao)
        # No create ainda não há parcelas, então o custo de receber é só o que veio no
        # payload. A margem é recalculada quando o pagamento é configurado.
        custo_receber = (data.taxa_cartao_valor or 0) + (data.desconto_pix_valor or 0)
        resultado = calcular_margem_real(
            data.valor_pecas, data.horas_trabalho, data.custo_materiais, data.custos_variaveis, params,
            custo_receber=custo_receber,
        )
        avisos = avaliar_avisos(data.valor_pecas, data.quantidade_pecas, data.horas_trabalho, resultado.margem_real)
        if avisos and not data.confirmado_atipico:
            raise PedidoAtipicoWarning(avisos, resultado.margem_real)
        return self.repo.create(
            data,
            margem_real=resultado.margem_real,
            param_preco_hora=preco_hora,
            param_impostos=p.impostos,
            param_cartao_credito=taxa_padrao,
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
        tipo: Optional[str] = None,
        repasse_funcionaria: bool = False,
        percentual_lucro_dono: Optional[float] = None,
    ):
        return self.repo.search_historico(
            q=q,
            offset=offset,
            limit=limit,
            mes=mes,
            status=status,
            tipo=tipo,
            repasse_funcionaria=repasse_funcionaria,
            percentual_lucro_dono=percentual_lucro_dono,
        )

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
        if "valor_pecas" in fields:
            data.valor_pecas = _normalizar_valor_pedido(data.valor_pecas)
            fields["valor_pecas"] = data.valor_pecas
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

        # Override manual da taxa/desconto: aplicar antes de calcular a margem, e
        # marcar como manual para que uma edição de preço depois não apague o número.
        if data.recalcular_custos:
            pedido.taxa_cartao_manual = False
            pedido.desconto_pix_manual = False
        if fields.get("taxa_cartao_valor") is not None:
            pedido.taxa_cartao_valor = data.taxa_cartao_valor
            pedido.taxa_cartao_manual = True
        if fields.get("desconto_pix_valor") is not None:
            pedido.desconto_pix_valor = data.desconto_pix_valor
            pedido.desconto_pix_manual = True
        if fields.get("canal_cartao") is not None:
            pedido.canal_cartao = data.canal_cartao

        custos_mudaram = bool(
            {"taxa_cartao_valor", "desconto_pix_valor", "canal_cartao", "valor_pecas"} & fields.keys()
        ) or data.recalcular_custos
        if custos_mudaram:
            aplicar_custos(db, pedido, [p for p in (pedido.pagamentos or []) if p.tipo == "receita"])

        resultado = calcular_margem_real(
            valor_pecas, horas_trabalho, custo_materiais, custos_variaveis, params,
            custo_receber=custo_receber_total(pedido),
        )
        avisos = avaliar_avisos(valor_pecas, quantidade_pecas, horas_trabalho, resultado.margem_real)
        if avisos and not data.confirmado_atipico:
            raise PedidoAtipicoWarning(avisos, resultado.margem_real)

        atualizado = self.repo.update(pedido_id, data, margem_real=resultado.margem_real, **snapshot_extra)
        if custos_mudaram and atualizado:
            # Recalcular DEPOIS do update: mudar o valor do pedido reescalona as
            # parcelas, e é sobre os valores novos que a taxa incide.
            aplicar_custos(db, atualizado, [p for p in (atualizado.pagamentos or []) if p.tipo == "receita"])
            self.recalcular_margem(atualizado)
            sync_custos_financeiros(db, atualizado)
            db.commit()
            db.refresh(atualizado)
        return atualizado

    def recalcular_margem(self, pedido: Pedido) -> float:
        """Recalcula margem_real do pedido com o custo de receber atual.

        Usado depois de configurar o pagamento, quando as formas por parcela — e
        portanto a taxa de cartão e o desconto Pix — só então são conhecidas.
        """
        db = self.repo.db
        if pedido.param_preco_hora is not None:
            params = ParametrosCalculo(
                pedido.param_preco_hora, pedido.param_impostos or 0, pedido.param_cartao_credito or 0
            )
        else:
            p = get_or_create_parametros(db)
            params = ParametrosCalculo(get_preco_hora_efetivo(db), p.impostos, resolver_percentual_padrao(db))

        resultado = calcular_margem_real(
            pedido.valor_pecas, pedido.horas_trabalho, pedido.custo_materiais, pedido.custos_variaveis,
            params, custo_receber=custo_receber_total(pedido),
        )
        pedido.margem_real = resultado.margem_real
        return resultado.margem_real

    def update_status(self, pedido_id: int, status: str) -> Optional[Pedido]:
        return self.repo.update_status(pedido_id, status)

    def list_tipos(self) -> List[TipoPedido]:
        return self.tipo_repo.list_all()

    @staticmethod
    def to_list_item(p: Pedido) -> PedidoListItem:
        # Só receitas: as despesas de taxa/repasse também vivem em p.pagamentos.
        parcelas = [x for x in (p.pagamentos or []) if x.tipo == "receita"]
        # Parcela de cartão futura já tem data_pagamento (a data prevista de crédito),
        # mas o dinheiro não entrou — contá-la como paga marcaria o pedido como
        # quitado no dia da venda.
        pagas = [x for x in parcelas if not x.pendente_de_caixa]
        pendentes = [x for x in parcelas if x.pendente_de_caixa]

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
            criado_como_orcamento=bool(getattr(p, "criado_como_orcamento", False)),
            data_pedido=p.data_pedido,
            data_entrega=p.data_entrega,
            foto_url=_norm_foto_url(p.foto_url),
            valor_pecas=p.valor_pecas,
            quantidade_pecas=p.quantidade_pecas,
            percentual_lucro_dono=p.percentual_lucro_dono,
            forma_pagamento=p.forma_pagamento,
            pagamento_na_entrega=p.pagamento_na_entrega,
            status_pagamento=status_pag,
            parcelas_pagas=len(pagas) if parcelas else None,
            parcelas_total=len(parcelas) if parcelas else None,
        )
