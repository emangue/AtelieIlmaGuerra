# 🚀 Guia de Deploy — Ateliê Ilma Guerra · Abril 2026

> **Baseado em:** [SPEC_DEPLOY_ABRIL_2026.md](SPEC_DEPLOY_ABRIL_2026.md)  
> **Data:** 24 de abril de 2026  
> **Destino:** VM Hostinger em `gestao.atelieilmaguerra.com.br`  
> **⭐ Regra absoluta:** o banco da VM tem dados reais. Toda operação de banco é ADITIVA. Nunca drop, nunca substituir o `.db`.

---

## 📋 Resumo do que vai para a VM

| Commit | O que muda | Risco |
|--------|-----------|-------|
| `ac3007a` | CRUD plano, modal de despesa, nova tabela `despesas_transacoes` | 🔴 Banco |
| `2fd3ee8` | Script de migração de dados | 🟡 Dados |
| `f0f3562` | Fix `0.0.0.0` no backend, scripts de infra | 🟢 Baixo |

---

## ⚠️ Pré-requisitos antes de começar

- Acesso SSH à VM: `ssh minha-vps-hostinger`  
  *(ajuste o alias ou use `ssh user@IP` conforme seu `~/.ssh/config`)*
- Branch `feature/deploy-vm-abril-2026` (ou `main`) já no GitHub com todos os commits acima
- Terminal local aberto na raiz do projeto

---

## FASE 0 — Preparação local

### Passo 0.1 — Confirmar branch no GitHub

```bash
git log --oneline origin/main | head -5
```

Você deve ver o commit `f0f3562` (ou mais recente) no topo. Se não aparecer, faça push antes de continuar.

---

### Passo 0.2 — Remover arquivos duplicados com " 2" no nome

> Esses arquivos são cópias acidentais. Devem ser removidos antes de qualquer merge/deploy.

```bash
cd /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra

# Listar todos os arquivos " 2" para revisar antes de apagar
find . -name "* 2.*" -not -path "./.git/*"
```

Confira a lista. Se todos são cópias desnecessárias:

```bash
# Remover do git tracking e do disco
find . -name "* 2.*" -not -path "./.git/*" -exec git rm -f "{}" \;

# Commitar a limpeza
git add -A
git commit -m "chore: remove arquivos duplicados com ' 2' no nome"
git push
```

---

### Passo 0.3 — Verificar variáveis de ambiente novas

```bash
cat app_dev/backend/.env.example
```

Compare com o `.env` da VM (veja no próximo passo). Se houver variável nova que não está no `.env` da VM, anote aqui para adicionar manualmente depois do `git pull`.

> Variáveis adicionadas desde o último deploy: *(preencha após comparar)*

---

### Passo 0.4 — Testar build do frontend localmente

```bash
cd app_dev/frontend
npm run build
```

✅ Esperado: sem erros TypeScript, sem erros Next.js.  
❌ Se falhar: corrija antes de continuar o deploy.

```bash
cd ../..   # voltar à raiz
```

---

### Passo 0.5 — Dry-run da migração de banco

```bash
python scripts/migration/migrate_plano_to_prod.py --dry-run
```

Confirme que as contagens de `plano_itens` e `despesas_transacoes` estão corretas antes de rodar em produção.

---

## FASE 1 — Backup obrigatório da VM

> **Nunca pule essa fase.** É o seu único seguro em caso de erro.

### Passo 1.1 — Backup do banco SQLite na VM

```bash
ssh minha-vps-hostinger \
  "cp /var/www/atelie/app_dev/backend/database/atelie.db \
      /var/www/atelie/app_dev/backend/database/atelie_backup_$(date +%Y%m%d_%H%M%S).db \
   && echo 'Backup criado:' \
   && ls -lh /var/www/atelie/app_dev/backend/database/atelie_backup_*.db | tail -1"
```

**Anote o nome do arquivo de backup** (ex: `atelie_backup_20260424_143000.db`) — você vai precisar se precisar fazer rollback.

---

### Passo 1.2 — Baixar cópia do banco localmente

