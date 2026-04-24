# 🚀 Plano de Deploy Local — Tela de Movimentações

> Branch: `feature/seguranca-senha-transacoes`  
> Data: 24/04/2026  
> Referência: `TECH_SPEC.md` (mesma pasta)  
> Objetivo: implementar e validar localmente a tela de movimentações + bottom sheet de edição antes de subir para produção.

---

## Estado atual (pré-deploy)

| Item | Status |
|---|---|
| Branch `feature/seguranca-senha-transacoes` criada | ✅ |
| `transacoes_router` registrado em `main.py` | ✅ |
| Endpoints PATCH/DELETE `/transacoes-despesas/{id}` | ✅ |
| Schema `MovimentacaoItem` + `MovimentacoesResponse` | ❌ pendente |
| Endpoint `GET /plano/movimentacoes` | ❌ pendente |
| Frontend redesign seção movimentações | ❌ pendente |
| Frontend bottom sheet receita | ❌ pendente |
| Frontend bottom sheet despesa (editar + excluir) | ❌ pendente |

---

## Passo a passo

### ─── FASE 1 — Backend ───────────────────────────────────

#### 1.1 Adicionar schemas em `schemas.py`

**Arquivo:** `app_dev/backend/app/domains/plano/schemas.py`

Adicionar ao final do arquivo:

```python
# ── Movimentações unificadas ──────────────────────────────
class MovimentacaoItem(BaseModel):
    id: int
    origem: str          # "pedido" | "transacao"
    tipo: str            # "receita" | "despesa"
    descricao: str
    categoria: str
    valor: float
    data: Optional[str]  # YYYY-MM-DD ou None
    icon_key: str

    class Config:
        from_attributes = True

class MovimentacoesResponse(BaseModel):
    mes: str
    total_receitas: float
    total_despesas: float
    saldo: float
    itens: List[MovimentacaoItem]
```

**Verificar:** `Optional` e `List` já importados (ou importar de `typing`).

---

#### 1.2 Adicionar endpoint em `router.py`

**Arquivo:** `app_dev/backend/app/domains/plano/router.py`

1. Adicionar imports no topo (se ausentes):
   ```python
   from app.domains.pedidos.models import Pedido
   from .transacoes_models import DespesaTransacao
   from .schemas import MovimentacaoItem, MovimentacoesResponse
   ```

2. Adicionar a função no final do arquivo, **antes** de qualquer `@router.get("/{item_id}")` genérico para não conflitar:

