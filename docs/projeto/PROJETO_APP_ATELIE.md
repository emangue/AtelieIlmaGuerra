# Projeto App Ateliê Ilma Guerra

**Versão:** 1.0  
**Data:** 14/02/2026  
**Foco:** Backend e usabilidade (mobile-first)

---

## 1. Visão Geral

Sistema completo para gestão do ateliê de costura, cobrindo pedidos, orçamentos, clientes, métricas operacionais e **geração de contratos**. Baseado nas telas de referência do AppSheet e na funcionalidade de contratos já implementada.

### 1.1 Escopo

| Módulo | Status | Descrição |
|--------|--------|-----------|
| **Contratos** | ✅ Implementado | Gerador de PDF, histórico, preview, edição |
| **Clientes** | 🔲 A implementar | Cadastro e gestão de clientes |
| **Pedidos Ativos** | 🔲 A implementar | Lista de pedidos em andamento |
| **Orçamentos** | 🔲 A implementar | Orçamentos/cotações |
| **Painel Operacional** | 🔲 A implementar | Dashboard com KPIs e gráficos |
| **Calendário** | 🔲 A implementar | Agenda e datas |
| **Pedidos Vencidos** | 🔲 A implementar | Pedidos em atraso |
| **Parâmetros Orçamentos** | 🔲 A implementar | Configurações de preços/margens |
| **Demonstrativo Resultado** | 🔲 A implementar | Relatórios financeiros |
| **Novo Custo** | 🔲 A implementar | Registro de despesas |

---

## 2. Navegação (Bottom + Drawer)

### 2.1 Bottom Navigation (principal)

- **Novo** – Criar novo pedido/orçamento
- **Painel Resultados** – Dashboard com métricas e gráficos
- **Pedidos Ativos** – Lista de pedidos em andamento
- **Orçamentos** – Lista de orçamentos
- **Contratos** – Histórico e geração de contratos *(já implementado)*

### 2.2 Drawer (menu lateral)

- **Calendário**
- **Pedidos Vencidos**
- **Parâmetros Orçamentos**
- **Demonstrativo Resultado**
- **Novo Custo**
- **Clientes**
- **Log Out**

---

## 3. Modelo de Dados (Backend)

### 3.1 Tabelas existentes

- `users` – Usuários e autenticação
- `contracts` – Contratos gerados (dados + created_at)

### 3.2 Tabelas a criar

#### `clientes`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| appsheet_id | VARCHAR(50) UNIQUE | ID da planilha (para migração) |
| nome | VARCHAR(255) | Nome completo |
| cpf | VARCHAR(20) | CPF |
| rg | VARCHAR(50) | RG |
| endereco | VARCHAR(500) | Endereço |
| telefone | VARCHAR(30) | Telefone |
| email | VARCHAR(255) | E-mail |
| primeiro_agendamento | VARCHAR(100) | Data ou "NA" |
| data_cadastro | DATE | |
| flag_medidas | BOOLEAN | Medidas cadastradas? |
| medida_ombro, medida_busto, medida_cinto, ... | FLOAT | Medidas em cm |
| created_at | DATETIME | |
| updated_at | DATETIME | |

#### `tipo_pedido` (catálogo)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| nome | VARCHAR(100) | VESTIDO FESTA, NOIVA FESTA, AJUSTE, etc. |
| meta_lucro | FLOAT | Meta de lucro padrão |
| meta_quantidade | INTEGER | Meta de quantidade/mês |

#### `pedidos`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| cliente_id | INTEGER FK | |
| tipo_pedido_id | INTEGER FK | |
| data_pedido | DATE | |
| data_entrega | DATE | |
| descricao_produto | TEXT | |
| status | VARCHAR(50) | Orçamento, Encomenda, Cortado, Provado, Pronto, Entregue |
| valor_pecas | FLOAT | Valor da(s) peça(s) |
| quantidade_pecas | INTEGER | |
| horas_trabalho | FLOAT | (15min=0.25, 30min=0.5) |
| custo_materiais | FLOAT | |
| custos_variaveis | FLOAT | |
| margem_real | FLOAT | % |
| forma_pagamento | VARCHAR(50) | Pix, Parcelado, Cartão Crédito |
| valor_entrada | FLOAT | |
| valor_restante | FLOAT | |
| detalhes_pagamento | TEXT | |
| medidas_disponiveis | BOOLEAN | |
| medida_ombro | VARCHAR(50) | |
| medida_busto | VARCHAR(50) | |
| medida_cinto | VARCHAR(50) | |
| fotos_disponiveis | BOOLEAN | |
| observacao_pedido | TEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

