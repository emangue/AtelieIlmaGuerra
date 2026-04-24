"""
Router do domínio Orçamentos.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db
from sqlalchemy.orm import Session

from .schemas import OrcamentoCreate, OrcamentoUpdate, OrcamentoListItem, OrcamentoDetail
from .repository import OrcamentoRepository


router = APIRouter(prefix="/orcamentos", tags=["Orçamentos"])


@router.get("", response_model=list[OrcamentoListItem])
def list_orcamentos(db: Session = Depends(get_db)):
    """Lista orçamentos."""
    repo = OrcamentoRepository(db)
    orcs = repo.list_all()
    return [
        OrcamentoListItem(
            id=o.id,
            cliente_id=o.cliente_id,
            cliente_nome=o.cliente.nome if o.cliente else "",
            data=o.data,
            descricao=o.descricao,
            valor=o.valor,
            status=o.status,
            margem_20=o.margem_20,
            margem_30=o.margem_30,
            margem_40=o.margem_40,
        )
        for o in orcs
    ]


@router.post("", response_model=OrcamentoDetail, status_code=201)
def create_orcamento(data: OrcamentoCreate, db: Session = Depends(get_db)):
    """Cria orçamento com cálculo automático de margens."""
    repo = OrcamentoRepository(db)
    orc = repo.create(data)
    return OrcamentoDetail(
        id=orc.id,
        cliente_id=orc.cliente_id,
        cliente_nome=orc.cliente.nome if orc.cliente else "",
        data=orc.data,
        descricao=orc.descricao,
        valor=orc.valor,
        status=orc.status,
        margem_20=orc.margem_20,
        margem_30=orc.margem_30,
        margem_40=orc.margem_40,
        horas_trabalho=orc.horas_trabalho,
        custo_materiais=orc.custo_materiais,
        custos_variaveis=orc.custos_variaveis,
        created_at=orc.created_at,
    )


@router.get("/{orcamento_id}", response_model=OrcamentoDetail)
def get_orcamento(orcamento_id: int, db: Session = Depends(get_db)):
    """Retorna detalhes do orçamento."""
    repo = OrcamentoRepository(db)
    orc = repo.get_by_id(orcamento_id)
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return OrcamentoDetail(
        id=orc.id,
        cliente_id=orc.cliente_id,
        cliente_nome=orc.cliente.nome if orc.cliente else "",
        data=orc.data,
        descricao=orc.descricao,
        valor=orc.valor,
        status=orc.status,
        margem_20=orc.margem_20,
        margem_30=orc.margem_30,
        margem_40=orc.margem_40,
        horas_trabalho=orc.horas_trabalho,
        custo_materiais=orc.custo_materiais,
        custos_variaveis=orc.custos_variaveis,
        created_at=orc.created_at,
    )


@router.patch("/{orcamento_id}", response_model=OrcamentoDetail)
def update_orcamento(orcamento_id: int, data: OrcamentoUpdate, db: Session = Depends(get_db)):
    """Atualiza orçamento (recalcula margens se horas/custos mudarem)."""
    repo = OrcamentoRepository(db)
    orc = repo.update(orcamento_id, data)
    if not orc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return OrcamentoDetail(
        id=orc.id,
        cliente_id=orc.cliente_id,
        cliente_nome=orc.cliente.nome if orc.cliente else "",
        data=orc.data,
        descricao=orc.descricao,
        valor=orc.valor,
        status=orc.status,
        margem_20=orc.margem_20,
        margem_30=orc.margem_30,
        margem_40=orc.margem_40,
        horas_trabalho=orc.horas_trabalho,
        custo_materiais=orc.custo_materiais,
        custos_variaveis=orc.custos_variaveis,
        created_at=orc.created_at,
    )
