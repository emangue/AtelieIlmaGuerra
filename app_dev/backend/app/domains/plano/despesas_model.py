"""
Modelo Despesa - fonte de verdade de despesas realizadas.
Cada despesa gera automaticamente um registro em `pagamentos` (tipo=despesa).
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Despesa(Base):
    """Despesa realizada do ateliê."""

    __tablename__ = "despesas"

    id            = Column(Integer, primary_key=True, index=True)
    anomes        = Column(String(6), nullable=False, index=True)   # YYYYMM — mês de competência
    plano_item_id = Column(Integer, ForeignKey("plano_itens.id"), nullable=True)  # NULL = fora do plano
    tipo_item     = Column(String(100), nullable=False)              # Colaboradores, Espaço Físico…
    detalhe       = Column(String(255), nullable=True)               # Esli, Aluguel, Luz…
    categoria     = Column(String(50), nullable=False)               # Custo Fixo | Custo Variável
    data          = Column(Date, nullable=False)                     # data do pagamento efetivo
    valor         = Column(Float, nullable=False)
    descricao     = Column(String(500), nullable=True)               # nota livre (ex: "NF 1234")
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plano_item = relationship("PlanoItem", back_populates="despesas")
    pagamento  = relationship(
        "Pagamento",
        back_populates="despesa",
        uselist=False,
        cascade="all, delete-orphan",
    )