```python
@router.get("/movimentacoes", response_model=MovimentacoesResponse)
def get_movimentacoes(
    mes: str = Query(..., description="YYYYMM"),
    db: Session = Depends(get_db),
):
    """Lista unificada de receitas (pedidos entregues) e despesas (transações) do mês."""
    if len(mes) != 6 or not mes.isdigit():
        raise HTTPException(status_code=422, detail="mes deve ser YYYYMM")

    ano  = int(mes[:4])
    m    = int(mes[4:])
    from calendar import monthrange
    ultimo_dia = monthrange(ano, m)[1]
    data_ini = f"{ano:04d}-{m:02d}-01"
    data_fim = f"{ano:04d}-{m:02d}-{ultimo_dia:02d}"

    itens: list[MovimentacaoItem] = []

    # ── Receitas: pedidos entregues no mês ──────────────────
    ICON_MAP = {
        "Colaboradores": "colab",
        "Espaço Físico": "espaco",
        "Transporte": "transp",
        "Contas": "contas",
        "Maquinário": "maq",
        "Marketing": "marketing",
    }

    pedidos = (
        db.query(Pedido)
        .filter(
            Pedido.data_entrega >= data_ini,
            Pedido.data_entrega <= data_fim,
            Pedido.status == "Entregue",
        )
        .all()
    )
    for p in pedidos:
        cliente_nome = p.cliente.nome if p.cliente else ""
        tipo_nome    = p.tipo_pedido.nome if p.tipo_pedido else "Pedido"
        descricao    = f"{tipo_nome} · {cliente_nome}" if cliente_nome else tipo_nome
        itens.append(MovimentacaoItem(
            id=p.id,
            origem="pedido",
            tipo="receita",
            descricao=descricao,
            categoria="Receita · Pedido entregue",
            valor=float(p.valor_pecas or 0),
            data=str(p.data_entrega) if p.data_entrega else None,
            icon_key="receita",
        ))

    # ── Despesas: transações do mês ─────────────────────────
    transacoes = (
        db.query(DespesaTransacao)
        .filter(DespesaTransacao.anomes == mes)
        .all()
    )
    for t in transacoes:
        plano = t.plano_item
        tipo_item = plano.tipo_item if plano else ""
        detalhe   = plano.detalhe   if plano else ""
        descricao = f"{detalhe} · {tipo_item}" if detalhe else (tipo_item or "Despesa")
        categoria = f"Despesa · {plano.categoria}" if plano and plano.categoria else "Despesa"
        icon_key  = ICON_MAP.get(tipo_item, "outros")
        itens.append(MovimentacaoItem(
            id=t.id,
            origem="transacao",
            tipo="despesa",
            descricao=descricao,
            categoria=categoria,
            valor=float(t.valor or 0),
            data=str(t.data) if t.data else None,
            icon_key=icon_key,
        ))

    # ── Ordenação: com data DESC, sem data por último ───────
    com_data  = sorted([i for i in itens if i.data],  key=lambda x: x.data, reverse=True)
    sem_data  = sorted([i for i in itens if not i.data], key=lambda x: x.descricao)
    itens_ord = com_data + sem_data

    total_rec  = sum(i.valor for i in itens if i.tipo == "receita")
    total_desp = sum(i.valor for i in itens if i.tipo == "despesa")

    return MovimentacoesResponse(
        mes=mes,
        total_receitas=total_rec,
        total_despesas=total_desp,
        saldo=total_rec - total_desp,
        itens=itens_ord,
    )
```

> ⚠️ Atenção: se `@router.get("/{item_id}")` existir no arquivo, garantir que `/movimentacoes` seja declarado **antes** dele para não ser capturado como `item_id`.

---

#### 1.3 Confirmar registro em `main.py`

Verificar que estas linhas já existem (não duplicar):

```python
from .domains.plano.transacoes_router import router as transacoes_router
app.include_router(transacoes_router, prefix="/api/v1")
```

Status atual: ✅ já presente.

---

#### 1.4 Testar o backend

Iniciar os servidores:
```bash
bash scripts/quick_start.sh
```

Testar com curl:
```bash
# Deve retornar JSON com itens, totais e saldo
curl -s "http://localhost:8000/api/v1/plano/movimentacoes?mes=202604" | python3 -m json.tool

# Verificar schema no swagger
open http://localhost:8000/docs
```

Critérios de aceite:
- [ ] Retorna `200` com estrutura `{ mes, total_receitas, total_despesas, saldo, itens[] }`
- [ ] Pedidos entregues no mês aparecem como `origem: "pedido"`, `tipo: "receita"`
- [ ] Transações de despesa do mês aparecem como `origem: "transacao"`, `tipo: "despesa"`
- [ ] Itens sem `data` ficam ao final da lista
- [ ] Mês sem dados retorna lista vazia (não erro 500)

---

### ─── FASE 2 — Frontend ──────────────────────────────────

**Arquivo:** `app_dev/frontend/src/app/mobile/financeiro/page.tsx`

---

#### 2.1 Adicionar tipos TypeScript

No início do arquivo, junto aos outros tipos/interfaces:

```typescript
interface MovimentacaoItem {
  id: number;
  origem: 'pedido' | 'transacao';
  tipo: 'receita' | 'despesa';
  descricao: string;
  categoria: string;
  valor: number;
  data: string | null;
  icon_key: string;
}

interface MovimentacoesResponse {
  mes: string;
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  itens: MovimentacaoItem[];
}
```

---

#### 2.2 Adicionar estados

Dentro do componente `FinanceiroPage`, junto aos demais `useState`:

