"""
Resolução do custo de receber (taxa de cartão / desconto Pix).

Este módulo é a **fonte única** do percentual aplicado a um pedido. Nenhum outro
ponto do código deve ler `parametros_taxas` nem `parametros_orcamento.cartao_credito`
direto — senão a taxa volta a ficar espalhada, que é o problema que a tabela resolve.
"""
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import ParametroTaxa, ParametrosOrcamento

FORMA_CARTAO = "Cartão"
FORMA_CARTAO_DEBITO = "Cartão de Débito"
FORMA_PIX = "Pix"

CANAIS_CARTAO = ["Maquininha", "Link de pagamento"]

TIPO_TAXA = "taxa"
TIPO_DESCONTO = "desconto"


def _faixa_cobre(taxa: ParametroTaxa, n_parcelas: Optional[int]) -> bool:
    """Uma linha sem faixa cobre qualquer prazo (caso do Pix)."""
    if taxa.parcelas_min is None and taxa.parcelas_max is None:
        return True
    n = n_parcelas or 1
    lo = taxa.parcelas_min if taxa.parcelas_min is not None else 1
    hi = taxa.parcelas_max if taxa.parcelas_max is not None else 10**6
    return lo <= n <= hi


def _especificidade(taxa: ParametroTaxa) -> int:
    """Quanto mais campos preenchidos, mais específica a linha — desempata o match."""
    score = 0
    if taxa.canal:
        score += 2
    if taxa.parcelas_min is not None or taxa.parcelas_max is not None:
        score += 1
    return score


def resolver_taxa(
    db: Session,
    forma: str,
    canal: Optional[str] = None,
    n_parcelas: Optional[int] = None,
) -> Optional[ParametroTaxa]:
    """Retorna a linha ativa mais específica que casa com (forma, canal, prazo)."""
    candidatas = (
        db.query(ParametroTaxa)
        .filter(ParametroTaxa.ativo.is_(True), ParametroTaxa.forma == forma)
        .all()
    )
    match = [
        t for t in candidatas
        if (t.canal is None or canal is None or t.canal == canal) and _faixa_cobre(t, n_parcelas)
    ]
    if not match:
        return None
    return sorted(match, key=_especificidade, reverse=True)[0]


def resolver_percentual(
    db: Session,
    forma: str,
    canal: Optional[str] = None,
    n_parcelas: Optional[int] = None,
) -> float:
    """Percentual (ex.: 3.49 = 3,49%) do custo de receber.

    Fallback quando nenhuma linha casa: o parâmetro legado `cartao_credito` para
    cartão, e zero para o resto — nunca estoura, no pior caso mantém o de antes.
    """
    taxa = resolver_taxa(db, forma, canal, n_parcelas)
    if taxa is not None:
        return float(taxa.percentual or 0.0)
    if forma in (FORMA_CARTAO, FORMA_CARTAO_DEBITO):
        p = db.query(ParametrosOrcamento).first()
        return round(float(p.cartao_credito or 0.0) * 100, 4) if p else 0.0
    return 0.0


def resolver_percentual_padrao(db: Session) -> float:
    """Taxa representativa para preço sugerido e faturamento_target.

    Usa a linha marcada como `padrao`; sem ela, cai no parâmetro legado. Devolve
    **fração** (0.03), não percentual, porque é assim que os cálculos de orçamento
    já trabalham.
    """
    linha = (
        db.query(ParametroTaxa)
        .filter(ParametroTaxa.ativo.is_(True), ParametroTaxa.padrao.is_(True))
        .first()
    )
    if linha is not None:
        return round(float(linha.percentual or 0.0) / 100, 6)
    p = db.query(ParametrosOrcamento).first()
    return float(p.cartao_credito or 0.0) if p else 0.0


def seed_parametros_taxas(db: Session) -> int:
    """Cria as linhas iniciais **só se a tabela estiver vazia**.

    Parte do valor atual de `cartao_credito` para que nada mude de comportamento no
    dia do deploy — a Ilma ajusta os números depois pela tela de parâmetros.
    """
    if db.query(ParametroTaxa).count() > 0:
        return 0

    p = db.query(ParametrosOrcamento).first()
    base = round(float(p.cartao_credito or 0.03) * 100, 4) if p else 3.0

    linhas = [
        ParametroTaxa(
            forma=FORMA_PIX, canal=None, parcelas_min=None, parcelas_max=None,
            percentual=0.0, tipo_custo=TIPO_DESCONTO, padrao=False, ativo=True,
        ),
        ParametroTaxa(
            forma=FORMA_CARTAO_DEBITO, canal=None, parcelas_min=None, parcelas_max=None,
            percentual=base, tipo_custo=TIPO_TAXA, padrao=False, ativo=True,
        ),
        ParametroTaxa(
            forma=FORMA_CARTAO, canal="Maquininha", parcelas_min=1, parcelas_max=6,
            percentual=base, tipo_custo=TIPO_TAXA, padrao=True, ativo=True,
        ),
        ParametroTaxa(
            forma=FORMA_CARTAO, canal="Maquininha", parcelas_min=7, parcelas_max=12,
            percentual=base, tipo_custo=TIPO_TAXA, padrao=False, ativo=True,
        ),
        ParametroTaxa(
            forma=FORMA_CARTAO, canal="Link de pagamento", parcelas_min=1, parcelas_max=6,
            percentual=base, tipo_custo=TIPO_TAXA, padrao=False, ativo=True,
        ),
        ParametroTaxa(
            forma=FORMA_CARTAO, canal="Link de pagamento", parcelas_min=7, parcelas_max=12,
            percentual=base, tipo_custo=TIPO_TAXA, padrao=False, ativo=True,
        ),
    ]
    for linha in linhas:
        db.add(linha)
    db.commit()
    return len(linhas)


def migrar_pix_default_zero(db: Session) -> int:
    """Atualiza bases antigas em que o Pix nasceu com 5% por padrão.

    Roda uma única vez. Assim, se depois a Ilma quiser configurar Pix em 5% de
    novo, uma reinicialização não desfaz a escolha dela.
    """
    migration_id = "20260802_pix_default_zero"
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS app_migrations (
            id VARCHAR(100) PRIMARY KEY
        )
    """))
    ja_rodou = db.execute(
        text("SELECT 1 FROM app_migrations WHERE id = :id"),
        {"id": migration_id},
    ).first()
    if ja_rodou:
        return 0

    atualizados = (
        db.query(ParametroTaxa)
        .filter(
            ParametroTaxa.forma == FORMA_PIX,
            ParametroTaxa.tipo_custo == TIPO_DESCONTO,
            ParametroTaxa.percentual == 5.0,
        )
        .update({"percentual": 0.0}, synchronize_session=False)
    )
    db.execute(text("INSERT INTO app_migrations (id) VALUES (:id)"), {"id": migration_id})
    db.commit()
    return int(atualizados or 0)


def seed_cartao_debito(db: Session) -> int:
    """Garante a existência do parâmetro de cartão de débito em bases antigas."""
    existe = db.query(ParametroTaxa).filter(ParametroTaxa.forma == FORMA_CARTAO_DEBITO).first()
    if existe:
        return 0

    p = db.query(ParametrosOrcamento).first()
    base = round(float(p.cartao_credito or 0.03) * 100, 4) if p else 3.0
    db.add(ParametroTaxa(
        forma=FORMA_CARTAO_DEBITO,
        canal=None,
        parcelas_min=None,
        parcelas_max=None,
        percentual=base,
        tipo_custo=TIPO_TAXA,
        padrao=False,
        ativo=True,
    ))
    db.commit()
    return 1
