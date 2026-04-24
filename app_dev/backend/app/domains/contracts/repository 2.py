"""
Repository do domínio Contracts.
"""
from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Contract
from .schemas import ContractData


class ContractRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: ContractData) -> Contract:
        contract = Contract(
            nome_completo=data.nome_completo,
            cpf=data.cpf,
            rg=data.rg,
            endereco=data.endereco,
            telefone=data.telefone,
            nacionalidade=data.nacionalidade,
            especificacoes=data.especificacoes,
            tecidos=data.tecidos,
            valor_total=data.valor_total,
            valor_servico_vestir=data.valor_servico_vestir,
            primeira_prova_mes=data.primeira_prova_mes,
            prova_final_data=data.prova_final_data,
            semana_revisao_inicio=data.semana_revisao_inicio,
            semana_revisao_fim=data.semana_revisao_fim,
            data_contrato=data.data_contrato,
            cidade_contrato=data.cidade_contrato,
            autoriza_imagem_completa=data.autoriza_imagem_completa,
            testemunha1_nome=data.testemunha1_nome,
            testemunha1_cpf=data.testemunha1_cpf,
            testemunha2_nome=data.testemunha2_nome,
            testemunha2_cpf=data.testemunha2_cpf,
        )
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def get_by_id(self, contract_id: int) -> Optional[Contract]:
        return self.db.query(Contract).filter(Contract.id == contract_id).first()

    def list_all(self) -> List[Contract]:
        return (
            self.db.query(Contract)
            .order_by(Contract.created_at.desc())
            .all()
        )

    def update(self, contract_id: int, data: ContractData) -> Optional[Contract]:
        contract = self.get_by_id(contract_id)
        if not contract:
            return None
        contract.nome_completo = data.nome_completo
        contract.cpf = data.cpf
        contract.rg = data.rg
        contract.endereco = data.endereco
        contract.telefone = data.telefone
        contract.nacionalidade = data.nacionalidade
        contract.especificacoes = data.especificacoes
        contract.tecidos = data.tecidos
        contract.valor_total = data.valor_total
        contract.valor_servico_vestir = data.valor_servico_vestir
        contract.primeira_prova_mes = data.primeira_prova_mes
        contract.prova_final_data = data.prova_final_data
        contract.semana_revisao_inicio = data.semana_revisao_inicio
        contract.semana_revisao_fim = data.semana_revisao_fim
        contract.data_contrato = data.data_contrato
        contract.cidade_contrato = data.cidade_contrato
        contract.autoriza_imagem_completa = data.autoriza_imagem_completa
        contract.testemunha1_nome = data.testemunha1_nome
        contract.testemunha1_cpf = data.testemunha1_cpf
        contract.testemunha2_nome = data.testemunha2_nome
        contract.testemunha2_cpf = data.testemunha2_cpf
        self.db.commit()
        self.db.refresh(contract)
        return contract