```typescript
const [movimentacoes,  setMovimentacoes]  = useState<MovimentacaoItem[]>([]);
const [filtroTipo,     setFiltroTipo]     = useState<'todas' | 'receita' | 'despesa'>('todas');
const [txSelecionada,  setTxSelecionada]  = useState<MovimentacaoItem | null>(null);
const [editValor,      setEditValor]      = useState('');
const [editData,       setEditData]       = useState('');
const [editDescricao,  setEditDescricao]  = useState('');
const [salvando,       setSalvando]       = useState(false);
const [confirmDelete,  setConfirmDelete]  = useState(false);
```

---

#### 2.3 Adicionar fetch de movimentações

Junto ao `useEffect` que já busca dados do mês:

```typescript
useEffect(() => {
  if (!mesSelecionado) return;
  api.get<MovimentacoesResponse>(`/plano/movimentacoes?mes=${mesSelecionado}`)
    .then(r => setMovimentacoes(r.data.itens))
    .catch(() => setMovimentacoes([]));
}, [mesSelecionado]);
```

---

#### 2.4 Adicionar helpers (antes do `return`)

```typescript
// ── Agrupamento por data ──────────────────────────────────
type Grupo = { data: string | null; label: string; itens: MovimentacaoItem[]; saldoDia: number };

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
          .replace('.', '').replace(/^\w/, c => c.toUpperCase());
}

function agruparPorData(itens: MovimentacaoItem[]): Grupo[] {
  const map = new Map<string | null, MovimentacaoItem[]>();
  for (const item of itens) {
    const key = item.data ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const comData = [...map.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => b!.localeCompare(a!));
  const semData = map.has(null) ? [[null, map.get(null)!] as [null, MovimentacaoItem[]]] : [];
  return [...comData, ...semData].map(([data, its]) => ({
    data,
    label: data ? formatDateLabel(data) : 'Sem data cadastrada',
    itens: its,
    saldoDia: its.reduce((acc, i) => acc + (i.tipo === 'receita' ? i.valor : -i.valor), 0),
  }));
}

// ── Ícone por icon_key ────────────────────────────────────
// (usar lucide-react ou similar — ajustar conforme lib disponível)
const ICON_MAP: Record<string, React.ReactNode> = {
  receita:   <span>↑</span>,
  colab:     <span>👥</span>,
  espaco:    <span>🏠</span>,
  transp:    <span>🚗</span>,
  contas:    <span>💳</span>,
  maq:       <span>🖥</span>,
  marketing: <span>📊</span>,
  outros:    <span>🏷</span>,
};

const COLOR_MAP: Record<string, { bg: string; color: string }> = {
  receita:   { bg: 'rgba(99,122,85,.12)',   color: '#1F4D35' },
  colab:     { bg: 'rgba(99,122,85,.12)',   color: '#637A55' },
  espaco:    { bg: 'rgba(99,122,85,.12)',   color: '#637A55' },
  transp:    { bg: 'rgba(110,74,42,.11)',   color: '#6E4A2A' },
  contas:    { bg: 'rgba(166,138,91,.13)',  color: '#A68A5B' },
  maq:       { bg: 'rgba(166,138,91,.13)',  color: '#A68A5B' },
  marketing: { bg: 'rgba(51,78,104,.11)',   color: '#334E68' },
  outros:    { bg: 'rgba(122,49,57,.10)',   color: '#7A3139' },
};

// ── Handlers do bottom sheet ──────────────────────────────
function abrirDetalhe(item: MovimentacaoItem) {
  setTxSelecionada(item);
  setEditValor(item.valor.toFixed(2).replace('.', ','));
  setEditData(item.data ?? '');
  setEditDescricao(item.descricao);
  setConfirmDelete(false);
}

async function handleSalvar() {
  if (!txSelecionada || txSelecionada.origem !== 'transacao') return;
  setSalvando(true);
  try {
    await api.patch(`/transacoes-despesas/${txSelecionada.id}`, {
      valor: parseFloat(editValor.replace(',', '.')),
      data: editData || null,
      descricao: editDescricao,
    });
    setMovimentacoes(prev => prev.map(i =>
      i.id === txSelecionada.id && i.origem === 'transacao'
        ? { ...i, valor: parseFloat(editValor.replace(',', '.')), data: editData || null, descricao: editDescricao }
        : i
    ));
    setTxSelecionada(null);
  } finally {
    setSalvando(false);
  }
}

async function handleExcluir() {
  if (!txSelecionada || txSelecionada.origem !== 'transacao') return;
  if (!confirmDelete) { setConfirmDelete(true); return; }
  setSalvando(true);
  try {
    await api.delete(`/transacoes-despesas/${txSelecionada.id}`);
    setMovimentacoes(prev => prev.filter(
      i => !(i.id === txSelecionada.id && i.origem === 'transacao')
    ));
    setTxSelecionada(null);
  } finally {
    setSalvando(false);
  }
}

const itensFiltrados = movimentacoes.filter(
  i => filtroTipo === 'todas' || i.tipo === filtroTipo
);
const grupos = agruparPorData(itensFiltrados);
```

