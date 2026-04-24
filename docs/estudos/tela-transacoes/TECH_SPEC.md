# 🛠️ Tech Spec — Tela de Movimentações + Edição de Transação

> Branch: `feature/seguranca-senha-transacoes`  
> Mockup aprovado: `mockup-transacoes.html` (telefones 1, 4 e 5)  
> Status: **pronto para implementação**

---

## 1. Visão geral

Redesenhar a seção de movimentações dentro de `/mobile/financeiro/page.tsx` e adicionar um bottom sheet de edição/exclusão ao clicar em qualquer transação (receita ou despesa).

### Escopo desta spec
| Área | O que muda |
|---|---|
| Backend | 1 endpoint novo (lista unificada por mês) |
| Backend | 2 endpoints já existem (PATCH + DELETE transação) |
| Frontend | Redesign da seção de movimentações |
| Frontend | Bottom sheet de detalhe/edição (receita e despesa) |

### O que **não** entra nesta versão
- Paginação / infinite scroll  
- Filtro por categoria  
- Criar nova despesa direto da lista (usa o form já existente)

---

## 2. Estado atual do código

### O que já existe e **não precisa ser criado**

| Recurso | Arquivo | Detalhe |
|---|---|---|
| Model `DespesaTransacao` | `domains/plano/transacoes_models.py` | Tabela `despesas_transacoes`, campo `data` já existe |
| `PATCH /transacoes-despesas/{id}` | `transacoes_router.py` | Atualiza `valor`, `data`, `descricao` |
| `DELETE /transacoes-despesas/{id}` | `transacoes_router.py` | Remove transação |
| `GET /transacoes-despesas?mes=` | `transacoes_router.py` | Lista despesas do mês, ordenado por categoria |
| Schema `DespesaTransacaoUpdate` | `schemas.py` | `valor`, `data`, `descricao` (todos opcionais) |
| Schema `DespesaTransacaoOut` | `schemas.py` | Inclui `tipo_item`, `detalhe`, `data` |

### O que **precisa ser criado**

| Recurso | Arquivo | Prioridade |
|---|---|---|
| `GET /plano/movimentacoes` | `plano/router.py` | **Alta** — lista unificada mês |
| Redesign seção movimentações | `financeiro/page.tsx` | **Alta** |
| Bottom sheet edição (receita) | `financeiro/page.tsx` | **Alta** |
| Bottom sheet edição (despesa) | `financeiro/page.tsx` | **Alta** |
| Botão deletar pedido | (ver seção 4.3) | **Média** |

---

## 3. Backend

### 3.1 Novo endpoint: `GET /plano/movimentacoes`

**Rota:** `GET /api/v1/plano/movimentacoes?mes=YYYYMM`

**Responsabilidade:** retornar uma lista unificada de receitas (pedidos entregues) e despesas (transações) do mês, prontas para exibir na tela — já com tipo, categoria, ícone e valor formatados.

#### Response schema (novo — adicionar em `schemas.py`)

```python
class MovimentacaoItem(BaseModel):
    id: int                       # pedido.id ou transacao.id
    origem: str                   # "pedido" | "transacao"
    tipo: str                     # "receita" | "despesa"
    descricao: str                # "Vestido Noiva · Fulana" / "Energia elétrica · Enel"
    categoria: str                # "Receita · Pedido entregue" / "Despesa · Custo Fixo"
    valor: float                  # sempre positivo; frontend aplica sinal pelo tipo
    data: Optional[str]           # YYYY-MM-DD ou null
    icon_key: str                 # "receita" | "colab" | "espaco" | "contas" | "transp" | "maq" | "marketing" | "outros"

class MovimentacoesResponse(BaseModel):
    mes: str
    total_receitas: float
    total_despesas: float
    saldo: float
    itens: List[MovimentacaoItem]
```

#### Lógica de construção da lista

