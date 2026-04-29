"""
Router do domínio Plano (receitas e despesas planejadas).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from .models import PlanoItem
from .schemas import (
    PlanoItemOut,
    PlanoResumoMes,
    PlanoItemUpdate,
    PlanoItemCreate,
    DespesaRealizadaItem,
    OpcaoDespesa,
    MovimentacaoItem,
    MovimentacoesResponse,
)
from .service import get_plano_vs_realizado

router = APIRouter(prefix="/plano", tags=["Plano"])


@router.get("", response_model=List[PlanoItemOut])
def list_plano(
    anomes: Optional[str] = Query(None, description="YYYYMM - filtrar por mês"),
    tipo: Optional[str] = Query(None, description="receita | despesa"),
    ano: Optional[int] = Query(None, description="Ano (ex: 2026) - todos os meses do ano"),
    db: Session = Depends(get_db),
):
    """Lista itens do plano. valor_realizado de despesas = soma das transações."""
    from .transacoes_models import DespesaTransacao

    q = db.query(PlanoItem)
    if anomes:
        q = q.filter(PlanoItem.anomes == anomes)
    if ano:
        q = q.filter(PlanoItem.anomes.like(f"{ano}%"))
    if tipo:
        q = q.filter(PlanoItem.tipo == tipo)
    q = q.order_by(PlanoItem.anomes, PlanoItem.tipo, PlanoItem.categoria, PlanoItem.tipo_item)
    itens = q.all()

    # valor_realizado de despesas = soma das transações
    if itens:
        meses = list({i.anomes for i in itens})
        trans = (
            db.query(DespesaTransacao.plano_item_id, func.coalesce(func.sum(DespesaTransacao.valor), 0).label("total"))
            .filter(DespesaTransacao.anomes.in_(meses))
            .group_by(DespesaTransacao.plano_item_id)
        )
        trans_map = {r.plano_item_id: float(r.total) for r in trans}
        for i in itens:
            if i.tipo == "despesa":
                i.valor_realizado = trans_map.get(i.id) if i.id in trans_map else (i.valor_realizado or 0)

    return itens


@router.get("/resumo-mensal", response_model=List[PlanoResumoMes])
def resumo_mensal(
    ano: Optional[int] = Query(None, description="Ano (ex: 2026). Default: ano atual"),
    db: Session = Depends(get_db),
):
    """Resumo por mês: planejado e realizado (receita de pedidos, despesas de transações)."""
    from datetime import date
    from .transacoes_models import DespesaTransacao
    from app.domains.pedidos.models import Pedido, TipoPedido

    y = ano or date.today().year
    prefix = str(y)

    # Receita planejada por mês
    rec = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.tipo == "receita", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    rec_map = {r.anomes: float(r.total) for r in rec}

    # Despesas planejadas por mês
    desp = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.tipo == "despesa", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    desp_map = {d.anomes: float(d.total) for d in desp}

    # Despesas realizadas: transações por mês (ou fallback valor_realizado legado)
    trans = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(DespesaTransacao.valor), 0).label("total"))
        .join(DespesaTransacao, DespesaTransacao.plano_item_id == PlanoItem.id)
        .filter(PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    trans_map = {t.anomes: float(t.total) for t in trans}
    # Fallback: valor_realizado em plano_itens (dados legados)
    desp_real_legado = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_realizado), 0).label("total"))
        .filter(PlanoItem.tipo == "despesa", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    for r in desp_real_legado:
        if trans_map.get(r.anomes, 0) == 0 and float(r.total) > 0:
            trans_map[r.anomes] = float(r.total)

    # Receita realizada (pedidos entregues) por mês - simplificado
    rec_real = {}
    for m in range(1, 13):
        anomes = f"{y}{m:02d}"
        ano_i, mes_i = int(anomes[:4]), int(anomes[4:6])
        inicio = date(ano_i, mes_i, 1)
        fim = date(ano_i + 1, 1, 1) if mes_i == 12 else date(ano_i, mes_i + 1, 1)
        tot = (
            db.query(func.coalesce(func.sum(Pedido.valor_pecas), 0))
            .join(TipoPedido)
            .filter(Pedido.status == "Entregue", Pedido.data_entrega >= inicio, Pedido.data_entrega < fim)
            .scalar() or 0
        )
        rec_real[anomes] = float(tot)

    meses = sorted(set(rec_map.keys()) | set(desp_map.keys()))
    return [
        PlanoResumoMes(
            anomes=m,
            receita_planejada=rec_map.get(m, 0),
            despesas_planejadas=desp_map.get(m, 0),
            lucro_planejado=rec_map.get(m, 0) - desp_map.get(m, 0),
            receita_realizada=rec_real.get(m, 0),
            despesas_realizadas=trans_map.get(m, 0),
            lucro_realizado=rec_real.get(m, 0) - trans_map.get(m, 0),
        )
        for m in meses
    ]


@router.get("/despesas-realizadas", response_model=List[DespesaRealizadaItem])
def list_despesas_realizadas(
    mes: str = Query(..., description="YYYYMM - mês de referência"),
    db: Session = Depends(get_db),
):
    """Lista despesas realizadas do plano no mês (soma das transações ou valor_realizado legado)."""
    from .transacoes_models import DespesaTransacao

    if len(mes) != 6 or not mes.isdigit():
        return []
    trans_soma = (
        db.query(DespesaTransacao.plano_item_id, func.coalesce(func.sum(DespesaTransacao.valor), 0).label("total"))
        .filter(DespesaTransacao.anomes == mes)
        .group_by(DespesaTransacao.plano_item_id)
    )
    trans_map = {r.plano_item_id: float(r.total) for r in trans_soma}

    itens = (
        db.query(PlanoItem)
        .filter(PlanoItem.anomes == mes, PlanoItem.tipo == "despesa")
        .order_by(PlanoItem.categoria, PlanoItem.tipo_item, PlanoItem.detalhe)
        .all()
    )
    result = []
    for i in itens:
        real = trans_map.get(i.id, float(i.valor_realizado or 0))
        if real > 0:
            result.append(
                DespesaRealizadaItem(
                    id=i.id,
                    tipo_item=i.tipo_item,
                    detalhe=i.detalhe,
                    valor_realizado=real,
                    categoria=i.categoria,
                )
            )
    return result


@router.get("/plano-vs-realizado")
def plano_vs_realizado(
    mes: Optional[str] = Query(None, description="YYYYMM (default: mês atual)"),
    db: Session = Depends(get_db),
):
    """Plano vs realizado para o painel (card colapsável)."""
    from datetime import date
    if not mes:
        d = date.today()
        mes = f"{d.year}{d.month:02d}"
    return get_plano_vs_realizado(db, mes)


@router.get("/evolucao-mensal")
def evolucao_mensal(
    mes: Optional[str] = Query(None, description="YYYYMM - mês de referência (default: atual)"),
    meses: int = Query(7, ge=3, le=12, description="Quantidade de meses para trás"),
    db: Session = Depends(get_db),
):
    """Evolução mensal: plano vs realizado para os últimos N meses (gráfico Comparação Mensal). Inclui o mês selecionado (ex.: fevereiro parcial)."""
    from datetime import date
    from .service import get_plano_vs_realizado
    if not mes:
        d = date.today()
        mes = f"{d.year}{d.month:02d}"
    ano, num_mes = int(mes[:4]), int(mes[4:6])
    # Incluir o mês selecionado (parcial) e ir para trás
    MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    result = []
    for _ in range(meses):
        anomes = f"{ano}{num_mes:02d}"
        data = get_plano_vs_realizado(db, anomes)
        result.append({
            "anomes": anomes,
            "label": MESES_ABREV[num_mes - 1],
            "receita_planejada": data.receita_planejada,
            "receita_realizada": data.receita_realizada,
        })
        num_mes -= 1
        if num_mes < 1:
            num_mes = 12
            ano -= 1
    return list(reversed(result))


@router.get("/detalhes")
def get_detalhes(
    tipo: Optional[str] = Query(None, description="receita | despesa"),
    db: Session = Depends(get_db),
):
    """Retorna lista de detalhes únicos cadastrados no plano (para uso no formulário)."""
    q = db.query(PlanoItem.detalhe).filter(
        PlanoItem.detalhe.isnot(None),
        PlanoItem.detalhe != "",
    )
    if tipo:
        q = q.filter(PlanoItem.tipo == tipo)
    detalhes = sorted(set(d[0] for d in q.distinct().all() if d[0]))
    return detalhes


@router.post("/copiar-mes", status_code=201)
def copiar_mes(
    mes_origem: str = Query(..., description="YYYYMM - mês de origem"),
    mes_destino: str = Query(..., description="YYYYMM - mês de destino"),
    db: Session = Depends(get_db),
):
    """Copia os itens de plano de um mês para outro (apenas valor_planejado, zera valor_realizado)."""
    for m in (mes_origem, mes_destino):
        if len(m) != 6 or not m.isdigit():
            raise HTTPException(status_code=400, detail=f"Mês inválido: {m}. Use o formato YYYYMM.")
    if mes_origem == mes_destino:
        raise HTTPException(status_code=400, detail="Mês de origem e destino não podem ser iguais.")
    existing = db.query(PlanoItem).filter(PlanoItem.anomes == mes_destino).count()
    if existing > 0:
        raise HTTPException(status_code=400, detail="O mês de destino já possui itens no plano.")
    itens_origem = db.query(PlanoItem).filter(PlanoItem.anomes == mes_origem).all()
    if not itens_origem:
        raise HTTPException(status_code=404, detail="Nenhum item encontrado no mês de origem.")
    novos = [
        PlanoItem(
            anomes=mes_destino,
            tipo=i.tipo,
            categoria=i.categoria,
            tipo_item=i.tipo_item,
            detalhe=i.detalhe,
            valor_planejado=i.valor_planejado,
            valor_realizado=None,
        )
        for i in itens_origem
    ]
    db.add_all(novos)
    db.commit()
    return {"copiados": len(novos), "mes_destino": mes_destino}


@router.patch("/{item_id}", response_model=PlanoItemOut)
def update_plano_item(
    item_id: int,
    data: PlanoItemUpdate,
    db: Session = Depends(get_db),
):
    """Atualiza item do plano (valor_planejado, quantidade, etc). valor_realizado vem das transações."""
    item = db.query(PlanoItem).filter(PlanoItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    if data.valor_planejado is not None:
        item.valor_planejado = data.valor_planejado
    if data.quantidade is not None:
        item.quantidade = data.quantidade
    if data.ticket_medio is not None:
        item.ticket_medio = data.ticket_medio
    if data.detalhe is not None:
        item.detalhe = data.detalhe
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_plano_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Remove item do plano."""
    item = db.query(PlanoItem).filter(PlanoItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(item)
    db.commit()


@router.get("/opcoes-despesa", response_model=List[OpcaoDespesa])
def get_opcoes_despesa(
    mes: str = Query(..., description="YYYYMM - mês de referência"),
    db: Session = Depends(get_db),
):
    """Opções para dropdown ao adicionar despesa realizada (detalhe + tipo_item do plano)."""
    if len(mes) != 6 or not mes.isdigit():
        return []
    itens = (
        db.query(PlanoItem)
        .filter(PlanoItem.anomes == mes, PlanoItem.tipo == "despesa")
        .order_by(PlanoItem.categoria, PlanoItem.tipo_item, PlanoItem.detalhe)
        .all()
    )
    seen = set()
    opcoes = []
    for i in itens:
        key = (i.tipo_item, i.detalhe or "")
        if key in seen:
            continue
        seen.add(key)
        label = f"{i.detalhe or i.tipo_item} ({i.tipo_item})" if i.detalhe else i.tipo_item
        opcoes.append(
            OpcaoDespesa(
                plano_item_id=i.id,
                label=label,
                tipo_item=i.tipo_item,
                detalhe=i.detalhe,
                categoria=i.categoria,
            )
        )
    # Incluir categorias do catálogo que não estão no mês (distinct do plano)
    todos = (
        db.query(PlanoItem.tipo_item, PlanoItem.detalhe, PlanoItem.categoria)
        .filter(PlanoItem.tipo == "despesa")
        .distinct()
        .all()
    )
    for tipo_item, detalhe, categoria in todos:
        key = (tipo_item, detalhe or "")
        if key in seen:
            continue
        seen.add(key)
        label = f"{detalhe or tipo_item} ({tipo_item})" if detalhe else tipo_item
        opcoes.append(
            OpcaoDespesa(
                plano_item_id=None,
                label=label,
                tipo_item=tipo_item,
                detalhe=detalhe,
                categoria=categoria,
            )
        )
    return opcoes


@router.post("/aplicar-aos-futuros", status_code=201)
def aplicar_aos_futuros(
    mes_referencia: str = Query(..., description="YYYYMM - mês onde foi feito o ajuste"),
    item_id: Optional[int] = Query(None, description="ID do item (aplica só esse)"),
    ate_mes: Optional[str] = Query(None, description="Último mês (default: fim do ano)"),
    criar_ausentes: bool = Query(True, description="Criar itens nos meses que não tiverem"),
    db: Session = Depends(get_db),
):
    """Aplica valor_planejado do(s) item(ns) do mês de referência aos meses futuros."""
    from datetime import date
    for m in (mes_referencia, ate_mes or ""):
        if m and (len(m) != 6 or not m.isdigit()):
            raise HTTPException(status_code=400, detail=f"Mês inválido: {m}")
    ano_ref = int(mes_referencia[:4])
    mes_ref_num = int(mes_referencia[4:6])
    ate = ate_mes or f"{ano_ref}12"
    ano_ate = int(ate[:4])
    mes_ate_num = int(ate[4:6])

    itens_ref = db.query(PlanoItem).filter(PlanoItem.anomes == mes_referencia)
    if item_id:
        itens_ref = itens_ref.filter(PlanoItem.id == item_id)
    itens_ref = itens_ref.all()
    if not itens_ref:
        raise HTTPException(status_code=404, detail="Nenhum item encontrado no mês de referência.")

    aplicados = 0
    ano, mes_num = ano_ref, mes_ref_num
    while (ano, mes_num) <= (ano_ate, mes_ate_num):
        anomes = f"{ano}{mes_num:02d}"
        if anomes <= mes_referencia:
            mes_num += 1
            if mes_num > 12:
                mes_num = 1
                ano += 1
            continue
        for i in itens_ref:
            existente = (
                db.query(PlanoItem)
                .filter(
                    PlanoItem.anomes == anomes,
                    PlanoItem.tipo == i.tipo,
                    PlanoItem.tipo_item == i.tipo_item,
                    PlanoItem.detalhe == i.detalhe,
                )
                .first()
            )
            if existente:
                existente.valor_planejado = i.valor_planejado
                aplicados += 1
            elif criar_ausentes:
                novo = PlanoItem(
                    anomes=anomes,
                    tipo=i.tipo,
                    categoria=i.categoria,
                    tipo_item=i.tipo_item,
                    detalhe=i.detalhe,
                    valor_planejado=i.valor_planejado,
                    valor_realizado=None,
                )
                db.add(novo)
                aplicados += 1
        mes_num += 1
        if mes_num > 12:
            mes_num = 1
            ano += 1

    db.commit()
    return {"aplicados": aplicados, "ate_mes": ate}


@router.get("/movimentacoes", response_model=MovimentacoesResponse)
def get_movimentacoes(
    mes: str = Query(..., description="YYYYMM"),
    db: Session = Depends(get_db),
):
    """Lista unificada de receitas (pedidos entregues) e despesas (transações) do mês."""
    if len(mes) != 6 or not mes.isdigit():
        raise HTTPException(status_code=422, detail="mes deve ser YYYYMM")

    from app.domains.pedidos.models import Pedido
    from .transacoes_models import DespesaTransacao
    from calendar import monthrange

    ano  = int(mes[:4])
    m    = int(mes[4:])
    ultimo_dia = monthrange(ano, m)[1]
    data_ini = f"{ano:04d}-{m:02d}-01"
    data_fim = f"{ano:04d}-{m:02d}-{ultimo_dia:02d}"

    ICON_MAP = {
        "Colaboradores": "colab",
        "Espaço Físico": "espaco",
        "Transporte": "transp",
        "Contas": "contas",
        "Maquinário": "maq",
        "Marketing": "marketing",
    }

    itens: list[MovimentacaoItem] = []

    # ── Receitas: pedidos entregues no mês ──────────────────
    pedidos = (
        db.query(Pedido)
        .filter(
            Pedido.data_entrega >= data_ini,
            Pedido.data_entrega <= data_fim,
            Pedido.status == "Entregue",
        )
        .all()
    )
    for p in pedidos:
        cliente_nome = p.cliente.nome if p.cliente else ""
        tipo_nome    = p.tipo_pedido.nome if p.tipo_pedido else "Pedido"
        descricao    = f"{tipo_nome} · {cliente_nome}" if cliente_nome else tipo_nome
        itens.append(MovimentacaoItem(
            id=p.id,
            origem="pedido",
            tipo="receita",
            descricao=descricao,
            categoria="Receita · Pedido entregue",
            valor=float(p.valor_pecas or 0),
            data=str(p.data_entrega) if p.data_entrega else None,
            icon_key="receita",
        ))

    # ── Despesas: transações do mês ─────────────────────────
    transacoes = (
        db.query(DespesaTransacao)
        .filter(DespesaTransacao.anomes == mes)
        .all()
    )
    for t in transacoes:
        plano = t.plano_item
        tipo_item = plano.tipo_item if plano else ""
        detalhe   = plano.detalhe   if plano else ""
        descricao = f"{detalhe} · {tipo_item}" if detalhe else (tipo_item or "Despesa")
        categoria = f"Despesa · {plano.categoria}" if plano and plano.categoria else "Despesa"
        icon_key  = ICON_MAP.get(tipo_item, "outros")
        # data: usa a data da transação ou, como default, o último dia do mês
        data_tx = str(t.data) if t.data else data_fim
        itens.append(MovimentacaoItem(
            id=t.id,
            origem="transacao",
            tipo="despesa",
            descricao=descricao,
            categoria=categoria,
            valor=float(t.valor or 0),
            data=data_tx,
            icon_key=icon_key,
        ))

    # ── Ordenação: com data DESC, sem data por último ───────
    com_data  = sorted([i for i in itens if i.data],     key=lambda x: x.data, reverse=True)  # type: ignore[arg-type]
    sem_data  = sorted([i for i in itens if not i.data], key=lambda x: x.descricao)
    itens_ord = com_data + sem_data

    total_rec  = sum(i.valor for i in itens if i.tipo == "receita")
    total_desp = sum(i.valor for i in itens if i.tipo == "despesa")

    return MovimentacoesResponse(
        mes=mes,
        total_receitas=total_rec,
        total_despesas=total_desp,
        saldo=total_rec - total_desp,
        itens=itens_ord,
    )


@router.post("", response_model=PlanoItemOut, status_code=201)
def create_plano_item(
    data: PlanoItemCreate,
    db: Session = Depends(get_db),
):
    """Cria novo item no plano (receita ou despesa)."""
    if len(data.anomes) != 6 or not data.anomes.isdigit():
        raise HTTPException(status_code=400, detail="anomes deve ser YYYYMM")
    if data.tipo not in ("receita", "despesa"):
        raise HTTPException(status_code=400, detail="tipo deve ser receita ou despesa")
    categoria = data.categoria or ("Receita" if data.tipo == "receita" else "Custo Fixo")
    item = PlanoItem(
        anomes=data.anomes,
        tipo=data.tipo,
        categoria=categoria,
        tipo_item=data.tipo_item,
        detalhe=data.detalhe,
        valor_planejado=data.valor_planejado,
        valor_realizado=data.valor_realizado,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