---

#### 2.5 Adicionar seção de movimentações no JSX

Logo após o card de lucro realizado (colapsável), adicionar:

```tsx
{/* ── MOVIMENTAÇÕES ─────────────────────────────────── */}
<div style={{ marginTop: 24 }}>
  {/* Eyebrow */}
  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A93A5', marginBottom: 12 }}>
    MOVIMENTAÇÕES · {nomeMes(mesSelecionado).toUpperCase()}
  </p>

  {/* Chips filtro */}
  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
    {(['todas', 'receita', 'despesa'] as const).map(f => (
      <button
        key={f}
        onClick={() => setFiltroTipo(f)}
        style={{
          padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          border: '1.5px solid',
          borderColor: filtroTipo === f ? '#A9852E' : '#E6E4DE',
          background: filtroTipo === f ? 'rgba(169,133,46,.10)' : 'transparent',
          color: filtroTipo === f ? '#A9852E' : '#4B5468',
          cursor: 'pointer',
        }}
      >
        {f === 'todas' ? 'Todas' : f === 'receita' ? 'Receitas' : 'Despesas'}
      </button>
    ))}
  </div>

  {/* Lista agrupada por data */}
  {grupos.length === 0 ? (
    <p style={{ color: '#8A93A5', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
      Nenhuma movimentação neste mês.
    </p>
  ) : grupos.map(grupo => (
    <div key={grupo.data ?? '__sem_data__'} style={{ marginBottom: 20 }}>
      {/* Cabeçalho do grupo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#4B5468' }}>{grupo.label}</span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: grupo.saldoDia >= 0 ? '#1F4D35' : '#6E1F27',
        }}>
          {grupo.saldoDia >= 0 ? '+' : ''}
          {grupo.saldoDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>

      {/* Linhas de transação */}
      {grupo.itens.map(item => {
        const cor = COLOR_MAP[item.icon_key] ?? COLOR_MAP['outros'];
        return (
          <div
            key={`${item.origem}-${item.id}`}
            onClick={() => abrirDetalhe(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: '#FFFFFF', borderRadius: 10, marginBottom: 6,
              boxShadow: '0 1px 3px rgba(0,0,0,.07)', cursor: 'pointer',
            }}
          >
            {/* Ícone */}
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: cor.bg, color: cor.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              {ICON_MAP[item.icon_key] ?? ICON_MAP['outros']}
            </div>
            {/* Texto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0B1220',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.descricao}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#8A93A5' }}>{item.categoria}</p>
            </div>
            {/* Valor */}
            <span style={{
              fontSize: 14, fontWeight: 700, flexShrink: 0,
              color: item.tipo === 'receita' ? '#1F4D35' : '#6E1F27',
            }}>
              {item.tipo === 'despesa' ? '−' : '+'}
              {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        );
      })}
    </div>
  ))}
</div>
```

---

#### 2.6 Adicionar bottom sheet no JSX

Logo antes do `</div>` de fechamento do retorno principal:

