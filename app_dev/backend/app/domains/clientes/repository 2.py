"""
Repository do domínio Clientes.
"""
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_

from .models import Cliente
from .schemas import ClienteCreate, ClienteUpdate


class ClienteRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: ClienteCreate) -> Cliente:
        cliente = Cliente(
            appsheet_id=data.appsheet_id,
            nome=data.nome,
            cpf=data.cpf,
            rg=data.rg,
            endereco=data.endereco,
            telefone=data.telefone,
            email=data.email,
            primeiro_agendamento=data.primeiro_agendamento,
            data_cadastro=data.data_cadastro,
            flag_medidas=data.flag_medidas,
            medida_ombro=data.medida_ombro,
            medida_busto=data.medida_busto,
            medida_cinto=data.medida_cinto,
            medida_quadril=data.medida_quadril,
            medida_comprimento_corpo=data.medida_comprimento_corpo,
            medida_comprimento_vestido=data.medida_comprimento_vestido,
            medida_distancia_busto=data.medida_distancia_busto,
            medida_raio_busto=data.medida_raio_busto,
            medida_altura_busto=data.medida_altura_busto,
            medida_frente=data.medida_frente,
            medida_costado=data.medida_costado,
            medida_comprimento_calca=data.medida_comprimento_calca,
            medida_comprimento_blusa=data.medida_comprimento_blusa,
            medida_largura_manga=data.medida_largura_manga,
            medida_comprimento_manga=data.medida_comprimento_manga,
            medida_punho=data.medida_punho,
            medida_comprimento_saia=data.medida_comprimento_saia,
            medida_comprimento_bermuda=data.medida_comprimento_bermuda,
        )
        self.db.add(cliente)
        self.db.commit()
        self.db.refresh(cliente)
        return cliente

    def get_by_id(self, cliente_id: int) -> Optional[Cliente]:
        return self.db.query(Cliente).filter(Cliente.id == cliente_id).first()

    def get_by_appsheet_id(self, appsheet_id: str) -> Optional[Cliente]:
        return self.db.query(Cliente).filter(Cliente.appsheet_id == appsheet_id).first()

    def exists_by_nome(
        self, nome: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se já existe cliente com o nome (case-insensitive, trim)."""
        nome_norm = (nome or "").strip().lower()
        if not nome_norm:
            return False
        from sqlalchemy import func
        query = self.db.query(Cliente.id).filter(
            func.lower(func.trim(Cliente.nome)) == nome_norm
        )
        if exclude_id is not None:
            query = query.filter(Cliente.id != exclude_id)
        return query.first() is not None

    def list_all(self, q: Optional[str] = None) -> List[Cliente]:
        query = self.db.query(Cliente).order_by(Cliente.nome.asc())
        if q and q.strip():
            term = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    Cliente.nome.ilike(term),
                    Cliente.telefone.ilike(term),
                    Cliente.email.ilike(term),
                )
            )
        return query.all()

    def update(self, cliente_id: int, data: ClienteUpdate) -> Optional[Cliente]:
        cliente = self.get_by_id(cliente_id)
        if not cliente:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(cliente, key, value)
        self.db.commit()
        self.db.refresh(cliente)
        return cliente

    def delete(self, cliente_id: int) -> bool:
        cliente = self.get_by_id(cliente_id)
        if not cliente:
            return False
        self.db.delete(cliente)
        self.db.commit()
        return True
