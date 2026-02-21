"""
Service do Dashboard - agregações de pedidos.
"""
from datetime import date
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.domains.pedidos.models import Pedido, TipoPedido


def _parse_mes(mes: str) -> tuple[int, int]:
    """mes = YYYYMM -> (ano, mes)"""
    if len(mes) != 6:
        y, m = date.today().year, date.today().month
        return y, m
    return int(mes[:4]), int(mes[4:6])


def get_kpis(db: Session, mes: str) -> Dict[str, Any]:
    """KPIs do mês: faturamento, horas, quantidade, etc."""
    ano, num_mes = _parse_mes(mes)
    from datetime import datetime
    inicio = date(ano, num_mes, 1)
    if num_mes == 12:
        fim = date(ano + 1, 1, 1)
    else:
        fim = date(ano, num_mes + 1, 1)

    # Ambos usam data_entrega no mês (mesmo "pool" de pedidos).
    # Real = entregues; Potencial = todos não-orçamento (entregue + em andamento).
    # Assim Potencial >= Real sempre.

    # Faturamento parcial (entregues no mês)
    fat_entregue = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )

    # Faturamento potencial (todos com data_entrega no mês, exc. Orçamento/Canelado)
    fat_potencial = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.data_entrega.isnot(None),
            Pedido.status.notin_(("Orçamento", "Canelado")),
        )
        .scalar() or 0
    )
    # Garantir Potencial >= Real (caso haja inconsistência)
    fat_potencial = max(float(fat_potencial), float(fat_entregue))

    # Horas trabalhadas (entregues no mês)
    horas = (
        db.query(func.coalesce(func.sum(Pedido.horas_trabalho), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )

    # Horas potencial (todos com data_entrega no mês, exc. Orçamento/Canelado)
    horas_potencial = (
        db.query(func.coalesce(func.sum(Pedido.horas_trabalho), 0))
        .filter(
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.data_entrega.isnot(None),
            Pedido.status.notin_(("Orçamento", "Canelado")),
        )
        .scalar() or 0
    )
    horas_potencial = max(float(horas_potencial), float(horas))

    # Margem Mês: média ponderada de margem_real por valor_pecas (entregues com margem)
    # Fórmula: SUM(valor_pecas * margem_real) / SUM(valor_pecas)
    sum_valor_margem = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas * Pedido.margem_real), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.margem_real.isnot(None),
        )
        .scalar() or 0
    )
    sum_valor = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.margem_real.isnot(None),
        )
        .scalar() or 0
    )
    margem_mes = (
        round(float(sum_valor_margem) / float(sum_valor), 2) if sum_valor else 0
    )

    # Quantidade de peças entregues (soma de quantidade_pecas; NULL = 1)
    qtd_entregues = (
        db.query(func.coalesce(func.sum(func.coalesce(Pedido.quantidade_pecas, 1)), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )

    return {
        "mes": mes,
        "faturamento_parcial": round(float(fat_entregue), 2),
        "faturamento_potencial": round(float(fat_potencial), 2),
        "horas_trabalhadas": round(float(horas), 2),
        "horas_potencial": round(float(horas_potencial), 2),
        "margem_mes": margem_mes,
        "quantidade_entregues": int(qtd_entregues),
    }


def get_mix_status(db: Session, mes: str) -> List[Dict[str, Any]]:
    """Mix de status dos pedidos com data_entrega no mês (para donut)."""
    ano, num_mes = _parse_mes(mes)
    inicio = date(ano, num_mes, 1)
    if num_mes == 12:
        fim = date(ano + 1, 1, 1)
    else:
        fim = date(ano, num_mes + 1, 1)

    rows = (
        db.query(Pedido.status, func.count(Pedido.id))
        .filter(
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.data_entrega.isnot(None),
            Pedido.status.notin_(("Orçamento", "Canelado")),
        )
        .group_by(Pedido.status)
        .all()
    )
    return [{"status": r[0], "quantidade": r[1]} for r in rows]


def get_lucro_mensal(
    db: Session, meses: int = 12, year: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Lucro (valor_pecas) por mês. Se year informado, retorna 12 meses do ano."""
    result = []
    if year is not None:
        for num_mes in range(1, 13):
            inicio = date(year, num_mes, 1)
            if num_mes == 12:
                fim = date(year + 1, 1, 1)
            else:
                fim = date(year, num_mes + 1, 1)
            total = (
                db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
                .filter(
                    Pedido.status == "Entregue",
                    Pedido.data_entrega >= inicio,
                    Pedido.data_entrega < fim,
                )
                .scalar() or 0
            )
            result.append({
                "mes": f"{year}{num_mes:02d}",
                "label": f"{num_mes:02d}/{year}",
                "valor": round(float(total), 2),
            })
        return result
    hoje = date.today()
    for i in range(meses):
        ano = hoje.year
        num_mes = hoje.month - i
        while num_mes <= 0:
            num_mes += 12
            ano -= 1
        inicio = date(ano, num_mes, 1)
        if num_mes == 12:
            fim = date(ano + 1, 1, 1)
        else:
            fim = date(ano, num_mes + 1, 1)
        total = (
            db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
            .filter(
                Pedido.status == "Entregue",
                Pedido.data_entrega >= inicio,
                Pedido.data_entrega < fim,
            )
            .scalar() or 0
        )
        result.append({
            "mes": f"{ano}{num_mes:02d}",
            "label": f"{num_mes:02d}/{ano}",
            "valor": round(float(total), 2),
        })
    return list(reversed(result))  # cronológico: mais antigo → mais recente


def get_pecas_entregues_por_tipo(db: Session, mes: str) -> List[Dict[str, Any]]:
    """Peças entregues no mês por tipo de pedido."""
    ano, num_mes = _parse_mes(mes)
    inicio = date(ano, num_mes, 1)
    if num_mes == 12:
        fim = date(ano + 1, 1, 1)
    else:
        fim = date(ano, num_mes + 1, 1)

    rows = (
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
    return [
        {"tipo": r[0], "quantidade": int(r[1]), "valor": round(float(r[2]), 2)}
        for r in rows
    ]


def _get_year_range(ano: int):
    """Retorna (inicio, fim) para um ano inteiro."""
    return date(ano, 1, 1), date(ano + 1, 1, 1)


def get_kpis_year(db: Session, ano: int) -> Dict[str, Any]:
    """KPIs do ano inteiro (YTD). Mesma lógica: data_entrega, Potencial >= Real."""
    inicio, fim = _get_year_range(ano)
    fat_entregue = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )
    fat_potencial = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.data_entrega.isnot(None),
            Pedido.status.notin_(("Orçamento", "Canelado")),
        )
        .scalar() or 0
    )
    fat_potencial = max(float(fat_potencial), float(fat_entregue))
    horas = (
        db.query(func.coalesce(func.sum(Pedido.horas_trabalho), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )
    horas_potencial = (
        db.query(func.coalesce(func.sum(Pedido.horas_trabalho), 0))
        .filter(
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.data_entrega.isnot(None),
            Pedido.status.notin_(("Orçamento", "Canelado")),
        )
        .scalar() or 0
    )
    horas_potencial = max(float(horas_potencial), float(horas))
    sum_valor_margem = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas * Pedido.margem_real), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.margem_real.isnot(None),
        )
        .scalar() or 0
    )
    sum_valor = (
        db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.margem_real.isnot(None),
        )
        .scalar() or 0
    )
    margem_mes = (
        round(float(sum_valor_margem) / float(sum_valor), 2) if sum_valor else 0
    )
    # Quantidade de peças entregues (soma de quantidade_pecas; NULL = 1)
    qtd_entregues = (
        db.query(func.coalesce(func.sum(func.coalesce(Pedido.quantidade_pecas, 1)), 0))
        .filter(
            Pedido.status == "Entregue",
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
        )
        .scalar() or 0
    )
    return {
        "ano": str(ano),
        "faturamento_parcial": round(float(fat_entregue), 2),
        "faturamento_potencial": round(float(fat_potencial), 2),
        "horas_trabalhadas": round(float(horas), 2),
        "horas_potencial": round(float(horas_potencial), 2),
        "margem_mes": margem_mes,
        "quantidade_entregues": int(qtd_entregues),
    }


def get_mix_status_year(db: Session, ano: int) -> List[Dict[str, Any]]:
    """Mix de status do ano (para donut) - por data_entrega."""
    inicio, fim = _get_year_range(ano)
    rows = (
        db.query(Pedido.status, func.count(Pedido.id))
        .filter(
            Pedido.data_entrega >= inicio,
            Pedido.data_entrega < fim,
            Pedido.data_entrega.isnot(None),
            Pedido.status.notin_(("Orçamento", "Canelado")),
        )
        .group_by(Pedido.status)
        .all()
    )
    return [{"status": r[0], "quantidade": r[1]} for r in rows]


def get_pecas_entregues_por_tipo_year(db: Session, ano: int) -> List[Dict[str, Any]]:
    """Peças entregues no ano por tipo."""
    inicio, fim = _get_year_range(ano)
    rows = (
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
    return [
        {"tipo": r[0], "quantidade": int(r[1]), "valor": round(float(r[2]), 2)}
        for r in rows
    ]
