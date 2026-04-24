#!/usr/bin/env python3
"""
Zera valor_realizado em plano_itens para todos os meses após janeiro.
Só janeiro deve manter os valores realizados.

Uso:
  cd AtelieIlmaGuerra
  python scripts/zerar_realizado_apos_jan.py [--dry-run]
"""
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent / "app_dev" / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine, text
from app.core.config import settings


def main(dry_run: bool = False):
    engine = create_engine(settings.DATABASE_URL)
    count_sql = """
        SELECT COUNT(*) FROM plano_itens
        WHERE tipo = 'despesa' AND anomes > '202601' AND valor_realizado IS NOT NULL
    """
    update_sql = """
        UPDATE plano_itens
        SET valor_realizado = NULL
        WHERE tipo = 'despesa' AND anomes > '202601'
    """
    with engine.connect() as conn:
        count = conn.execute(text(count_sql)).scalar()
        if dry_run:
            print(f"[DRY-RUN] Seriam zerados {count} itens de despesa (meses após jan/2026).")
            return
        conn.execute(text(update_sql))
        conn.commit()
    print(f"Zerado valor_realizado em {count} itens de despesa (meses após jan/2026).")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    main(dry_run=dry_run)
