#!/usr/bin/env python3
"""
Migração APENAS de plano_itens e despesas_transacoes
NÃO altera: clientes, pedidos, orçamentos, contracts, etc.

Suporta dois destinos:
  1) PostgreSQL: export ATELIE_POSTGRES_DSN="postgresql://..."
  2) SQLite:     export ATELIE_SQLITE_DEST="/caminho/para/atelie.db"

Uso PostgreSQL:
    export ATELIE_POSTGRES_DSN="postgresql://atelie_user:SENHA@HOST:5432/atelie_db"
    python scripts/migration/migrate_plano_to_prod.py

Uso SQLite (ex: prod na VM usa SQLite):
    # 1. Copiar banco local para a VM
    scp app_dev/backend/database/atelie.db minha-vps:/tmp/atelie_local.db

    # 2. Na VM: migrar plano do arquivo copiado para o banco de prod
    ssh minha-vps "cd /var/www/atelie && \
      ATELIE_SQLITE_PATH=/tmp/atelie_local.db \
      ATELIE_SQLITE_DEST=/var/www/atelie/app_dev/backend/database/atelie.db \
      python scripts/migration/migrate_plano_to_prod.py"

    # Ou rodar localmente se o dest estiver montado/acessível
    ATELIE_SQLITE_DEST=/caminho/remoto/atelie.db python scripts/migration/migrate_plano_to_prod.py

Dry-run (só mostra contagens):
    python scripts/migration/migrate_plano_to_prod.py --dry-run
"""

import os
import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = PROJECT_ROOT / "app_dev" / "backend" / "database" / "atelie.db"
POSTGRES_DSN = os.environ.get("ATELIE_POSTGRES_DSN", "")
SQLITE_DEST = os.environ.get("ATELIE_SQLITE_DEST", "")

TABLES = ["plano_itens", "despesas_transacoes"]


def get_sqlite_path() -> Path:
    for i, arg in enumerate(sys.argv):
        if arg == "--sqlite-path" and i + 1 < len(sys.argv):
            return Path(sys.argv[i + 1])
    if os.environ.get("ATELIE_SQLITE_PATH"):
        return Path(os.environ["ATELIE_SQLITE_PATH"])
    return DEFAULT_SQLITE


def get_table_columns(cursor, table: str):
    cursor.execute(f"PRAGMA table_info({table})")
    return [col[1] for col in cursor.fetchall()]


def migrate_to_sqlite(
    sqlite_conn: sqlite3.Connection,
    dest_path: Path,
    table: str,
    dry_run: bool,
) -> int:
    cur = sqlite_conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    if not cur.fetchone():
        print(f"  ⏭️  {table}: Não existe no SQLite origem, pulando...")
        return 0

    columns = get_table_columns(cur, table)
    if not columns:
        return 0

    cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = cur.fetchone()[0]
    if count == 0:
        print(f"  ⏭️  {table}: Vazia, pulando...")
        return 0

    if dry_run:
        print(f"  🔍 [DRY-RUN] {table}: {count} registros seriam migrados")
        return count

    cols_str = ", ".join(columns)
    cur.execute(f"SELECT {cols_str} FROM {table}")
    rows = cur.fetchall()

    dest_conn = sqlite3.connect(str(dest_path))
    dest_cur = dest_conn.cursor()

    # Verificar se tabela existe no destino
    dest_cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    if not dest_cur.fetchone():
        print(f"  ⚠️  {table}: Tabela não existe no destino (criar com deploy primeiro)")
        dest_conn.close()
        return 0

    # Limpar destino
    dest_cur.execute(f"DELETE FROM {table}")
    dest_conn.commit()

    # Inserir
    placeholders = ", ".join(["?"] * len(columns))
    cols_quoted = ", ".join(f'"{c}"' for c in columns)
    insert_sql = f'INSERT INTO "{table}" ({cols_quoted}) VALUES ({placeholders})'
    dest_cur.executemany(insert_sql, rows)
    dest_conn.commit()
    dest_conn.close()

    print(f"  ✅ {table}: {count} registros migrados")
    return count


