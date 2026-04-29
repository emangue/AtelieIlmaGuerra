# 💳 Plano de Implementação — Tabela `pagamentos`

> Branch: `feature/pagamentos`  
> Data: 29/04/2026  
> Substitui: `docs/estudos/tela-transacoes/PLANO_DEPLOY_LOCAL.md`

---

## Contexto e decisões

### O problema que resolve
Hoje receitas (pedidos entregues) e despesas (`despesas_transacoes`) vivem em tabelas separadas, sem um campo comum de data/valor. Isso força endpoints de "fusão" frágeis (ex.: `GET /plano/movimentacoes` que gerou bug de 404 por conflito com middleware).

### Decisões fechadas

| Questão | Decisão |
|---|---|
| Pagamentos parciais? | ❌ MVP: valor único por pedido |
| Despesas sem plano? | ❌ Proibido — usar tipo_item "Outros" em `plano_itens` |
| `despesas_transacoes` agora? | Mantida — migração na Fase 4 |
| Pedido muda de status? | `pagamentos` é sensibilizado automaticamente |
| `data_pagamento` vs `data_entrega`? | MVP: `data_pagamento = data_entrega` do pedido |
| Pedido entregue sem `data_entrega`? | Fallback: data atual (`date.today()`) |
| Deploy frontend antes do backend? | ❌ — Fase 3 (migração) antes da Fase 5 (frontend) |

---

## O que o plano anterior implementou (e o que muda)

O [PLANO_DEPLOY_LOCAL.md](../tela-transacoes/PLANO_DEPLOY_LOCAL.md) implementou:

| Item implementado | Aproveitado? | Observação |
|---|---|---|
| Schemas `MovimentacaoItem` + `MovimentacoesResponse` em `plano/schemas.py` | ⚠️ Parcial | Reaproveitados como `PagamentoItem` / `PagamentosResponse` nos novos schemas |
| Endpoint `GET /plano/movimentacoes` em `plano/router.py` | ❌ Substituído | Será removido — substituído por `GET /pagamentos` |
| Frontend: interfaces TypeScript `MovimentacaoItem` | ⚠️ Parcial | Renomear para `PagamentoItem`, remover campo `icon_key` calculado no backend |
| Frontend: estados, fetch, helpers `agruparPorData` | ✅ Mantido | Apenas muda a URL do fetch |
| Frontend: seção MOVIMENTAÇÕES + chips filtro | ✅ Mantido | Sem alteração visual |
| Frontend: bottom sheet detalhe/edição despesa | ✅ Mantido | Ajustar `origem === 'transacao'` → `origem === 'despesa'` |
| Remoção da seção "Transações" antiga | ✅ Mantido | Não volta |
| FAB "Lançar" | ✅ Mantido | Sem alteração |
| PATCH/DELETE `transacoes-despesas/{id}` | ❌ Substituído | Novos endpoints em `/pagamentos/{id}` |

### Conflitos resolvidos com novas definições
- O plano antigo usava `origem: "pedido" | "transacao"` → novo usa `origem: "pedido" | "despesa"` (mais semântico)
- O plano antigo calculava `icon_key` no backend via `ICON_MAP` → mantido, mas agora calculado a partir do `plano_item.tipo_item`
- O plano antigo não sensibilizava o status do pedido → **novo requisito central**

---

## Arquitetura da tabela `pagamentos`

