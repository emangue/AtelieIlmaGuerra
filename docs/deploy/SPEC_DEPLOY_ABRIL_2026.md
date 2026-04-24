# 🚀 Spec Tech — Deploy VM · Abril 2026

> **Branch de referência:** `feature/deploy-vm-abril-2026`  
> **Data:** 24 de abril de 2026  
> **⚠️ Premissa crítica:** o banco de dados da VM contém dados reais de produção. **Nenhuma ação pode apagar ou sobrescrever dados existentes.** Toda operação no banco deve ser aditiva (CREATE TABLE IF NOT EXISTS, INSERT OR IGNORE, ALTER TABLE ADD COLUMN).

---

## 🗺️ Visão Geral do Que Precisa ir Para a VM

O servidor está **3 commits atrás** do local. Os três commits trazem:

| Commit | Resumo | Impacto no banco? |
|--------|--------|-------------------|
| `ac3007a` | CRUD plano financeiro + transações de despesa | ✅ Nova tabela `despesas_transacoes` |
| `2fd3ee8` | Script de migração plano → prod | ✅ Migração de dados |
| `f0f3562` | Fix backend `0.0.0.0` + scripts de infraestrutura | ❌ Só código/config |

Além disso, há mudanças locais não comitadas na `main` (já capturadas na branch `feature/deploy-vm-abril-2026`) relacionadas a contratos (PDF generator, schemas) e frontend (contratos/novo, home mobile, month-scroll-picker, next.config.ts).

---

## ✅ Micro-Tarefas em Ordem de Execução

### FASE 0 — Preparação Local (fazer antes de tocar na VM)

- [ ] **T-01** · Verificar que a branch `feature/deploy-vm-abril-2026` está no GitHub e reflete tudo o que queremos deployar
  - Confirmar no GitHub que o push foi feito com sucesso
  - Revisar os arquivos `" 2"` (cópias acidentais) e decidir se devem ser removidos antes do merge final

- [ ] **T-02** · Limpar os arquivos duplicados com `" 2"` no nome
  - São cópias acidentais geradas localmente (ex: `config 2.py`, `models 2.py`)
  - Criar um script ou fazer `git rm` de todos os arquivos com ` 2` no nome
  - Comitar a limpeza na branch antes de seguir

- [ ] **T-03** · Revisar o `.env.example` do backend
  - O arquivo foi modificado (`app_dev/backend/.env.example`)
  - Verificar se alguma variável nova precisa ser adicionada no `.env` da VM (sem sobrescrever o `.env` existente)
  - Documentar as variáveis novas em comentário neste doc

- [ ] **T-04** · Testar o build do frontend localmente
  - Rodar `npm run build` dentro de `app_dev/frontend/` e garantir que não há erros de TypeScript ou Next.js
  - O `next.config.ts` foi modificado — validar que não há quebra de build

- [ ] **T-05** · Fazer dry-run da migração de banco localmente
  - Rodar: `python scripts/migration/migrate_plano_to_prod.py --dry-run`
  - Confirmar que as tabelas e contagens estão corretas antes de rodar em produção

---

### FASE 1 — Backup Obrigatório da VM (nunca pular)

- [ ] **T-06** · Fazer backup do banco SQLite da VM antes de qualquer coisa
  ```bash
  ssh minha-vps-hostinger "cp /var/www/atelie/app_dev/backend/database/atelie.db \
    /var/www/atelie/app_dev/backend/database/atelie_backup_$(date +%Y%m%d_%H%M%S).db"
  ```
  - Guardar o nome do arquivo de backup para rollback de emergência
  - Baixar uma cópia local também via `scp` para segurança extra

- [ ] **T-07** · Verificar saúde atual da VM antes de começar
  ```bash
  ssh minha-vps-hostinger "cd /var/www/atelie && \
    systemctl status atelie-backend atelie-frontend && \
    curl -s http://localhost:8001/health | head -5"
  ```
  - Confirmar que backend e frontend estão UP antes de qualquer alteração
  - Registrar a versão atual rodando (commit hash): `git -C /var/www/atelie log --oneline -1`

---

### FASE 2 — Migração de Banco (crítica — fazer antes do git pull)

