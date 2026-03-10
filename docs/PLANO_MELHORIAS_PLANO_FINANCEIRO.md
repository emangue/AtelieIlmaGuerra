# Plano de Melhorias - Plano Financeiro

**Objetivo:** Permitir adicionar, deletar e editar itens do plano; aplicar ajustes em massa aos meses futuros; e registrar despesas realizadas para comparação com o planejado.

**Base atual:** `plano_itens` (receita/despesa), `PlanoItem` com `valor_planejado` e `valor_realizado`.

---

## 1. CRUD Completo (Adicionar, Editar, Deletar)

### 1.1 Backend

| Ação | Endpoint | Status atual | Ação necessária |
|------|----------|--------------|-----------------|
| **Criar** | `POST /api/v1/plano` | ✅ Existe | Manter |
| **Editar** | `PATCH /api/v1/plano/{id}` | ⚠️ Parcial (só `valor_realizado`) | Estender para `valor_planejado`, `quantidade`, `ticket_medio`, `detalhe`, etc. **Nota:** `valor_realizado` passa a ser calculado a partir das transações (base de despesas); não editar diretamente. |
| **Deletar** | `DELETE /api/v1/plano/{id}` | ❌ Não existe | Criar |

**Schema de update completo:**
```python
class PlanoItemUpdate(BaseModel):
    valor_planejado: Optional[float] = None
    quantidade: Optional[int] = None
    ticket_medio: Optional[float] = None
    detalhe: Optional[str] = None
    # valor_realizado NÃO editável aqui – vem da soma das transações
```

### 1.2 Frontend

- **Adicionar:** Botão "Novo item" por mês (ou no resumo) → modal/drawer com formulário (tipo, categoria, tipo_item, valor_planejado, etc.).
- **Editar:** Clique longo ou ícone de lápis na linha do item → modal de edição.
- **Deletar:** Ícone de lixeira + confirmação ("Excluir este item?").

---

## 2. Aplicar Ajuste aos Meses Futuros

### 2.1 Comportamento desejado

Ao editar um valor em um mês (ex.: despesas de Jan/2026 = R$ 13.500), o usuário pode clicar em **"Aplicar aos próximos meses"** para que todos os meses futuros do ano (ou até o fim do plano) recebam o mesmo ajuste.

**Cenários:**
- **Ajuste de valor único:** Ex.: despesa "Colaboradores - Esli" em Jan = R$ 5.000 → aplicar R$ 5.000 em Fev, Mar, ..., Dez.
- **Ajuste por tipo_item:** Ex.: alterar "Espaço Físico - Aluguel" em Jan → aplicar o novo valor em todos os meses futuros que tenham esse mesmo `tipo_item` + `detalhe`.
- **Aplicar despesas fixas do mês:** Ex.: todas as despesas de Jan somam R$ 13.299 → copiar essa estrutura (valores por item) para Fev, Mar, etc.

### 2.2 Backend

**Novo endpoint:**
```
POST /api/v1/plano/aplicar-aos-futuros
Body: {
  "mes_referencia": "202601",     // YYYYMM - mês onde o usuário fez o ajuste
  "item_id": 123,                 // opcional - se informado, aplica só esse item
  "tipo_item": "Colaboradores",   // opcional - aplica a todos os itens com esse tipo
  "detalhe": "Esli",              // opcional - filtra por detalhe
  "ate_mes": "202612"             // opcional - último mês a receber (default: fim do ano)
}
```

**Lógica:**
1. Buscar o(s) item(ns) no `mes_referencia` que atendem aos filtros.
2. Para cada mês futuro (mes_referencia < mês ≤ ate_mes):
   - Se já existe item com mesmo `tipo` + `tipo_item` + `detalhe` → atualizar `valor_planejado`.
   - Se não existe → criar novo item com os mesmos dados e o novo valor.

### 2.3 Frontend

- Na tela de edição de um item (ou na linha expandida do mês):
  - Botão **"Aplicar aos próximos meses"**.
  - Modal de confirmação: "Aplicar este valor (R$ X) aos meses de Fev/2026 a Dez/2026?"
  - Opção: "Aplicar só a itens existentes" vs "Criar itens nos meses que não tiverem".