```bash
scp minha-vps-hostinger:/var/www/atelie/app_dev/backend/database/atelie.db \
    ~/Desktop/atelie_backup_$(date +%Y%m%d_%H%M%S).db

echo "✅ Backup local salvo em ~/Desktop"
```

---

### Passo 1.3 — Verificar saúde atual da VM

```bash
ssh minha-vps-hostinger "
  echo '=== Status dos serviços ==='
  systemctl status atelie-backend atelie-frontend --no-pager | grep -E 'Active|●'
  echo ''
  echo '=== Commit atual na VM ==='
  git -C /var/www/atelie log --oneline -1
  echo ''
  echo '=== Health check ==='
  curl -s http://localhost:8001/health | head -3
"
```

✅ Esperado:
- `Active: active (running)` para ambos os serviços
- Commit hash `2a513d9` (ou anterior)
- Resposta JSON do health check

Se qualquer serviço estiver DOWN antes do deploy, **não continue** — investigue e corrija primeiro.

---

## FASE 2 — Migração de banco na VM

> **Execute ANTES do `git pull`** — o novo código referencia a tabela `despesas_transacoes`. Se ela não existir quando o backend iniciar, ele vai crashar.

### Passo 2.1 — Criar a tabela `despesas_transacoes`

```bash
ssh minha-vps-hostinger "sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db \"
CREATE TABLE IF NOT EXISTS despesas_transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plano_item_id INTEGER NOT NULL REFERENCES plano_itens(id),
    valor REAL NOT NULL,
    descricao TEXT,
    data TEXT NOT NULL,
    categoria TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
SELECT 'Tabela criada ou já existe: ' || count(*) || ' registros' FROM despesas_transacoes;
\""
```

✅ Esperado: mensagem de sucesso sem erro. O `IF NOT EXISTS` garante que é seguro rodar mesmo se a tabela já existir.

---

### Passo 2.2 — Verificar colunas da tabela `plano_itens`

```bash
ssh minha-vps-hostinger "sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db \
  'PRAGMA table_info(plano_itens);'"
```

Compare as colunas retornadas com o modelo local em `app_dev/backend/app/domains/plano/models.py`.  
Se houver colunas faltando, adicione com:

```bash
# Exemplo (substitua <coluna> e <tipo> pelo real)
ssh minha-vps-hostinger "sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db \
  'ALTER TABLE plano_itens ADD COLUMN <coluna> <tipo> DEFAULT <valor>;'"
```

> Use `ALTER TABLE ... ADD COLUMN` — nunca recrie a tabela.

---

### Passo 2.3 — Verificar contagem de registros antes da migração

```bash
ssh minha-vps-hostinger "sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db \
  'SELECT count(*) as plano_itens FROM plano_itens; SELECT count(*) as despesas_transacoes FROM despesas_transacoes;'"
```

Anote os números. Eles serão usados para validar depois do deploy.

---

### Passo 2.4 — Migrar dados do plano local para a VM (opcional)

> Execute **somente se** os dados do plano local são mais completos/atualizados que os da VM.  
> Se a VM já tem dados de plano mais recentes, **pule este passo**.

```bash
# 1. Enviar o banco local para a VM
scp app_dev/backend/database/atelie.db \
    minha-vps-hostinger:/tmp/atelie_local.db

# 2. Rodar a migração na VM (só plano_itens e despesas_transacoes)
ssh minha-vps-hostinger "cd /var/www/atelie && \
  ATELIE_SQLITE_PATH=/tmp/atelie_local.db \
  ATELIE_SQLITE_DEST=/var/www/atelie/app_dev/backend/database/atelie.db \
  source app_dev/backend/venv/bin/activate 2>/dev/null || true && \
  python3 scripts/migration/migrate_plano_to_prod.py"
```

---

## FASE 3 — Atualização do código na VM

### Passo 3.1 — Git pull

```bash
ssh minha-vps-hostinger "
  cd /var/www/atelie
  git fetch origin
  git status
  git pull origin main
  echo ''
  echo '=== Commit após pull ==='
  git log --oneline -3
"
```