#### `orcamentos`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| cliente_id | INTEGER FK | |
| data | DATE | |
| descricao | TEXT | |
| valor | FLOAT | |
| status | VARCHAR(50) | |
| created_at | DATETIME | |

#### `custos`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| descricao | VARCHAR(255) | |
| valor | FLOAT | |
| data | DATE | |
| categoria | VARCHAR(100) | |
| created_at | DATETIME | |

#### `parametros_orcamento`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| preco_hora | FLOAT | Preço/hora |
| margem_target | FLOAT | % margem alvo |
| faturamento_target | FLOAT | Faturamento alvo |
| impostos | FLOAT | % |
| cartao_credito | FLOAT | % |
| total_despesas | FLOAT | |
| total_horas_mes | INTEGER | |

#### `fotos_pedido`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| pedido_id | INTEGER FK | |
| comentario | VARCHAR(500) | |
| arquivo_path | VARCHAR(500) | Caminho do arquivo |

---

## 4. Telas e Funcionalidades

### 4.1 Painel Operacional (Dashboard)

**Filtros:**
- Mês Análise (YYYYMM) com botões -/+
- StatusSelecionado (dropdown): Painel Operacional, etc.

**KPIs exibidos:**
- Fat Potencial Mês (MoM, YoY, % do Target 30K)
- Faturamento Líquido Potencial (Sem Despesas Totais)
- Faturamento Parcial (Valor do que foi entregue)
- Valor Orçamentos Mês
- Horas Trabalhadas Potencial
- Horas Trabalhadas
- Margem Mês (Margem dos Produtos)
- TotalDespesas, TotalHorasMes, Impostos, CartaoCredito
- PrecoHora, MargemTarget, FaturamentoTarget

**Gráficos:**
- MixStatusPedidos – Donut (Entregue, Pronto, Encomenda) com paginação 1/3
- Lucro por Mês – Barras (SUM Valor Peça por MesAno)
- Peças Entregues Mês Atual – Barras (QuantidadePedidos vs Meta por TipoPedido)
- Faturamento por Peça Mês Atual – Barras (LucroPedidos vs MetaLucro por TipoPedido)

### 4.2 Pedidos Ativos

**Escopo da tela:** Exibe apenas pedidos que **não são orçamento** e **não estão entregues**. Ao mudar o status para Entregue, o pedido sai da lista automaticamente.

**Layout de cada linha (ref: `FotosAppSheet/PedidosAtivos_Lista.png`):**

| Posição | Elemento | Descrição |
|---------|----------|-----------|
| **Esquerda** | Foto | Espaço reservado para foto do pedido/peça (pode ficar vazio se não houver) |
| **Centro** | Nome cliente (negrito) | Nome do cliente |
| **Centro** | Descrição produto | Campo editável com a descrição do item |
| **Superior direita** | Status atual | Ex.: Encomenda, Cortado, Provado, Pronto |
| **Inferior** | Ícones de status | Cada ícone representa um status; ao clicar, atualiza na base e no canto superior direito |

**Ícones de status (ordem do fluxo):**
- Lápis – Editar/detalhes
- Régua – Medidas
- Tesoura – Cortado
- Play – Em costura/produção
- Silhueta – Provado (prova)
- Caixa – Pronto
- Check – Entregue (ao clicar, remove da lista)

**Comportamento:** Ao clicar em um ícone, o status é atualizado no banco e refletido imediatamente no badge superior direito. Se o status for **Entregue**, o pedido deixa de aparecer na lista de ativos.

**Outros elementos:**
- Lista agrupada por data (17/1/2026, 7/2/2026, etc.)
- FAB: calendário (vermelho)
- Busca, filtro, refresh

**Status possíveis (ref: `FotosAppSheet/StatusPedidos_Planilha.png`):** Orçamento, Cortado, Encomenda, Provado, Pronto, Entregue, Canelado

### 4.3 Orçamentos

- Lista: data, cliente, descrição
- Ícones: Preview, Editar, Excluir
- FAB: calendário
- Botão Novo

### 4.4 Formulário Pedido/Orçamento (Novo/Editar)

**Seção 1 – Dados básicos**
- Nome Cliente* (dropdown/autocomplete)
- Data Pedido* (date picker)
- Tipo Pedido* (dropdown: VESTIDO FESTA, AJUSTE, NOIVA FESTA, etc.)
- Descrição Produto* (textarea)

