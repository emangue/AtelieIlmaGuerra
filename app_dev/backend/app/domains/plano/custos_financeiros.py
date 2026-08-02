"""
Custo de receber de um pedido: taxa de cartão e desconto Pix.

Os dois têm a mesma mecânica — o faturamento fica **bruto** (a parcela vale o valor
cheio da peça) e o custo vira uma despesa automática, que é o que aparece no saldo
do mês e como custo na margem. Por isso uma função só, não duas quase iguais.
"""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.domains.parametros.taxas import FORMA_CARTAO, FORMA_PIX, resolver_percentual

ORIGEM_TAXA_CARTAO = "taxa_cartao"
ORIGEM_DESCONTO_PIX = "desconto_pix"
ORIGENS_CUSTO = (ORIGEM_TAXA_CARTAO, ORIGEM_DESCONTO_PIX)

TIPO_ITEM_TAXA_CARTAO = "Taxa de cartão"
TIPO_ITEM_DESCONTO_PIX = "Desconto Pix"

CATEGORIA_CUSTO = "Custo Variável"

# "Cartão de Crédito" é o rótulo legado de registros antigos.
_FORMAS_CARTAO = {"cartão parcelado", "cartao parcelado", "cartão de crédito", "cartao de credito"}
_FORMAS_PIX = {"pix"}


def is_cartao(forma: Optional[str]) -> bool:
    return (forma or "").strip().lower() in _FORMAS_CARTAO


def is_pix(forma: Optional[str]) -> bool:
    return (forma or "").strip().lower() in _FORMAS_PIX


