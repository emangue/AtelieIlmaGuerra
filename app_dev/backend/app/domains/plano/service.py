"""
Service do domínio Plano - plano vs realizado.
"""
from datetime import date
from typing import Dict, List

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.domains.pedidos.models import Pedido, TipoPedido
from .models import PlanoItem
from .transacoes_models import DespesaTransacao
from .pagamentos_model import Pagamento
from .schemas import PlanoVsRealizado, PlanoVsRealizadoItem, TIPO_PEDIDO_TO_PLANO


def _parse_mes(mes: str) -> tuple:
    """mes = YYYYMM -> (ano, num_mes)"""
    if len(mes) != 6:
        d = date.today()
        return d.year, d.month
    return int(mes[:4]), int(mes[4:6])


def get_plano_vs_realizado(db: Session, mes: str) -> PlanoVsRealizado:
    """
    Retorna plano vs realizado para o mês.
    Receita realizado: calculado em tempo real a partir dos pedidos com status=Entregue
    e data_entrega no mês. Atualiza automaticamente quando uma peça é marcada como
    entregue ou retirada de entregue (via update_status).
    Despesas realizado: valor_realizado do plano (dados do Excel/planilha).
    """
    ano, num_mes = _parse_mes(mes)
    inicio = date(ano, num_mes, 1)
    fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)

    # Itens do plano para o mês
    itens = db.query(PlanoItem).filter(PlanoItem.anomes == mes).order_by(
        PlanoItem.tipo, PlanoItem.categoria, PlanoItem.tipo_item
    ).all()

    # Receita realizado: pedidos entregues no mês + receitas manuais (plano_itens tipo=receita valor_realizado)
    receita_por_tipo = (
        db.query(
            TipoPedido.nome,
            func.coalesce(func.sum(Pedido.valor_pecas), 0).label("valor"),
        )
        .join(Pedido, Pedido.tipo_pedido_id == TipoPedido.id)
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .group_by(TipoPedido.nome)
        .all()
    )
    rec_map: Dict[str, float] = {r.nome.upper(): float(r.valor) for r in receita_por_tipo}
    receita_total_realizado = sum(rec_map.values())

    itens_rec = [i for i in itens if i.tipo == "receita"]
    itens_desp = [i for i in itens if i.tipo == "despesa"]

    receita_planejada = sum(i.valor_planejado for i in itens_rec)
    despesas_planejadas = sum(i.valor_planejado for i in itens_desp)

    # Despesas realizadas: soma dos pagamentos tipo=despesa por plano_item_id
    pag_soma = (
        db.query(Pagamento.plano_item_id, func.coalesce(func.sum(Pagamento.valor), 0).label("total"))
        .filter(Pagamento.anomes == mes, Pagamento.tipo == "despesa")
        .group_by(Pagamento.plano_item_id)
    )
    pag_map = {r.plano_item_id: float(r.total) for r in pag_soma}

    # Fallback legado: DespesaTransacao (dados importados do Excel que ainda não migraram)
    trans_soma = (
        db.query(DespesaTransacao.plano_item_id, func.coalesce(func.sum(DespesaTransacao.valor), 0).label("total"))
        .filter(DespesaTransacao.anomes == mes)
        .group_by(DespesaTransacao.plano_item_id)
    )
    trans_map = {r.plano_item_id: float(r.total) for r in trans_soma}

    # Para cada plano_item, usa pagamentos se existir, senão transacoes legado, senão valor_realizado
    def _realizado_desp(item: PlanoItem) -> float:
        if item.id in pag_map:
            return pag_map[item.id]
        if item.id in trans_map:
            return trans_map[item.id]
        return float(item.valor_realizado or 0)

    despesas_realizadas = sum(_realizado_desp(i) for i in itens_desp)

    # Agrupar receita realizado por tipo_item do plano (pedidos + receitas manuais)
    rec_por_plano_tipo: Dict[str, float] = {}
    for tipo_pedido, valor in rec_map.items():
        plano_tipo = TIPO_PEDIDO_TO_PLANO.get(tipo_pedido, "Outros")
        rec_por_plano_tipo[plano_tipo] = rec_por_plano_tipo.get(plano_tipo, 0) + valor
    # Somar receitas manuais (itens do plano tipo=receita com valor_realizado)
    for i in itens_rec:
        if i.valor_realizado:
            v = float(i.valor_realizado)
            rec_por_plano_tipo[i.tipo_item] = rec_por_plano_tipo.get(i.tipo_item, 0) + v
            receita_total_realizado += v

    def _status_receita(planejado: float, realizado: float) -> str:
        if planejado <= 0:
            return "ok"
        pct = (realizado / planejado) * 100
        if pct >= 90:
            return "ok"
        if pct >= 70:
            return "abaixo"
        return "abaixo"

    def _status_despesa(planejado: float, realizado: float) -> str:
        if planejado <= 0:
            return "ok"
        pct = (realizado / planejado) * 100
        if pct <= 110:
            return "ok"
        if pct <= 130:
            return "acima"
        return "acima"

    itens_receita: List[PlanoVsRealizadoItem] = []
    for i in itens_rec:
        real = rec_por_plano_tipo.get(i.tipo_item, 0)
        itens_receita.append(PlanoVsRealizadoItem(
            tipo_item=i.tipo_item,
            detalhe=i.detalhe,
            valor_planejado=float(i.valor_planejado),
            valor_realizado=real,
            status=_status_receita(float(i.valor_planejado), real),
        ))

    # Tipos realizados sem item no plano (ex: Outros)
    plano_tipos = {i.tipo_item for i in itens_rec}
    for tipo_plano, real in rec_por_plano_tipo.items():
        if tipo_plano not in plano_tipos and real > 0:
            itens_receita.append(PlanoVsRealizadoItem(
                tipo_item=tipo_plano, detalhe=None, valor_planejado=0,
                valor_realizado=real, status="ok",
            ))

    itens_despesas: List[PlanoVsRealizadoItem] = []
    for i in itens_desp:
        real = _realizado_desp(i)
        itens_despesas.append(PlanoVsRealizadoItem(
            tipo_item=i.tipo_item,
            detalhe=i.detalhe,
            valor_planejado=float(i.valor_planejado),
            valor_realizado=real,
            status=_status_despesa(float(i.valor_planejado), real),
        ))

    lucro_planejado = receita_planejada - despesas_planejadas
    lucro_realizado = receita_total_realizado - despesas_realizadas
    percentual = (lucro_realizado / lucro_planejado * 100) if lucro_planejado else 0

    return PlanoVsRealizado(
        anomes=mes,
        receita_planejada=receita_planejada,
        receita_realizada=receita_total_realizado,
        despesas_planejadas=despesas_planejadas,
        despesas_realizadas=despesas_realizadas,
        lucro_planejado=lucro_planejado,
        lucro_realizado=lucro_realizado,
        percentual_atingimento=round(percentual, 1),
        itens_receita=itens_receita,
        itens_despesas=itens_despesas,
    )