**Seção 2 – Status e trabalho**
- Status Pedido* (botões: Orçamento, Encomenda, Cortado, Provado, Pronto, Entregue)
- Horas de Trabalho* (0,25 = 15min, 0,5 = 30min, 0,75 = 45min) com -/+
- Custo Materiais* com -/+

**Seção 3 – Valores**
- Custos Variáveis com -/+
- Valor para Margem 20%, 30%, 40% (calculados)
- Valor Peça(s)* com -/+
- Margem Real (%)
- Quantidade de Peças* com -/+
- Data de Entrega* (date picker)

**Seção 4 – Pagamento**
- Forma de Pagamento (Pix, Parcelado, Cartão Crédito)
- Valor Entrada com -/+
- ValorRestante
- Detalhes do Pagamento (textarea)
- Fotos disponíveis? (SIM/NAO)

**Seção 5 – Medidas**
- Medidas estão disponíveis? (SIM/NAO)
- Se SIM: Medida Ombro, Busto, Cinto

**Seção 6 – Fotos (se disponíveis)**
- ComentarioFoto1, Foto1 (upload/câmera)
- ComentarioFoto2, Foto2
- …

**Ações:** Cancelar, Salvar

### 4.5 Painel Resultados (Demonstrativo)

- TotalDespesas, TotalHorasMes
- Impostos, CartaoCredito (%)
- PrecoHora, MargemTarget, FaturamentoTarget
- FAB: Enviar (avião), Editar (lápis)
- Botões: Excluir, Mais opções, Refresh

### 4.6 Contratos *(já implementado)*

- **Novo:** Formulário com dados do cliente, especificações, valores, datas
- **Preview:** PDF em nova aba antes de salvar
- **Gerar:** Salva no banco e baixa PDF
- **Histórico:** Lista clicável com dados, preview e edição
- **Editar:** Atualiza dados e permite regenerar PDF

### 4.7 Cálculos automáticos (Margem20, Margem30, Margem40)

As variáveis **Margem20**, **Margem30** e **Margem40** não representam a margem em si, e sim o **preço de venda sugerido** para atingir margem de lucro de 20%, 30% ou 40% após impostos e taxas. Fórmulas do AppSheet (ref: `FotosAppSheet/Formula_Margem20.png`, `Formula_Margem30.png`, `Formula_Margem40.png`):

**Fórmula genérica (MargemX, com X = 0,2 ou 0,3 ou 0,4):**

```
MargemX = (CustoTotal) / (1 - Impostos - CartaoCredito - X)
```

Onde:

- **Numerador (CustoTotal):**
  - `PrecoHora * HorasTrabalho + custo_materiais + custos_variaveis`
  - `PrecoHora`, `Impostos`, `CartaoCredito` vêm de `ParametrosOrcamento` (1ª linha)
  - `HorasTrabalho`, `custo_materiais`, `custos_variaveis` vêm do pedido/orçamento

- **Denominador:**
  - `1 - Impostos - CartaoCredito - margem_alvo`
  - Para Margem20: `0.2`; Margem30: `0.3`; Margem40: `0.4`

**Fórmula AppSheet (ex.: Margem20):**

```
(INDEX(ParametrosOrcamento[PrecoHora], 1) * [HorasTrabalho] + [custo_materiais] + [custos_variaveis]) 
/ (1 - INDEX(ParametrosOrcamento[Impostos], 1) - INDEX(ParametrosOrcamento[CartaoCredito], 1) - 0.2)
```

**Implementação no backend:** Criar função/serviço que receba `horas_trabalho`, `custo_materiais`, `custos_variaveis`, busque parâmetros em `parametros_orcamento` e retorne `margem_20`, `margem_30`, `margem_40`. Usar no formulário de pedido/orçamento e em endpoints de preview.

---

## 5. APIs Backend (FastAPI)

### 5.1 Já implementadas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /api/v1/auth/login | Login |
| GET | /api/v1/auth/me | Usuário atual |
| POST | /api/v1/auth/logout | Logout |
| POST | /api/v1/contracts/preview | Preview PDF |
| POST | /api/v1/contracts/generate | Gerar e salvar contrato |
| GET | /api/v1/contracts | Listar contratos |
| GET | /api/v1/contracts/{id} | Detalhe contrato |
| GET | /api/v1/contracts/{id}/preview | PDF inline |
| GET | /api/v1/contracts/{id}/pdf | Download PDF |
| PATCH | /api/v1/contracts/{id} | Atualizar contrato |

