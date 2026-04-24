# 📋 Plano — Tela de Movimentações (Transações)

> Branch: `feature/seguranca-senha-transacoes`  
> Status: **aguardando aprovação**

---

## 🎯 Objetivo

Redesenhar a seção de transações que já existe em `/mobile/financeiro/page.tsx`, posicionada logo abaixo do card "Lucro realizado do plano". Sem nova rota. A seção mostrará todas as receitas (pedidos entregues) e despesas realizadas do mês, agrupadas por data, com o visual premium do HTML de referência.

---

## 🖼️ Referência Visual (03-identidade-mobile-premium.html)

O HTML de referência mostrou a tela **"Movimentações"** com os seguintes padrões:

### Identidade visual adotada
| Token | Valor | Uso |
|---|---|---|
| `paper-50` | `#FAF8F3` | background geral (marfim) |
| `ink-900` | `#0B1220` | títulos, valores |
| `ink-500` | `#4B5468` | labels, secundário |
| `ink-100` | `#E6E4DE` | dividers |
| `moss-700` | `#1F4D35` | valor positivo |
| `oxblood-700` | `#6E1F27` | valor negativo |
| `brass-500` | `#A9852E` | acento (único) |

### Cores de categoria para ícones
| Categoria | Cor | Hex |
|---|---|---|
| Receita | Moss | `#637A55` bg `rgba(99,122,85,.12)` |
| Colaboradores | Sage | `#637A55` |
| Espaço Físico / Moradia | Sage | `#637A55` |
| Alimentação / Marketing | Mineral | `#334E68` |
| Transporte | Bronze | `#6E4A2A` |
| Contas / Maquinário | Sand | `#A68A5B` |
| Saúde / Outros | Claret | `#7A3139` |

### Tipografia
- **Títulos de tela** (`MOVIMENTAÇÕES`, `Abril`): Inter bold / semibold, maiúsculas com letter-spacing
- **Valores**: tabular-nums, monospace (JetBrains Mono via CSS se disponível, senão `font-variant-numeric: tabular-nums`)
- **Labels de data**: `SEX · 19 ABR` — pequeno, uppercase, tracking largo
- **Nome da transação**: Inter 14px semibold
- **Categoria**: Inter 12px, ink-500

---

## 🗂️ Estrutura de Arquivos

```
app_dev/frontend/src/app/mobile/financeiro/
└── page.tsx    ← único arquivo alterado (redesign da seção de transações)
```

---

## 📐 Layout da Seção (dentro de `/mobile/financeiro`)

```
[ Resumo do Mês                        ]  ← já existe
[ Gráfico Comparação Mensal            ]  ← já existe
[ Lucro realizado do plano (collapse)  ]  ← já existe
┌─────────────────────────────────────┐
│  MOVIMENTAÇÕES   [Todas][+][−]      │  ← header + chips filtro
├─────────────────────────────────────┤
│  SEX · 19 ABR              −970,00  │  ← date group header
│  🟢  Vestido Noiva · Fulana  +R$... │  ← receita (verde)
│  🔵  Aluguel · Espaço Físico −R$... │  ← despesa (bordô)
│  🔴  Einstein · consulta    −R$...  │
├─────────────────────────────────────┤
│  QUI · 18 ABR            −1.840,00  │
│  🟤  Vivo · fatura          −R$...  │
│  🟢  Ajuste vestido · Ana   +R$...  │
└─────────────────────────────────────┘
```

> Sinal `+` verde para receitas, `−` bordô para despesas. Sem separação de blocos.

---

---

## 🔌 Fontes de Dados (APIs já existentes)

| Dado | Endpoint | Campo útil |
|---|---|---|
| Pedidos entregues (receitas) | `GET /api/v1/pedidos/entregues?mes={anomes}` | `data_entrega`, `tipo_pedido_nome`, `cliente_nome`, `valor_pecas` |
| Despesas realizadas | `GET /api/v1/plano/despesas-realizadas?mes={anomes}` | `tipo_item`, `detalhe`, `categoria`, `valor_realizado`, `data_realizado` (novo) |

> As duas fontes serão mescladas e ordenadas por data no frontend.

---

## ❓ Despesas sem data — decisão tomada

Para misturar receitas e despesas numa linha do tempo única, **despesas precisam de data**.

**Decisão: adicionar `data_realizado` (nullable) na tabela `PlanoItem` como parte do MVP.**

- Novas despesas lançadas pelo form já pedem a data
- Despesas existentes sem data ficam com `NULL` → exibidas num bloco "Sem data" no fim da lista (temporário, até serem editadas)
- Campo opcional no form: se não preenchido, usa `NULL`

---


## 🧩 Componentes a criar

| Componente | Onde | Descrição |
|---|---|---|
| `TransacaoRow` | inline na página | linha de 1 transação (ícone categoria + nome + categoria + valor) |
| `DateGroupHeader` | inline | header de grupo de data ("SEX · 19 ABR · −2.970,00") |
| `FilterChip` | inline | chip pill para filtro Todas/Receitas/Despesas |

> São componentes simples — criar inline na página, sem arquivo separado.

---

## 📋 Tarefas de Implementação

### Backend
- [ ] **1.** Adicionar coluna `data_realizado DATE nullable` na tabela `PlanoItem` (migration SQLite via `ALTER TABLE`)
- [ ] **2.** Atualizar schema Pydantic com campo `data_realizado: Optional[date]`
- [ ] **3.** Atualizar endpoint `GET /plano/despesas-realizadas` para retornar `data_realizado`
- [ ] **4.** Adicionar campo de data no form do bottom sheet (opcional ao lançar despesa)

### Frontend
- [ ] **1.** Redesenhar a seção de transações em `/mobile/financeiro/page.tsx`
  - Header "MOVIMENTAÇÕES" + chips filtro (Todas / Receitas / Despesas)
  - Lista **única** mesclando pedidos + despesas, ordenada por data decrescente
  - Header de grupo por data: "SEX · 19 ABR · saldo do dia"
  - Ícone circular colorido por categoria
  - `+valor` em moss-700, `−valor` em oxblood-700
  - Itens sem data (`data_realizado = NULL`) agrupados no final com header "Sem data"
  - Manter busca textual já existente
- [ ] **2.** Adicionar campo "Data" (opcional) no bottom sheet ao lançar despesa realizada

---

## ✅ Critérios de aceite

- [ ] Seção de movimentações aparece abaixo do card "Lucro realizado do plano"
- [ ] Receitas e despesas numa lista única ordenada por data decrescente
- [ ] Header de grupo por dia com saldo do dia
- [ ] `+valor` verde (moss-700), `−valor` bordô (oxblood-700)
- [ ] Chips de filtro Todas / Receitas / Despesas funcionam
- [ ] Despesas sem data aparecem ao final com header "Sem data"
- [ ] Campo data disponível ao lançar nova despesa realizada
- [ ] Background marfim `#FAF8F3` na seção

---

## 🚀 O que NÃO entra no MVP

- Editar/excluir transação direto da lista
- Paginação ou infinite scroll
- Filtro por categoria