✅ Esperado: pull limpo, sem conflitos, commit hash atualizado para `f0f3562` (ou mais recente).  
❌ Se houver conflito: **não force** — avalie e resolva manualmente.

---

### Passo 3.2 — Instalar dependências Python

```bash
ssh minha-vps-hostinger "
  cd /var/www/atelie/app_dev/backend
  source venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt
  echo '✅ pip install concluído'
"
```

---

### Passo 3.3 — Build do frontend na VM

```bash
ssh minha-vps-hostinger "
  cd /var/www/atelie/app_dev/frontend
  npm ci
  npm run build
  echo '✅ Build frontend concluído'
"
```

> Se falhar por falta de memória RAM:
> ```bash
> ssh minha-vps-hostinger "cd /var/www/atelie/app_dev/frontend && \
>   NODE_OPTIONS=--max-old-space-size=512 npm run build"
> ```

---

### Passo 3.4 — Atualizar o serviço systemd do backend

Primeiro, verifique se a unidade atual já tem `--host 0.0.0.0`:

```bash
ssh minha-vps-hostinger "grep 'ExecStart' /etc/systemd/system/atelie-backend.service"
```

Se **não tiver** `0.0.0.0`, atualize:

```bash
ssh minha-vps-hostinger "
  cp /var/www/atelie/scripts/deploy/atelie-backend.service /etc/systemd/system/atelie-backend.service
  cp /var/www/atelie/scripts/deploy/atelie-frontend.service /etc/systemd/system/atelie-frontend.service
  systemctl daemon-reload
  echo '✅ Units atualizados'
"
```

> O novo `atelie-backend.service` usa `--host 0.0.0.0 --port 8001` — necessário para o Nginx em Docker rotear corretamente.

---

### Passo 3.5 — (Alternativa) Usar o script de pós-deploy automático

Se preferir automatizar os passos 3.2 a 3.4 de uma vez:

```bash
ssh minha-vps-hostinger "cd /var/www/atelie && sudo bash scripts/deploy/pos_deploy_vm.sh"
```

> O script cuida de: venv, pip, npm ci, build, systemd units, permissões e restart. Não sobrescreve `.env` existente.

---

### Passo 3.6 — Adicionar variáveis de ambiente novas (se houver)

Se no Passo 0.3 você identificou variáveis novas:

```bash
ssh minha-vps-hostinger "nano /var/www/atelie/app_dev/backend/.env"
```

Adicione as variáveis novas ao final do arquivo. **Nunca sobrescreva** — apenas adicione.

---

### Passo 3.7 — Reiniciar os serviços

```bash
ssh minha-vps-hostinger "
  systemctl restart atelie-backend atelie-frontend
  sleep 5
  systemctl status atelie-backend atelie-frontend --no-pager | grep -E 'Active|●'
"
```

✅ Esperado: `Active: active (running)` para os dois serviços.

---

## FASE 4 — Validação pós-deploy

### Passo 4.1 — Health check do backend

```bash
# Via internet (URL pública)
curl -s https://gestao.atelieilmaguerra.com.br/api/health

# Via SSH direto ao processo (mais confiável)
ssh minha-vps-hostinger "curl -s http://localhost:8001/health"
```

✅ Esperado: `{"status": "ok"}` ou similar com HTTP 200.

---

### Passo 4.2 — Validar endpoint de transações (novo)

```bash
# Obtenha o token de acesso logando primeiro ou use o cookie da sessão
ssh minha-vps-hostinger "curl -s http://localhost:8001/api/v1/plano/transacoes-despesas \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI'"
```

✅ Esperado: lista JSON (pode ser `[]` vazia), não 404 nem 500.

---

### Passo 4.3 — Validar contagem de registros no banco

```bash
ssh minha-vps-hostinger "sqlite3 /var/www/atelie/app_dev/backend/database/atelie.db \
  'SELECT count(*) as plano_itens FROM plano_itens; SELECT count(*) as despesas_transacoes FROM despesas_transacoes;'"
```

