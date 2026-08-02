"""
Router do domínio Parâmetros.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db
from app.domains.auth.router import get_user_id_from_token
from sqlalchemy.orm import Session

from .models import ParametroTaxa
from .schemas import (
    ParametrosOrcamentoSchema, ParametrosOrcamentoUpdate, CalcularMargensRequest, CalcularMargensResponse,
    ParametroTaxaSchema, ParametroTaxaCreate, ParametroTaxaUpdate,
)
from .service import get_or_create_parametros, get_parametros, calcular_margens, get_total_despesas, get_preco_hora_efetivo
from .taxas import resolver_percentual_padrao


router = APIRouter(prefix="/parametros", tags=["Parâmetros"], dependencies=[Depends(get_user_id_from_token)])


def _build_parametros_response(p, total_despesas: float, preco_hora: float, taxa_padrao: float):
    """Monta resposta com valores calculados. taxa_padrao vem de parametros_taxas."""
    denom = 1 - taxa_padrao - (p.impostos or 0) - (p.margem_target or 0)
    faturamento_target = round(total_despesas / denom, 2) if denom > 0 and total_despesas > 0 else None
    return ParametrosOrcamentoSchema(
        preco_hora=preco_hora,
        impostos=p.impostos,
        cartao_credito=taxa_padrao,
        total_horas_mes=p.total_horas_mes,
        margem_target=p.margem_target,
        total_despesas=round(total_despesas, 2) if total_despesas else 0,
        faturamento_target=faturamento_target,
    )


def _taxa_out(t: ParametroTaxa) -> ParametroTaxaSchema:
    return ParametroTaxaSchema(
        id=t.id,
        forma=t.forma,
        canal=t.canal,
        parcelas_min=t.parcelas_min,
        parcelas_max=t.parcelas_max,
        percentual=t.percentual,
        tipo_custo=t.tipo_custo,
        taxa_antecipacao_mes=t.taxa_antecipacao_mes,
        padrao=bool(t.padrao),
        ativo=bool(t.ativo),
        descricao=t.descricao,
        deflator=t.deflator,
    )


def _validar_faixa(parcelas_min, parcelas_max):
    if parcelas_min is not None and parcelas_max is not None and parcelas_min > parcelas_max:
        raise HTTPException(status_code=400, detail="parcelas_min não pode ser maior que parcelas_max")


def _garantir_padrao_unico(db: Session, taxa: ParametroTaxa):
    """Só uma linha pode ser padrão — senão o faturamento_target fica não determinístico."""
    if not taxa.padrao:
        return
    db.query(ParametroTaxa).filter(ParametroTaxa.id != taxa.id).update(
        {"padrao": False}, synchronize_session=False
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
    preco_hora = get_preco_hora_efetivo(db)
    return _build_parametros_response(p, total_despesas, preco_hora, resolver_percentual_padrao(db))


@router.patch("", response_model=ParametrosOrcamentoSchema)
def update_parametros(data: ParametrosOrcamentoUpdate, db: Session = Depends(get_db)):
    """Atualiza parâmetros editáveis. preco_hora, total_despesas e faturamento_target são calculados.
    A taxa de cartão não é editada aqui — ver PATCH /parametros/taxas/{id}."""
    p = get_or_create_parametros(db)
    if data.impostos is not None:
        p.impostos = data.impostos
    if data.total_horas_mes is not None:
        p.total_horas_mes = data.total_horas_mes
    if data.margem_target is not None:
        p.margem_target = data.margem_target
    db.commit()
    db.refresh(p)
    total_despesas = get_total_despesas(db)
    preco_hora = get_preco_hora_efetivo(db)
    return _build_parametros_response(p, total_despesas, preco_hora, resolver_percentual_padrao(db))


@router.get("/taxas", response_model=list[ParametroTaxaSchema])
def list_taxas(db: Session = Depends(get_db)):
    """Lista os custos de receber cadastrados (taxa de cartão e desconto Pix)."""
    taxas = (
        db.query(ParametroTaxa)
        .order_by(ParametroTaxa.forma.asc(), ParametroTaxa.canal.asc().nullsfirst(), ParametroTaxa.parcelas_min.asc().nullsfirst())
        .all()
    )
    return [_taxa_out(t) for t in taxas]


@router.post("/taxas", response_model=ParametroTaxaSchema, status_code=201)
def create_taxa(data: ParametroTaxaCreate, db: Session = Depends(get_db)):
    """Cadastra um custo de receber."""
    _validar_faixa(data.parcelas_min, data.parcelas_max)
    taxa = ParametroTaxa(**data.model_dump())
    db.add(taxa)
    db.flush()
    _garantir_padrao_unico(db, taxa)
    db.commit()
    db.refresh(taxa)
    return _taxa_out(taxa)


@router.patch("/taxas/{taxa_id}", response_model=ParametroTaxaSchema)
def update_taxa(taxa_id: int, data: ParametroTaxaUpdate, db: Session = Depends(get_db)):
    """Atualiza um custo de receber."""
    taxa = db.query(ParametroTaxa).filter(ParametroTaxa.id == taxa_id).first()
    if not taxa:
        raise HTTPException(status_code=404, detail="Taxa não encontrada")

    campos = data.model_dump(exclude_unset=True)
    # A linha padrão alimenta o preço sugerido e o faturamento alvo: desativá-la
    # deixaria os dois sem fonte. Marque outra como padrão antes.
    if campos.get("ativo") is False and taxa.padrao:
        raise HTTPException(
            status_code=400,
            detail="Esta é a taxa padrão do orçamento. Marque outra como padrão antes de desativar.",
        )
    for campo, valor in campos.items():
        setattr(taxa, campo, valor)
    _validar_faixa(taxa.parcelas_min, taxa.parcelas_max)
    _garantir_padrao_unico(db, taxa)
    db.commit()
    db.refresh(taxa)
    return _taxa_out(taxa)


@router.delete("/taxas/{taxa_id}", status_code=204)
def delete_taxa(taxa_id: int, db: Session = Depends(get_db)):
    """Remove um custo de receber. A linha padrão não pode ser removida."""
    taxa = db.query(ParametroTaxa).filter(ParametroTaxa.id == taxa_id).first()
    if not taxa:
        raise HTTPException(status_code=404, detail="Taxa não encontrada")
    if taxa.padrao:
        raise HTTPException(
            status_code=400,
            detail="Esta é a taxa padrão do orçamento. Marque outra como padrão antes de remover.",
        )
    db.delete(taxa)
    db.commit()


@router.post("/calcular-margens", response_model=CalcularMargensResponse)
def calcular_margens_endpoint(
    data: CalcularMargensRequest,
    db: Session = Depends(get_db),
):
    """Calcula Margem20, Margem30, Margem40 a partir dos parâmetros e inputs."""
    p = get_or_create_parametros(db)
    preco_hora = get_preco_hora_efetivo(db)
    m20, m30, m40, custo = calcular_margens(
        preco_hora=preco_hora,
        impostos=p.impostos,
        cartao_credito=resolver_percentual_padrao(db),
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
