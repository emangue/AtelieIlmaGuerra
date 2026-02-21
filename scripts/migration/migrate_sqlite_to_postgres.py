#!/usr/bin/env python3
"""
Script de Migração Completa SQLite → PostgreSQL
Ateliê Ilma Guerra

Migra TODOS os dados do SQLite local para PostgreSQL de produção.
Preserva integridade referencial e valida após migração.

Uso:
    export ATELIE_POSTGRES_DSN="postgresql://atelie_user:SENHA@148.230.78.91:5432/atelie_db"
    python scripts/migration/migrate_sqlite_to_postgres.py [--dry-run]
"""

import os
import sqlite3
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

try:
    import psycopg2
    from psycopg2 import extras
except ImportError:
    print("❌ Instale psycopg2-binary: pip install psycopg2-binary")
    sys.exit(1)

# Configurações
PROJECT_ROOT = Path(__file__).parent.parent.parent
DEFAULT_SQLITE = PROJECT_ROOT / "app_dev" / "backend" / "database" / "atelie.db"
POSTGRES_DSN = os.environ.get("ATELIE_POSTGRES_DSN", "")


def get_sqlite_path() -> Path:
    """SQLite path: --sqlite-path ou env ATELIE_SQLITE_PATH ou default"""
    for i, arg in enumerate(sys.argv):
        if arg == "--sqlite-path" and i + 1 < len(sys.argv):
            return Path(sys.argv[i + 1])
    if os.environ.get("ATELIE_SQLITE_PATH"):
        return Path(os.environ["ATELIE_SQLITE_PATH"])
    return DEFAULT_SQLITE


SQLITE_PATH = get_sqlite_path()

# Ordem importa - respeita foreign keys (tipo_pedido, clientes antes de pedidos/orcamentos)
TABLES_TO_MIGRATE = [
    "tipo_pedido",
    "users",
    "parametros_orcamento",
    "clientes",
    "orcamentos",
    "pedidos",
    "despesas_detalhadas",
    "contracts",
]

# SQLite armazena boolean como 0/1; PostgreSQL espera true/false
BOOLEAN_COLUMNS = {
    "clientes": ["flag_medidas"],
    "pedidos": ["medidas_disponiveis", "fotos_disponiveis"],
    "contracts": ["autoriza_imagem_completa"],
}


class MigrationStats:
    def __init__(self):
        self.tables_migrated = 0
        self.total_rows_migrated = 0
        self.errors: List[Tuple[str, str]] = []
        self.start_time = datetime.now()

    def add_table(self, table: str, rows: int):
        self.tables_migrated += 1
        self.total_rows_migrated += rows
        print(f"  ✅ {table}: {rows:,} registros")

    def add_error(self, table: str, error: str):
        self.errors.append((table, error))
        print(f"  ⚠️  {table}: {error}")

    def print_summary(self):
        duration = (datetime.now() - self.start_time).total_seconds()
        print("\n" + "=" * 70)
        print("📊 RESUMO DA MIGRAÇÃO")
        print("=" * 70)
        print(f"Tabelas migradas: {self.tables_migrated}/{len(TABLES_TO_MIGRATE)}")
        print(f"Total de registros: {self.total_rows_migrated:,}")
        print(f"Tempo total: {duration:.2f}s")
        if self.errors:
            print(f"\n⚠️  Erros encontrados: {len(self.errors)}")
            for table, error in self.errors:
                print(f"  - {table}: {error}")
        else:
            print("\n✅ Migração concluída sem erros!")
        print("=" * 70)


def get_table_columns(cursor, table: str) -> List[str]:
    """Busca nomes das colunas de uma tabela"""
    cursor.execute(f"PRAGMA table_info({table})")
    return [col[1] for col in cursor.fetchall()]


def migrate_table(
    sqlite_conn,
    postgres_conn,
    table: str,
    stats: MigrationStats,
    dry_run: bool = False,
) -> bool:
    """Migra uma tabela do SQLite para PostgreSQL"""

    try:
        sqlite_cur = sqlite_conn.cursor()
        postgres_cur = postgres_conn.cursor()

        # Buscar colunas
        columns = get_table_columns(sqlite_cur, table)
        if not columns:
            stats.add_error(table, "Tabela não encontrada no SQLite")
            return False

        # Contar registros no SQLite
        sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = sqlite_cur.fetchone()[0]

        if count == 0:
            print(f"  ⏭️  {table}: Vazia, pulando...")
            return True

        # Buscar todos os dados
        columns_str = ", ".join(columns)
        sqlite_cur.execute(f"SELECT {columns_str} FROM {table}")
        rows = sqlite_cur.fetchall()

        # Converter booleanos: SQLite 0/1 -> PostgreSQL true/false
        bool_cols = BOOLEAN_COLUMNS.get(table, [])
        if bool_cols:
            col_indices = {c: i for i, c in enumerate(columns)}

            def convert_row(row_tuple):
                lst = list(row_tuple)
                for col in bool_cols:
                    if col in col_indices:
                        idx = col_indices[col]
                        if lst[idx] == 1:
                            lst[idx] = True
                        elif lst[idx] == 0:
                            lst[idx] = False
                return tuple(lst)

            rows = [convert_row(r) for r in rows]

        if dry_run:
            print(f"  🔍 [DRY-RUN] {table}: {count:,} registros seriam migrados")
            return True

        # Limpar tabela no PostgreSQL
        postgres_cur.execute(f'TRUNCATE TABLE "{table}" CASCADE')

        # Inserir dados no PostgreSQL
        placeholders = ", ".join(["%s"] * len(columns))
        cols_quoted = ", ".join(f'"{c}"' for c in columns)
        insert_sql = f'INSERT INTO "{table}" ({cols_quoted}) VALUES ({placeholders})'

        extras.execute_batch(postgres_cur, insert_sql, rows, page_size=1000)
        postgres_conn.commit()

        # Validar migração
        postgres_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        pg_count = postgres_cur.fetchone()[0]

        if pg_count != count:
            stats.add_error(
                table, f"Contagens diferentes: SQLite={count}, PostgreSQL={pg_count}"
            )
            return False

        stats.add_table(table, count)
        return True

    except Exception as e:
        stats.add_error(table, str(e))
        postgres_conn.rollback()
        return False