### 5.2 A implementar

**Clientes**
- GET /api/v1/clientes
- POST /api/v1/clientes
- GET /api/v1/clientes/{id}
- PATCH /api/v1/clientes/{id}
- DELETE /api/v1/clientes/{id}

**Pedidos**
- GET /api/v1/pedidos (filtros: status, data, cliente)
- POST /api/v1/pedidos
- GET /api/v1/pedidos/{id}
- PATCH /api/v1/pedidos/{id}
- DELETE /api/v1/pedidos/{id}

**Orçamentos**
- GET /api/v1/orcamentos
- POST /api/v1/orcamentos
- GET /api/v1/orcamentos/{id}
- PATCH /api/v1/orcamentos/{id}

**Tipo Pedido**
- GET /api/v1/tipos-pedido (catálogo)

**Custos**
- GET /api/v1/custos
- POST /api/v1/custos

**Parâmetros**
- GET /api/v1/parametros
- PATCH /api/v1/parametros

**Dashboard**
- GET /api/v1/dashboard/kpis?mes=YYYYMM
- GET /api/v1/dashboard/mix-status?mes=YYYYMM
- GET /api/v1/dashboard/lucro-mensal
- GET /api/v1/dashboard/pecas-entregues?mes=YYYYMM
- GET /api/v1/dashboard/faturamento-peca?mes=YYYYMM

---

## 6. Ordem de Implementação Sugerida

### Fase 1 – Base (prioridade alta)
1. **Clientes** – CRUD, necessário para pedidos e contratos
2. **Tipo Pedido** – Catálogo fixo (seed)
3. **Parâmetros Orçamento** – Configurações iniciais

### Fase 2 – Pedidos e Orçamentos
4. **Pedidos** – CRUD completo com todos os campos
5. **Orçamentos** – CRUD (pode ser simplificado no início)
6. **Fotos** – Upload e armazenamento (opcional na v1)

### Fase 3 – Dashboard
7. **Dashboard KPIs** – Cálculos e endpoints
8. **Gráficos** – Mix status, lucro mensal, peças entregues, faturamento por peça

### Fase 4 – Complementos
9. **Calendário** – Datas de entrega e provas
10. **Pedidos Vencidos** – Filtro de atrasados
11. **Novo Custo** – Registro de despesas
12. **Demonstrativo Resultado** – Relatório consolidado

---

## 7. Integração Contratos ↔ Resto do App

- **Cliente:** Contrato usa dados de `clientes` quando disponível (autocomplete no formulário)
- **Pedido:** Um contrato pode ser vinculado a um `pedido_id` (futuro)
- **Orçamento:** Orçamento aprovado pode gerar contrato automaticamente (futuro)

---

## 8. Stack Técnica

- **Backend:** FastAPI, SQLAlchemy, SQLite (dev) / PostgreSQL (prod)
- **Frontend:** Next.js 15, React 19, Tailwind, shadcn/ui
- **PDF:** ReportLab
- **Auth:** JWT + cookie httpOnly
- **Mobile-first:** Layout otimizado para celular

---

## 9. Base Excel (AppSheet) – Análise e Migração

A planilha **`Clientes (1).xlsx`** é a base de dados usada no app atual (AppSheet). Parte dos dados será migrada para o banco SQLite do novo app.

### 9.1 Estrutura da planilha

| Sheet | Linhas | Descrição |
|-------|--------|-----------|
| **Clientes** | ~937 | Cadastro de clientes (principal para migração) |
| **Pedidos** | ~4296 | Pedidos vinculados a clientes |
| **FormularioNovosOrcamentos** | ~4 | Orçamentos vindos de formulário |
| **ParametrosContrato** | 1 | Campos usados no contrato |
| **ParametrosOrcamento** | 3 | TotalHorasMes, Impostos, MargemTarget |
| **ParametrosOrcamento1** | ~1000 | Despesas (GrupoDespesa, DetalheDespesa, Valor) |
| **TipoPedido** | ~10 | Catálogo: VESTIDO FESTA, AJUSTE, NOIVA FESTA, etc. |
| **StatusOrcamentoForms** | 7 | Status de orçamentos |
| **StatusPedidosMes** | 8 | Status de pedidos com % de conclusão |
| **TabelaCustos** | ~11 | Custos (DataPagamento, Tipo, Descricao, Valor) |
| **TabelaResultadoFinal** | 7 | Tipos de resultado (Faturamento, Custo Fixo, etc.) |
| **BackLog App** | 10 | Ideias/backlog do app |
| **FiltroAnoMes**, **Página13**, etc. | variável | Views/auxiliares |

