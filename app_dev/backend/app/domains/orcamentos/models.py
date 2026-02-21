"""
Modelo Orcamento - orçamentos/cotações.
"""
from datetime import date, datetime

from sqlalchemy import Column, Integer, Float, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Orcamento(Base):
    """Orçamento ou cotação."""

    __tablename__ = "orcamentos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)

    data = Column(Date, nullable=False)
    descricao = Column(Text, nullable=True)
    valor = Column(Float, nullable=True)
    status = Column(Text, nullable=False, default="Ativo")

    # Campos para cálculo de margens
    horas_trabalho = Column(Float, nullable=True)
    custo_materiais = Column(Float, nullable=True)
    custos_variaveis = Column(Float, nullable=True)
    margem_20 = Column(Float, nullable=True)
    margem_30 = Column(Float, nullable=True)
    margem_40 = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    cliente = relationship("Cliente", backref="orcamentos")
