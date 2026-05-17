# Reavaliação do Projeto — Ateliê Ilma Guerra
**Data:** maio/2026  
**Branch de referência:** `fix/financeiro-movimentacoes-2026-05`

---

## 0. Sessão de 17/maio — `pagamentos` como fonte única (foco: parcelas futuras)

### Diagnóstico
- Não apareciam despesas nunca em nenhum mês.
- Receitas de abril apareciam, mas maio aparecia vazio.

### Causa raiz
A tabela `pagamentos` foi desenhada para ser a fonte única (e suportar parcelamento no futuro), mas a sincronização tinha buracos:
- `PedidoRepository.create()` **não chamava** `_sincronizar_pagamento` — só `update` e `update_status`. Pedidos criados já com status "Entregue" ficavam órfãos. Eram 13 em maio e 4 em abril.
- `_sincronizar_pagamento` usava fallback `data_entrega → today()`. Pedidos antigos sem `data_entrega` (8 no banco) caíam no mês atual indevidamente.
- Despesas (tabela `despesas`): 0 registros no banco — nunca foram lançadas pela usuária ainda.
- `get_plano_vs_realizado` e `get_evolucao_bulk` em [service.py](app_dev/backend/app/domains/plano/service.py) liam **direto de `Pedido`** com `func.strftime("%Y%m", data_entrega)` (SQLite-only) — então a tabela `pagamentos` ficava sub-utilizada e divergia.

