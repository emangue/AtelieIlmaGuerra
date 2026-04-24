"""
Schemas para geração de contratos.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ContractData(BaseModel):
    """Dados para gerar um novo contrato"""

    # CONTRATANTE (cliente)
    nome_completo: str = Field(..., min_length=3)
    cpf: str = Field(..., min_length=11)
    rg: str = Field(default="")
    endereco: str = Field(..., min_length=5)
    telefone: str = Field(..., min_length=10)
    nacionalidade: str = Field(default="brasileira")

    # Especificações do vestido
    especificacoes: str = Field(
        ...,
        description="Descrição completa do vestido (estilo, decote, saia, véu, forro)",
    )
    tecidos: str = Field(
        ...,
        description="Descrição dos tecidos (ex: West chic Otimotex, crepe leve)",
    )

    # Valores
    valor_total: float = Field(..., gt=0)
    valor_servico_vestir: float = Field(default=150.0)

    # Datas
    primeira_prova_mes: str = Field(default="março")
    prova_final_data: date
    semana_revisao_inicio: date
    semana_revisao_fim: date
    data_contrato: date
    cidade_contrato: str = Field(default="Araraquara")

    # Direito de imagem
    autoriza_imagem_completa: bool = Field(default=False)

    # Testemunhas
    testemunha1_nome: str = Field(default="")
    testemunha1_cpf: str = Field(default="")
    testemunha2_nome: str = Field(default="")
    testemunha2_cpf: str = Field(default="")


class ContractListItem(BaseModel):
    """Item da lista de contratos (histórico)."""

    id: int
    nome_completo: str
    data_contrato: date
    created_at: datetime

    class Config:
        from_attributes = True


class ContractDetail(ContractData):
    """Contrato completo com metadados."""

    id: int
    created_at: datetime

    class Config:
        from_attributes = True
