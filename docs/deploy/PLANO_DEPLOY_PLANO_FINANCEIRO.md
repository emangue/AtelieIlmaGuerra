# Plano de Deploy — Plano Financeiro (CRUD + Transações)

**Branch:** `feature/plano-financeiro-transacoes-crud`  
**Objetivo:** Subir as melhorias do Plano Financeiro sem alterar as bases de clientes e pedidos.

---

## Escopo do Deploy

### O que será deployado

| Componente | Descrição |
|------------|-----------|
| **Base `plano_itens`** | Já existe. Novos endpoints: DELETE, PATCH estendido, aplicar-aos-futuros, opcoes-despesa |
| **Base `despesas_transacoes`** | **NOVA** — transações individuais de despesa |
| **Backend** | Novos endpoints e lógica de valor_realizado calculado |
| **Frontend** | Tela Plano com CRUD, modal despesa realizada, layout em tabela |

### O que NÃO será alterado

- **Base `clientes`** — intacta
- **Base `pedidos`** — intacta
- **Demais tabelas** — sem alteração de schema

---

## 1. Pré-requisitos

- Acesso SSH ao servidor (VM Hostinger)
- Branch `feature/plano-financeiro-transacoes-crud` com o commit aplicado
- Backup do banco antes do deploy (recomendado)

---

## 2. Backup Preventivo

```bash
# Na VM
cd /var/www/atelie
sudo -u postgres pg_dump atelie_db | gzip > backup_antes_plano_$(date +%Y%m%d).sql.gz
# Ou, se usar SQLite:
# cp app_dev/backend/database/atelie.db app_dev/backend/database/atelie.db.bak
```

---

## 3. Migração do Banco

### 3.1 Nova tabela `despesas_transacoes`

A tabela é criada automaticamente pelo `Base.metadata.create_all()` no startup do FastAPI, pois o modelo `DespesaTransacao` é importado em `main.py`.

**Se precisar criar manualmente (PostgreSQL):**

```sql
CREATE TABLE IF NOT EXISTS despesas_transacoes (
    id SERIAL PRIMARY KEY,
    anomes VARCHAR(6) NOT NULL,
    plano_item_id INTEGER NOT NULL REFERENCES plano_itens(id),
    valor FLOAT NOT NULL,
    data DATE,
    descricao VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_despesas_transacoes_anomes ON despesas_transacoes(anomes);
CREATE INDEX IF NOT EXISTS ix_despesas_transacoes_plano_item_id ON despesas_transacoes(plano_item_id);
```

**SQLite (desenvolvimento):**

```sql
CREATE TABLE IF NOT EXISTS despesas_transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anomes VARCHAR(6) NOT NULL,
    plano_item_id INTEGER NOT NULL REFERENCES plano_itens(id),
    valor FLOAT NOT NULL,
    data DATE,
    descricao VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_despesas_transacoes_anomes ON despesas_transacoes(anomes);
CREATE INDEX IF NOT EXISTS ix_despesas_transacoes_plano_item_id ON despesas_transacoes(plano_item_id);
```

### 3.2 Base `plano_itens`

- **Sem alteração de schema.** A tabela é criada pelo `create_all` se não existir.
- O campo `valor_realizado` continua existindo; passa a ser calculado a partir de `despesas_transacoes` quando houver transações.
- Dados legados em `valor_realizado` continuam válidos (fallback).

### 3.3 Migração dos dados do plano (local → prod)

#### Opção A: Produção usa **SQLite** (caso da VM atual)

Use o script que copia o banco e migra na VM:

```bash
# Um comando faz tudo: SCP + migração na VM
./scripts/migration/sync_plano_sqlite_to_vm.sh

# Ou com host customizado:
./scripts/migration/sync_plano_sqlite_to_vm.sh minha-vps-hostinger
```

Ou manualmente:

```bash
# 1. Copiar banco local para a VM
scp app_dev/backend/database/atelie.db minha-vps:/tmp/atelie_local.db

# 2. Na VM: migrar plano
ssh minha-vps "cd /var/www/atelie && source app_dev/backend/venv/bin/activate && \
  ATELIE_SQLITE_PATH=/tmp/atelie_local.db \
  ATELIE_SQLITE_DEST=/var/www/atelie/app_dev/backend/database/atelie.db \
  python scripts/migration/migrate_plano_to_prod.py --yes"
```

#### Opção B: Produção usa **PostgreSQL**

```bash
export ATELIE_POSTGRES_DSN="postgresql://atelie_user:SENHA@HOST:5432/atelie_db"
python scripts/migration/migrate_plano_to_prod.py
```