✅ Os números devem ser ≥ aos anotados no Passo 2.3. Nunca devem ser zero se havia dados antes.

---

### Passo 4.4 — Monitorar logs por 5 minutos

```bash
ssh minha-vps-hostinger "journalctl -u atelie-backend -f --since '2 min ago'"
```

Pressione `Ctrl+C` para sair após 5 minutos.

🔍 Busque por:
- `ERROR` ou `CRITICAL` → investigar
- `Table despesas_transacoes doesn't exist` → rollback imediato (Fase 5)
- `500 Internal Server Error` repetidos → investigar rota

---

### Passo 4.5 — Teste funcional no celular/browser

Acesse `https://gestao.atelieilmaguerra.com.br` e valide:

- [ ] Login com `admin@atelie.com` / `admin123`
- [ ] Home mobile carrega sem erro
- [ ] Menu → **Plano Financeiro** → lista de itens aparece
- [ ] Clica em um item → modal de despesa abre e **salva** sem erro
- [ ] Menu → **Contratos** → **Novo Contrato** → formulário abre
- [ ] Preenche e gera o PDF → download funciona
- [ ] Menu → **Pedidos** → lista carrega normalmente
- [ ] Menu → **Clientes** → lista carrega normalmente

---

### Passo 4.6 — Executar script de validação completo

```bash
ssh minha-vps-hostinger "cd /var/www/atelie && bash scripts/validar_deploy_vm.sh"
```

---

## FASE 5 — Rollback de emergência

> Execute **somente** se algo quebrou e não consegue corrigir rapidamente.

### Rollback do banco de dados

```bash
# Substitua YYYYMMDD_HHMMSS pelo nome do arquivo anotado no Passo 1.1
ssh minha-vps-hostinger "
  systemctl stop atelie-backend
  cp /var/www/atelie/app_dev/backend/database/atelie_backup_YYYYMMDD_HHMMSS.db \
     /var/www/atelie/app_dev/backend/database/atelie.db
  systemctl start atelie-backend
  echo '✅ Banco restaurado'
"
```

### Rollback do código

```bash
ssh minha-vps-hostinger "
  cd /var/www/atelie
  git checkout 2a513d9
  systemctl restart atelie-backend atelie-frontend
  echo '✅ Código revertido para 2a513d9'
"
```

### Confirmar rollback

```bash
ssh minha-vps-hostinger "curl -s http://localhost:8001/health && \
  git -C /var/www/atelie log --oneline -1"
```

---

## ✅ Checklist completo de execução

Copie e use como checklist durante o deploy:

```
FASE 0 — Preparação local
[ ] 0.1  Branch confirmada no GitHub (commit f0f3562 presente)
[ ] 0.2  Arquivos " 2" removidos e commitados
[ ] 0.3  Variáveis de ambiente novas identificadas
[ ] 0.4  Build do frontend local: OK sem erros
[ ] 0.5  Dry-run da migração: OK

FASE 1 — Backup (NUNCA pular)
[ ] 1.1  ⭐ Backup do banco na VM — nome do arquivo anotado: _______________
[ ] 1.2  ⭐ Cópia local do banco salva em ~/Desktop
[ ] 1.3  VM saudável: backend e frontend UP antes do deploy

FASE 2 — Migração de banco
[ ] 2.1  CREATE TABLE despesas_transacoes (IF NOT EXISTS) — sem erro
[ ] 2.2  Colunas de plano_itens verificadas / ALTER TABLE feito se necessário
[ ] 2.3  Contagens antes do deploy anotadas: plano_itens=___ despesas_transacoes=___
[ ] 2.4  Migração de dados rodada (ou pulada — justificativa: _______________)

FASE 3 — Código
[ ] 3.1  git pull — limpo, sem conflitos
[ ] 3.2  pip install requirements — OK
[ ] 3.3  npm ci + npm run build — OK
[ ] 3.4  atelie-backend.service tem --host 0.0.0.0 (verificado/atualizado)
[ ] 3.5  (opcional) pos_deploy_vm.sh rodado
[ ] 3.6  Variáveis de ambiente novas adicionadas ao .env (se aplicável)
[ ] 3.7  Serviços reiniciados — Active: running

FASE 4 — Validação
[ ] 4.1  Health check: HTTP 200 OK
[ ] 4.2  Endpoint /api/v1/plano/transacoes-despesas: responde (não 404/500)
[ ] 4.3  Contagens após deploy: plano_itens=___ despesas_transacoes=___ (≥ antes)
[ ] 4.4  Logs monitorados por 5 min — sem ERROR/CRITICAL
[ ] 4.5  Teste funcional no celular — todos os fluxos OK
[ ] 4.6  Script validar_deploy_vm.sh executado — OK
```

