"""
Seed para forma_peca, forma_peca_medidas e tipo_pedido_forma_peca.
"""
from sqlalchemy.orm import Session

from .models import FormaPeca, FormaPecaMedida, TipoPedido, tipo_pedido_forma_peca

FORMAS_E_MEDIDAS = [
    ("Saia", ["medida_cinto", "medida_quadril", "medida_comprimento_saia"]),
    ("Calça", ["medida_cinto", "medida_quadril", "medida_comprimento_calca"]),
    ("Bermuda", ["medida_cinto", "medida_quadril", "medida_comprimento_bermuda"]),
    (
        "Vestido sem manga",
        [
            "medida_ombro", "medida_busto", "medida_cinto", "medida_quadril",
            "medida_comprimento_corpo", "medida_distancia_busto", "medida_raio_busto",
            "medida_altura_busto", "medida_comprimento_vestido",
        ],
    ),
    (
        "Vestido com manga",
        [
            "medida_ombro", "medida_busto", "medida_cinto", "medida_quadril",
            "medida_comprimento_corpo", "medida_distancia_busto", "medida_raio_busto",
            "medida_altura_busto", "medida_comprimento_vestido",
            "medida_largura_manga", "medida_comprimento_manga", "medida_punho",
        ],
    ),
    (
        "Blusa",
        [
            "medida_ombro", "medida_busto", "medida_cinto", "medida_quadril",
            "medida_comprimento_corpo", "medida_comprimento_blusa", "medida_distancia_busto",
            "medida_raio_busto", "medida_altura_busto",
            "medida_largura_manga", "medida_comprimento_manga", "medida_punho",
        ],
    ),
]

# Tipos de pedido que mostram APENAS vestidos (não bermuda, saia, calça, blusa)
TIPOS_SO_VESTIDO = ("VESTIDO FESTA", "NOIVA FESTA", "NOIVA CIVIL", "DEBUTANTE")

# Tipos que mostram todas as formas (PEÇA CASUAL, AJUSTE, TRANSFORMAÇÃO, CORTINA)
TIPOS_TODAS_FORMAS = ("PEÇA CASUAL", "AJUSTE", "TRANSFORMAÇÃO", "CORTINA")


def seed_forma_peca(db: Session) -> int:
    """Insere formas de peça e medidas se a tabela estiver vazia. Retorna quantidade inserida."""
    if db.query(FormaPeca).count() > 0:
        return 0

    formas_by_nome = {}
    for nome, medida_keys in FORMAS_E_MEDIDAS:
        fp = FormaPeca(nome=nome)
        db.add(fp)
        db.flush()
        formas_by_nome[nome] = fp
        for mk in medida_keys:
            db.add(FormaPecaMedida(forma_peca_id=fp.id, medida_key=mk))

    db.commit()

    # Mapear tipo_pedido -> formas permitidas
    tipos = {t.nome: t for t in db.query(TipoPedido).all()}
    vestido_sem = formas_by_nome.get("Vestido sem manga")
    vestido_com = formas_by_nome.get("Vestido com manga")
    todas_formas = list(formas_by_nome.values())

    for tipo_nome, tipo in tipos.items():
        if tipo_nome in TIPOS_SO_VESTIDO and vestido_sem and vestido_com:
            db.execute(
                tipo_pedido_forma_peca.insert().values(
                    tipo_pedido_id=tipo.id, forma_peca_id=vestido_sem.id
                )
            )
            db.execute(
                tipo_pedido_forma_peca.insert().values(
                    tipo_pedido_id=tipo.id, forma_peca_id=vestido_com.id
                )
            )
        elif tipo_nome in TIPOS_TODAS_FORMAS:
            for fp in todas_formas:
                db.execute(
                    tipo_pedido_forma_peca.insert().values(
                        tipo_pedido_id=tipo.id, forma_peca_id=fp.id
                    )
                )
        else:
            # Tipos não mapeados: mostrar todas
            for fp in todas_formas:
                db.execute(
                    tipo_pedido_forma_peca.insert().values(
                        tipo_pedido_id=tipo.id, forma_peca_id=fp.id
                    )
                )

    db.commit()
    return len(FORMAS_E_MEDIDAS)
