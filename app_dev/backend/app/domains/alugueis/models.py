"""Modelos do acervo ligado ao Pedido existente."""
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class ItemAcervo(Base):
    __tablename__ = "itens_acervo"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), nullable=False, unique=True, index=True)
    nome = Column(String(255), nullable=False)
    categoria = Column(String(30), nullable=False)  # Vestido | Acessório
    tamanho = Column(String(30), nullable=True)
    cor = Column(String(80), nullable=True)
    valor_aluguel_padrao = Column(Float, nullable=True)
    valor_reposicao = Column(Float, nullable=True)
    status_item = Column(String(30), nullable=False, default="disponivel")
    foto_url = Column(String(500), nullable=True)
    observacao = Column(Text, nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PedidoAcervoItem(Base):
    __tablename__ = "pedido_acervo_itens"
    __table_args__ = (UniqueConstraint("pedido_id", "item_acervo_id", name="uq_pedido_acervo_item"),)

    id = Column(Integer, primary_key=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False, index=True)
    item_acervo_id = Column(Integer, ForeignKey("itens_acervo.id"), nullable=False, index=True)
    valor_aluguel = Column(Float, nullable=False, default=0)
    observacao_retirada = Column(Text, nullable=True)
    observacao_devolucao = Column(Text, nullable=True)
    valor_dano = Column(Float, nullable=True)

    pedido = relationship("Pedido", back_populates="itens_acervo")
    item = relationship("ItemAcervo", backref="pedidos_itens")