```sql
CREATE TABLE pagamentos (
    id              INTEGER PRIMARY KEY,
    anomes          VARCHAR(6)  NOT NULL,      -- YYYYMM (indexed)
    tipo            VARCHAR(10) NOT NULL,      -- "receita" | "despesa"
    origem          VARCHAR(20) NOT NULL,      -- "pedido" | "despesa_manual"
    pedido_id       INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    plano_item_id   INTEGER REFERENCES plano_itens(id),
    data            DATE        NOT NULL,
    valor           FLOAT       NOT NULL,      -- sempre positivo
    descricao       VARCHAR(500),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Regras de integridade:**
- `tipo = "receita"` → `pedido_id` obrigatório, `plano_item_id` NULL
- `tipo = "despesa"` → `plano_item_id` obrigatório, `pedido_id` NULL
- `ON DELETE CASCADE` no `pedido_id`: deletar pedido → deletar pagamento automaticamente
- Um pedido só pode ter **um** pagamento associado (constraint `UNIQUE(pedido_id)`)

---

## Passo a passo

### ─── FASE 1 — Model ────────────────────────────────────

**Arquivo:** `app_dev/backend/app/domains/plano/pagamentos_model.py` *(novo)*

```python
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Pagamento(Base):
    __tablename__ = "pagamentos"
    __table_args__ = (
        UniqueConstraint("pedido_id", name="uq_pagamento_pedido"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    anomes        = Column(String(6), nullable=False, index=True)  # YYYYMM
    tipo          = Column(String(10), nullable=False)              # "receita" | "despesa"
    origem        = Column(String(20), nullable=False)              # "pedido" | "despesa_manual"
    pedido_id     = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=True)
    plano_item_id = Column(Integer, ForeignKey("plano_itens.id"), nullable=True)
    data          = Column(Date, nullable=False)
    valor         = Column(Float, nullable=False)
    descricao     = Column(String(500), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    pedido     = relationship("Pedido",    back_populates="pagamento",  passive_deletes=True)
    plano_item = relationship("PlanoItem", back_populates="pagamentos")
```

**Ajustes nos models existentes:**

Em `pedidos/models.py` — adicionar ao final da classe `Pedido`:
```python
pagamento = relationship("Pagamento", back_populates="pedido", uselist=False, cascade="all, delete-orphan")
```

Em `plano/models.py` — adicionar ao final da classe `PlanoItem`:
```python
pagamentos = relationship("Pagamento", back_populates="plano_item")
```

Registrar em `main.py`:
```python
from .domains.plano.pagamentos_model import Pagamento  # noqa: F401
```

---

### ─── FASE 2 — Sensibilizar status do pedido ────────────

**Arquivo:** `app_dev/backend/app/domains/pedidos/router.py`

Criar função helper (importar no topo do router):

```python
from datetime import date as date_type

def _sincronizar_pagamento(db, pedido) -> None:
    """Cria, atualiza ou deleta o pagamento de receita de acordo com o status do pedido."""
    from app.domains.plano.pagamentos_model import Pagamento

    pag_existente = db.query(Pagamento).filter(Pagamento.pedido_id == pedido.id).first()

    if pedido.status == "Entregue":
        data_pag = pedido.data_entrega or date_type.today()
        anomes   = f"{data_pag.year}{data_pag.month:02d}"
        tipo_nome  = pedido.tipo_pedido.nome if pedido.tipo_pedido else "Pedido"
        cliente    = pedido.cliente.nome if pedido.cliente else ""
        descricao  = f"{tipo_nome} · {cliente}" if cliente else tipo_nome

        if pag_existente:
            pag_existente.data      = data_pag
            pag_existente.anomes    = anomes
            pag_existente.valor     = float(pedido.valor_pecas or 0)
            pag_existente.descricao = descricao
        else:
            db.add(Pagamento(
                anomes    = anomes,
                tipo      = "receita",
                origem    = "pedido",
                pedido_id = pedido.id,
                data      = data_pag,
                valor     = float(pedido.valor_pecas or 0),
                descricao = descricao,
            ))
    else:
        # Status saiu de "Entregue" → remover pagamento
        if pag_existente:
            db.delete(pag_existente)
```

Chamar `_sincronizar_pagamento(db, pedido)` antes de cada `db.commit()` nos endpoints:
- `PATCH /pedidos/{id}` (atualizar status, valor ou data_entrega)
- `DELETE /pedidos/{id}` — não precisa: `ON DELETE CASCADE` já remove

---

### ─── FASE 3 — Migração dos dados existentes ────────────

**Arquivo:** `app_dev/backend/app/main.py` — dentro de `startup()`, após `Base.metadata.create_all()`

```python
# Migração: popular tabela pagamentos (roda uma única vez)
from app.domains.plano.pagamentos_model import Pagamento
from app.domains.plano.transacoes_models import DespesaTransacao
from app.domains.pedidos.models import Pedido
from calendar import monthrange
from datetime import date as date_type

with SessionLocal() as db:
    if db.query(Pagamento).count() == 0:
        # 1. Despesas: copiar despesas_transacoes → pagamentos
        for t in db.query(DespesaTransacao).all():
            ano, m = int(t.anomes[:4]), int(t.anomes[4:])
            data_def = date_type(ano, m, monthrange(ano, m)[1])
            plano = t.plano_item
            tipo_item = plano.tipo_item if plano else ""
            detalhe   = plano.detalhe   if plano else ""
            descricao = f"{detalhe} · {tipo_item}" if detalhe else (tipo_item or "Despesa")
            db.add(Pagamento(
                anomes        = t.anomes,
                tipo          = "despesa",
                origem        = "despesa_manual",
                plano_item_id = t.plano_item_id,
                data          = t.data or data_def,
                valor         = float(t.valor or 0),
                descricao     = t.descricao or descricao,
            ))

        # 2. Receitas: pedidos entregues → pagamentos
        for p in db.query(Pedido).filter(Pedido.status == "Entregue").all():
            data_pag = p.data_entrega or date_type.today()
            anomes   = f"{data_pag.year}{data_pag.month:02d}"
            tipo_nome = p.tipo_pedido.nome if p.tipo_pedido else "Pedido"
            cliente   = p.cliente.nome if p.cliente else ""
            descricao = f"{tipo_nome} · {cliente}" if cliente else tipo_nome
            db.add(Pagamento(
                anomes    = anomes,
                tipo      = "receita",
                origem    = "pedido",
                pedido_id = p.id,
                data      = data_pag,
                valor     = float(p.valor_pecas or 0),
                descricao = descricao,
            ))

        db.commit()
        print("Migration: pagamentos populados")
```

---

### ─── FASE 4 — Router `pagamentos` ─────────────────────

**Arquivo:** `app_dev/backend/app/domains/plano/pagamentos_router.py` *(novo)*

#### Schemas (adicionar em `plano/schemas.py`)

```python
class PagamentoItem(BaseModel):
    id: int
    tipo: str            # "receita" | "despesa"
    origem: str          # "pedido" | "despesa_manual"
    descricao: str
    categoria: str       # "Receita · Pedido" | "Despesa · Custo Fixo" etc.
    valor: float
    data: str            # YYYY-MM-DD (nunca None — sempre tem data)
    icon_key: str
    pedido_id: Optional[int] = None
    plano_item_id: Optional[int] = None

    class Config:
        from_attributes = True

class PagamentosResponse(BaseModel):
    mes: str
    total_receitas: float
    total_despesas: float
    saldo: float
    itens: List[PagamentoItem]

class PagamentoCreate(BaseModel):
    """Criar despesa manual. plano_item_id obrigatório."""
    anomes: str
    plano_item_id: int
    data: Optional[str] = None     # YYYY-MM-DD; default = último dia do mês
    valor: float
    descricao: Optional[str] = None

class PagamentoUpdate(BaseModel):
    """Atualizar despesa manual. Receitas não são editáveis aqui."""
    valor: Optional[float] = None
    data: Optional[str] = None
    descricao: Optional[str] = None
```

#### Endpoints

```
GET    /api/v1/pagamentos?mes=YYYYMM   → PagamentosResponse
POST   /api/v1/pagamentos              → PagamentoItem  (despesas manuais)
PATCH  /api/v1/pagamentos/{id}         → PagamentoItem  (só despesas)
DELETE /api/v1/pagamentos/{id}         → 204            (só despesas)
```

Registrar em `main.py`:
```python
from .domains.plano.pagamentos_router import router as pagamentos_router
app.include_router(pagamentos_router, prefix="/api/v1")
```

---

### ─── FASE 5 — Frontend ──────────────────────────────────

**Arquivo:** `app_dev/frontend/src/app/mobile/financeiro/page.tsx`

Mudanças pontuais (o grosso do código já existe):

1. Renomear interface `MovimentacaoItem` → `PagamentoItem` e `MovimentacoesResponse` → `PagamentosResponse`
2. Trocar URL: `api.get<PagamentosResponse>('/api/v1/pagamentos?mes=...')`
3. Remover dependência de `plano/movimentacoes` (e limpar `schemas.py` depois)
4. No bottom sheet: trocar `txSelecionada.origem === 'transacao'` → `txSelecionada.origem === 'despesa_manual'`
5. No handler `handleSalvar`: trocar `api.patch('/api/v1/transacoes-despesas/...')` → `api.patch('/api/v1/pagamentos/...')`
6. No handler `handleExcluir`: trocar `api.delete('/api/v1/transacoes-despesas/...')` → `api.delete('/api/v1/pagamentos/...')`

---

### ─── FASE 6 — Remoção de `despesas_transacoes` ─────────

Após validação completa em produção:

1. Remover `transacoes_router.py`
2. Remover `transacoes_models.py`
3. Remover imports em `main.py`
4. Remover endpoint `GET /plano/movimentacoes` de `plano/router.py`
5. Remover schemas `MovimentacaoItem` + `MovimentacoesResponse` de `plano/schemas.py`
6. Adicionar migration em `startup()`: `DROP TABLE IF EXISTS despesas_transacoes`
7. Ajustar `GET /plano/despesas-realizadas` e `GET /plano/opcoes-despesa` para consultar `pagamentos` ao invés de `despesas_transacoes`

---

## Estado de implementação

| Fase | Descrição | Status |
|---|---|---|
| 1 | Model `Pagamento` + relationships | ❌ pendente |
| 2 | Sensibilizar status do pedido | ❌ pendente |
| 3 | Migração `despesas_transacoes` → `pagamentos` | ❌ pendente |
| 4 | Router `GET/POST/PATCH/DELETE /pagamentos` | ❌ pendente |
| 5 | Frontend: trocar endpoint + renomear interfaces | ❌ pendente |
| 6 | Remoção de `despesas_transacoes` | ❌ pendente |

---

## Arquivos tocados (resumo)

```
app_dev/backend/app/
  domains/plano/
    pagamentos_model.py     ← CRIAR (novo model)
    pagamentos_router.py    ← CRIAR (novo router)
    schemas.py              ← ADICIONAR PagamentoItem, PagamentosResponse,
                               PagamentoCreate, PagamentoUpdate
    router.py               ← REMOVER GET /movimentacoes (fase 6)
    transacoes_router.py    ← REMOVER (fase 6)
    transacoes_models.py    ← REMOVER (fase 6)
  domains/pedidos/
    models.py               ← ADICIONAR relationship pagamento
    router.py               ← ADICIONAR _sincronizar_pagamento()
  main.py                   ← ADICIONAR import + include_router +
                               migração no startup()

app_dev/frontend/src/app/mobile/financeiro/
  page.tsx                  ← AJUSTAR interfaces, URL, bottom sheet handlers
```

---

## Notas para deploy em produção

- A migração em `startup()` é idempotente (`if count == 0`) — segura para rodar no servidor
- `ON DELETE CASCADE` no `pedido_id` garante que o banco se auto-limpa sem precisar de lógica extra
- O UNIQUE constraint `uq_pagamento_pedido` evita duplicatas se a migration rodar mais de uma vez
- Em SQLite, `ON DELETE CASCADE` exige `PRAGMA foreign_keys = ON` — ✅ **já adicionado em `database.py`** via `event.listens_for(engine, "connect")`