#### Dry-run (qualquer destino)

```bash
python scripts/migration/migrate_plano_to_prod.py --dry-run
```

O script **não altera** clientes, pedidos ou outras tabelas.

### 3.4 Seed do plano (alternativa)

Se preferir importar do Excel em vez de migrar do SQLite:

```bash
cd /var/www/atelie/app_dev/backend
source venv/bin/activate
python -m app.domains.plano.seed_plano
```

Requer o arquivo `PLANO 2026 ATELIE ILMA GUERRA.xlsx` na raiz do projeto.

---

## 4. Deploy do Código

### 4.1 Local

```bash
# Garantir que está na branch correta
git checkout feature/plano-financeiro-transacoes-crud

# Deploy (usa scripts existentes)
./scripts/deploy.sh
# ou: ./scripts/deploy.sh 148.230.78.91
```

O script faz:
- Build do frontend
- Rsync para `/var/www/atelie/`
- Não envia `.env`, `*.db`, `uploads/`

### 4.2 Na VM — Pós-deploy

```bash
ssh minha-vps-hostinger  # ou IP
cd /var/www/atelie
bash scripts/deploy/pos_deploy_vm.sh
```

Isso reinstala dependências, faz build do frontend e reinicia os serviços.

---

## 5. Verificação da Nova Tabela

Após o restart do backend:

```bash
# PostgreSQL
sudo -u postgres psql atelie_db -c "\dt despesas_transacoes"

# Ou via API
curl -s https://gestao.atelieilmaguerra.com.br/api/health
curl -s "https://gestao.atelieilmaguerra.com.br/api/v1/plano/opcoes-despesa?mes=202601" | head -c 200
```

---

## 6. Novos Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| DELETE | `/api/v1/plano/{id}` | Deletar item do plano |
| PATCH | `/api/v1/plano/{id}` | Editar item (valor_planejado, etc.) |
| GET | `/api/v1/plano/opcoes-despesa?mes=YYYYMM` | Opções para dropdown de despesa |
| POST | `/api/v1/plano/aplicar-aos-futuros` | Aplicar valor aos meses futuros |
| GET | `/api/v1/transacoes-despesas?mes=YYYYMM` | Listar transações do mês |
| POST | `/api/v1/transacoes-despesas` | Criar transação |
| PATCH | `/api/v1/transacoes-despesas/{id}` | Editar transação |
| DELETE | `/api/v1/transacoes-despesas/{id}` | Deletar transação |

---

## 7. Checklist de Deploy

| # | Ação | Status |
|---|------|--------|
| 1 | Backup do banco | ☐ |
| 2 | `git checkout feature/plano-financeiro-transacoes-crud` | ☐ |
| 3 | `./scripts/deploy.sh` (local) | ☐ |
| 4 | `bash scripts/deploy/pos_deploy_vm.sh` (VM) | ☐ |
| 5 | Verificar criação de `despesas_transacoes` | ☐ |
| 6 | **Migrar dados do plano:** `./scripts/migration/sync_plano_sqlite_to_vm.sh` (SQLite) ou `migrate_plano_to_prod.py` (PostgreSQL) | ☐ |
| 7 | Testar `/api/v1/plano/opcoes-despesa?mes=202601` | ☐ |
| 8 | Testar tela Plano no frontend (login + /mobile/plano) | ☐ |

---

## 8. Rollback

Se houver problema:

1. Fazer checkout da branch anterior: `git checkout feature/plano-financeiro-graficos` (ou `main`)
2. Rodar `./scripts/deploy.sh` novamente
3. Restaurar backup do banco se necessário (a tabela `despesas_transacoes` pode ficar vazia; não afeta clientes/pedidos)

---

## 9. Resumo

- **Bases alteradas:** nenhuma existente (clientes, pedidos intactas)
- **Nova base:** `despesas_transacoes`
- **Base plano_itens:** sem alteração de schema; dados migrados do local via `migrate_plano_to_prod.py`
- **Frontend:** tela Plano atualizada
- **Backend:** novos endpoints e service ajustado

---

## 10. Base plano_itens — o que fazemos

| Situação | Ação |
|----------|------|
| **Prod SQLite (VM atual)** | Usar `sync_plano_sqlite_to_vm.sh` — copia o banco e migra na VM |
| **Prod PostgreSQL** | Usar `migrate_plano_to_prod.py` com `ATELIE_POSTGRES_DSN` |
| **Prod já tem dados** | O script **substitui** os dados do plano. Faça backup antes |