### Ajustes (branch `fix/financeiro-movimentacoes-2026-05`)
1. **Backend — `pagamentos` é fonte única de receitas**
   - [service.py — get_plano_vs_realizado](app_dev/backend/app/domains/plano/service.py#L47): JOIN `Pagamento → Pedido → TipoPedido`, filtra `Pagamento.anomes` + `tipo=receita`.
   - [service.py — get_evolucao_bulk](app_dev/backend/app/domains/plano/service.py#L191): mesma fonte. Removido `func.strftime` (Postgres-ready).
   - [router.py — resumo_mensal](app_dev/backend/app/domains/plano/router.py#L70): receitas e despesas vêm de `Pagamento`.
2. **Sincronização robusta**
   - [repository.py — create()](app_dev/backend/app/domains/pedidos/repository.py#L88): chama `_sincronizar_pagamento`.
   - [repository.py — _sincronizar_pagamento](app_dev/backend/app/domains/pedidos/repository.py#L18): fallback `data_entrega → data_pedido → today()`.
   - Mesmo fallback em `update` e `update_status`.
3. **Endpoint de resync idempotente** — `POST /api/v1/pagamentos/resync` em [pagamentos_router.py](app_dev/backend/app/domains/plano/pagamentos_router.py): cria os faltantes, atualiza os divergentes e remove órfãos. Útil para corrigir qualquer dessincronização no futuro.
4. **Frontend** — `handleSalvar`/`handleExcluir` em [financeiro/page.tsx](app_dev/frontend/src/app/mobile/financeiro/page.tsx#L411) chamam `fetchDashboard()` após mutação (resolve a pendência 2.1 abaixo).

### Validação na VM
```
POST /pagamentos/resync → {"criados":30, "atualizados":6, "removidos":0}
GET /plano/dashboard?mes=202605 → 13 receitas (R$ 4.170) — antes era 0
POST /plano/despesas (teste) → aparece em movimentações ✓
```

### Próximo passo: parcelas (visão de longo prazo)
Hoje, ao marcar um pedido como `Entregue` cria-se **1 pagamento à vista** com o valor cheio. Para suportar parcelamento, o caminho é:
- Adicionar `parcelas` (nº) e `data_primeira_parcela` no `Pedido` (ou em novo `pedido_pagamento_plano`).
- `_sincronizar_pagamento` passa a criar N `Pagamento` (um por parcela) com `anomes` correspondente.
- Estado `Entregue` deixa de implicar "pago". Surge campo `Pagamento.recebido_em` ou status.
- Resync continua válido — só recalcula os pagamentos esperados.

Como `pagamentos` já é a fonte única após este ajuste, essa migração ficará localizada em `_sincronizar_pagamento` (criar várias linhas em vez de uma) sem mexer no resto.

---

## 1. O que foi feito nesta sessão

### 1.1 Correção de bug crítico — Contratos (datas)
**Problema:** `prova_final_data`, `semana_revisao_inicio` e `semana_revisao_fim` chegavam ao backend como string vazia `""`. O Pydantic rejeita `""` para `Optional[date]` e retornava 422. Os inputs tinham `required` no HTML, mas os botões são `type="button"` — a validação nativa do browser nunca disparava, e o `validate()` do frontend não checava essas datas.

**Arquivo corrigido:** `app_dev/frontend/src/app/mobile/contratos/novo/page.tsx`  
**Mudança:** `buildPayload` agora converte string vazia para `null`:
```ts
prova_final_data: form.prova_final_data || null,
semana_revisao_inicio: form.semana_revisao_inicio || null,
semana_revisao_fim: form.semana_revisao_fim || null,
```

### 1.2 Limpeza de arquivos na raiz
Removidos arquivos desnecessários que se acumularam na raiz do projeto:
- `.atelie-backend 2.pid` / `.atelie-backend 3.pid`
- `.atelie-ports 2` / `.atelie-ports 3`

Ainda existem na raiz e podem ser arquivados manualmente quando conveniente:
- `Clientes (1).xlsx` — import inicial já concluído
- `atelie_db_2026-03-06_backup.db` — backup já existe em `.gz`, o `.db` raw pode ser removido
- `Captura de Tela 2026-03-05...png` — referência visual pontual
- `Contrato Aline Albuquerque.docx.pdf` — contrato original de referência
- `PLANO 2026 ATELIE ILMA GUERRA.xlsx` — planilha original do plano

### 1.3 Endpoint consolidado de Financeiro — `GET /plano/dashboard`
**Problema:** a tela Financeiro fazia 3 requisições HTTP separadas a cada troca de mês, totalizando ~33 queries no banco.

| Antes | Depois |
|---|---|
| `GET /plano/plano-vs-realizado` | `GET /plano/dashboard` (único) |
| `GET /plano/evolucao-mensal` (7 chamadas a `get_plano_vs_realizado` = 28 queries) | `get_evolucao_bulk()` → 2 queries totais |
| `GET /pagamentos` | incluído na resposta do dashboard |
| **~33 queries / troca de mês** | **~9 queries / troca de mês** |

**Arquivos alterados:**
- `app_dev/backend/app/domains/plano/schemas.py` — adicionados `EvolucaoMensalItem` e `DashboardResponse`
- `app_dev/backend/app/domains/plano/service.py` — adicionada `get_evolucao_bulk()`
- `app_dev/backend/app/domains/plano/router.py` — adicionado `GET /plano/dashboard`
- `app_dev/frontend/src/app/mobile/financeiro/page.tsx` — `fetchPlano()` + useEffect separado de pagamentos substituídos por `fetchDashboard()`

---

## 2. Pendências desta sessão (concluir antes do próximo deploy)

### 2.1 ~~Frontend — `handleSalvar` e `handleExcluir` desatualizados~~ ✅ resolvido na sessão de 17/maio

### 2.2 Validação de datas no formulário de contrato
O `validate()` em `novo/page.tsx` não valida `prova_final_data`, `semana_revisao_inicio` e `semana_revisao_fim`. Hoje se a usuária não preencher, o contrato é gerado com "a definir" no PDF — que pode ser intencional. Avaliar se faz sentido torná-las obrigatórias ou pelo menos exibir um aviso.

### 2.3 Testar o novo endpoint `/plano/dashboard` em produção
O `func.strftime("%Y%m", Pedido.data_entrega)` em `get_evolucao_bulk()` é SQLite-específico. Se o banco migrar para PostgreSQL no futuro, usar `func.to_char(Pedido.data_entrega, 'YYYYMM')`. Validar o comportamento na VM antes do próximo deploy.

---

## 3. Avaliações para fazer depois

### 3.1 Dois sistemas paralelos de despesas — dívida técnica
Hoje existem duas tabelas registrando despesas realizadas:
- `despesa_transacoes` — dados legados importados do Excel
- `despesas` + `pagamentos` — sistema novo criado pelo app

O `service.py` tem lógica de fallback que tenta `pagamentos`, depois `despesa_transacoes`, depois `valor_realizado` do plano. Isso funciona, mas é frágil e dificulta queries.

**Avaliação futura:** migrar os dados de `despesa_transacoes` para `despesas`/`pagamentos` e remover o fallback. Ganha: código mais simples, queries mais rápidas, sem risco de divergência entre as duas fontes.

### 3.2 Endpoint `/plano/movimentacoes` é código morto
`GET /plano/movimentacoes` existe em `router.py` e usa `DespesaTransacao` (legado). O frontend usa `GET /pagamentos` (novo). O endpoint legado pode ser removido com segurança após confirmar que nada mais o consome.

### 3.3 Cache de detalhes do formulário de lançamento
O `useEffect` que chama `GET /plano/detalhes?tipo=...` dispara toda vez que o form abre OU que `txSelecionada` muda. Os dados mudam raramente (são nomes de colaboradores, categorias, etc.).

**Avaliação futura:** carregar os detalhes uma vez por sessão e guardar em estado de módulo (fora do componente) ou em `localStorage` com TTL curto (ex: 1 hora).

### 3.4 Paginação na lista de movimentações
`GET /pagamentos?mes=...` retorna todos os itens do mês sem limite. Para meses com muitos lançamentos, pode ficar pesado.

**Avaliação futura:** adicionar `limit` e `offset` no endpoint e implementar scroll infinito no frontend. Baixa prioridade enquanto o volume for pequeno.

### 3.5 Contratos — passar dados do cliente sem chamada extra
Quando a usuária cria um contrato a partir da ficha de um cliente, o frontend faz `GET /clientes/{id}` para pré-preencher o formulário. Se a navegação passar os dados necessários via `searchParams` (nome, cpf, telefone, etc.), essa chamada é eliminada.

**Avaliação futura:** avaliar tamanho dos dados vs. conveniência de passar por URL. Alternativa: contexto React compartilhado.

### 3.6 Consistência analítica — "justiça com os dados"
A receita realizada vem de pedidos com `status = "Entregue"` e `data_entrega` no mês. Isso significa que:
- Um pedido entregue em atraso conta no mês da entrega real (correto)
- Um pedido cujo pagamento foi parcelado não tem os parcelas refletidas no mês (limitação atual)

**Avaliação futura:** definir com a Ilma se o critério de receita deve ser "data de entrega" ou "data de pagamento". Se for pagamento, precisará de um modelo de parcelas no banco.

### 3.7 Segurança de transações — branch atual
A branch `feature/seguranca-senha-transacoes` sugere implementação de senha para confirmar transações financeiras. Avaliar o escopo: é uma confirmação por PIN no frontend, autenticação de 2 fatores, ou bloqueio de edição após X dias?

---

## 4. Arquitetura atual resumida

```
Frontend (Next.js 15, porta 3004)
  └── /mobile/financeiro/page.tsx
        └── GET /api/v1/plano/dashboard?mes=YYYYMM   ← novo (uma chamada)
              ├── plano_vs_realizado    (PlanoItem + Pedido + Pagamento)
              ├── evolucao_mensal       (bulk: 2 queries para 7 meses)
              └── movimentacoes         (Pagamento ordenado por data)

Backend (FastAPI, porta 8001)
  └── /domains/plano/
        ├── router.py           → GET /plano/dashboard (novo)
        ├── service.py          → get_plano_vs_realizado + get_evolucao_bulk
        ├── despesas_router.py  → CRUD /plano/despesas (fonte de verdade)
        ├── pagamentos_router.py → /pagamentos (lista unificada)
        └── transacoes_router.py → legado, pode ser removido

Banco (PostgreSQL na VM)
  ├── plano_itens       — o que foi planejado
  ├── despesas          — o que foi gasto (fonte de verdade nova)
  ├── pagamentos        — receitas + despesas unificadas
  ├── despesa_transacoes — legado (Excel), deprecado
  └── pedidos           — receitas (status=Entregue)
```

---

## 5. Próximas features desejadas (backlog)

- [ ] Parcelas / forma de pagamento nos pedidos
- [ ] Relatório mensal em PDF para a Ilma
- [ ] Notificação de pedidos próximos da data de entrega
- [ ] Histórico de alterações em contratos (audit log)
- [ ] Backup automático do banco na VM com retenção de 30 dias
