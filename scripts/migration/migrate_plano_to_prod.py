#!/usr/bin/env python3
"""
Migração APENAS de plano_itens e despesas_transacoes
SQLite (local) → PostgreSQL (produção)

NÃO altera: clientes, pedidos, orçamentos, contracts, etc.

Uso:
    export ATELIE_POSTGRES_DSN="postgresql://atelie_user:SENHA@HOST:5432/atelie_db"
    python scripts/migration/migrate_plano_to_prod.py [--dry-run]

Ou com SQLite customizado:
    export ATELIE_SQLITE_PATH="/caminho/para/atelie.db"
    python scripts/migration/migrate_plano_to_prod.py
"""

import os
import sqlite3
import sys
from pathlib import Path
from datetime import datetime

try:
    import psycopg2
    from psycopg2 import extras
except ImportError:
    print("❌ Instale psycopg2-binary: pip install psycopg2-binary")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = PROJECT_ROOT / "app_dev" / "backend" / "database" / "atelie.db"
POSTGRES_DSN = os.environ.get("ATELIE_POSTGRES_DSN", "")

# Ordem: plano_itens primeiro (despesas_transacoes tem FK para plano_itens)
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


def migrate_table(sqlite_conn, postgres_conn, table: str, dry_run: bool) -> int:
    sqlite_cur = sqlite_conn.cursor()
    postgres_cur = postgres_conn.cursor()

    # Verificar se tabela existe no SQLite
    sqlite_cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    )
    if not sqlite_cur.fetchone():
        print(f"  ⏭️  {table}: Não existe no SQLite, pulando...")
        return 0

    columns = get_table_columns(sqlite_cur, table)
    if not columns:
        print(f"  ⚠️  {table}: Sem colunas")
        return 0

    sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = sqlite_cur.fetchone()[0]
    if count == 0:
        print(f"  ⏭️  {table}: Vazia, pulando...")
        return 0

    if dry_run:
        print(f"  🔍 [DRY-RUN] {table}: {count} registros seriam migrados")
        return count

    # Buscar dados
    cols_str = ", ".join(columns)
    sqlite_cur.execute(f"SELECT {cols_str} FROM {table}")
    rows = sqlite_cur.fetchall()

    # Limpar no PostgreSQL (CASCADE para despesas_transacoes se truncar plano_itens)
    postgres_cur.execute(f'TRUNCATE TABLE "{table}" CASCADE')
    postgres_conn.commit()

    # Inserir
    placeholders = ", ".join(["%s"] * len(columns))
    cols_quoted = ", ".join(f'"{c}"' for c in columns)
    insert_sql = f'INSERT INTO "{table}" ({cols_quoted}) VALUES ({placeholders})'
    extras.execute_batch(postgres_cur, insert_sql, rows, page_size=500)
    postgres_conn.commit()

    print(f"  ✅ {table}: {count} registros migrados")
    return count


def reset_sequences(postgres_conn):
    print("\n🔄 Resetando sequences...")
    cur = postgres_conn.cursor()
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
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence(%s, %s),
                        COALESCE((SELECT MAX("{col_name}") FROM "{table}"), 1),
                        true
                    )
                    """,
                    (table, col_name),
                )
                postgres_conn.commit()
                print(f"  ✅ {table}.{col_name}")
        except Exception as e:
            print(f"  ⏭️  {table}: {e}")


def main():
    sqlite_path = get_sqlite_path()
    dry_run = "--dry-run" in sys.argv

    if not POSTGRES_DSN and not dry_run:
        print("❌ Defina ATELIE_POSTGRES_DSN")
        print("   Ex: export ATELIE_POSTGRES_DSN='postgresql://atelie_user:SENHA@HOST:5432/atelie_db'")
        return 1
    if not sqlite_path.exists():
        print(f"❌ SQLite não encontrado: {sqlite_path}")
        return 1

    print("=" * 60)
    print("📤 MIGRAÇÃO PLANO: SQLite → PostgreSQL")
    print("   (apenas plano_itens e despesas_transacoes)")
    print("=" * 60)
    print(f"📂 SQLite:     {sqlite_path}")
    print(f"🐘 PostgreSQL: {POSTGRES_DSN.split('@')[-1] if '@' in POSTGRES_DSN else '(dry-run: não conecta)'}")
    print("=" * 60)

    if dry_run and not POSTGRES_DSN:
        sqlite_conn = sqlite3.connect(str(sqlite_path))
        for table in TABLES:
            sqlite_cur = sqlite_conn.cursor()
            sqlite_cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if not sqlite_cur.fetchone():
                print(f"  ⏭️  {table}: Não existe no SQLite")
                continue
            sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
            n = sqlite_cur.fetchone()[0]
            print(f"  🔍 [DRY-RUN] {table}: {n} registros seriam migrados")
        sqlite_conn.close()
        print("\n✅ Dry-run concluído. Para migrar de verdade, defina ATELIE_POSTGRES_DSN.")
        return 0

    if not dry_run and "--yes" not in sys.argv:
        confirm = input("\n⚠️  Sobrescrever plano no PostgreSQL? (sim/não): ")
        if confirm.lower() not in ["sim", "s", "yes", "y"]:
            print("❌ Cancelado")
            return 1

    try:
        sqlite_conn = sqlite3.connect(str(sqlite_path))
        postgres_conn = psycopg2.connect(POSTGRES_DSN)
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return 1

    total = 0
    for table in TABLES:
        total += migrate_table(sqlite_conn, postgres_conn, table, dry_run)

    if not dry_run and total > 0:
        reset_sequences(postgres_conn)

    sqlite_conn.close()
    postgres_conn.close()

    print("\n✅ Migração do plano concluída.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
