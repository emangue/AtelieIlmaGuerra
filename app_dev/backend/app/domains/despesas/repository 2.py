"""
Repository do domínio Despesas.
"""
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import DespesaDetalhada
from .schemas import DespesaDetalhadaCreate, DespesaDetalhadaUpdate


class DespesaRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_all(self) -> List[DespesaDetalhada]:
        return self.db.query(DespesaDetalhada).order_by(DespesaDetalhada.grupo, DespesaDetalhada.detalhe).all()

    def get_total(self) -> float:
        result = self.db.query(func.coalesce(func.sum(DespesaDetalhada.valor), 0)).scalar()
        return float(result)

    def get_by_id(self, id: int) -> Optional[DespesaDetalhada]:
        return self.db.query(DespesaDetalhada).filter(DespesaDetalhada.id == id).first()

    def create(self, data: DespesaDetalhadaCreate) -> DespesaDetalhada:
        d = DespesaDetalhada(
            detalhe=data.detalhe,
            valor=data.valor,
            grupo=data.grupo,
        )
        self.db.add(d)
        self.db.commit()
        self.db.refresh(d)
        return d

    def update(self, id: int, data: DespesaDetalhadaUpdate) -> Optional[DespesaDetalhada]:
        d = self.get_by_id(id)
        if not d:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(d, key, value)
        self.db.commit()
        self.db.refresh(d)
        return d

    def delete(self, id: int) -> bool:
        d = self.get_by_id(id)
        if not d:
            return False
        self.db.delete(d)
        self.db.commit()
        return True
