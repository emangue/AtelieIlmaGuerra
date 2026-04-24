"""
Seed do plano - importa MetaReceita e MetaDespesas do Excel.
Executar: python -m app.domains.plano.seed_plano
"""
import sys
from pathlib import Path
from typing import Optional

# Adicionar raiz do projeto ao path (app_dev/backend/app/domains/plano -> projeto)
ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.domains.plano.models import PlanoItem


EXCEL_PATH = ROOT / "PLANO 2026 ATELIE ILMA GUERRA.xlsx"


def _import_receita(db: Session, df: "pd.DataFrame") -> int:
    """Importa MetaReceita."""
    import pandas as pd  # noqa: F401 - só usado via df
    count = 0
    for _, row in df.iterrows():
        anomes = str(int(row["anomes"])) if pd.notna(row["anomes"]) else None
        if not anomes or len(anomes) != 6:
            continue
        valor = float(row.get("ValorTotal", 0) or 0)
        qtd = int(row["Quantidade"]) if pd.notna(row.get("Quantidade")) else None
        ticket = float(row["TicketMedio"]) if pd.notna(row.get("TicketMedio")) else None
        detalhe = str(row["DetalheGasto"]).strip() if pd.notna(row.get("DetalheGasto")) and str(row["DetalheGasto"]) != "nan" else None
        item = PlanoItem(
            anomes=anomes,
            tipo="receita",
            categoria="Receita",
            tipo_item=str(row.get("TipoGasto", "") or "").strip(),
            detalhe=detalhe,
            quantidade=qtd,
            ticket_medio=ticket,
            valor_planejado=valor,
            valor_realizado=None,
        )
        db.add(item)
        count += 1
    return count


def _import_despesas(db: Session, df: "pd.DataFrame") -> int:
    """Importa MetaDespesas."""
    import pandas as pd  # noqa: F401 - só usado via df
    count = 0
    for _, row in df.iterrows():
        anomes = str(int(row["anomes"])) if pd.notna(row["anomes"]) else None
        if not anomes or len(anomes) != 6:
            continue
        planejado = float(row.get("Planejado", 0) or 0)
        realizado = float(row["Realizado"]) if pd.notna(row.get("Realizado")) else None
        detalhe = str(row["DetalheGasto"]).strip() if pd.notna(row.get("DetalheGasto")) and str(row["DetalheGasto"]) != "nan" else None
        item = PlanoItem(
            anomes=anomes,
            tipo="despesa",
            categoria=str(row.get("Categoria", "") or "").strip(),
            tipo_item=str(row.get("TipoGasto", "") or "").strip(),
            detalhe=detalhe,
            quantidade=None,
            ticket_medio=None,
            valor_planejado=planejado,
            valor_realizado=realizado,
        )
        db.add(item)
        count += 1
    return count


def seed_plano(db: Session, excel_path: Optional[Path] = None) -> tuple[int, int]:
    """Importa receita e despesas do Excel. Retorna (n_receita, n_despesas)."""
    import pandas as pd
    path = excel_path or EXCEL_PATH
    if not path.exists():
        print(f"Arquivo não encontrado: {path}")
        return 0, 0

    # Limpar dados existentes (opcional - para reimport)
    db.query(PlanoItem).delete()

    df_r = pd.read_excel(path, sheet_name="MetaReceita", header=0)
    df_d = pd.read_excel(path, sheet_name="MetaDespesas", header=0)

    n_r = _import_receita(db, df_r)
    n_d = _import_despesas(db, df_d)
    db.commit()
    return n_r, n_d


if __name__ == "__main__":
    db = SessionLocal()
    try:
        n_r, n_d = seed_plano(db)
        print(f"Importados: {n_r} receitas, {n_d} despesas")
    finally:
        db.close()