### 9.2 Sheet Clientes (principal para migração)

| Coluna | Tipo | Observação |
|--------|------|------------|
| ID | string (hash) | ID único AppSheet |
| Nome | string | Nome completo |
| Telefone | string/number | "NA" quando vazio; às vezes número sem DDD |
| PrimeiroAgendamento | string | "NA" ou data |
| DataCadastro | datetime | Geralmente vazio |
| FlagMedidas | string | "SIM" ou "NAO" |
| MedidaOmbro, MedidaBusto, MedidaCinto, MedidaQuadril | number | Medidas em cm |
| MedidaComprimentoCorpo, MedidaComprimentoVestido | number | |
| MedidaSeioaSeio, MedidaRaioDeBusto, MedidaAlturaDeBusto | number | |
| MedidaFrente, MedidaCostado | number | |
| MedidaComprimentoCalca, MedidaComprimentoBlusa | number | |
| MedidaLarguraDaManga, MedidaComprimentoDaManga | number | |
| MedidaPunho, MedidaComprimentoDaSaia, MedidaComprimentoDaBermuda | number | |

**Qualidade dos dados:** Muitos registros com Telefone="NA", DataCadastro vazio. Medidas geralmente vazias (podem estar no Pedido).

### 9.3 Sheet Pedidos

| Coluna | Tipo | Observação |
|--------|------|------------|
| PedidoID | string | ID único |
| ClienteID | string | FK para Clientes.ID |
| TipoPedido | string | VESTIDO FESTA, AJUSTE, TRANSFORMAÇÃO, etc. |
| DescricaoProduto | string | |
| Quantidade | number | |
| DataPedido, DataEntrega | datetime | |
| ValorTotal, DespesasTotal | number | |
| Status | string | Backlog, Cortado, Pronto, Entregue, Encomenda, Provado |
| FlagAtivo | string | SIM/NAO |
| SatusOrcamento, MotivoDesistencia | string | |
| HorasTrabalho, QuantidadePecas, ValorPecas | number | |
| custo_materiais, custos_variaveis, TotalDespesas | number | |
| FormaPagamento, Entrada, ValorRestante | string/number | |
| DetalhePagamento, Pagamento1–3, DtPagamento1–3 | string/datetime | |
| FlagMedidas + medidas (Ombro, Busto, Cinto, etc.) | number | Medidas por pedido |
| ObservacaoPedido, FlagFotos | string | |
| Foto1–3, ComentarioFoto1–3 | string | |
| atualizado_em | datetime | |

### 9.4 Sheet FormularioNovosOrcamentos

| Coluna | Tipo | Observação |
|--------|------|------------|
| ID | string | |
| Carimbo de data/hora | datetime | |
| Nome Completo, Celular Whatsapp | string/number | |
| Vestido Desejado, Quando será o Evento? | string/datetime | |
| Referências 1–3, Observações, Horário, Local | string | |
| Status, ValorMinimo, ValorMaximo, MotivoDesistencia | string/number | |

### 9.5 Plano de migração para o DB

#### Fase 1 – Clientes (prioridade alta)

1. **Criar tabela `clientes`** com campos:
   - `id` (PK, auto), `appsheet_id` (string, único, para referência)
   - `nome`, `telefone`, `email`
   - `primeiro_agendamento`, `data_cadastro`
   - `flag_medidas` (boolean)
   - Medidas: `medida_ombro`, `medida_busto`, `medida_cinto`, etc.
   - `created_at`, `updated_at`

2. **Script de migração:**
   - Ler sheet Clientes do Excel
   - Normalizar: "NA" → null, telefone como string
   - Inserir em `clientes` preservando `appsheet_id` para vincular pedidos

#### Fase 2 – Pedidos (após clientes)

1. **Criar tabela `pedidos`** conforme modelo da seção 3.2
2. **Mapear ClienteID:** JOIN por `appsheet_id` → `clientes.id`
3. Migrar pedidos com cliente encontrado; registrar pedidos órfãos para revisão

#### Fase 3 – Catálogos e parâmetros

