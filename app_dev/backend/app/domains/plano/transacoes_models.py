"""
Modelo DespesaTransacao - base de transações de despesa.
Cada transação é armazenada individualmente; valor_realizado
em plano_itens = SUM(transacoes) por plano_item_id.
"""
from datetime import date, datetime

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class DespesaTransacao(Base):
    """Transação individual de despesa."""

    __tablename__ = "despesas_transacoes"

    id = Column(Integer, primary_key=True, index=True)
    anomes = Column(String(6), nullable=False, index=True)  # YYYYMM
    plano_item_id = Column(Integer, ForeignKey("plano_itens.id"), nullable=False)
    valor = Column(Float, nullable=False)
    data = Column(Date, nullable=True)  # Data da transação
    descricao = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plano_item = relationship("PlanoItem", backref="transacoes")
