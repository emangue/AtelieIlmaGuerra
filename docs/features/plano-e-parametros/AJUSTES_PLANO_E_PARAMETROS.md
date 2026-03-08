# Ajustes: Plano e Parâmetros

**Data:** 08/03/2026
**Status:** Em planejamento

---

## Contexto atual

Hoje o plano é carregado **exclusivamente via upload de Excel**, o que foi útil para construir a base inicial. No dia a dia, porém, isso não é sustentável: a Ilma precisa poder gerenciar o plano e registrar o realizado direto no app.

---

## 1. Edição do Plano pelo App

### Problema
Não é possível criar ou editar o plano sem subir um novo Excel.

### Solução esperada
- Interface dentro do app para **criar e editar o Plano de Receita e o Plano de Despesas** por período (mês/ano).
- Manter a possibilidade de subir Excel como forma alternativa (importação).
- Alterações feitas pelo app devem sobrescrever/complementar o plano existente.

### Campos mínimos
| Campo | Descrição |
|-------|-----------|
| Período | Mês/Ano de referência |
| Tipo | `receita` ou `despesa` |
| Categoria | Categoria do item |
| Descrição | Descrição do item |
| Valor planejado | Valor previsto para o período |

---

## 2. Lançamento de Despesas Reais (Realizado)

### Problema
Não existe forma de registrar o que foi **efetivamente gasto** para comparar com o planejado.

### Solução esperada
- Tela de **lançamento de despesas reais** com os mesmos campos do plano de despesas.
- Vinculação ao período e categoria correspondente do plano.
- Exibição de uma visão **Plano × Realizado** com variação (positiva ou negativa).

### Visão Plano × Realizado
| Categoria | Plano | Realizado | Variação |
|-----------|-------|-----------|----------|
| Exemplo   | R$ X  | R$ Y      | R$ X–Y   |

---

## 3. Total de Despesas nos Parâmetros vindo do Plano/Realizado

### Problema
O total de despesas detalhadas dentro dos parâmetros é calculado de forma independente, sem conexão com o plano ou o realizado.

### Solução esperada
- O campo **"Total de Despesas"** nos parâmetros deve ser **calculado automaticamente** a partir dos dados do plano de despesas e/ou do realizado (conforme o período ativo).
- Não deve ser um valor digitado manualmente — deve refletir a soma das categorias de despesa registradas.
- Regra de prioridade sugerida:
  - Se houver **realizado** para o período → usa o realizado.
  - Se não houver realizado → usa o **plano**.

---

## 4. Lucro Esperado nos Parâmetros

### Problema
Os parâmetros tratam tudo como despesa, sem considerar um objetivo de lucro.

### Solução esperada
- Adicionar o conceito de **Lucro Esperado** nos parâmetros.
- O lucro **não é uma despesa** — é a diferença entre receita e despesa que o ateliê quer reter.

### Lógica de cálculo

```
Plano de Receita  - Plano de Despesas  = Plano de Lucro
Receita Realizada - Despesa Realizada  = Lucro Realizado
Plano de Lucro    - Lucro Realizado    = Variação do Lucro
```

### Campos a adicionar nos parâmetros
| Campo | Origem |
|-------|--------|
| Total Receita Planejada | Soma do Plano de Receita |
| Total Despesa Planejada | Soma do Plano de Despesas |
| **Lucro Esperado** | Receita Planejada − Despesa Planejada |
| Total Receita Realizada | Soma das receitas registradas |
| Total Despesa Realizada | Soma das despesas registradas |
| **Lucro Realizado** | Receita Realizada − Despesa Realizada |

---

## 5. Resumo das Mudanças por Área

| Área | Mudança |
|------|---------|
| Plano | Edição pelo app (não só via Excel) |
| Realizado | Novo lançamento de despesas reais |
| Parâmetros – Despesas | Calculado automaticamente do plano/realizado |
| Parâmetros – Lucro | Novo campo: Receita − Despesa = Lucro esperado |

---

## Próximos passos

- [ ] Definir layout das telas de edição de plano
- [ ] Definir layout da tela de lançamento de despesas reais
- [ ] Ajustar tela de parâmetros para refletir os novos campos
- [ ] Atualizar modelo de dados (`PLANO_RECEITA_DESPESAS.md`)