> **Por que antes do git pull?** O código novo referencia a tabela `despesas_transacoes`. Se o código chegar antes da tabela existir, o backend vai crashar ao iniciar. A tabela deve ser criada **antes** ou **atomicamente** com o novo código.

- [ ] **T-08** · Criar a tabela `despesas_transacoes` na VM (se não existir)
  - Conectar no SQLite da VM e rodar o DDL seguro:
  ```sql
  CREATE TABLE IF NOT EXISTS despesas_transacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plano_item_id INTEGER NOT NULL REFERENCES plano_itens(id),
      valor REAL NOT NULL,
      descricao TEXT,
      data TEXT NOT NULL,
      categoria TEXT,
      created_at TEXT DEFAULT (datetime('now'))
  );
  ```
  - ⚠️ Usar `IF NOT EXISTS` — nunca dropar a tabela

- [ ] **T-09** · Verificar se a tabela `plano_itens` precisa de novas colunas
  - Comparar o schema local (`app_dev/backend/app/domains/plano/models.py`) com o existente na VM
  - Adicionar colunas faltantes com `ALTER TABLE plano_itens ADD COLUMN <col> <tipo> DEFAULT <valor>` (nunca recriar a tabela)

- [ ] **T-10** · Rodar a migração de dados do plano local → VM (opcional mas recomendado)
  - Avaliar se os dados de plano local (itens e transações) devem ser copiados para a VM
  - Se sim, usar `scripts/migration/migrate_plano_to_prod.py` no modo SQLite → SQLite remoto
  - Se a VM já tem dados de plano que são mais recentes, **NÃO rodar** e pular esta tarefa

---

### FASE 3 — Atualização do Código na VM

- [ ] **T-11** · Git pull na VM
  ```bash
  ssh minha-vps-hostinger "cd /var/www/atelie && git fetch origin && git pull origin main"
  ```
  - Confirmar que o pull foi limpo (sem conflitos)
  - Verificar o novo commit hash: `git log --oneline -1`

- [ ] **T-12** · Instalar dependências Python novas
  ```bash
  ssh minha-vps-hostinger "cd /var/www/atelie/app_dev/backend && \
    source venv/bin/activate && pip install -r requirements.txt"
  ```
  - Verificar o `requirements.txt` antes — se há pacotes novos que podem falhar na VM

- [ ] **T-13** · Build do frontend na VM
  ```bash
  ssh minha-vps-hostinger "cd /var/www/atelie/app_dev/frontend && \
    npm ci && npm run build"
  ```
  - O `npm ci` usa o `package-lock.json` — mais seguro que `npm install`
  - Se falhar por falta de memória RAM, tentar `NODE_OPTIONS=--max-old-space-size=512 npm run build`

- [ ] **T-14** · Atualizar o serviço systemd do backend (se necessário)
  - Verificar se o arquivo `/etc/systemd/system/atelie-backend.service` na VM tem `--host 0.0.0.0`
  - Se não tiver, copiar o novo arquivo e recarregar:
  ```bash
  ssh minha-vps-hostinger "
    cp /var/www/atelie/scripts/deploy/atelie-backend.service /etc/systemd/system/
    systemctl daemon-reload
  "
  ```
  - ⚠️ Não sobrescrever se já estiver correto — checar antes

- [ ] **T-15** · Reiniciar os serviços
  ```bash
  ssh minha-vps-hostinger "systemctl restart atelie-backend atelie-frontend"
  ```
  - Aguardar 5s e verificar status: `systemctl status atelie-backend atelie-frontend`

---

### FASE 4 — Validação Pós-Deploy

- [ ] **T-16** · Health check do backend
  ```bash
  curl -s https://gestao.atelieilmaguerra.com.br/api/health
  # ou via SSH: curl -s http://localhost:8001/health
  ```
  - Esperar resposta 200 com JSON de status

- [ ] **T-17** · Validar os novos endpoints de transações
  ```bash
  curl -s https://gestao.atelieilmaguerra.com.br/api/v1/plano/transacoes-despesas \
    -H "Cookie: access_token=<token>"
  ```
  - Deve retornar lista (pode ser vazia), não 404 nem 500