```python
# 1. Pedidos entregues no mês (receitas)
#    Critério: data_entrega entre o 1º e último dia do mês, status == "Entregue"
#    Campos: id, tipo_pedido_nome + cliente_nome → descricao, "Receita · Pedido entregue" → categoria
#            valor_pecas → valor, data_entrega → data

# 2. Transações de despesa do mês (despesas)
#    Critério: DespesaTransacao.anomes == mes
#    Campos: id, plano_item.detalhe ou plano_item.tipo_item → descricao
#            plano_item.tipo_item → categoria label, valor → valor, data → data

# 3. Mesclar e ordenar:
#    - Itens com data: ordenar por data DESC
#    - Itens sem data (data == None): ao final, ordenados por descricao

# 4. Calcular totais:
#    total_receitas = sum(valor) where tipo == "receita"
#    total_despesas = sum(valor) where tipo == "despesa"
#    saldo = total_receitas - total_despesas
```

#### Mapeamento `icon_key` (para despesas)

| `tipo_item` (PlanoItem) | `icon_key` |
|---|---|
| Colaboradores | `colab` |
| Espaço Físico | `espaco` |
| Transporte | `transp` |
| Contas / Maquinário | `contas` |
| Marketing | `marketing` |
| *(demais)* | `outros` |
| *(qualquer receita)* | `receita` |

#### Arquivo de destino

Adicionar a função em `domains/plano/router.py`:

```python
@router.get("/movimentacoes", response_model=MovimentacoesResponse)
def movimentacoes(
    mes: str = Query(..., description="YYYYMM"),
    db: Session = Depends(get_db),
):
    ...
```

---

### 3.2 Endpoints de edição/exclusão já existentes

Não precisam de alteração. Verificar que estão registrados em `main.py`:

```python
# já deve estar em main.py:
from app.domains.plano.transacoes_router import router as transacoes_router
app.include_router(transacoes_router, prefix="/api/v1")
```

Rotas disponíveis após confirmação:
- `PATCH /api/v1/transacoes-despesas/{id}` → atualiza valor/data/descricao
- `DELETE /api/v1/transacoes-despesas/{id}` → remove transação

> ⚠️ **Pedidos (receitas) não têm endpoint de exclusão no contexto do financeiro.** Para o MVP, o botão "Excluir" no bottom sheet de receita não estará disponível (ou mostrará um alerta explicando que o pedido deve ser editado na tela de pedidos).

---

## 4. Frontend — `financeiro/page.tsx`

### 4.1 Seção de movimentações (redesign)

#### Posição na página

```
[Resumo do mês]
[Gráfico comparação mensal]
[Card lucro realizado do plano — colapsável]
────────────────────────────────── ← divisor
[eyebrow "MOVIMENTAÇÕES · ABRIL"]
[chips filtro: Todas | Receitas | Despesas]
[lista de transações agrupada por data]
```

#### Estado e fetch

```typescript
// Estado
const [movimentacoes, setMovimentacoes] = useState<MovimentacaoItem[]>([]);
const [filtroTipo, setFiltroTipo] = useState<'todas' | 'receita' | 'despesa'>('todas');
const [busca, setBusca] = useState('');

// Fetch ao trocar de mês
useEffect(() => {
  api.get(`/plano/movimentacoes?mes=${mesSelecionado}`)
    .then(r => setMovimentacoes(r.data.itens));
}, [mesSelecionado]);

// Itens filtrados
const itensFiltrados = movimentacoes
  .filter(i => filtroTipo === 'todas' || i.tipo === filtroTipo)
  .filter(i => !busca || i.descricao.toLowerCase().includes(busca.toLowerCase()));
```

#### Agrupamento por data (frontend)

```typescript
// Agrupar por data (string YYYY-MM-DD ou null)
type Grupo = { data: string | null; label: string; itens: MovimentacaoItem[]; saldoDia: number };

function agruparPorData(itens: MovimentacaoItem[]): Grupo[] {
  const map = new Map<string | null, MovimentacaoItem[]>();
  for (const item of itens) {
    const key = item.data ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  // Datas com valor: ordenar DESC; null por último
  const comData = [...map.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => b!.localeCompare(a!));
  const semData = map.has(null) ? [[null, map.get(null)!]] as const : [];
  return [...comData, ...semData].map(([data, itens]) => ({
    data,
    label: data ? formatDateLabel(data) : 'Sem data cadastrada',  // ex: "Qui · 24 Abr"
    itens,
    saldoDia: itens.reduce((acc, i) => acc + (i.tipo === 'receita' ? i.valor : -i.valor), 0),
  }));
}
```