---

## 3. Base de Transações e Despesas Realizadas

### 3.1 Arquitetura desejada

- **Base de transações:** Nova tabela `despesas_transacoes` para armazenar **todas** as transações de despesa (cada lançamento individual).
- **Plano sumarizado:** O campo `valor_realizado` em `plano_itens` passa a ser **calculado** (ou mantido em cache) como a soma das transações vinculadas àquele item.
- **Fluxo ao adicionar:** Ao incluir uma despesa nova realizada, o usuário escolhe no **dropdown** a categoria (tipo_item + detalhe) → a transação é salva → o `valor_realizado` do item correspondente é atualizado.

### 3.2 Modelo de dados

**Nova tabela `despesas_transacoes`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | |
| anomes | VARCHAR(6) | YYYYMM – mês da transação |
| plano_item_id | INTEGER FK | Referência ao item do plano (tipo_item + detalhe + categoria) |
| valor | FLOAT | Valor da transação |
| data | DATE | Data da transação (opcional) |
| descricao | VARCHAR(255) | Descrição livre (opcional) |
| created_at | DATETIME | |

**Regra:** `valor_realizado` em `plano_itens` = `SUM(valor)` de `despesas_transacoes` onde `plano_item_id = plano_itens.id`.

- Pode ser **calculado em tempo real** nas consultas (subquery/join).
- Ou **atualizado** via trigger/service sempre que uma transação é criada/editada/deletada.

**Migração:** Se já existirem registros com `valor_realizado` preenchido em `plano_itens`, criar script para gerar uma transação por item (valor = valor_realizado) e depois zerar o campo, ou manter o campo como fallback até a migração completa.

### 3.3 Dropdown de categorias – temas de despesa

Ao adicionar uma despesa realizada, o dropdown deve mostrar as opções no formato **detalhe (tipo_item)**, conforme o detalhamento atual do plano:

| tipo_item (categoria) | detalhe (exemplos) |
|----------------------|--------------------|
| Colaboradores | Pró-Labore, Esli, Faxineira |
| Espaço Físico | Aluguel, Água Mineral, DAS MEI, Luz, Produtos de Limpeza, Produtos de Higiene |
| Maquinário | Manutenção de Máquinas |
| Marketing | Tráfego Pago, Fotógrafo |
| Transporte | Gasolina |

**Exemplos de opções no dropdown:** "Pró-Labore (Colaboradores)", "Aluguel (Espaço Físico)", "Esli (Colaboradores)", "Luz (Espaço Físico)", "Gasolina (Transporte)", etc.

**Fonte das opções:**
1. **Itens do plano no mês:** `plano_itens` com `tipo=despesa` e `anomes=mes_selecionado`.
2. **Catálogo de categorias:** Lista de (tipo_item, detalhe, categoria) já usados no sistema ou em um cadastro mestre, para permitir adicionar despesas em categorias que ainda não existem no mês.

**Comportamento:**
- Se o usuário escolher um item que **já existe** no plano daquele mês → transação vinculada a `plano_item_id`.
- Se escolher uma categoria que **não existe** no plano daquele mês → criar `PlanoItem` com `valor_planejado=0`, `valor_realizado` = valor da transação (ou somar depois).

**Endpoint para popular o dropdown:**
```
GET /api/v1/plano/opcoes-despesa?mes=YYYYMM
Response: [
  { "plano_item_id": 123, "label": "Colaboradores - Esli", "categoria": "Custo Fixo" },
  { "plano_item_id": 124, "label": "Espaço Físico - Aluguel", "categoria": "Custo Fixo" },
  ...
]
```
- Incluir itens existentes no plano do mês.
- Incluir categorias do catálogo que ainda não têm item no mês (nesse caso `plano_item_id` null até a criação).

