# 🔍 Diferenças: Local (main) vs Servidor

> Gerado em: 24 de abril de 2026  
> Comparação: `HEAD` local (`f0f3562`) × servidor (`2a513d9`)

---

## 📊 Resumo Executivo

| | Local (`main`) | Servidor |
|---|---|---|
| **Commit** | `f0f3562` | `2a513d9` |
| **Data** | 09/03/2026 | 09/03/2026 (mais cedo) |
| **Commits à frente** | **+3** | — |
| **Arquivos diferentes** | **20 arquivos** | — |
| **Linhas adicionadas** | **+2.316** | — |

O servidor está **3 commits atrás** do `main`. Os commits ausentes são, do mais antigo ao mais novo:

1. `ac3007a` — `feat(plano): CRUD completo, transações de despesa e aplicar aos futuros`
2. `2fd3ee8` — `feat(deploy): script de migração plano_itens e despesas_transacoes para prod`
3. `f0f3562` — `fix(deploy): backend 0.0.0.0 para Nginx em Docker + sync plano SQLite`

---

## 🚀 Commit 1 — `ac3007a` (mais importante)
### `feat(plano): CRUD completo, transações de despesa e aplicar aos futuros`

Este é o maior commit dos três: **+1.363 linhas, 9 arquivos**. Ele introduz funcionalidades completamente novas no módulo de Plano Financeiro.

---

### Backend — `app_dev/backend/`

#### 📄 `app/domains/plano/transacoes_models.py` *(arquivo novo)*
- Criou o modelo `DespesaTransacao` — nova tabela no banco de dados.
- Cada linha representa **uma transação individual de despesa** vinculada a um item do plano (`plano_item_id`).
- **Por que isso importa:** o servidor não tem essa tabela. Qualquer tentativa de acessar o plano financeiro no servidor vai falhar ou retornar dados incompletos.

#### 📄 `app/domains/plano/transacoes_router.py` *(arquivo novo)*
- Router completo com os endpoints:
  - `GET /api/v1/plano/transacoes-despesas` — lista transações
  - `POST /api/v1/plano/transacoes-despesas` — cria transação
  - `PATCH /api/v1/plano/transacoes-despesas/{id}` — edita transação
  - `DELETE /api/v1/plano/transacoes-despesas/{id}` — deleta transação
  - `GET /api/v1/plano/opcoes-despesa` — lista opções de despesa para dropdown
- **Por que isso importa:** esses endpoints **não existem no servidor**. O frontend vai receber erros 404 ao tentar usá-los.

#### 📄 `app/domains/plano/router.py` (+276 linhas)
- `GET /plano/itens` agora calcula `valor_realizado` de despesas somando as transações da nova tabela (em vez de usar um campo legado).
- `GET /plano/resumo-mes` agora usa as transações para o realizado de despesas.
- Adicionados endpoints:
  - `DELETE /plano/itens/{id}` — deletar item
  - `PATCH /plano/itens/{id}` — editar item
  - `POST /plano/itens/{id}/aplicar-aos-futuros` — replica o item para meses seguintes

#### 📄 `app/domains/plano/schemas.py` (+55 linhas)
- Novos schemas: `PlanoItemUpdate`, `PlanoItemCreate`, `DespesaRealizadaItem`, `OpcaoDespesa`.

#### 📄 `app/main.py` (+3 linhas)
```python
from .domains.plano.transacoes_router import router as transacoes_router
from .domains.plano.transacoes_models import DespesaTransacao  # noqa: F401
app.include_router(transacoes_router, prefix="/api/v1")
```
- **Por que isso importa:** sem esse registro, os novos endpoints de transações simplesmente não são montados pelo FastAPI.

---

### Frontend — `app_dev/frontend/`

#### 📄 `src/app/mobile/plano/page.tsx` (+509 linhas, −85 linhas)
Esta foi a maior mudança de UI do conjunto. O que mudou:

| Antes (servidor) | Depois (local) |
|---|---|
| Layout simples, sem ações por item | Layout em tabela: **Item \| Planejado \| Realizado \| Ações** |
| Sem como editar ou deletar itens | Botões ✏️ editar e 🗑️ deletar em cada item |
| `valor_realizado` era campo livre | `valor_realizado` calculado automaticamente pelas transações |
| Sem modal de despesa | **Modal de despesa** com dropdown de categoria e campo de descrição |
| Sem funcionalidade "aplicar aos futuros" | Botão para replicar item para meses seguintes |

---

### Documentação

#### 📄 `docs/PLANO_MELHORIAS_PLANO_FINANCEIRO.md` *(arquivo novo, +214 linhas)*
- Documento interno detalhando as melhorias do plano financeiro, decisões de arquitetura e próximos passos.

