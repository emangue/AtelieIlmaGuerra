"""
Repository do domínio Orçamentos.
"""
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Orcamento
from .schemas import OrcamentoCreate, OrcamentoUpdate
from app.domains.parametros.service import get_or_create_parametros, calcular_margens


class OrcamentoRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: OrcamentoCreate) -> Orcamento:
        p = get_or_create_parametros(self.db)
        m20, m30, m40, _ = calcular_margens(
            preco_hora=p.preco_hora,
            impostos=p.impostos,
            cartao_credito=p.cartao_credito,
            horas_trabalho=data.horas_trabalho,
            custo_materiais=data.custo_materiais,
            custos_variaveis=data.custos_variaveis,
        )
        orc = Orcamento(
            cliente_id=data.cliente_id,
            data=data.data,
            descricao=data.descricao,
            valor=data.valor,
            status=data.status,
            horas_trabalho=data.horas_trabalho,
            custo_materiais=data.custo_materiais,
            custos_variaveis=data.custos_variaveis,
            margem_20=m20,
            margem_30=m30,
            margem_40=m40,
        )
        self.db.add(orc)
        self.db.commit()
        self.db.refresh(orc)
        return orc

    def get_by_id(self, id: int) -> Optional[Orcamento]:
        return self.db.query(Orcamento).filter(Orcamento.id == id).first()

    def list_all(self) -> List[Orcamento]:
        return (
            self.db.query(Orcamento)
            .order_by(Orcamento.data.desc(), Orcamento.id.desc())
            .all()
        )

    def update(self, id: int, data: OrcamentoUpdate) -> Optional[Orcamento]:
        orc = self.get_by_id(id)
        if not orc:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(orc, key, value)
        if "horas_trabalho" in update_data or "custo_materiais" in update_data or "custos_variaveis" in update_data:
            p = get_or_create_parametros(self.db)
            m20, m30, m40, _ = calcular_margens(
                preco_hora=p.preco_hora,
                impostos=p.impostos,
                cartao_credito=p.cartao_credito,
                horas_trabalho=orc.horas_trabalho or 0,
                custo_materiais=orc.custo_materiais or 0,
                custos_variaveis=orc.custos_variaveis or 0,
            )
            orc.margem_20 = m20
            orc.margem_30 = m30
            orc.margem_40 = m40
        self.db.commit()
        self.db.refresh(orc)
        return orc
