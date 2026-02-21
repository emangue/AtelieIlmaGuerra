"""
Model Contract - histórico de contratos gerados.
"""
from datetime import date, datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text

from app.core.database import Base


class Contract(Base):
    """Contrato salvo para histórico e regeneração."""

    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)

    # CONTRATANTE
    nome_completo = Column(String(255), nullable=False)
    cpf = Column(String(20), nullable=False)
    rg = Column(String(50), default="")
    endereco = Column(String(500), nullable=False)
    telefone = Column(String(30), nullable=False)
    nacionalidade = Column(String(50), default="brasileira")

    # Especificações
    especificacoes = Column(Text, nullable=False)
    tecidos = Column(Text, nullable=False)

    # Valores
    valor_total = Column(Float, nullable=False)
    valor_servico_vestir = Column(Float, default=150.0)

    # Datas
    primeira_prova_mes = Column(String(50), default="março")
    prova_final_data = Column(Date, nullable=False)
    semana_revisao_inicio = Column(Date, nullable=False)
    semana_revisao_fim = Column(Date, nullable=False)
    data_contrato = Column(Date, nullable=False)
    cidade_contrato = Column(String(100), default="Araraquara")

    # Direito de imagem
    autoriza_imagem_completa = Column(Boolean, default=False)

    # Testemunhas
    testemunha1_nome = Column(String(255), default="")
    testemunha1_cpf = Column(String(50), default="")
    testemunha2_nome = Column(String(255), default="")
    testemunha2_cpf = Column(String(50), default="")

    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