```tsx
{/* ── BOTTOM SHEET: Detalhe / Edição ──────────────── */}
{txSelecionada && (
  <>
    {/* Overlay */}
    <div
      onClick={() => setTxSelecionada(null)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
        zIndex: 999, backdropFilter: 'blur(2px)',
      }}
    />
    {/* Sheet */}
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#FAF8F3', borderRadius: '20px 20px 0 0',
      padding: '20px 20px 36px', zIndex: 1000,
      boxShadow: '0 -4px 24px rgba(0,0,0,.18)',
    }}>
      {/* Handle */}
      <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E6E4DE', margin: '0 auto 20px' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0B1220' }}>
          {txSelecionada.origem === 'pedido' ? 'Detalhe da Receita' : 'Editar Despesa'}
        </h3>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: txSelecionada.tipo === 'receita' ? 'rgba(31,77,53,.10)' : 'rgba(110,31,39,.10)',
          color: txSelecionada.tipo === 'receita' ? '#1F4D35' : '#6E1F27',
        }}>
          {txSelecionada.tipo === 'receita' ? 'Receita' : 'Despesa'}
        </span>
      </div>

      {/* Campos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Valor */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
          Valor (R$)
          <input
            type="text"
            value={editValor}
            onChange={e => txSelecionada.origem === 'transacao' && setEditValor(e.target.value)}
            readOnly={txSelecionada.origem === 'pedido'}
            style={{
              display: 'block', width: '100%', marginTop: 4,
              padding: '10px 12px', borderRadius: 10, fontSize: 16, fontWeight: 700,
              border: '1.5px solid #E6E4DE',
              color: txSelecionada.tipo === 'receita' ? '#1F4D35' : '#6E1F27',
              background: txSelecionada.origem === 'pedido' ? '#F5F3EE' : '#fff',
            }}
          />
        </label>

        {/* Data */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
          {txSelecionada.tipo === 'receita' ? 'Data de entrega' : 'Data do pagamento'}
          <input
            type="date"
            value={editData}
            onChange={e => setEditData(e.target.value)}
            readOnly={txSelecionada.origem === 'pedido'}
            style={{
              display: 'block', width: '100%', marginTop: 4,
              padding: '10px 12px', borderRadius: 10, fontSize: 14,
              border: `1.5px solid ${txSelecionada.origem === 'transacao' ? '#A9852E' : '#E6E4DE'}`,
              background: txSelecionada.origem === 'pedido' ? '#F5F3EE' : '#fff',
            }}
          />
        </label>

        {/* Descrição */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#4B5468' }}>
          Descrição
          <input
            type="text"
            value={editDescricao}
            onChange={e => txSelecionada.origem === 'transacao' && setEditDescricao(e.target.value)}
            readOnly={txSelecionada.origem === 'pedido'}
            style={{
              display: 'block', width: '100%', marginTop: 4,
              padding: '10px 12px', borderRadius: 10, fontSize: 14,
              border: '1.5px solid #E6E4DE',
              background: txSelecionada.origem === 'pedido' ? '#F5F3EE' : '#fff',
            }}
          />
        </label>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {txSelecionada.origem === 'transacao' ? (
          <>
            {/* Excluir */}
            <button
              onClick={handleExcluir}
              disabled={salvando}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                border: `1.5px solid ${confirmDelete ? '#6E1F27' : '#E6E4DE'}`,
                background: confirmDelete ? 'rgba(110,31,39,.08)' : 'transparent',
                color: confirmDelete ? '#6E1F27' : '#4B5468',
                cursor: salvando ? 'not-allowed' : 'pointer',
              }}
            >
              {confirmDelete ? '⚠️ Confirmar exclusão' : 'Excluir'}
            </button>
            {/* Salvar */}
            <button
              onClick={handleSalvar}
              disabled={salvando}
              style={{
                flex: 2, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                background: '#1F4D35', color: '#fff', border: 'none',
                cursor: salvando ? 'not-allowed' : 'pointer',
                opacity: salvando ? 0.7 : 1,
              }}
            >
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </>
        ) : (
          <>
            <button
              disabled
              title="Acesse a tela de Pedidos para remover"
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                border: '1.5px solid #E6E4DE', background: 'transparent',
                color: '#C0BFB9', cursor: 'not-allowed',
              }}
            >
              Excluir
            </button>
            <button
              onClick={() => setTxSelecionada(null)}
              style={{
                flex: 2, padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                background: '#1F4D35', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </>
        )}
      </div>

      {txSelecionada.origem === 'pedido' && (
        <p style={{ fontSize: 11, color: '#8A93A5', textAlign: 'center', marginTop: 10 }}>
          Para editar ou excluir este pedido, acesse a tela de Pedidos.
        </p>
      )}
    </div>
  </>
)}
```

