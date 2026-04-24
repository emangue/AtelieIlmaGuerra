"""
Router do domínio Parâmetros.
"""
from fastapi import APIRouter, Depends

from app.core.database import get_db
from sqlalchemy.orm import Session

from .schemas import ParametrosOrcamentoSchema, ParametrosOrcamentoUpdate, CalcularMargensRequest, CalcularMargensResponse
from .service import get_or_create_parametros, get_parametros, calcular_margens, get_total_despesas


router = APIRouter(prefix="/parametros", tags=["Parâmetros"])


def _build_parametros_response(p, total_despesas: float):
    """Monta resposta com valores calculados."""
    total_horas = p.total_horas_mes or 0
    preco_hora = (
        round(total_despesas / total_horas, 2)
        if total_horas > 0 and total_despesas > 0
        else p.preco_hora
    )
    denom = 1 - (p.cartao_credito or 0) - (p.impostos or 0) - (p.margem_target or 0)
    faturamento_target = round(total_despesas / denom, 2) if denom > 0 and total_despesas > 0 else None
    return ParametrosOrcamentoSchema(
        preco_hora=preco_hora,
        impostos=p.impostos,
        cartao_credito=p.cartao_credito,
        total_horas_mes=p.total_horas_mes,
        margem_target=p.margem_target,
        total_despesas=round(total_despesas, 2) if total_despesas else 0,
        faturamento_target=faturamento_target,
    )


@router.get("", response_model=ParametrosOrcamentoSchema)
def get_parametros_endpoint(db: Session = Depends(get_db)):
    """Retorna parâmetros de orçamento (cria com defaults se não existir).
    total_despesas vem da base de despesas detalhadas.
    preco_hora = total_despesas / total_horas_mes.
    faturamento_target = total_despesas / (1 - impostos - cartao_credito - margem_target).
    """
    p = get_or_create_parametros(db)
    total_despesas = get_total_despesas(db)
    return _build_parametros_response(p, total_despesas)


@router.patch("", response_model=ParametrosOrcamentoSchema)
def update_parametros(data: ParametrosOrcamentoUpdate, db: Session = Depends(get_db)):
    """Atualiza parâmetros editáveis. preco_hora, total_despesas e faturamento_target são calculados."""
    p = get_or_create_parametros(db)
    if data.impostos is not None:
        p.impostos = data.impostos
    if data.cartao_credito is not None:
        p.cartao_credito = data.cartao_credito
    if data.total_horas_mes is not None:
        p.total_horas_mes = data.total_horas_mes
    if data.margem_target is not None:
        p.margem_target = data.margem_target
    db.commit()
    db.refresh(p)
    total_despesas = get_total_despesas(db)
    return _build_parametros_response(p, total_despesas)


@router.post("/calcular-margens", response_model=CalcularMargensResponse)
def calcular_margens_endpoint(
    data: CalcularMargensRequest,
    db: Session = Depends(get_db),
):
    """Calcula Margem20, Margem30, Margem40 a partir dos parâmetros e inputs."""
    p = get_or_create_parametros(db)
    m20, m30, m40, custo = calcular_margens(
        preco_hora=p.preco_hora,
        impostos=p.impostos,
        cartao_credito=p.cartao_credito,
        horas_trabalho=data.horas_trabalho,
        custo_materiais=data.custo_materiais,
        custos_variaveis=data.custos_variaveis,
    )
    return CalcularMargensResponse(
        margem_20=m20,
        margem_30=m30,
        margem_40=m40,
        custo_total=custo,
    )
