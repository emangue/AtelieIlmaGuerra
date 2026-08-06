"""
Catálogos de tipo de pedido e forma de peça — somente leitura.

Espelho reduzido de app_dev/backend/app/domains/pedidos/models.py: as colunas
`meta_lucro` e `meta_quantidade` de `tipo_pedido` são metas de negócio da Ilma e
NÃO são declaradas aqui de propósito. O que o model não declara, o SQLAlchemy
não seleciona — então não há como esse dado vazar por este backend, nem por
engano num schema de resposta.
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from app.core.database import Base

tipo_pedido_forma_peca = Table(
    "tipo_pedido_forma_peca",
    Base.metadata,
    Column("tipo_pedido_id", Integer, ForeignKey("tipo_pedido.id"), primary_key=True),
    Column("forma_peca_id", Integer, ForeignKey("forma_peca.id"), primary_key=True),
)


class FormaPeca(Base):
    __tablename__ = "forma_peca"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True)


class FormaPecaMedida(Base):
    """Quais medidas fazem sentido pedir para cada forma de peça."""

    __tablename__ = "forma_peca_medidas"

    forma_peca_id = Column(Integer, ForeignKey("forma_peca.id"), primary_key=True)
    medida_key = Column(String(50), primary_key=True)


class TipoPedido(Base):
    __tablename__ = "tipo_pedido"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True)

    formas_peca = relationship("FormaPeca", secondary=tipo_pedido_forma_peca)