---

### ─── FASE 3 — Validação local ───────────────────────────

#### 3.1 Checklist de testes no browser

Servidor rodando (`bash scripts/quick_start.sh`) — acesse `http://localhost:3001/mobile/financeiro`

| Teste | Como validar |
|---|---|
| Lista de movimentações carrega | Seção "MOVIMENTAÇÕES · MÊS" aparece com itens |
| Filtro "Receitas" | Apenas receitas visíveis |
| Filtro "Despesas" | Apenas despesas visíveis |
| Agrupamento por data | Itens agrupados com cabeçalho de data |
| Itens sem data | Aparecem ao final sob "Sem data cadastrada" |
| Clique em despesa abre sheet | Bottom sheet aparece com campos editáveis |
| Editar valor + salvar | Toast de sucesso, lista atualiza sem reload |
| Clique "Excluir" (1º) | Botão muda para "⚠️ Confirmar exclusão" |
| Clique "Excluir" (2º) | Item removido da lista |
| Clique em receita abre sheet | Sheet em modo somente leitura |
| Botão "Excluir" em receita | Desabilitado (cinza) |
| Trocar mês | Lista recarrega com dados do novo mês |
| Mês sem dados | Mensagem "Nenhuma movimentação neste mês." |

---

#### 3.2 Validação do backend (curl rápido)

```bash
# Obter token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@atelie.com","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Chamar endpoint
curl -s "http://localhost:8000/api/v1/plano/movimentacoes?mes=202604" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Esperado: `200 OK` com `{ mes, total_receitas, total_despesas, saldo, itens[] }`.

---

### ─── FASE 4 — Commit ────────────────────────────────────

Após todos os testes passarem:

```bash
cd /Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra

# Adicionar apenas os arquivos tocados
git add app_dev/backend/app/domains/plano/schemas.py
git add app_dev/backend/app/domains/plano/router.py
git add app_dev/frontend/src/app/mobile/financeiro/page.tsx
git add docs/estudos/

# Commit
git commit -m "feat(financeiro): tela de movimentações + bottom sheet edição de transação

- Backend: schemas MovimentacaoItem + MovimentacoesResponse
- Backend: GET /plano/movimentacoes (lista unificada por mês)
- Frontend: seção movimentações com filtros e agrupamento por data
- Frontend: bottom sheet edição de despesa (PATCH + DELETE)
- Frontend: bottom sheet somente leitura para receitas (pedidos)"

# Push
git push origin feature/seguranca-senha-transacoes
```

---

## Arquivos tocados (resumo)

```
app_dev/backend/app/domains/plano/
  schemas.py    ← ADICIONAR: MovimentacaoItem, MovimentacoesResponse
  router.py     ← ADICIONAR: GET /movimentacoes

app_dev/frontend/src/app/mobile/financeiro/
  page.tsx      ← ADICIONAR: tipos, estados, fetch, helpers, seção JSX, bottom sheet

docs/estudos/tela-transacoes/
  TECH_SPEC.md            ← (já existe — spec de referência)
  PLANO_DEPLOY_LOCAL.md   ← este arquivo
```

---

## O que fica fora do escopo desta entrega

| Item | Motivo |
|---|---|
| Edição real de data de entrega de pedido | Precisa de `PATCH /pedidos/{id}/data-entrega` (spec futura) |
| Filtro por categoria | MVP não cobre |
| Paginação / infinite scroll | MVP não cobre |
| Deploy para produção (VM) | Separado — após validação local completa |