#### 📄 `docs/deploy/PLANO_DEPLOY_PLANO_FINANCEIRO.md` *(arquivo novo, +196 linhas)*
- **Guia de deploy específico para o módulo de plano financeiro**, incluindo o passo de migração de banco.
- **Por que isso importa:** o servidor precisa executar um script de migração antes do deploy — sem esse guia, é fácil esquecer esse passo e quebrar a produção.

---

## 📦 Commit 2 — `2fd3ee8`
### `feat(deploy): script de migração plano_itens e despesas_transacoes para prod`

**+243 linhas, 2 arquivos**

#### 📄 `scripts/migration/migrate_plano_to_prod.py` *(arquivo novo)*
- Script Python que copia os dados do SQLite local para o PostgreSQL de produção.
- Cobre as tabelas `plano_itens` e `despesas_transacoes`.
- **Não toca** em clientes, pedidos ou outras tabelas — seguro para rodar em produção.
- **Por que isso importa:** sem esse script, mesmo após o deploy do código, o servidor ficará com as tabelas vazias ou desatualizadas.

#### 📄 `docs/deploy/PLANO_DEPLOY_PLANO_FINANCEIRO.md` (+55 linhas)
- Atualização do guia de deploy adicionando o passo de execução do script de migração.

---

## 🔧 Commit 3 — `f0f3562`
### `fix(deploy): backend 0.0.0.0 para Nginx em Docker + sync plano SQLite`

**+710 linhas, 9 arquivos** — foco em infraestrutura e operações.

#### 📄 `scripts/deploy/pos_deploy_vm.sh` *(arquivo novo, +117 linhas)*
- Script de pós-deploy completo para executar na VM após o `git pull`.
- Faz automaticamente: `venv`, `pip install`, `npm ci`, `npm run build`, restart do systemd.
- **Não sobrescreve** `.env` e `.env.production` se já existirem.
- **Por que isso importa:** elimina passos manuais e risco de erro humano no deploy.

#### 📄 `scripts/deploy/atelie-backend.service` (+20 linhas)
- Arquivo de serviço systemd do backend corrigido para escutar em `0.0.0.0` (necessário para o Nginx em Docker rotear as requisições corretamente).
- **Por que isso importa:** sem essa correção, o Nginx em Docker não consegue alcançar o backend, resultando em erros 502 Bad Gateway.

#### 📄 `scripts/deploy/config.sh` (+18 linhas)
- Variáveis de configuração centralizadas para os scripts de deploy.

#### 📄 `scripts/migration/sync_plano_sqlite_to_vm.sh` (+50 linhas)
- Script shell para sincronizar o SQLite local com a VM via `scp` + execução remota da migração.

#### 📄 Documentação de deploy atualizada:
- `docs/deploy/RECUPERAR_SITE_502.md` *(arquivo novo, +141 linhas)* — guia de recuperação de erros 502.
- `docs/deploy/VALIDACAO_DEPLOY_SEGURO.md` *(arquivo novo, +163 linhas)* — checklist de validação pós-deploy.
- `docs/deploy/GUIA_DEPLOY_GESTAO.md` (+24 linhas) — atualizado com novos passos.
- `docs/deploy/PLANO_DEPLOY_PLANO_FINANCEIRO.md` (+52 linhas) — refinamentos finais.

---

## ❌ Impactos no Servidor Atual

| Área | Problema | Severidade |
|---|---|---|
| **Tabela `despesas_transacoes`** | Não existe no banco de produção | 🔴 Crítico |
| **Endpoints de transações** | 4 endpoints não existem (404) | 🔴 Crítico |
| **Cálculo do realizado** | `valor_realizado` não considera transações | 🟠 Alto |
| **UI do plano** | Sem editar/deletar/aplicar-aos-futuros | 🟠 Alto |
| **Backend `0.0.0.0`** | Pode causar erros 502 com Nginx+Docker | 🟠 Alto |
| **Script de migração ausente** | Dados locais não estão em produção | 🟡 Médio |

---

## ✅ O que precisa ser feito para atualizar o servidor

1. **`git pull`** em `/var/www/atelie` (branch `main`)
2. **Rodar migração de banco** com `scripts/migration/migrate_plano_to_prod.py` (cria a tabela `despesas_transacoes` e migra dados)
3. **Rodar pós-deploy** com `bash scripts/deploy/pos_deploy_vm.sh` (instala dependências, builda frontend, reinicia serviços)
4. **Atualizar `atelie-backend.service`** no systemd se ainda não tiver o bind em `0.0.0.0`

Ou, resumidamente, seguir o guia em [docs/deploy/PLANO_DEPLOY_PLANO_FINANCEIRO.md](deploy/PLANO_DEPLOY_PLANO_FINANCEIRO.md).
