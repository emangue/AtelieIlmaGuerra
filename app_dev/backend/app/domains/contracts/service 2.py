"""
Service do domínio Contracts.
"""
from datetime import date
from io import BytesIO
from typing import List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Contract
from .repository import ContractRepository
from .schemas import ContractData
from .pdf_generator import generate_contract_pdf


class ContractService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ContractRepository(db)

    def _contract_to_data(self, c: Contract) -> ContractData:
        return ContractData(
            nome_completo=c.nome_completo,
            cpf=c.cpf,
            rg=c.rg or "",
            endereco=c.endereco,
            telefone=c.telefone,
            nacionalidade=c.nacionalidade or "brasileira",
            especificacoes=c.especificacoes,
            tecidos=c.tecidos,
            valor_total=c.valor_total,
            valor_servico_vestir=c.valor_servico_vestir or 150,
            primeira_prova_mes=c.primeira_prova_mes or "março",
            prova_final_data=c.prova_final_data,
            semana_revisao_inicio=c.semana_revisao_inicio,
            semana_revisao_fim=c.semana_revisao_fim,
            data_contrato=c.data_contrato,
            cidade_contrato=c.cidade_contrato or "Araraquara",
            autoriza_imagem_completa=c.autoriza_imagem_completa or False,
            testemunha1_nome=c.testemunha1_nome or "",
            testemunha1_cpf=c.testemunha1_cpf or "",
            testemunha2_nome=c.testemunha2_nome or "",
            testemunha2_cpf=c.testemunha2_cpf or "",
        )

    def create_and_generate(self, data: ContractData) -> Tuple[Contract, BytesIO]:
        """Salva no banco e gera PDF."""
        contract = self.repository.create(data)
        pdf = generate_contract_pdf(data)
        return contract, pdf

    def preview_pdf(self, data: ContractData) -> BytesIO:
        """Gera PDF para preview (não salva)."""
        return generate_contract_pdf(data)

    def list_contracts(self) -> List[Contract]:
        return self.repository.list_all()

    def get_contract(self, contract_id: int) -> Contract:
        c = self.repository.get_by_id(contract_id)
        if not c:
            raise HTTPException(status_code=404, detail="Contrato não encontrado")
        return c

    def regenerate_pdf(self, contract_id: int) -> BytesIO:
        """Regenera PDF a partir do contrato salvo."""
        c = self.get_contract(contract_id)
        data = self._contract_to_data(c)
        return generate_contract_pdf(data)

    def update_contract(self, contract_id: int, data: ContractData) -> Contract:
        """Atualiza dados do contrato."""
        c = self.repository.update(contract_id, data)
        if not c:
            raise HTTPException(status_code=404, detail="Contrato não encontrado")
        return c