def reset_sequences(postgres_conn):
    """Reseta sequences do PostgreSQL após migração"""
    print("\n🔄 Resetando sequences...")
    cursor = postgres_conn.cursor()

    for table in TABLES_TO_MIGRATE:
        try:
            cursor.execute(
                f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = %s AND column_default LIKE 'nextval%%'
                """,
                (table,),
            )
            seq_cols = cursor.fetchall()
            for (col_name,) in seq_cols:
                cursor.execute(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', '{col_name}'),
                        COALESCE((SELECT MAX("{col_name}") FROM "{table}"), 1),
                        true
                    )
                    """
                )
                postgres_conn.commit()
                print(f"  ✅ {table}.{col_name}")
        except Exception as e:
            print(f"  ⏭️  {table}: {e}")


def validate_migration(
    sqlite_conn, postgres_conn
) -> Tuple[Dict[str, Tuple[int, int]], bool]:
    """Valida migração comparando contagens"""
    print("\n🔍 Validando migração...")

    sqlite_cur = sqlite_conn.cursor()
    postgres_cur = postgres_conn.cursor()

    validation: Dict[str, Tuple[int, int]] = {}
    all_ok = True

    for table in TABLES_TO_MIGRATE:
        try:
            sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
            sqlite_count = sqlite_cur.fetchone()[0]

            postgres_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            postgres_count = postgres_cur.fetchone()[0]

            validation[table] = (sqlite_count, postgres_count)

            if sqlite_count != postgres_count:
                print(f"  ❌ {table}: SQLite={sqlite_count}, PostgreSQL={postgres_count}")
                all_ok = False
            else:
                print(f"  ✅ {table}: {sqlite_count:,} registros OK")

        except Exception as e:
            print(f"  ⚠️  {table}: Erro na validação - {e}")
            all_ok = False

    return validation, all_ok


def main():
    if not POSTGRES_DSN:
        print("❌ Defina ATELIE_POSTGRES_DSN com a URL do PostgreSQL")
        print("   Ex: export ATELIE_POSTGRES_DSN='postgresql://atelie_user:SENHA@148.230.78.91:5432/atelie_db'")
        return 1

    if not SQLITE_PATH.exists():
        print(f"❌ SQLite não encontrado: {SQLITE_PATH}")
        return 1

    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("🔍 MODO DRY-RUN - Nenhuma alteração será feita\n")

    print("=" * 70)
    print("🚀 MIGRAÇÃO: SQLite → PostgreSQL (Ateliê Ilma Guerra)")
    print("=" * 70)
    print(f"📂 SQLite:     {SQLITE_PATH}")
    print(f"🐘 PostgreSQL: {POSTGRES_DSN.split('@')[-1] if '@' in POSTGRES_DSN else '...'}")
    print(f"📊 Tabelas:    {len(TABLES_TO_MIGRATE)}")
    print("=" * 70)

    if not dry_run and "--yes" not in sys.argv:
        confirm = input(
            "\n⚠️  Esta operação vai SOBRESCREVER dados no PostgreSQL. Continuar? (sim/não): "
        )
        if confirm.lower() not in ["sim", "s", "yes", "y"]:
            print("❌ Migração cancelada pelo usuário")
            return 1

    # Conectar aos bancos
    print("\n📡 Conectando aos bancos de dados...")
    try:
        sqlite_conn = sqlite3.connect(str(SQLITE_PATH))
        postgres_conn = psycopg2.connect(POSTGRES_DSN)
        print("  ✅ Conexões estabelecidas")
    except Exception as e:
        print(f"  ❌ Erro ao conectar: {e}")
        return 1

    # Migrar tabelas
    print("\n📦 Migrando tabelas...")
    stats = MigrationStats()

    for table in TABLES_TO_MIGRATE:
        migrate_table(sqlite_conn, postgres_conn, table, stats, dry_run)

    # Resetar sequences (só se não for dry-run)
    if not dry_run:
        reset_sequences(postgres_conn)
        validate_migration(sqlite_conn, postgres_conn)

    # Fechar conexões
    sqlite_conn.close()
    postgres_conn.close()

    # Resumo
    stats.print_summary()

    return 0 if not stats.errors else 1


if __name__ == "__main__":
    sys.exit(main())