def _round(valor) -> float:
    return float(Decimal(str(valor or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class ResumoFormas:
    """Quanto do pedido foi por cada forma, a partir das parcelas de receita."""

    def __init__(self, parcelas: Iterable):
        parcelas = list(parcelas)
        self.total = _round(sum(p.valor or 0 for p in parcelas))
        self.valor_cartao = _round(sum(p.valor or 0 for p in parcelas if is_cartao(p.forma_pagamento)))
        self.valor_pix = _round(sum(p.valor or 0 for p in parcelas if is_pix(p.forma_pagamento)))
        self.n_parcelas_cartao = sum(1 for p in parcelas if is_cartao(p.forma_pagamento))
        # Tudo-ou-nada: o desconto de Pix é pensado para pagamento inteiro em Pix.
        self.pago_100_pct_pix = bool(parcelas) and self.valor_pix > 0 and self.valor_pix == self.total


def calcular_custos(db: Session, pedido, parcelas: Iterable) -> dict:
    """Calcula taxa de cartão e desconto Pix do pedido.

    Respeita os flags `*_manual`: se a Ilma digitou o valor, ele é mantido. O
    desconto de Pix só é calculado automaticamente quando o pedido é 100% Pix,
    mas um valor manual é sempre respeitado — a regra é o padrão, não uma trava.
    """
    resumo = ResumoFormas(parcelas)

    if pedido.taxa_cartao_manual:
        taxa_pct = pedido.taxa_cartao_percentual
        taxa_valor = _round(pedido.taxa_cartao_valor)
    elif resumo.valor_cartao > 0:
        taxa_pct = resolver_percentual(db, FORMA_CARTAO, pedido.canal_cartao, resumo.n_parcelas_cartao)
        taxa_valor = _round(resumo.valor_cartao * taxa_pct / 100)
    else:
        taxa_pct, taxa_valor = None, 0.0

    if pedido.desconto_pix_manual:
        pix_pct = pedido.desconto_pix_percentual
        pix_valor = _round(pedido.desconto_pix_valor)
    elif resumo.pago_100_pct_pix:
        pix_pct = resolver_percentual(db, FORMA_PIX)
        pix_valor = _round(resumo.valor_pix * pix_pct / 100)
    else:
        pix_pct, pix_valor = None, 0.0

    return {
        "taxa_cartao_percentual": taxa_pct,
        "taxa_cartao_valor": taxa_valor,
        "desconto_pix_percentual": pix_pct,
        "desconto_pix_valor": pix_valor,
        "base_cartao": resumo.valor_cartao,
        "base_pix": resumo.valor_pix,
        "pago_100_pct_pix": resumo.pago_100_pct_pix,
    }


def aplicar_custos(db: Session, pedido, parcelas: Iterable) -> dict:
    """Recalcula os custos e grava no pedido. Não cria as despesas — ver sync_custos_financeiros."""
    custos = calcular_custos(db, pedido, parcelas)
    pedido.taxa_cartao_percentual = custos["taxa_cartao_percentual"]
    pedido.taxa_cartao_valor = custos["taxa_cartao_valor"]
    pedido.desconto_pix_percentual = custos["desconto_pix_percentual"]
    pedido.desconto_pix_valor = custos["desconto_pix_valor"]
    return custos


def custo_receber_total(pedido) -> float:
    """Custo de receber em R$ usado na margem.

    Fallback para pedidos anteriores à mudança, que não têm as colunas preenchidas:
    reproduz o comportamento antigo (taxa sobre o valor cheio) apenas quando a forma
    de pagamento era cartão, para não alterar a margem histórica desses pedidos.
    """
    if pedido.taxa_cartao_valor is not None or pedido.desconto_pix_valor is not None:
        return _round((pedido.taxa_cartao_valor or 0) + (pedido.desconto_pix_valor or 0))
    if is_cartao(pedido.forma_pagamento):
        return _round((pedido.valor_pecas or 0) * (pedido.param_cartao_credito or 0))
    return 0.0


def _upsert_despesa(
    db: Session,
    pedido,
    origem: str,
    tipo_item: str,
    valor: float,
    data_custo: Optional[date],
    descricao: str,
    pagamento_pai_id: Optional[int] = None,
):
    """Cria, atualiza ou remove a despesa de custo. Idempotente."""
    from .pagamentos_model import Pagamento

    query = db.query(Pagamento).filter(
        Pagamento.origem == origem,
        Pagamento.pedido_id == pedido.id,
    )
    if pagamento_pai_id is not None:
        query = query.filter(Pagamento.pagamento_pai_id == pagamento_pai_id)
    else:
        query = query.filter(Pagamento.pagamento_pai_id.is_(None))
    existente = query.first()

    if not valor or valor <= 0 or data_custo is None:
        if existente:
            db.delete(existente)
        return None

    anomes = f"{data_custo.year}{data_custo.month:02d}"
    dados = {
        "anomes": anomes,
        "data_vencimento": data_custo,
        "data_pagamento": data_custo,
        "categoria": CATEGORIA_CUSTO,
        "tipo_item": tipo_item,
        "valor": valor,
        "descricao": descricao,
    }
    if existente:
        for campo, val in dados.items():
            setattr(existente, campo, val)
        return existente

    nova = Pagamento(
        tipo="despesa",
        origem=origem,
        pedido_id=pedido.id,
        pagamento_pai_id=pagamento_pai_id,
        **dados,
    )
    db.add(nova)
    return nova


def _descricao_base(pedido) -> str:
    tipo_nome = pedido.tipo_pedido.nome if pedido.tipo_pedido else "Pedido"
    cliente_nome = pedido.cliente.nome if pedido.cliente else ""
    return f"{tipo_nome} · {cliente_nome}" if cliente_nome else tipo_nome


def sync_custos_financeiros(db: Session, pedido) -> None:
    """Mantém as despesas de custo de receber alinhadas ao pedido.

    Timing diferente entre os dois: a data da compra no cartão é conhecida na
    criação, então a despesa da taxa nasce junto. A data do Pix só existe quando a
    parcela é confirmada — até lá o valor está no pedido, mas sem lançamento.
    """
    from .pagamentos_model import Pagamento

    parcelas = (
        db.query(Pagamento)
        .filter(
            Pagamento.pedido_id == pedido.id,
            Pagamento.tipo == "receita",
            Pagamento.origem == "pedido",
        )
        .order_by(Pagamento.parcela_numero.asc().nullslast(), Pagamento.id.asc())
        .all()
    )
    base_desc = _descricao_base(pedido)

    data_cartao = pedido.data_compra_cartao
    if data_cartao is None:
        primeira_cartao = next((p for p in parcelas if is_cartao(p.forma_pagamento) and p.data_vencimento), None)
        if primeira_cartao:
            from datetime import timedelta
            data_cartao = primeira_cartao.data_vencimento - timedelta(days=30)

    _upsert_despesa(
        db, pedido, ORIGEM_TAXA_CARTAO, TIPO_ITEM_TAXA_CARTAO,
        valor=_round(pedido.taxa_cartao_valor),
        data_custo=data_cartao,
        descricao=f"Taxa de cartão · {base_desc}",
    )

    # Desconto Pix só vira lançamento quando o Pix efetivamente entrou.
    primeira_pix_paga = next(
        (p for p in parcelas if is_pix(p.forma_pagamento) and p.data_pagamento), None
    )
    _upsert_despesa(
        db, pedido, ORIGEM_DESCONTO_PIX, TIPO_ITEM_DESCONTO_PIX,
        valor=_round(pedido.desconto_pix_valor),
        data_custo=primeira_pix_paga.data_pagamento if primeira_pix_paga else None,
        descricao=f"Desconto Pix · {base_desc}",
    )


def sync_custo_adiantamento(db: Session, pedido, parcela) -> None:
    """Despesa do desconto dado ao antecipar o recebimento de uma parcela.

    É **adicional** à taxa flat do pedido: a adquirente cobra a taxa da compra de
    qualquer jeito, e o custo de antecipação vem por cima.
    """
    _upsert_despesa(
        db, pedido, ORIGEM_TAXA_CARTAO, TIPO_ITEM_TAXA_CARTAO,
        valor=_round(parcela.desconto_adiantamento),
        data_custo=parcela.data_pagamento,
        descricao=f"Antecipação parcela {parcela.parcela_numero or ''} · {_descricao_base(pedido)}".replace("  ", " "),
        pagamento_pai_id=parcela.id,
    )