---

## ⚠️ Regras de ouro do banco

| ✅ PODE | ❌ PROIBIDO |
|--------|-----------|
| `CREATE TABLE IF NOT EXISTS` | `DROP TABLE` |
| `ALTER TABLE ADD COLUMN` | `DROP COLUMN` |
| `INSERT OR IGNORE` | `DELETE FROM` sem `WHERE` |
| `UPDATE` com `WHERE id = X` | Substituir `atelie.db` pelo banco local |
| Backup antes de qualquer DDL | Rodar `init_db.py` (recria tudo do zero) |

---

## 🧠 Lições aprendidas — Deploy 24/04/2026

> Estas notas evitam retrabalho em próximos deploys.

### Infraestrutura real da VM
- O **nginx roda como container Docker** (`infra_nginx`), não como serviço systemd.
  O `nginx.service` systemd está inativo — isso é **normal**.
- Porta real do backend: **8001** (não 8000). Porta 8000 é o `finup_backend_prod` (outro projeto).
- Para testar o backend diretamente: `curl http://localhost:8001/api/v1/...`
- Para testar via HTTPS externo: `curl -sk https://gestao.atelieilmaguerra.com.br/api/v1/...`

### Domínio
- Domínio correto: `gestao.atelieilmaguerra.com**.br**` (o `.com` sem `.br` não existe/não resolve)

### Banco de dados — campo de senha
- O campo de senha em `users` é `password_hash` (não `hashed_password`)
- A função de hash em `password_utils.py` é `hash_password()` (não `get_password_hash()`)
- Se o login falhar após deploy, checar se o campo foi atualizado corretamente

### Build do frontend
- `npm run build` demora ~2 min e faz o SSH dar timeout
- **Solução obrigatória:** usar `nohup ... &` para rodar em background e verificar `/tmp/frontend_build.log` após ~90s

### Stash/pull com modificações locais na VM
- A VM pode ter arquivos modificados (configs de systemd copiados, etc.)
- Antes do `git pull`: `git stash` para rastreados + `git clean -fd` para não-rastreados que conflitem
- Verificar com `git status` antes de qualquer pull

### Teste de login — armadilha dos workers
- O uvicorn tem **2 workers**. Após resetar senha diretamente no SQLite e reiniciar o backend, aguardar os 2 workers subirem antes de testar o login (checar `journalctl -u atelie-backend -n 5`)

---

## 🔗 Referências

| Documento | Link |
|-----------|------|
| Spec técnica | [SPEC_DEPLOY_ABRIL_2026.md](SPEC_DEPLOY_ABRIL_2026.md) |
| Diff local vs servidor | [../DIFF_LOCAL_VS_SERVIDOR.md](../DIFF_LOCAL_VS_SERVIDOR.md) |
| Script pós-deploy | [../../scripts/deploy/pos_deploy_vm.sh](../../scripts/deploy/pos_deploy_vm.sh) |
| Script de migração | [../../scripts/migration/migrate_plano_to_prod.py](../../scripts/migration/migrate_plano_to_prod.py) |
| Recuperar 502 | [RECUPERAR_SITE_502.md](RECUPERAR_SITE_502.md) |
| Validação de deploy | [VALIDACAO_DEPLOY_SEGURO.md](VALIDACAO_DEPLOY_SEGURO.md) |
