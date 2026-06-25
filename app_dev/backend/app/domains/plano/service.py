"""
Service do domínio Plano - plano vs realizado.
"""
import calendar
from datetime import date
from typing import Dict, List

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.domains.pedidos.models import Pedido, TipoPedido
from .models import PlanoItem
from .pagamentos_model import Pagamento
from .schemas import (
    PlanoVsRealizado, PlanoVsRealizadoItem, EvolucaoMensalItem, TIPO_PEDIDO_TO_PLANO,
    MetaMes, PecaNecessaria, DespesaNaoLancada, PecaEntregue,
)


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

    # Receita realizada: pagamentos tipo=receita do mês com data_pagamento confirmada.
    receita_por_tipo = (
        db.query(
            TipoPedido.nome,
            func.coalesce(func.sum(Pagamento.valor), 0).label("valor"),
        )
        .join(Pedido, Pedido.id == Pagamento.pedido_id)
        .join(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(
            Pagamento.anomes == mes,
            Pagamento.tipo == "receita",
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

    def _realizado_desp(item: PlanoItem) -> float:
        return pag_map.get(item.id, float(item.valor_realizado or 0))

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

    # Repasse para costureira: 50% dos ajustes entregues no mês
    valor_ajustes = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .join(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            func.lower(TipoPedido.nome) == "ajustes",
        )
        .scalar() or 0
    )
    repasse_costureira = round(float(valor_ajustes) * 0.5, 2)
    lucro_liquido_dono = round(lucro_realizado - repasse_costureira, 2)

    # Visão entrega: soma valor_pecas dos pedidos com data_entrega no mês
    receita_por_entrega = float(
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )

    # Breakdown por tipo — visão entrega
    entrega_por_tipo = (
        db.query(
            TipoPedido.nome,
            func.coalesce(func.sum(Pedido.valor_pecas), 0).label("valor"),
        )
        .join(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .group_by(TipoPedido.nome)
        .all()
    )
    entrega_map: Dict[str, float] = {}
    for r in entrega_por_tipo:
        plano_tipo = TIPO_PEDIDO_TO_PLANO.get(r.nome.upper(), "Outros")
        entrega_map[plano_tipo] = entrega_map.get(plano_tipo, 0) + float(r.valor)

    itens_receita_entrega: List[PlanoVsRealizadoItem] = []
    plano_tipos_set = {i.tipo_item for i in itens_rec}
    for i in itens_rec:
        real_e = entrega_map.get(i.tipo_item, 0)
        itens_receita_entrega.append(PlanoVsRealizadoItem(
            tipo_item=i.tipo_item,
            detalhe=i.detalhe,
            valor_planejado=float(i.valor_planejado),
            valor_realizado=real_e,
            status=_status_receita(float(i.valor_planejado), real_e),
        ))
    for tipo_plano, real_e in entrega_map.items():
        if tipo_plano not in plano_tipos_set and real_e > 0:
            itens_receita_entrega.append(PlanoVsRealizadoItem(
                tipo_item=tipo_plano, detalhe=None, valor_planejado=0,
                valor_realizado=real_e, status="ok",
            ))

    return PlanoVsRealizado(
        anomes=mes,
        receita_planejada=receita_planejada,
        receita_realizada=receita_total_realizado,
        receita_por_entrega=round(receita_por_entrega, 2),
        despesas_planejadas=despesas_planejadas,
        despesas_realizadas=despesas_realizadas,
        lucro_planejado=lucro_planejado,
        lucro_realizado=lucro_realizado,
        percentual_atingimento=round(percentual, 1),
        repasse_costureira=repasse_costureira,
        lucro_liquido_dono=lucro_liquido_dono,
        itens_receita=itens_receita,
        itens_receita_entrega=itens_receita_entrega,
        itens_despesas=itens_despesas,
    )


def get_evolucao_bulk(db: Session, mes: str, meses: int = 7) -> List[EvolucaoMensalItem]:
    """
    Evolução mensal com bulk queries: 2 queries totais para N meses,
    em vez de N×4 queries do loop original.
    """
    MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    ano, num_mes = int(mes[:4]), int(mes[4:6])
    anomes_list: List[str] = []
    for _ in range(meses):
        anomes_list.append(f"{ano}{num_mes:02d}")
        num_mes -= 1
        if num_mes < 1:
            num_mes = 12
            ano -= 1

    # Query 1: receita planejada por mês (um único SELECT com GROUP BY)
    rec_plan_rows = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.anomes.in_(anomes_list), PlanoItem.tipo == "receita")
        .group_by(PlanoItem.anomes)
        .all()
    )
    rec_plan_map: Dict[str, float] = {r.anomes: float(r.total) for r in rec_plan_rows}

    # Query 2: receita realizada — pagamentos tipo=receita nos meses pedidos.
    # Usa Pagamento.anomes (string YYYYMM) — sem strftime, portável a Postgres.
    pag_rows = (
        db.query(
            Pagamento.anomes,
            func.coalesce(func.sum(Pagamento.valor), 0).label("valor"),
        )
        .filter(
            Pagamento.anomes.in_(anomes_list),
            Pagamento.tipo == "receita",
        )
        .group_by(Pagamento.anomes)
        .all()
    )
    rec_real_map: Dict[str, float] = {r.anomes: float(r.valor) for r in pag_rows}

    return [
        EvolucaoMensalItem(
            anomes=anomes,
            label=MESES_ABREV[int(anomes[4:]) - 1],
            receita_planejada=rec_plan_map.get(anomes, 0),
            receita_realizada=rec_real_map.get(anomes, 0),
        )
        for anomes in reversed(anomes_list)
    ]


def get_meta_mes(db: Session, mes: str) -> MetaMes:
    """Retorna a meta do mês com progresso, peças necessárias e despesas não lançadas."""
    import math
    ano, num_mes = _parse_mes(mes)
    inicio = date(ano, num_mes, 1)
    fim = date(ano + 1, 1, 1) if num_mes == 12 else date(ano, num_mes + 1, 1)
    hoje = date.today()

    # Plano de receita do mês
    itens_rec = db.query(PlanoItem).filter(
        PlanoItem.anomes == mes, PlanoItem.tipo == "receita"
    ).all()
    meta_receita = sum(float(i.valor_planejado) for i in itens_rec)

    # Realizado: soma dos pagamentos tipo=receita no mês
    realizado = float(
        db.query(func.coalesce(func.sum(Pagamento.valor), 0))
        .filter(Pagamento.anomes == mes, Pagamento.tipo == "receita")
        .scalar() or 0
    )

    faltam = max(0.0, meta_receita - realizado)
    percentual = round((realizado / meta_receita * 100) if meta_receita > 0 else 0, 1)

    # Dias úteis restantes (seg-sáb, excluindo dom), a partir de amanhã até fim do mês
    dias_uteis = 0
    if hoje < fim:
        check = max(hoje, inicio)
        cur = check
        while cur < fim:
            if cur.weekday() != 6:  # 6 = domingo
                dias_uteis += 1
            from datetime import timedelta
            cur += timedelta(days=1)
        # Se hoje já passou, não contar hoje
        if hoje >= inicio and hoje.weekday() != 6:
            dias_uteis = max(0, dias_uteis - 1)

    # Peças necessárias por tipo para bater a meta
    # Receita realizada por tipo de plano
    # Realizado por tipo: valor total, contagem de pedidos distintos
    rec_por_tipo_realizado: Dict[str, float] = {}
    rec_por_tipo_qtd: Dict[str, int] = {}
    rows_pag = (
        db.query(
            TipoPedido.nome,
            func.coalesce(func.sum(Pagamento.valor), 0).label("v"),
            func.coalesce(func.sum(Pedido.quantidade_pecas), 0).label("qtd"),
        )
        .join(Pedido, Pedido.id == Pagamento.pedido_id)
        .join(TipoPedido, TipoPedido.id == Pedido.tipo_pedido_id)
        .filter(Pagamento.anomes == mes, Pagamento.tipo == "receita")
        .group_by(TipoPedido.nome)
        .all()
    )
    for r in rows_pag:
        plano_tipo = TIPO_PEDIDO_TO_PLANO.get(r.nome.upper(), "Outros")
        rec_por_tipo_realizado[plano_tipo] = rec_por_tipo_realizado.get(plano_tipo, 0) + float(r.v)
        rec_por_tipo_qtd[plano_tipo] = rec_por_tipo_qtd.get(plano_tipo, 0) + int(r.qtd)

    pecas_necessarias: List[PecaNecessaria] = []
    for item in itens_rec:
        ticket = float(item.ticket_medio) if item.ticket_medio and item.ticket_medio > 0 else 0
        if ticket <= 0:
            continue
        real = rec_por_tipo_realizado.get(item.tipo_item, 0)
        real_qtd = rec_por_tipo_qtd.get(item.tipo_item, 0)
        real_ticket = round(real / real_qtd, 2) if real_qtd > 0 else 0
        falta_tipo = max(0.0, float(item.valor_planejado) - real)
        pecas_necessarias.append(PecaNecessaria(
            tipo_item=item.tipo_item,
            ticket_medio=round(ticket, 2),
            faltam_valor=round(falta_tipo, 2),
            pecas_necessarias=math.ceil(falta_tipo / ticket) if falta_tipo > 0 else 0,
            realizado=round(real, 2),
            realizado_quantidade=real_qtd,
            realizado_ticket_medio=real_ticket,
        ))

    # Despesas não lançadas: itens do plano tipo=despesa sem pagamento no mês
    itens_desp = db.query(PlanoItem).filter(
        PlanoItem.anomes == mes, PlanoItem.tipo == "despesa"
    ).all()
    pag_desp_ids = {
        r[0] for r in db.query(Pagamento.plano_item_id)
        .filter(Pagamento.anomes == mes, Pagamento.tipo == "despesa", Pagamento.plano_item_id.isnot(None))
        .all()
    }
    despesas_nao_lancadas = [
        DespesaNaoLancada(
            tipo_item=i.tipo_item,
            detalhe=i.detalhe,
            valor_planejado=float(i.valor_planejado),
        )
        for i in itens_desp
        if i.id not in pag_desp_ids and float(i.valor_planejado) > 0
    ]

    # Peças entregues por tipo no mês
    rows_pe = (
        db.query(
            TipoPedido.nome,
            func.coalesce(func.sum(func.coalesce(Pedido.quantidade_pecas, 1)), 0).label("qtd"),
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
    pecas_entregues = [
        PecaEntregue(
            tipo=r.nome,
            quantidade=int(r.qtd),
            valor=round(float(r.valor), 2),
            ticket_medio=round(float(r.valor) / int(r.qtd), 2) if int(r.qtd) > 0 else 0,
        )
        for r in rows_pe
    ]

    return MetaMes(
        anomes=mes,
        meta_receita=round(meta_receita, 2),
        realizado=round(realizado, 2),
        faltam=round(faltam, 2),
        percentual=percentual,
        dias_uteis_restantes=dias_uteis,
        pecas_necessarias=pecas_necessarias,
        despesas_nao_lancadas=despesas_nao_lancadas,
        pecas_entregues=pecas_entregues,
    )