- [ ] **T-18** · Abrir o app no celular e testar o fluxo completo
  - [ ] Login funciona
  - [ ] Home mobile carrega
  - [ ] Página de Plano Financeiro abre e lista itens
  - [ ] Modal de despesa abre e salva
  - [ ] Página de Contratos → Novo Contrato abre sem erro
  - [ ] PDF de contrato é gerado corretamente

- [ ] **T-19** · Verificar os logs por 5 minutos após o deploy
  ```bash
  ssh minha-vps-hostinger "journalctl -u atelie-backend -f --since '5 min ago'"
  ```
  - Buscar por `ERROR`, `CRITICAL`, `500`, `traceback`
  - Se aparecer erro de tabela não encontrada → rollback imediato (ver T-20)

---

### FASE 5 — Rollback de Emergência (só se algo quebrar)

- [ ] **T-20** · Procedimento de rollback do banco
  ```bash
  # Restaurar o backup feito no T-06
  ssh minha-vps-hostinger "
    cp /var/www/atelie/app_dev/backend/database/atelie_backup_YYYYMMDD_HHMMSS.db \
       /var/www/atelie/app_dev/backend/database/atelie.db
    systemctl restart atelie-backend
  "
  ```

- [ ] **T-21** · Procedimento de rollback do código
  ```bash
  ssh minha-vps-hostinger "cd /var/www/atelie && git checkout 2a513d9 && \
    systemctl restart atelie-backend atelie-frontend"
  ```

---

## ⚠️ Regras de Ouro — Banco de Dados

| ✅ PODE | ❌ NÃO PODE |
|--------|------------|
| `CREATE TABLE IF NOT EXISTS` | `DROP TABLE` |
| `ALTER TABLE ADD COLUMN` | `DROP COLUMN` |
| `INSERT OR IGNORE` | `DELETE FROM` sem `WHERE` |
| `UPDATE` com `WHERE id = X` | Substituir o arquivo `.db` pelo local |
| Backup antes de qualquer DDL | Rodar `init_db.py` (recria tudo do zero) |
| Verificar contagem de registros antes e depois | `git checkout` em arquivos `.db` |

---

## 📋 Checklist Rápido (ordem de execução)

```
[ ] T-01  Branch no GitHub confirmada
[ ] T-02  Limpar arquivos " 2" da branch
[ ] T-03  Revisar variáveis de ambiente novas
[ ] T-04  Build do frontend local sem erros
[ ] T-05  Dry-run da migração local
---
[ ] T-06  ⭐ BACKUP do banco da VM
[ ] T-07  Saúde da VM verificada
---
[ ] T-08  CREATE TABLE despesas_transacoes (IF NOT EXISTS)
[ ] T-09  ALTER TABLE plano_itens (colunas novas)
[ ] T-10  Migração de dados (avaliar se necessário)
---
[ ] T-11  git pull na VM
[ ] T-12  pip install requirements
[ ] T-13  npm ci + npm run build
[ ] T-14  Atualizar atelie-backend.service (se necessário)
[ ] T-15  Reiniciar serviços
---
[ ] T-16  Health check backend
[ ] T-17  Validar endpoints novos
[ ] T-18  Teste funcional no celular
[ ] T-19  Monitorar logs 5 minutos
```

---

## 🔗 Referências

- Diff completo local vs servidor: [docs/DIFF_LOCAL_VS_SERVIDOR.md](../DIFF_LOCAL_VS_SERVIDOR.md)
- Script de migração: [scripts/migration/migrate_plano_to_prod.py](../../scripts/migration/migrate_plano_to_prod.py)
- Script pós-deploy: [scripts/deploy/pos_deploy_vm.sh](../../scripts/deploy/pos_deploy_vm.sh)
- Guia de deploy geral: [docs/deploy/GUIA_DEPLOY_GESTAO.md](GUIA_DEPLOY_GESTAO.md)
- Recuperar 502: [docs/deploy/RECUPERAR_SITE_502.md](RECUPERAR_SITE_502.md)
- Validação pós-deploy: [docs/deploy/VALIDACAO_DEPLOY_SEGURO.md](VALIDACAO_DEPLOY_SEGURO.md)
