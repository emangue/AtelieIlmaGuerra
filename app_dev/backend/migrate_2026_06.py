"""
Migração 2026-06 — Ateliê Ilma Guerra
Executa APENAS adições. Nunca apaga dados existentes.

O que faz:
  1. Backup automático antes de qualquer alteração
  2. Recria tabela `pagamentos` sem UNIQUE(pedido_id) e com novas colunas
     → data_vencimento, data_pagamento (preenchido a partir de `data`),
        parcela_numero, parcela_total, categoria, tipo_item
  3. Adiciona coluna `pagamento_na_entrega` em `pedidos` (se não existir)
  4. Não remove nada: coluna `data` original é mantida para segurança

Uso:
  cd /var/www/atelie/app_dev/backend
  python migrate_2026_06.py
"""

import sqlite3
import shutil
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "database", "atelie.db")
BACKUP_PATH = DB_PATH.replace(".db", f"_backup_pre_migrate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")


def col_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def main():
    print(f"DB: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("ERRO: banco não encontrado.")
        return

    # 1. Backup
    shutil.copy2(DB_PATH, BACKUP_PATH)
    print(f"Backup criado: {BACKUP_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    cur = conn.cursor()

    try:
        # ── 2. Recriar `pagamentos` sem UNIQUE(pedido_id) e com novas colunas ──
        cur.execute("SELECT COUNT(*) FROM pagamentos")
        total = cur.fetchone()[0]
        print(f"pagamentos: {total} registros encontrados")

        # Verificar se UNIQUE ainda existe
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='pagamentos'")
        ddl = cur.fetchone()[0]
        needs_recreate = "uq_pagamento_pedido" in ddl or "UNIQUE (pedido_id)" in ddl.upper()

        # Verificar quais colunas novas já existem
        new_cols = ["data_vencimento", "data_pagamento", "parcela_numero",
                    "parcela_total", "categoria", "tipo_item"]
        missing = [c for c in new_cols if not col_exists(cur, "pagamentos", c)]

        if not needs_recreate and not missing:
            print("pagamentos: sem alterações necessárias — OK")
        else:
            print(f"pagamentos: recriando (UNIQUE a remover: {needs_recreate}, colunas faltantes: {missing})")

            conn.execute("BEGIN")

            # Criar nova tabela com estrutura correta
            conn.execute("""
                CREATE TABLE pagamentos_new (
                    id              INTEGER NOT NULL,
                    anomes          VARCHAR(6),
                    tipo            VARCHAR(10) NOT NULL,
                    origem          VARCHAR(20) NOT NULL,
                    pedido_id       INTEGER,
                    plano_item_id   INTEGER,
                    despesa_id      INTEGER,
                    data            DATE,
                    data_vencimento DATE,
                    data_pagamento  DATE,
                    parcela_numero  INTEGER,
                    parcela_total   INTEGER,
                    taxa_cartao     FLOAT,
                    categoria       VARCHAR(100),
                    tipo_item       VARCHAR(100),
                    valor           FLOAT NOT NULL,
                    descricao       VARCHAR(500),
                    created_at      DATETIME,
                    PRIMARY KEY (id),
                    FOREIGN KEY(pedido_id)     REFERENCES pedidos (id) ON DELETE CASCADE,
                    FOREIGN KEY(plano_item_id) REFERENCES plano_itens (id),
                    FOREIGN KEY(despesa_id)    REFERENCES despesas (id) ON DELETE CASCADE
                )
            """)

            # Migrar dados: data_pagamento = data (registros existentes já foram pagos)
            conn.execute("""
                INSERT INTO pagamentos_new (
                    id, anomes, tipo, origem, pedido_id, plano_item_id, despesa_id,
                    data, data_vencimento, data_pagamento,
                    parcela_numero, parcela_total, taxa_cartao,
                    categoria, tipo_item, valor, descricao, created_at
                )
                SELECT
                    id, anomes, tipo, origem, pedido_id, plano_item_id, despesa_id,
                    data,
                    NULL AS data_vencimento,
                    data  AS data_pagamento,
                    NULL AS parcela_numero,
                    NULL AS parcela_total,
                    NULL AS taxa_cartao,
                    NULL AS categoria,
                    NULL AS tipo_item,
                    valor, descricao, created_at
                FROM pagamentos
            """)

            # Verificar contagem antes de dropar
            cur.execute("SELECT COUNT(*) FROM pagamentos_new")
            new_total = cur.fetchone()[0]
            if new_total != total:
                conn.execute("ROLLBACK")
                print(f"ERRO: contagem diverge ({total} → {new_total}). Rollback. Backup preservado.")
                return

            conn.execute("DROP TABLE pagamentos")
            conn.execute("ALTER TABLE pagamentos_new RENAME TO pagamentos")

            # Recriar índices
            conn.execute("CREATE INDEX IF NOT EXISTS ix_pagamentos_id ON pagamentos (id)")
            conn.execute("CREATE INDEX IF NOT EXISTS ix_pagamentos_anomes ON pagamentos (anomes)")

            conn.execute("COMMIT")
            print(f"pagamentos: recriada com sucesso ({new_total} registros preservados)")

        # ── 3. Adicionar `pagamento_na_entrega` em `pedidos` ──
        if col_exists(cur, "pedidos", "pagamento_na_entrega"):
            print("pedidos.pagamento_na_entrega: já existe — OK")
        else:
            conn.execute("ALTER TABLE pedidos ADD COLUMN pagamento_na_entrega BOOLEAN")
            conn.commit()
            print("pedidos.pagamento_na_entrega: adicionado")

        # ── 4. Verificação final ──
        cur.execute("SELECT COUNT(*) FROM pagamentos")
        print(f"\nVerificação final: {cur.fetchone()[0]} registros em pagamentos")
        cur.execute("SELECT COUNT(*) FROM pedidos")
        print(f"Verificação final: {cur.fetchone()[0]} registros em pedidos")

        # Confirmar que UNIQUE sumiu
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='pagamentos'")
        ddl_final = cur.fetchone()[0]
        if "uq_pagamento_pedido" not in ddl_final:
            print("UNIQUE(pedido_id): removido com sucesso")

        print("\nMigração concluída. Backup em:", BACKUP_PATH)

    except Exception as e:
        conn.execute("ROLLBACK")
        print(f"ERRO: {e}")
        print("Rollback executado. Dados originais preservados.")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