def migrate_to_postgres(
    sqlite_conn: sqlite3.Connection,
    table: str,
    dry_run: bool,
) -> int:
    try:
        import psycopg2
        from psycopg2 import extras
    except ImportError:
        print("❌ Para destino PostgreSQL: pip install psycopg2-binary")
        return 0

    postgres_conn = psycopg2.connect(POSTGRES_DSN)
    postgres_cur = postgres_conn.cursor()
    sqlite_cur = sqlite_conn.cursor()

    sqlite_cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    if not sqlite_cur.fetchone():
        print(f"  ⏭️  {table}: Não existe no SQLite, pulando...")
        postgres_conn.close()
        return 0

    columns = get_table_columns(sqlite_cur, table)
    if not columns:
        postgres_conn.close()
        return 0

    sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = sqlite_cur.fetchone()[0]
    if count == 0:
        print(f"  ⏭️  {table}: Vazia, pulando...")
        postgres_conn.close()
        return 0

    if dry_run:
        print(f"  🔍 [DRY-RUN] {table}: {count} registros seriam migrados")
        postgres_conn.close()
        return count

    cols_str = ", ".join(columns)
    sqlite_cur.execute(f"SELECT {cols_str} FROM {table}")
    rows = sqlite_cur.fetchall()

    postgres_cur.execute(f'TRUNCATE TABLE "{table}" CASCADE')
    postgres_conn.commit()

    placeholders = ", ".join(["%s"] * len(columns))
    cols_quoted = ", ".join(f'"{c}"' for c in columns)
    insert_sql = f'INSERT INTO "{table}" ({cols_quoted}) VALUES ({placeholders})'
    extras.execute_batch(postgres_cur, insert_sql, rows, page_size=500)
    postgres_conn.commit()
    postgres_conn.close()

    print(f"  ✅ {table}: {count} registros migrados")
    return count


def reset_postgres_sequences():
    try:
        import psycopg2
    except ImportError:
        return
    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()
    print("\n🔄 Resetando sequences (PostgreSQL)...")
    for table in TABLES:
        try:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = %s AND column_default LIKE 'nextval%%'
                """,
                (table,),
            )
            for (col_name,) in cur.fetchall():
                cur.execute(
                    f'SELECT setval(pg_get_serial_sequence(%s, %s), '
                    f'COALESCE((SELECT MAX("{col_name}") FROM "{table}"), 1), true)',
                    (table, col_name),
                )
                conn.commit()
                print(f"  ✅ {table}.{col_name}")
        except Exception as e:
            print(f"  ⏭️  {table}: {e}")
    conn.close()


def main():
    sqlite_path = get_sqlite_path()
    dry_run = "--dry-run" in sys.argv

    if not sqlite_path.exists():
        print(f"❌ SQLite origem não encontrado: {sqlite_path}")
        return 1

    use_sqlite_dest = bool(SQLITE_DEST)
    use_postgres = bool(POSTGRES_DSN)

    if not dry_run and not use_sqlite_dest and not use_postgres:
        print("❌ Defina o destino:")
        print("   PostgreSQL: export ATELIE_POSTGRES_DSN='postgresql://...'")
        print("   SQLite:     export ATELIE_SQLITE_DEST='/caminho/atelie.db'")
        return 1

    if not dry_run and use_sqlite_dest and use_postgres:
        print("❌ Defina apenas um destino (ATELIE_SQLITE_DEST ou ATELIE_POSTGRES_DSN)")
        return 1

    target = "SQLite" if use_sqlite_dest else ("PostgreSQL" if use_postgres else "(dry-run)")
    print("=" * 60)
    print("📤 MIGRAÇÃO PLANO (apenas plano_itens e despesas_transacoes)")
    print("=" * 60)
    print(f"📂 Origem:  {sqlite_path}")
    print(f"📂 Destino: {target}")
    if use_sqlite_dest:
        print(f"            {SQLITE_DEST}")
    elif use_postgres:
        print(f"            {POSTGRES_DSN.split('@')[-1] if '@' in POSTGRES_DSN else '...'}")
    print("=" * 60)

    if dry_run and not use_sqlite_dest and not use_postgres:
        sqlite_conn = sqlite3.connect(str(sqlite_path))
        for table in TABLES:
            cur = sqlite_conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if not cur.fetchone():
                print(f"  ⏭️  {table}: Não existe")
                continue
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            n = cur.fetchone()[0]
            print(f"  🔍 [DRY-RUN] {table}: {n} registros seriam migrados")
        sqlite_conn.close()
        print("\n✅ Dry-run concluído. Defina ATELIE_SQLITE_DEST ou ATELIE_POSTGRES_DSN para migrar.")
        return 0

    if not dry_run and "--yes" not in sys.argv:
        confirm = input("\n⚠️  Sobrescrever dados do plano no destino? (sim/não): ")
        if confirm.lower() not in ["sim", "s", "yes", "y"]:
            print("❌ Cancelado")
            return 1

    sqlite_conn = sqlite3.connect(str(sqlite_path))
    total = 0

    if use_sqlite_dest:
        dest_path = Path(SQLITE_DEST)
        if not dest_path.exists():
            print(f"❌ Destino não encontrado: {dest_path}")
            sqlite_conn.close()
            return 1
        for table in TABLES:
            total += migrate_to_sqlite(sqlite_conn, dest_path, table, dry_run)
    else:
        for table in TABLES:
            total += migrate_to_postgres(sqlite_conn, table, dry_run)
        if not dry_run and total > 0:
            reset_postgres_sequences()

    sqlite_conn.close()
    print("\n✅ Migração do plano concluída.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