#### Componentes inline

```tsx
// DateGroupHeader
function DateGroupHeader({ label, saldo }: { label: string; saldo: number }) { ... }

// TransacaoRow — clicável, abre bottom sheet
function TransacaoRow({ item, onClick }: { item: MovimentacaoItem; onClick: () => void }) { ... }

// FilterChip
function FilterChip({ label, active, onClick }: ...) { ... }
```

#### Ícone por `icon_key`

```typescript
const ICON_MAP: Record<string, JSX.Element> = {
  receita:   <IconPlus />,
  colab:     <IconUsers />,
  espaco:    <IconHome />,
  transp:    <IconTruck />,
  contas:    <IconCreditCard />,
  maq:       <IconMonitor />,
  marketing: <IconBarChart />,
  outros:    <IconTag />,
};

const COLOR_MAP: Record<string, { bg: string; color: string }> = {
  receita:   { bg: 'rgba(99,122,85,.12)',   color: '#637A55' },
  colab:     { bg: 'rgba(99,122,85,.12)',   color: '#637A55' },
  espaco:    { bg: 'rgba(99,122,85,.12)',   color: '#637A55' },
  transp:    { bg: 'rgba(110,74,42,.11)',   color: '#6E4A2A' },
  contas:    { bg: 'rgba(166,138,91,.13)',  color: '#A68A5B' },
  maq:       { bg: 'rgba(166,138,91,.13)',  color: '#A68A5B' },
  marketing: { bg: 'rgba(51,78,104,.11)',   color: '#334E68' },
  outros:    { bg: 'rgba(122,49,57,.10)',   color: '#7A3139' },
};
```

---

### 4.2 Bottom sheet — Detalhe/Edição

#### Estado

```typescript
const [txSelecionada, setTxSelecionada] = useState<MovimentacaoItem | null>(null);
const [editValor, setEditValor] = useState('');
const [editData, setEditData] = useState('');
const [editDescricao, setEditDescricao] = useState('');
const [salvando, setSalvando] = useState(false);
const [confirmDelete, setConfirmDelete] = useState(false);

// Ao abrir o sheet
function abrirDetalhe(item: MovimentacaoItem) {
  setTxSelecionada(item);
  setEditValor(item.valor.toFixed(2).replace('.', ','));
  setEditData(item.data ?? '');
  setEditDescricao(item.descricao);
  setConfirmDelete(false);
}
```

#### Variante receita (origem = "pedido")

- **Valor**: exibido em `moss-700`, editável
- **Data de recebimento**: campo date (input type=date com estilo customizado), destacado com borda `brass-300`
- **Descrição**: exibida mas **somente leitura** (nome do pedido — não muda aqui)
- **Tipo**: badge verde "Receita" readonly
- **Origem**: "Pedido" readonly
- **Botão salvar**: chama `PATCH /transacoes-despesas/{id}` com `{ valor, data }`
- **Botão excluir**: **desabilitado** com tooltip "Acesse a tela de Pedidos para remover"

> Receitas são pedidos — não têm `DespesaTransacao.id`. Para editar data de recebimento de um pedido, será necessário um endpoint separado (`PATCH /pedidos/{id}/data-entrega`) — **fora do escopo desta spec**. Por ora o botão "Salvar" de receita apenas atualiza a data visualmente sem persistir, com um toast informativo.

#### Variante despesa (origem = "transacao")

- **Valor**: editável, `oxblood-700`
- **Data do pagamento**: campo date, campo novo destacado em `brass-300`
- **Descrição**: editável (atualiza `DespesaTransacao.descricao`)
- **Tipo**: badge vermelho "Despesa" readonly
- **Categoria**: select com opções do catálogo (Custo Fixo / Custo Variável) — **fora do escopo MVP** (editável visualmente, não persiste)
- **Toggle "Despesa recorrente"**: somente visual (sem backend), indica se `PlanoItem.valor_planejado > 0`
- **Botão salvar**: `PATCH /api/v1/transacoes-despesas/{id}` com `{ valor, data, descricao }`
- **Botão excluir**: confirma com estado `confirmDelete` → `DELETE /api/v1/transacoes-despesas/{id}` → fecha sheet e remove da lista

