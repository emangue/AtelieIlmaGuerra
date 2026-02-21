"""
Modelo ParametrosOrcamento - configurações para cálculo de margens.
"""
from sqlalchemy import Column, Integer, String, Float

from app.core.database import Base


class ParametrosOrcamento(Base):
    """Parâmetros globais para orçamento (1 registro)."""

    __tablename__ = "parametros_orcamento"

    id = Column(Integer, primary_key=True, index=True)
    preco_hora = Column(Float, nullable=False, default=50.0)
    impostos = Column(Float, nullable=False, default=0.06)
    cartao_credito = Column(Float, nullable=False, default=0.03)
    total_horas_mes = Column(Float, nullable=True)
    margem_target = Column(Float, nullable=True, default=0.25)