### 3.4 Endpoints da base de transações

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/transacoes-despesas?mes=YYYYMM` | Lista transações do mês |
| POST | `/api/v1/transacoes-despesas` | Cria transação; atualiza `valor_realizado` do plano_item |
| PATCH | `/api/v1/transacoes-despesas/{id}` | Edita transação; recalcula realizado |
| DELETE | `/api/v1/transacoes-despesas/{id}` | Remove transação; recalcula realizado |
| GET | `/api/v1/plano/opcoes-despesa?mes=YYYYMM` | Opções para o dropdown |

### 3.5 Fluxo no frontend

1. Usuário clica em **"Adicionar despesa realizada"**.
2. Modal abre com:
   - **Dropdown "Categoria":** opções do `GET /plano/opcoes-despesa?mes=YYYYMM` (ex.: "Colaboradores - Esli", "Espaço Físico - Aluguel", "Outros - [nova]").
   - **Valor:** campo numérico.
   - **Data:** opcional.
   - **Descrição:** opcional.
3. Ao salvar → `POST /transacoes-despesas` → backend cria transação, vincula ao plano_item (ou cria item se necessário), atualiza `valor_realizado`.
4. A tela do plano e o resumo passam a refletir o novo realizado automaticamente.

---

## 4. Ordem de Implementação Sugerida

### Fase 1 – CRUD básico
1. Backend: `DELETE /plano/{id}`.
2. Backend: Estender `PATCH /plano/{id}` para editar todos os campos relevantes.
3. Frontend: Botões Editar e Deletar nos itens do detalhamento.
4. Frontend: Modal de edição (reutilizar campos do formulário de criação).

### Fase 2 – Aplicar aos futuros
5. Backend: `POST /plano/aplicar-aos-futuros`.
6. Frontend: Botão "Aplicar aos próximos meses" no modal de edição.
7. Frontend: Modal de confirmação com opções (até qual mês, criar ou só atualizar).

### Fase 3 – Base de transações e despesas realizadas
8. Backend: Criar modelo `DespesaTransacao` e migration.
9. Backend: Endpoints CRUD `/transacoes-despesas` + `GET /plano/opcoes-despesa`.
10. Backend: Calcular `valor_realizado` a partir da soma das transações (ajustar service `get_plano_vs_realizado` e queries).
11. Frontend: Botão "Adicionar despesa realizada" → modal com **dropdown de categorias** (opções do backend), valor, data, descrição.
12. Frontend: Lista de transações do mês (opcional, para auditoria).

### Fase 4 – Comparação visual
13. Frontend: Colunas "Despesas realizadas" e "Variação" na tabela "Por mês".
14. Frontend: Resumo do ano com totais realizados (receita, despesas, lucro) ao lado dos planejados.

---

## 5. Resumo de Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/plano` | Lista itens (já existe) |
| GET | `/plano/resumo-mensal` | Resumo por mês (já existe) |
| GET | `/plano/opcoes-despesa?mes=YYYYMM` | **Opções para dropdown ao adicionar despesa (criar)** |
| POST | `/plano` | Criar item (já existe) |
| PATCH | `/plano/{id}` | Editar item – só campos do plano, não valor_realizado (estender) |
| **DELETE** | `/plano/{id}` | **Deletar item (criar)** |
| **POST** | `/plano/aplicar-aos-futuros` | **Aplicar valor aos meses futuros (criar)** |
| GET | `/plano/despesas-realizadas` | Lista despesas realizadas – pode vir de transações (ajustar) |
| GET | `/plano/plano-vs-realizado` | Comparação – valor_realizado = soma transações (ajustar) |
| **GET** | **`/transacoes-despesas?mes=YYYYMM`** | **Lista transações do mês (criar)** |
| **POST** | **`/transacoes-despesas`** | **Cria transação; atualiza realizado (criar)** |
| **PATCH** | **`/transacoes-despesas/{id}`** | **Edita transação (criar)** |
| **DELETE** | **`/transacoes-despesas/{id}`** | **Remove transação (criar)** |

---

## 6. Considerações de UX (mobile-first)

- Modais em tela cheia ou bottom sheet no mobile.
- Confirmação antes de deletar e antes de aplicar aos futuros.
- Feedback visual após salvar (toast ou mensagem).
- Loading states em todas as operações assíncronas.
