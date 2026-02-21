# Plano de Receitas e Despesas - Estrutura Unificada

**Baseado em:** `PLANO 2026 ATELIE ILMA GUERRA.xlsx`  
**Planilhas originais:** MetaReceita, MetaDespesas

## 1. Estrutura Unificada

Uma única base com receitas e despesas, diferenciadas pelo campo `tipo`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| anomes | YYYYMM | Mês/ano do plano |
| tipo | receita \| despesa | Receita ou despesa |
| categoria | string | Receita, Custo Variável, Custo Fixo |
| tipo_item | string | Vestido Noiva, Ajustes, Colaboradores, Espaço Físico, etc. |
| detalhe | string? | Detalhe opcional (Esli, Aluguel, Luz, etc.) |
| quantidade | int? | Para receita: qtd planejada |
| ticket_medio | float? | Para receita: valor médio unitário |
| valor_planejado | float | Valor planejado (ValorTotal ou Planejado) |
| valor_realizado | float? | Valor realizado (despesas; receita vem dos pedidos) |

## 2. Mapeamento das Planilhas Originais

### MetaReceita → tipo=receita
- Categoria: sempre "Receita"
- tipo_item: Vestido Noiva, Vestido Festa, Ajustes, Peça Casual
- quantidade, ticket_medio, valor_planejado (ValorTotal)

### MetaDespesas → tipo=despesa
- Categoria: Custo Variável ou Custo Fixo
- tipo_item: Colaboradores, Espaço Físico, Marketing, Transporte, Maquinário
- detalhe: Esli, Faxineira, Aluguel, Luz, DAS MEI, etc.
- valor_planejado (Planejado), valor_realizado (Realizado)

## 3. Card Colapsável no Painel (Dashboard)

**Local:** Painel principal mobile, junto aos KPIs (Peças entregues, % Margem mês, Mix de status).

### Linha fechada (resumo)
- Uma linha preenchida com o **lucro realizado do plano**
- Exibe o **valor** (ex.: R$ 12.500)
- Exibe o **percentual** de atingimento (ex.: "85% do planejado" ou "atingindo 85%")
- Permite expandir/colapsar para ver o detalhamento

### Linha expandida (detalhamento)
- **Quebra Receitas vs Despesas:** duas seções (Receitas | Despesas)
- **Linha a linha:** cada item do plano com:
  - Planejado vs Realizado
  - Indicador visual de onde estamos bem (verde) e onde não (vermelho/amarelo)
- Objetivo: identificar rapidamente onde o plano está sendo cumprido e onde há desvio

## 4. Visões do Painel (implementado)

**Toggle com 4 opções:** Mês | YTD | Ano | YTD Fech.

- **Mês:** Scroll de meses. Gráfico: lucro últimos 12 meses. KPIs do mês.
- **YTD:** Scroll de anos. Gráfico: faturamento por mês (ano completo) comparando 3 anos.
- **Ano:** Scroll de anos. Gráfico: uma barra por ano (faturamento total) — anos fechados 24, 25, 26.
- **YTD Fech.:** Scroll de anos. Gráfico: visão ano (uma barra por ano) com faturamento até o mês atual — "quanto ganhou até aqui" em 24, 25, 26.

## 5. Próximos Passos (fase 2)

- **Edição:** Formulário para alterar itens do plano
- **Acompanhamento:** Gráficos ou tabelas comparando planejado vs realizado
- **Receita realizado:** Calcular a partir dos pedidos entregues no mês
