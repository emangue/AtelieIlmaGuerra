# Ateliê Ilma Guerra — Telas e Funcionalidades

> Aplicativo web mobile-first desenvolvido em Next.js 15 para gestão completa do ateliê: pedidos, clientes, contratos, financeiro e muito mais.

---

## Sumário

1. [Login](#1-login)
2. [Painel (Dashboard)](#2-painel-dashboard)
3. [Pedidos](#3-pedidos)
   - [Lista de Pedidos Ativos](#31-lista-de-pedidos-ativos)
   - [Todos os Pedidos](#32-todos-os-pedidos)
   - [Detalhe do Pedido](#33-detalhe-do-pedido)
   - [Novo Pedido](#34-novo-pedido)
4. [Orçamentos](#4-orçamentos)
5. [Contratos](#5-contratos)
6. [Clientes](#6-clientes)
7. [Financeiro](#7-financeiro)
8. [Plano Anual](#8-plano-anual)
9. [Despesas Detalhadas](#9-despesas-detalhadas)
10. [Parâmetros](#10-parâmetros)
11. [Perfil e Usuários](#11-perfil-e-usuários)
12. [Calendário](#12-calendário-em-desenvolvimento)
13. [Navegação Geral](#13-navegação-geral)

---

## 1. Login

**Rota:** `/auth/login`

Tela de acesso ao sistema.

### Funcionalidades
- Formulário com **e-mail** e **senha**
- Autenticação via JWT (token armazenado no `localStorage`)
- Redirecionamento automático para `/mobile/contratos` após login bem-sucedido
- Preserva a rota de destino original caso o usuário tente acessar uma página protegida sem estar logado
- Auto-logout em caso de token expirado (resposta 401 da API)

---

## 2. Painel (Dashboard)

**Rota:** `/mobile`

Visão geral dos principais indicadores do ateliê.

### Seletor de Período
Permite alternar entre quatro visões:
| Opção | Descrição |
|---|---|
| **Mês** | Dados do mês selecionado |
| **YTD** | Acumulado do ano até o mês atual (inclui pedidos em aberto) |
| **Ano** | Acumulado do ano completo |
| **YTD-Fechado** | Acumulado do ano considerando apenas pedidos entregues |

### Cards de KPIs
- **Faturamento Real** — Receita já faturada no período
- **Faturamento Potencial** — Receita de pedidos em andamento + entregues
- **Horas Trabalhadas** — Horas efetivamente trabalhadas vs. horas potenciais
- **Peças Entregues** — Quantidade de peças finalizadas
- **Margem** — Percentual de margem de lucro realizada

### Seção "Lucro Realizado do Plano"
Painel colapsável com duas abas:
- **Receitas** — Comparativo entre o planejado e o realizado no mês
- **Despesas** — Comparativo entre o planejado e o realizado no mês

### Gráficos
- **Comparação Mensal** — Evolução mês a mês do lucro ao longo do ano
- **Lucro por Tipo** — Distribuição do lucro por categoria de produto
- **Mix de Status** — Gráfico de pizza com a situação atual dos pedidos (Encomenda, Cortado, Provado, Pronto, Entregue)

### Peças por Tipo
Listagem com a quantidade de peças por categoria de produto.

---

## 3. Pedidos

### 3.1 Lista de Pedidos Ativos

**Rota:** `/mobile/pedidos`

Exibe todos os pedidos que ainda não foram entregues.

#### Funcionalidades
- Pedidos **agrupados por data de entrega** (mais próximos primeiro)
- Para cada pedido, exibe: cliente, tipo de peça, status atual e data de entrega
- **Botões de status rápido** diretamente na listagem:
  - Cortado
  - Provado
  - Pronto
  - Entregue
- Toque no pedido abre o detalhe completo
- Botão flutuante `+` para criar novo pedido

---

### 3.2 Todos os Pedidos

**Rota:** `/mobile/pedidos/todos`

Visão completa do histórico de pedidos (ativos e entregues).

#### Funcionalidades
- Lista todos os pedidos independentemente do status
- Filtros e navegação por período
- Acesso ao detalhe de qualquer pedido

---

### 3.3 Detalhe do Pedido

**Rota:** `/mobile/pedidos/[id]`

Exibe todas as informações de um pedido específico.

#### Informações exibidas
- Cliente vinculado
- Tipo de peça / produto
- Status atual no fluxo de trabalho
- Datas (criação, prova, entrega)
- Valor do pedido
- Observações

#### Funcionalidades
- Atualizar status do pedido pelo fluxo:
  `Encomenda → Cortado → Provado → Pronto → Entregue`
- Atalho para **gerar contrato** diretamente do pedido
- Editar informações do pedido

---

### 3.4 Novo Pedido

**Rota:** `/mobile/pedidos/novo`

Formulário para cadastrar um novo pedido.

#### Campos
- Cliente (seleção a partir do cadastro)
- Tipo de peça / produto
- Data de prova (se aplicável)
- Data de entrega
- Valor
- Observações

---

## 4. Orçamentos

**Rota:** `/mobile/orcamentos` e `/mobile/pedidos/orcamentos`

Gestão de orçamentos enviados para clientes.

### Funcionalidades
- Listagem de todos os orçamentos
- Visualização de margens simuladas em **20%, 30% e 40%** para cada orçamento
- Criar novo orçamento em `/mobile/orcamentos/novo`
- Visualizar detalhe em `/mobile/orcamentos/[id]`

### Campos do Orçamento
- Cliente
- Descrição do serviço / peça
- Custo estimado
- Cálculo automático de preço de venda por margem

---

## 5. Contratos

**Rota:** `/mobile/contratos`

Gerenciamento de contratos gerados para os clientes.

### Funcionalidades
- Listagem de todos os contratos cadastrados
- Criar novo contrato em `/mobile/contratos/novo`
- Visualizar contrato em `/mobile/contratos/[id]`
- Editar contrato em `/mobile/contratos/[id]/editar`
- **Download de PDF** do contrato gerado

### Campos do Contrato
- Seleção do cliente
- Dados do serviço contratado
- Valores e condições de pagamento
- Datas relevantes

---

## 6. Clientes

**Rota:** `/mobile/clientes`

Cadastro e gestão da carteira de clientes do ateliê.

### Funcionalidades
- Listagem de todos os clientes
- **Busca** por nome, telefone ou e-mail
- Criar novo cliente em `/mobile/clientes/novo`
- Visualizar e editar cliente em `/mobile/clientes/[id]`

### Campos do Cliente
- Nome completo
- E-mail
- Telefone / WhatsApp
- Endereço
- Observações

---

## 7. Financeiro

**Rota:** `/mobile/financeiro`

Controle financeiro mensal com comparativo entre planejado e realizado.

### Funcionalidades

#### Visão Mensal
- Seletor de mês para navegar entre períodos
- Comparativo **Plano vs. Realizado** para receitas e despesas
- Percentual de execução do plano

#### Copiar Plano
- Botão para copiar os valores planejados do mês anterior ou seguinte
- Útil para replicar meses com estrutura similar

#### Gráfico de Evolução Mensal
- Linha de lucro realizado vs. lucro planejado ao longo dos meses

#### Transações do Mês
- Lista com todos os lançamentos do mês:
  - Receitas: pedidos entregues no período
  - Despesas: despesas realizadas no período

#### Adicionar Lançamento
- Formulário para registrar receita ou despesa manual
- Seleção de categoria
- Valor e descrição

---

## 8. Plano Anual

**Rota:** `/mobile/plano`

Planejamento financeiro anual com visão consolidada por mês.

### Funcionalidades
- **Seletor de ano** (2024–2027)
- Tabela resumo com todos os meses do ano exibindo:
  - Receitas planejadas
  - Despesas planejadas
  - Lucro esperado
  - Margem percentual
- Cada mês é **expansível** para ver o detalhamento por linha de receita e despesa
- Planejamento editável diretamente na tela

---

## 9. Despesas Detalhadas

**Rota:** `/mobile/despesas`

Cadastro e gestão das despesas fixas e variáveis do ateliê.

### Funcionalidades
- Listagem de todas as despesas **agrupadas por categoria**
- Exibe o total por categoria e total geral
- Criar nova despesa
- Editar despesa existente
- Excluir despesa (com confirmação)
- O total de despesas calculado aqui alimenta os **Parâmetros** de precificação

### Categorias de Despesas (exemplos)
- Aluguel
- Salários
- Materiais
- Marketing
- Outras

---

## 10. Parâmetros

**Rota:** `/mobile/parametros`

Configurações de precificação e metas financeiras.

### Indicadores exibidos
- **Total de Despesas** — calculado automaticamente a partir das despesas cadastradas
- **Preço por Hora** — valor da hora de trabalho baseado nas despesas e horas disponíveis
- **Faturamento Target** — meta de faturamento para atingir a margem desejada

### Campos editáveis
| Campo | Valor padrão |
|---|---|
| Impostos | 6% |
| Taxa Cartão de Crédito | 3% |
| Total de Horas por Mês | configurável |
| Margem Target | configurável |

Ao alterar qualquer campo, o sistema recalcula automaticamente o preço/hora e o faturamento alvo.

---

## 11. Perfil e Usuários

**Rota:** `/mobile/perfil`

Gerenciamento de perfil do usuário logado e, para administradores, gestão de usuários do sistema.

### Informações do Perfil
- Nome
- E-mail
- Função (role)

### Gestão de Usuários *(somente Admin)*
- Listar todos os usuários cadastrados
- Criar novo usuário (nome, e-mail, senha, função)
- Editar dados de um usuário
- Ativar / desativar usuário
- Redefinir senha de um usuário

---

## 12. Calendário *(em desenvolvimento)*

**Rota:** `/mobile/calendario`

Tela reservada para visualização de datas de entrega e provas em formato de calendário.

> **Status:** Em desenvolvimento — tela ainda não implementada.

---

## 13. Navegação Geral

### Barra de Navegação Inferior (5 abas fixas)
| Aba | Ícone | Rota |
|---|---|---|
| Painel | Dashboard | `/mobile` |
| Pedidos | Lista | `/mobile/pedidos` |
| **+** (Novo Pedido) | FAB central | `/mobile/pedidos/novo` |
| Financeiro | Moeda | `/mobile/financeiro` |
| Contratos | Documento | `/mobile/contratos` |

### Menu Superior (Header)
Acessível pelo ícone de menu no cabeçalho:
- Clientes
- Orçamentos
- Plano Anual
- Despesas
- Parâmetros
- Perfil
- Sair (Logout)

### Mapa de Rotas Completo

```
/
├── /auth/login                        ← Login
└── /mobile                            ← Área protegida
    ├── /                              ← Painel (Dashboard)
    ├── /pedidos                       ← Pedidos Ativos
    │   ├── /novo                      ← Criar Pedido
    │   ├── /todos                     ← Todos os Pedidos
    │   ├── /orcamentos                ← Orçamentos (via Pedidos)
    │   └── /[id]                      ← Detalhe do Pedido
    ├── /contratos                     ← Lista de Contratos
    │   ├── /novo                      ← Criar Contrato
    │   ├── /[id]                      ← Visualizar Contrato
    │   └── /[id]/editar               ← Editar Contrato
    ├── /clientes                      ← Lista de Clientes
    │   ├── /novo                      ← Criar Cliente
    │   └── /[id]                      ← Ver/Editar Cliente
    ├── /orcamentos                    ← Lista de Orçamentos
    │   ├── /novo                      ← Criar Orçamento
    │   └── /[id]                      ← Ver Orçamento
    ├── /financeiro                    ← Financeiro Mensal
    ├── /plano                         ← Plano Anual
    ├── /despesas                      ← Despesas Detalhadas
    ├── /parametros                    ← Parâmetros de Precificação
    ├── /perfil                        ← Perfil e Gestão de Usuários
    └── /calendario                    ← Calendário (em dev)
```

---

## Stack Técnica (Referência)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript 5 |
| UI | shadcn/ui + Radix UI |
| Estilização | Tailwind CSS v4 |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Datas | date-fns |
| Estado Global | React Context API (AuthContext) |
| Autenticação | JWT via localStorage |
| Backend | FastAPI (Python) + SQLite |
