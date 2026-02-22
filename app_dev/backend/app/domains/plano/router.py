"""
Router do domínio Plano (receitas e despesas planejadas).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from .models import PlanoItem
from .schemas import PlanoItemOut, PlanoResumoMes, PlanoItemUpdateRealizado, PlanoItemCreate, DespesaRealizadaItem
from .service import get_plano_vs_realizado

router = APIRouter(prefix="/plano", tags=["Plano"])


@router.get("", response_model=List[PlanoItemOut])
def list_plano(
    anomes: Optional[str] = Query(None, description="YYYYMM - filtrar por mês"),
    tipo: Optional[str] = Query(None, description="receita | despesa"),
    ano: Optional[int] = Query(None, description="Ano (ex: 2026) - todos os meses do ano"),
    db: Session = Depends(get_db),
):
    """Lista itens do plano. Filtros: anomes, tipo, ano."""
    q = db.query(PlanoItem)
    if anomes:
        q = q.filter(PlanoItem.anomes == anomes)
    if ano:
        q = q.filter(PlanoItem.anomes.like(f"{ano}%"))
    if tipo:
        q = q.filter(PlanoItem.tipo == tipo)
    q = q.order_by(PlanoItem.anomes, PlanoItem.tipo, PlanoItem.categoria, PlanoItem.tipo_item)
    return q.all()


@router.get("/resumo-mensal", response_model=List[PlanoResumoMes])
def resumo_mensal(
    ano: Optional[int] = Query(None, description="Ano (ex: 2026). Default: ano atual"),
    db: Session = Depends(get_db),
):
    """Resumo por mês: receita planejada, despesas planejadas, lucro planejado."""
    from datetime import date
    y = ano or date.today().year
    prefix = str(y)

    # Receita por mês
    rec = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.tipo == "receita", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    rec_map = {r.anomes: float(r.total) for r in rec}

    # Despesas por mês
    desp = (
        db.query(PlanoItem.anomes, func.coalesce(func.sum(PlanoItem.valor_planejado), 0).label("total"))
        .filter(PlanoItem.tipo == "despesa", PlanoItem.anomes.like(f"{prefix}%"))
        .group_by(PlanoItem.anomes)
    )
    desp_map = {d.anomes: float(d.total) for d in desp}

    # Meses únicos
    meses = sorted(set(rec_map.keys()) | set(desp_map.keys()))
    return [
        PlanoResumoMes(
            anomes=m,
            receita_planejada=rec_map.get(m, 0),
            despesas_planejadas=desp_map.get(m, 0),
            lucro_planejado=rec_map.get(m, 0) - desp_map.get(m, 0),
        )
        for m in meses
    ]


@router.get("/despesas-realizadas", response_model=List[DespesaRealizadaItem])
def list_despesas_realizadas(
    mes: str = Query(..., description="YYYYMM - mês de referência"),
    db: Session = Depends(get_db),
):
    """Lista despesas realizadas do plano no mês (plano_itens tipo=despesa com valor_realizado > 0)."""
    if len(mes) != 6 or not mes.isdigit():
        return []
    itens = (
        db.query(PlanoItem)
        .filter(
            PlanoItem.anomes == mes,
            PlanoItem.tipo == "despesa",
            PlanoItem.valor_realizado.isnot(None),
            PlanoItem.valor_realizado > 0,
        )
        .order_by(PlanoItem.categoria, PlanoItem.tipo_item, PlanoItem.detalhe)
        .all()
    )
    return [
        DespesaRealizadaItem(
            id=i.id,
            tipo_item=i.tipo_item,
            detalhe=i.detalhe,
            valor_realizado=float(i.valor_realizado),
            categoria=i.categoria,
        )
        for i in itens
    ]


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
def update_plano_item_realizado(
    item_id: int,
    data: PlanoItemUpdateRealizado,
    db: Session = Depends(get_db),
):
    """Atualiza valor_realizado de um item do plano (receitas e despesas)."""
    item = db.query(PlanoItem).filter(PlanoItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    if data.valor_realizado is not None:
        item.valor_realizado = data.valor_realizado
    else:
        item.valor_realizado = None
    db.commit()
    db.refresh(item)
    return item


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
