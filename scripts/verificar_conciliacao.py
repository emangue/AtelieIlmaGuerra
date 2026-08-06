#!/usr/bin/env python3
"""
Prova que a tela de Transações fecha com a tela de Plano.

Compara `get_conciliacao_mes` (a base de pagamentos, linha a linha) com
`get_plano_vs_realizado` (os totais que o Plano mostra) para uma faixa de meses.
Se alguma asserção falhar, as duas telas vão mostrar números diferentes para o
mesmo mês — que é exatamente o que esta tela existe para evitar.

Uso (a partir da raiz do repo):
    app_dev/backend/venv/bin/python scripts/verificar_conciliacao.py
    app_dev/backend/venv/bin/python scripts/verificar_conciliacao.py 202601 202606
"""
import os
import sys

BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app_dev", "backend")
sys.path.insert(0, os.path.abspath(BACKEND))
os.chdir(os.path.abspath(BACKEND))

import app.main  # noqa: F401 — registra todos os models no registry do SQLAlchemy
from app.core.database import SessionLocal
from app.domains.plano.models import PlanoItem
from app.domains.plano.service import (
    GRUPO_DESPESA_FINANCEIRA,
    GRUPO_DESPESA_OPERACIONAL,
    GRUPO_RECEITA,
    get_conciliacao_mes,
    get_plano_vs_realizado,
)

TOL = 0.01
falhas = []
avisos = []


def perto(a, b):
    return abs(float(a) - float(b)) < TOL


def checar(mes, nome, obtido, esperado):
    if perto(obtido, esperado):
        return True
    falhas.append(f"{mes}  {nome}: conciliacao={obtido!r}  plano={esperado!r}  (dif {float(obtido) - float(esperado):+.2f})")
    return False


def meses_padrao():
    return [f"2025{m:02d}" for m in range(1, 13)] + [f"2026{m:02d}" for m in range(1, 13)]


def verificar_mes(db, mes):
    pvr = get_plano_vs_realizado(db, mes)
    conc = get_conciliacao_mes(db, mes)

    # 1-4: os totais agregados
    checar(mes, "receita_total", conc.receita_total, pvr.receita_realizada)
    checar(mes, "despesas_operacionais", conc.despesas_operacionais_total, pvr.despesas_realizadas)
    checar(mes, "despesas_financeiras.total", conc.despesas_financeiras["total"], pvr.despesas_financeiras_realizadas)
    checar(mes, "despesas_financeiras.credito", conc.despesas_financeiras["credito"], pvr.despesas_financeiras_credito)
    checar(mes, "despesas_financeiras.debito", conc.despesas_financeiras["debito"], pvr.despesas_financeiras_debito)
    checar(mes, "despesas_financeiras.pix", conc.despesas_financeiras["pix"], pvr.despesas_financeiras_pix)
    checar(mes, "lucro", conc.lucro, pvr.lucro_realizado)

    # 5: identidade linha-a-linha — o que a tela mostra tem que somar o total.
    # É a asserção que realmente importa: garante que a mãe consegue conferir
    # somando as linhas na tela e chegar no número do topo.
    rec_linhas = sum(
        float(l.pagamento.valor or 0)
        for l in conc.linhas
        if l.grupo == GRUPO_RECEITA and l.conta_no_plano
    )
    checar(mes, "Σ linhas receita + sem_lancamento", rec_linhas + conc.receita_sem_lancamento, pvr.receita_realizada)

    desp_linhas = sum(
        float(l.pagamento.valor or 0)
        for l in conc.linhas
        if l.grupo == GRUPO_DESPESA_OPERACIONAL and l.conta_no_plano
    )
    checar(
        mes,
        "Σ linhas despesa + sem_lancamento",
        desp_linhas + conc.despesas_operacionais_sem_lancamento,
        pvr.despesas_realizadas,
    )

    fin_linhas = sum(l.valor_no_plano for l in conc.linhas if l.grupo == GRUPO_DESPESA_FINANCEIRA)
    checar(mes, "Σ linhas financeiras", fin_linhas, pvr.despesas_financeiras_realizadas)

    # 6: uma despesa não pode estar nos dois lados (contagem dupla)
    ids_com_lancamento = {
        l.pagamento.plano_item_id
        for l in conc.linhas
        if l.grupo == GRUPO_DESPESA_OPERACIONAL and l.pagamento.plano_item_id is not None
    }
    dupes = [
        s.plano_item.id for s in conc.sem_lancamento
        if s.plano_item.tipo == "despesa" and s.plano_item.id in ids_com_lancamento
    ]
    if dupes:
        falhas.append(f"{mes}  itens do plano contados DUAS vezes: {dupes}")

    fora = [l for l in conc.linhas if not l.conta_no_plano]
    if fora or conc.sem_lancamento:
        detalhe = []
        if conc.sem_lancamento:
            total_sl = conc.receita_sem_lancamento + conc.despesas_operacionais_sem_lancamento
            detalhe.append(f"{len(conc.sem_lancamento)} sem lançamento (R$ {total_sl:,.2f})")
        if fora:
            total_fora = conc.fora_do_plano_receitas + conc.fora_do_plano_despesas
            motivos = sorted({l.motivo_fora for l in fora})
            detalhe.append(f"{len(fora)} fora do plano (R$ {total_fora:,.2f}: {', '.join(motivos)})")
        avisos.append(f"{mes}  " + " · ".join(detalhe))


def verificar_receita_manual_nao_dobra(db, mes):
    """Um PlanoItem de receita com valor_realizado não pode ser somado duas vezes.

    Nenhum item de receita tem valor_realizado no banco de dev, então esse bug
    passaria despercebido aqui e só apareceria em produção. Por isso o caso é
    criado na marra e desfeito com rollback.
    """
    item = (
        db.query(PlanoItem)
        .filter(PlanoItem.anomes == mes, PlanoItem.tipo == "receita")
        .first()
    )
    if item is None:
        avisos.append(f"{mes}  (sem item de receita no plano — teste de receita manual pulado)")
        return

    antes = get_plano_vs_realizado(db, mes).receita_realizada
    original = item.valor_realizado
    try:
        item.valor_realizado = 1234.56
        db.flush()
        db.expire_all()

        pvr = get_plano_vs_realizado(db, mes)
        conc = get_conciliacao_mes(db, mes)

        checar(mes, "[sintético] receita com item manual", conc.receita_total, pvr.receita_realizada)
        if not perto(pvr.receita_realizada, antes + 1234.56):
            falhas.append(
                f"{mes}  [sintético] receita manual contada errado: "
                f"esperado {antes + 1234.56:.2f}, obtido {pvr.receita_realizada:.2f} "
                f"(dobrou? diferença {pvr.receita_realizada - antes:.2f})"
            )
    finally:
        item.valor_realizado = original
        db.rollback()
        db.expire_all()


def main():
    meses = sys.argv[1:] or meses_padrao()
    db = SessionLocal()
    try:
        for mes in meses:
            verificar_mes(db, mes)
        verificar_receita_manual_nao_dobra(db, meses[-1])
    finally:
        db.close()

    if avisos:
        print("Divergências encontradas (esperado — é o que a tela expõe):")
        for a in avisos:
            print(f"  • {a}")
        print()

    if falhas:
        print(f"FALHOU — {len(falhas)} asserção(ões):")
        for f in falhas:
            print(f"  ✗ {f}")
        return 1

    print(f"OK — conciliação fecha com o plano em {len(meses)} meses.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
