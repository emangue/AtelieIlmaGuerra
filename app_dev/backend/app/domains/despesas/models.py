"""
Modelo DespesaDetalhada - base de despesas detalhadas.
"""
from sqlalchemy import Column, Integer, String, Float, Text

from app.core.database import Base


class DespesaDetalhada(Base):
    """Despesa detalhada (Luz, Aluguel, Pró-Labore, etc.).
    Fonte: planilha ParametrosOrcamento1 em Clientes (1).xlsx.
    """

    __tablename__ = "despesas_detalhadas"

    id = Column(Integer, primary_key=True, index=True)
    appsheet_id = Column(String(50), unique=True, index=True, nullable=True)  # DespesaID do Excel
    detalhe = Column(String(255), nullable=False)  # DetalheDespesa: Luz, Aluguel, etc.
    valor = Column(Float, nullable=False, default=0)
    grupo = Column(String(100), nullable=True)  # Espaço Físico, Colaboradores, etc.