#### Fluxo salvar (despesa)

```typescript
async function handleSalvar() {
  if (!txSelecionada || txSelecionada.origem !== 'transacao') return;
  setSalvando(true);
  try {
    await api.patch(`/transacoes-despesas/${txSelecionada.id}`, {
      valor: parseFloat(editValor.replace(',', '.')),
      data: editData || null,
      descricao: editDescricao,
    });
    // Atualizar lista local
    setMovimentacoes(prev => prev.map(i =>
      i.id === txSelecionada.id && i.origem === 'transacao'
        ? { ...i, valor: parseFloat(editValor.replace(',', '.')), data: editData || null, descricao: editDescricao }
        : i
    ));
    setTxSelecionada(null);
    toast.success('Transação atualizada');
  } finally {
    setSalvando(false);
  }
}
```

#### Fluxo excluir (despesa)

```typescript
async function handleExcluir() {
  if (!txSelecionada || txSelecionada.origem !== 'transacao') return;
  if (!confirmDelete) { setConfirmDelete(true); return; }  // 1º clique = pedir confirmação
  setSalvando(true);
  try {
    await api.delete(`/transacoes-despesas/${txSelecionada.id}`);
    setMovimentacoes(prev => prev.filter(i => !(i.id === txSelecionada.id && i.origem === 'transacao')));
    setTxSelecionada(null);
    toast.success('Transação excluída');
  } finally {
    setSalvando(false);
  }
}
```

---

### 4.3 Decisões de arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Nova rota ou inline? | Inline em `financeiro/page.tsx` | Mantém contexto do mês selecionado sem route params |
| Bottom sheet: componente separado? | Inline (sem arquivo novo) | Sheet é simples, reutilização baixa agora |
| Recharts no sheet? | Não | Sem gráfico no sheet |
| Edição de receita (pedido)? | Somente visual (MVP) | Precisa de endpoint específico em pedidos |

---

## 5. Arquivos tocados

```
app_dev/
├── backend/
│   └── app/domains/plano/
│       ├── router.py          ← ADD: GET /movimentacoes
│       └── schemas.py         ← ADD: MovimentacaoItem, MovimentacoesResponse
└── frontend/
    └── src/app/mobile/financeiro/
        └── page.tsx           ← REDESIGN: seção movimentações + bottom sheet
```

---

## 6. Ordem de implementação

```
[ ] 1. Backend: schemas MovimentacaoItem + MovimentacoesResponse (schemas.py)
[ ] 2. Backend: endpoint GET /plano/movimentacoes (router.py)
[ ] 3. Backend: confirmar que transacoes_router está em main.py
[ ] 4. Testar endpoints com curl / swagger
[ ] 5. Frontend: redesign da seção movimentações (lista + grupos)
[ ] 6. Frontend: bottom sheet receita (somente leitura + data visual)
[ ] 7. Frontend: bottom sheet despesa (editar + excluir com confirmação)
[ ] 8. Teste end-to-end no browser (local)
[ ] 9. Commit + deploy
```

---

## 7. Tokens de design (referência rápida)

```css
/* superfície */
--paper-50:  #FAF8F3   /* fundo geral */
--paper-00:  #FFFFFF   /* card / sheet */
--ink-100:   #E6E4DE   /* dividers */

/* texto */
--ink-900:   #0B1220   /* título */
--ink-500:   #4B5468   /* label secundário */
--ink-300:   #8A93A5   /* placeholder, detalhe */

/* valores */
--moss-700:  #1F4D35   /* receita / positivo */
--oxblood-700: #6E1F27 /* despesa / negativo */
--brass-500: #A9852E   /* acento (campo novo, mês atual) */

/* ícones categoria */
sage    #637A55   receita, colab, espaço
mineral #334E68   marketing
sand    #A68A5B   contas, maquinário
bronze  #6E4A2A   transporte
claret  #7A3139   outros
```