- **TipoPedido:** seed a partir da sheet TipoPedido
- **StatusPedidosMes:** seed para % de conclusão
- **ParametrosOrcamento:** migrar TotalHorasMes, Impostos, MargemTarget
- **ParametrosOrcamento1 / TabelaCustos:** migrar para tabela `custos`

#### Dados não migrados (inicialmente)

- FormularioNovosOrcamentos (poucos registros; pode ser import manual)
- Views auxiliares (Página13, FiltroAnoMes, etc.)
- BackLog App (documentação)

### 9.6 Avaliação Gráficos ↔ Base Excel

Mapeamento dos gráficos/KPIs do Painel Operacional com as fontes de dados na planilha:

| Gráfico/KPI | Fonte Excel | Coluna(s) | Observação |
|-------------|-------------|-----------|------------|
| **MixStatusPedidos** (Donut) | Pedidos | Status (Backlog/Cortado/Pronto/Entregue) | ✅ Existe. Valores: Entregue, Pronto, Encomenda, Cortado, Orçamento, Provado, Canelado. StatusPedidosMes traz % de conclusão. |
| **Lucro por Mês** (Barras) | Pedidos | ValorPecas ou ValorTotal, DataPedido/DataEntrega | ⚠️ ValorPecas pode ser null; ValorTotal sempre preenchido. Definir regra: usar ValorPecas quando houver, senão ValorTotal. Agrupar por MesAno (DataEntrega ou DataPedido). |
| **Peças Entregues Mês Atual** | Pedidos + TipoPedido | Quantidade, TipoPedido, Status, DataEntrega; Meta | ✅ Pedidos.Quantidade e TipoPedido.Meta existem. Filtrar Status=Entregue e DataEntrega no mês. |
| **Faturamento por Peça Mês Atual** | Pedidos + TipoPedido | ValorPecas/ValorTotal, TipoPedido; MetaLucro | ⚠️ Mesma dúvida ValorPecas vs ValorTotal. TipoPedido.MetaLucro existe. |
| **Fat Potencial Mês** | Pedidos | ValorTotal ou ValorPecas, DataEntrega | Agregação dos pedidos do mês (status entregue + em andamento). |
| **Faturamento Parcial** | Pedidos | ValorTotal, Status=Entregue | ✅ Soma do que foi entregue. |
| **Horas Trabalhadas** | Pedidos | HorasTrabalho | ✅ Existe. TotalHorasMes em ParametrosOrcamento. |
| **Margem Mês** | Pedidos | MargemReal_1, ValorPecas | MargemReal_1 existe; verificar se está sempre preenchido. |
| **TotalDespesas, Impostos, CartaoCredito** | ParametrosOrcamento, ParametrosOrcamento1 | TotalHorasMes, Impostos, CartaoCredito; Valor (despesas) | ParametrosOrcamento tem 1 linha; despesas em ParametrosOrcamento1. |
| **Valor Orçamentos Mês** | FormularioNovosOrcamentos | ValorMinimo, ValorMaximo, Carimbo | ⚠️ Poucos registros (~4). Status para filtrar ativos. |

**Resumo:** A base cobre os gráficos principais. Pontos de atenção: (1) ValorPecas vs ValorTotal – padronizar; (2) Orçamentos – FormularioNovosOrcamentos tem poucos dados; (3) Filtro por mês – usar DataEntrega para pedidos entregues.

### 9.7 Mapeamento ID AppSheet → DB

Para manter vínculos entre Excel e DB durante a migração:

| Excel | DB |
|-------|-----|
| Clientes.ID | clientes.appsheet_id |
| Pedidos.ClienteID | JOIN clientes.appsheet_id → clientes.id |
| Pedidos.PedidoID | pedidos.appsheet_id (opcional) |

---

## 10. Referências

- Fotos de referência: `FotosAppSheet/` (incl. `Formula_Margem20.png`, `Formula_Margem30.png`, `Formula_Margem40.png` – fórmulas AppSheet; `Referencia_MenuInferior_FinancasV5.png` – layout menu inferior; `PedidosAtivos_Lista.png` – layout linha de pedido; `StatusPedidos_Planilha.png` – status na planilha)
- Contrato modelo: `Contrato Aline Albuquerque.docx.pdf`
- Mapeamento contrato: `docs/MAPEAMENTO_CONTRATO.md`
- **Sprints e To-Do:** `docs/SPRINT_TODO.md` – checklist acionável para produção
- **Base Excel (AppSheet):** `Clientes (1).xlsx`
- Código atual: `app_dev/`
