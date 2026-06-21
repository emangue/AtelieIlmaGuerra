# Deploy — Tabela `pagamentos` + `despesas` na VM

**Data:** 29/abr/2026  
**Branch local:** `feature/seguranca-senha-transacoes`  
**Commit:** `c2d9ca8`  
**VM:** `gestao.atelieilmaguerra.com.br` (SSH alias: `minha-vps-hostinger`)  
**Código na VM:** `/var/www/atelie/`

---

## Estado atual da VM (antes do deploy)

| Tabela | Registros |
|---|---|
| `pedidos` | 1.714 (1.701 com status=Entregue) |
| `plano_itens` | 204 |
| `despesas_transacoes` | **0** (vazia — dados legados do Excel em `valor_realizado`) |
| `pagamentos` | **não existe ainda** |
| `despesas` | **não existe ainda** |
| `plano_itens` despesas com `valor_realizado > 0` | 9 itens, total R$ 9.020 |

> ⚠️ Os R$ 9.020 vivem em `plano_itens.valor_realizado` (importação Excel).  
> Esses dados **não serão tocados** — o `service.py` usa como fallback quando não há entrada em `pagamentos`.

---

## O que o deploy faz (automático via `startup` do FastAPI)

1. **Cria tabelas** `pagamentos` e `despesas` (via `Base.metadata.create_all` — idempotente)
2. **Migration 1** — popula `pagamentos` a partir dos pedidos entregues (1.701 receitas)
3. **Migration 2** — cria registros em `despesas` para pagamentos sem `despesa_id` (0 registros, noop)
4. **Migration 3** — zera `valor_realizado` de `plano_itens` órfãos (valor_planejado=0, sem entrada em `despesas_transacoes`) — **proteção contra resíduos**

> Todas as migrations são **idempotentes** (só rodam se a tabela estiver vazia).

---

## Micro-ações

### 1 — Backup do banco antes de tudo

```bash
ssh minha-vps-hostinger '
  cp /var/www/atelie/app_dev/backend/database/atelie.db \
     /var/www/atelie/app_dev/backend/database/atelie_backup_$(date +%Y%m%d_%H%M%S).db
  echo "Backup criado:"
  ls -lh /var/www/atelie/app_dev/backend/database/atelie_backup_*.db | tail -1
'
```

✅ Critério: mensagem "Backup criado" + tamanho > 0

---

### 2 — Push da branch local para o remote

```bash
cd /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra
git push origin feature/seguranca-senha-transacoes
```

✅ Critério: `Everything up-to-date` ou `Branch ... set up to track`

---

### 3 — Pull na VM

```bash
ssh minha-vps-hostinger '
  cd /var/www/atelie
  git fetch origin
  git checkout feature/seguranca-senha-transacoes 2>/dev/null || git checkout -b feature/seguranca-senha-transacoes origin/feature/seguranca-senha-transacoes
  git pull origin feature/seguranca-senha-transacoes
  git log --oneline -3
'
```

✅ Critério: último commit é `c2d9ca8 feat: tabela pagamentos + despesas como fonte-verdade`

---

### 4 — Instalar dependências Python (se houver novas)

```bash
ssh minha-vps-hostinger '
  cd /var/www/atelie/app_dev/backend
  /var/www/atelie/app_dev/backend/venv/bin/pip install -r requirements.txt -q
  echo "Deps OK"
'
```

✅ Critério: linha `Deps OK` sem erros

---

### 5 — Testar migration em dry-run (sem reiniciar o serviço)

```bash
ssh minha-vps-hostinger '
  cd /var/www/atelie/app_dev/backend
  /var/www/atelie/app_dev/backend/venv/bin/python3 -c "
import sqlite3
conn = sqlite3.connect(\"database/atelie.db\")
tables = [r[0] for r in conn.execute(\"SELECT name FROM sqlite_master WHERE type=\\\"table\\\"\").fetchall()]
print(\"Tabelas existentes:\", tables)
entregues = conn.execute(\"SELECT COUNT(*) FROM pedidos WHERE status=\\\"Entregue\\\"\").fetchone()[0]
print(f\"Pedidos Entregue: {entregues}\")
has_pag = \"pagamentos\" in tables
has_desp = \"despesas\" in tables
print(f\"pagamentos existe: {has_pag}\")
print(f\"despesas existe: {has_desp}\")
conn.close()
"
'
```

✅ Critério: `pagamentos existe: False`, `despesas existe: False`, `Pedidos Entregue: 1701`  
(confirma estado pré-deploy como esperado)

---

### 6 — Reiniciar o backend (aplica migrations)

```bash
ssh minha-vps-hostinger 'sudo systemctl restart atelie-backend && sleep 5 && systemctl is-active atelie-backend'
```

