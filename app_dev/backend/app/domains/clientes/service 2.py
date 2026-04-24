"""
Service do domínio Clientes.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Cliente
from .repository import ClienteRepository
from .schemas import ClienteCreate, ClienteUpdate, ClienteDetail, ClienteListItem


class ClienteService:
    def __init__(self, db: Session):
        self.repo = ClienteRepository(db)

    def create(self, data: ClienteCreate) -> Cliente:
        return self.repo.create(data)

    def get_by_id(self, cliente_id: int) -> Optional[Cliente]:
        return self.repo.get_by_id(cliente_id)

    def list_all(self, q: Optional[str] = None) -> List[Cliente]:
        return self.repo.list_all(q=q)

    def update(self, cliente_id: int, data: ClienteUpdate) -> Optional[Cliente]:
        return self.repo.update(cliente_id, data)

    def delete(self, cliente_id: int) -> bool:
        return self.repo.delete(cliente_id)

    @staticmethod
    def to_list_item(c: Cliente) -> ClienteListItem:
        return ClienteListItem(id=c.id, nome=c.nome, telefone=c.telefone, email=c.email)

    @staticmethod
    def to_detail(c: Cliente) -> ClienteDetail:
        return ClienteDetail(
            id=c.id,
            appsheet_id=c.appsheet_id,
            nome=c.nome,
            cpf=c.cpf,
            rg=c.rg,
            endereco=c.endereco,
            telefone=c.telefone,
            email=c.email,
            primeiro_agendamento=c.primeiro_agendamento,
            data_cadastro=c.data_cadastro,
            flag_medidas=c.flag_medidas,
            medida_ombro=c.medida_ombro,
            medida_busto=c.medida_busto,
            medida_cinto=c.medida_cinto,
            medida_quadril=c.medida_quadril,
            medida_comprimento_corpo=c.medida_comprimento_corpo,
            medida_comprimento_vestido=c.medida_comprimento_vestido,
            medida_distancia_busto=c.medida_distancia_busto,
            medida_raio_busto=c.medida_raio_busto,
            medida_altura_busto=c.medida_altura_busto,
            medida_frente=c.medida_frente,
            medida_costado=c.medida_costado,
            medida_comprimento_calca=c.medida_comprimento_calca,
            medida_comprimento_blusa=c.medida_comprimento_blusa,
            medida_largura_manga=c.medida_largura_manga,
            medida_comprimento_manga=c.medida_comprimento_manga,
            medida_punho=c.medida_punho,
            medida_comprimento_saia=c.medida_comprimento_saia,
            medida_comprimento_bermuda=c.medida_comprimento_bermuda,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
