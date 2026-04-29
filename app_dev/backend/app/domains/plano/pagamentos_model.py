"""
Modelo Pagamento - tabela unificada de receitas e despesas realizadas.
Receitas: originam de pedidos com status "Entregue".
Despesas: originam de lançamentos manuais associados a plano_itens.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Pagamento(Base):
    """Movimentação financeira realizada (receita ou despesa)."""

    __tablename__ = "pagamentos"
    __table_args__ = (
        UniqueConstraint("pedido_id", name="uq_pagamento_pedido"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    anomes        = Column(String(6), nullable=False, index=True)   # YYYYMM
    tipo          = Column(String(10), nullable=False)               # "receita" | "despesa"
    origem        = Column(String(20), nullable=False)               # "pedido" | "despesa_manual"
    pedido_id     = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=True)
    plano_item_id = Column(Integer, ForeignKey("plano_itens.id"), nullable=True)
    despesa_id    = Column(Integer, ForeignKey("despesas.id", ondelete="CASCADE"), nullable=True)
    data          = Column(Date, nullable=False)
    valor         = Column(Float, nullable=False)
    descricao     = Column(String(500), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    pedido     = relationship("Pedido",    back_populates="pagamento",  passive_deletes=True)
    plano_item = relationship("PlanoItem", back_populates="pagamentos")
    despesa    = relationship("Despesa",   back_populates="pagamento",  passive_deletes=True)
