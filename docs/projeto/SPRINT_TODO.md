# Sprint e To-Do – App Ateliê Ilma Guerra

**Referência:** `PROJETO_APP_ATELIE.md`  
**Objetivo:** Checklist acionável para começar a produzir

---

## Status geral

| Sprint | Foco | Status |
|-------|------|--------|
| Sprint 0 | Setup + Contratos (já feito) | ✅ |
| Sprint 1 | Clientes + migração Excel | 🔲 |
| Sprint 2 | Pedidos Ativos | ✅ |
| Sprint 3 | Orçamentos + Parâmetros | ✅ |
| Sprint 4 | Dashboard | ✅ |
| Sprint 5 | Complementos | 🔲 |

---

## Sprint 0 – Base (concluído)

- [x] Backend FastAPI + SQLite
- [x] Auth JWT
- [x] Contratos: CRUD, PDF, preview, edição
- [x] Layout mobile + BottomNavigation (estilo Finanças V5)
- [x] Páginas placeholder: Painel, Pedidos, Orçamentos

---

## Sprint 1 – Clientes e migração

**Objetivo:** Cadastro de clientes e importação da planilha.

### Backend
- [x] Criar modelo `clientes` (id, appsheet_id, nome, telefone, email, medidas, etc.)
- [x] Migration Alembic ou script SQL (create_all no startup)
- [x] CRUD: GET/POST/PATCH/DELETE `/api/v1/clientes`
- [x] Endpoint GET `/api/v1/clientes?q=` para autocomplete

### Script de migração
- [x] Script Python: ler sheet Clientes do Excel
- [x] Normalizar dados ("NA" → null, telefone como string)
- [x] Inserir em `clientes` com `appsheet_id`
- [x] Log de erros/órfãos

### Frontend
- [x] Página `/mobile/clientes` (lista + busca)
- [x] Formulário novo/editar cliente
- [ ] Integrar autocomplete de cliente no formulário de contrato

---

## Sprint 2 – Pedidos Ativos

**Objetivo:** Tela de pedidos em andamento conforme spec (seção 4.2 do PROJETO).

### Backend
- [x] Criar modelo `pedidos` (campos do doc)
- [x] Criar modelo `tipo_pedido` + seed
- [x] GET `/api/v1/pedidos/ativos` (exclui Entregue e Orçamento)
- [x] PATCH `/api/v1/pedidos/{id}` – atualizar pedido
- [x] PATCH `/api/v1/pedidos/{id}/status` – mudar status por ícone

### Frontend
- [x] Substituir placeholder `/mobile/pedidos` pela tela real
- [x] Lista agrupada por data
- [x] Linha: foto (esquerda), nome, descrição, status (canto superior direito)
- [x] Ícones de status (Editar, Medidas, Tesoura, Play, Caixa, Check)
- [x] Ao clicar ícone → PATCH status → atualiza UI e remove se Entregue
- [x] FAB calendário (vermelho)

---

## Sprint 3 – Orçamentos e Parâmetros

**Objetivo:** Orçamentos + cálculo Margem20/30/40 + parâmetros.

### Backend
- [x] Modelo `parametros_orcamento` (PrecoHora, Impostos, CartaoCredito)
- [x] Endpoint GET/PATCH `/api/v1/parametros`
- [x] Função/serviço: calcular margem_20, margem_30, margem_40 (fórmula doc 4.7)
- [x] Modelo `orcamentos` + CRUD
- [x] Endpoint POST `/api/v1/parametros/calcular-margens`

### Frontend
- [x] Substituir placeholder `/mobile/orcamentos`
- [x] Formulário novo orçamento com horas, custos, margens
- [x] Campos Margem20, Margem30, Margem40 calculados em tempo real
- [x] Tela Parâmetros Orçamento (/mobile/parametros)

---

## Sprint 4 – Dashboard

**Objetivo:** Painel Operacional com KPIs e gráficos.

### Backend
- [x] Endpoints dashboard: KPIs, mix-status, lucro-mensal, peças-entregues
- [x] Filtro por mês (YYYYMM, opcional com default mês atual)

### Frontend
- [x] Substituir placeholder `/mobile` (Painel)
- [x] Seletor de mês (prev/next)
- [x] Cards de KPIs
- [x] Gráficos: MixStatus (donut), Lucro mensal (barras), Peças por tipo

---

## Sprint 5 – Complementos

- [ ] Calendário (datas entrega/provas)
- [ ] Pedidos Vencidos (filtro atrasados)
- [ ] Novo Custo (registro despesas)
- [ ] Demonstrativo Resultado
- [ ] Drawer com itens: Calendário, Pedidos Vencidos, Parâmetros, etc.

---

## Como usar

1. Marque `[x]` ao concluir cada item.
2. Sprints são sequenciais; Sprint 1 deve estar estável antes de Sprint 2.
3. Dúvidas de spec → consultar `PROJETO_APP_ATELIE.md`.
4. Migração Excel (Sprint 1) pode rodar em paralelo ao CRUD clientes.