✅ Critério: `active`

---

### 7 — Validar migrations aplicadas

```bash
ssh minha-vps-hostinger '
  sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db "
SELECT name FROM sqlite_master WHERE type='"'"'table'"'"' AND name IN ('"'"'pagamentos'"'"','"'"'despesas'"'"');
SELECT COUNT(*) as pagamentos_receitas FROM pagamentos WHERE tipo='"'"'receita'"'"';
SELECT COUNT(*) as pagamentos_despesas FROM pagamentos WHERE tipo='"'"'despesa'"'"';
SELECT COUNT(*) as despesas FROM despesas;
"
'
```

✅ Critério esperado:
- `pagamentos` e `despesas` listados
- `pagamentos_receitas` ≈ 1.701
- `pagamentos_despesas` = 0 (nenhuma despesa nova lançada ainda)
- `despesas` = 0

---

### 8 — Validar que dados legados estão intactos

```bash
ssh minha-vps-hostinger '
  sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db "
SELECT COUNT(*) as pedidos FROM pedidos;
SELECT COUNT(*) as plano_itens FROM plano_itens;
SELECT COUNT(*) as com_realizado FROM plano_itens WHERE tipo='"'"'despesa'"'"' AND valor_realizado > 0;
SELECT SUM(valor_realizado) as soma_realizado FROM plano_itens WHERE tipo='"'"'despesa'"'"' AND valor_realizado > 0;
"
'
```

✅ Critério: `pedidos=1714`, `plano_itens=204`, `com_realizado=9`, `soma_realizado=9020`  
(nenhum dado foi alterado)

---

### 9 — Validar login e endpoint /pagamentos via HTTPS

```bash
curl -sk https://gestao.atelieilmaguerra.com.br/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@atelie.com","password":"admin123"}' \
  -c /tmp/vm_cookies.txt -b /tmp/vm_cookies.txt > /dev/null && \
curl -sk "https://gestao.atelieilmaguerra.com.br/api/v1/pagamentos?mes=202601" \
  -c /tmp/vm_cookies.txt -b /tmp/vm_cookies.txt | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('receitas:', d['total_receitas'], '| itens:', len(d['itens']))"
```

✅ Critério: `receitas: 9020.0 | itens: 41` (ou valor próximo — pedidos entregues em jan/2026)

---

### 10 — Build do frontend

```bash
ssh minha-vps-hostinger 'nohup bash -c "cd /var/www/atelie/app_dev/frontend && npm run build" > /tmp/frontend_build.log 2>&1 & echo PID:$!'
```

Aguardar ~90 segundos, depois:

```bash
ssh minha-vps-hostinger 'tail -20 /tmp/frontend_build.log'
```

✅ Critério: `Route (app)` listado sem erros de compilação

---

### 11 — Reiniciar frontend

```bash
ssh minha-vps-hostinger 'sudo systemctl restart atelie-frontend && sleep 5 && systemctl is-active atelie-frontend'
```

✅ Critério: `active`

---

### 12 — Validação final no browser

Acesse `https://gestao.atelieilmaguerra.com.br/mobile/financeiro`:

- [ ] Card **MOVIMENTAÇÕES** exibe receitas de pedidos entregues
- [ ] Botão **Lançar** → **Despesa** → **Valor realizado** → preencher e salvar → aparece na lista
- [ ] Clicar na despesa → sheet com todos os campos editáveis
- [ ] **Salvar alterações** → valor atualizado na lista e no card "Lucro realizado"
- [ ] **Excluir** → despesa some da lista e do card

---

## Rollback (se algo der errado)

```bash
ssh minha-vps-hostinger '
  # Restaurar backup do banco
  BACKUP=$(ls -t /var/www/atelie/app_dev/backend/database/atelie_backup_*.db | head -1)
  cp "$BACKUP" /var/www/atelie/app_dev/backend/database/atelie.db
  echo "Banco restaurado de: $BACKUP"

  # Voltar para a branch anterior (main)
  cd /var/www/atelie && git checkout main

  # Reiniciar serviços
  sudo systemctl restart atelie-backend atelie-frontend
  sleep 5
  systemctl is-active atelie-backend atelie-frontend
'
```

> As tabelas `pagamentos` e `despesas` criadas pelo deploy serão ignoradas após rollback  
> (o código antigo não as consulta). Os dados originais não foram modificados.

---

## Notas de segurança

- `pagamentos` é populado **apenas se a tabela estiver vazia** (migration idempotente)
- `plano_itens.valor_realizado` **não é alterado** — apenas lido como fallback
- O backup criado no passo 1 permite restaurar o estado exato pré-deploy
- `despesas_transacoes` permanece intacta para consulta de fallback pelo `service.py`
