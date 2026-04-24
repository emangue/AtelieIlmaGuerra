"""
Seed para tipo_pedido - catálogo fixo.
"""
from sqlalchemy.orm import Session

from .models import TipoPedido

TIPOS = [
    ("VESTIDO FESTA", 3000.0, 5),
    ("NOIVA FESTA", None, None),
    ("NOIVA CIVIL", 1500.0, 1),
    ("AJUSTE", 3000.0, 100),
    ("PEÇA CASUAL", 4500.0, 30),
    ("TRANSFORMAÇÃO", None, None),
    ("DEBUTANTE", None, None),
    ("CORTINA", None, None),
]


def seed_tipo_pedido(db: Session) -> int:
    """Insere tipos de pedido se a tabela estiver vazia. Retorna quantidade inserida."""
    count = db.query(TipoPedido).count()
    if count > 0:
        return 0
    for nome, meta_lucro, meta_qtd in TIPOS:
        db.add(TipoPedido(nome=nome, meta_lucro=meta_lucro, meta_quantidade=meta_qtd))
    db.commit()
    return len(TIPOS)
