"""
FastAPI Main - Ateliê Ilma Guerra
"""
from pathlib import Path

from sqlalchemy import text

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .core.database import engine, Base
from .domains.auth.router import router as auth_router
from .domains.users.router import router as users_router
from .domains.contracts.router import router as contracts_router
from .domains.clientes.router import router as clientes_router
from .domains.pedidos.router import router as pedidos_router
from .domains.parametros.router import router as parametros_router
from .domains.orcamentos.router import router as orcamentos_router
from .domains.dashboard.router import router as dashboard_router
from .domains.despesas.router import router as despesas_router
from .domains.plano.router import router as plano_router
from .domains.plano.transacoes_router import router as transacoes_router
from .domains.plano.pagamentos_router import router as pagamentos_router
from .domains.plano.despesas_router import router as despesas_router

# Importar modelos para criar tabelas
from .domains.clientes.models import Cliente  # noqa: F401
from .domains.pedidos.models import Pedido, TipoPedido, FormaPeca, FormaPecaMedida, tipo_pedido_forma_peca  # noqa: F401
from .domains.parametros.models import ParametrosOrcamento  # noqa: F401
from .domains.orcamentos.models import Orcamento  # noqa: F401
from .domains.despesas.models import DespesaDetalhada  # noqa: F401
from .domains.plano.models import PlanoItem  # noqa: F401
from .domains.plano.transacoes_models import DespesaTransacao  # noqa: F401
from .domains.plano.pagamentos_model import Pagamento  # noqa: F401
from .domains.plano.despesas_model import Despesa  # noqa: F401
from .domains.users.models import User  # noqa: F401

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API para gerador de contratos - Ateliê Ilma Guerra",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(contracts_router, prefix="/api/v1")
app.include_router(clientes_router, prefix="/api/v1")
app.include_router(pedidos_router, prefix="/api/v1")
app.include_router(parametros_router, prefix="/api/v1")
app.include_router(orcamentos_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(despesas_router, prefix="/api/v1")
app.include_router(plano_router, prefix="/api/v1")
app.include_router(transacoes_router, prefix="/api/v1")
app.include_router(pagamentos_router, prefix="/api/v1")
app.include_router(despesas_router, prefix="/api/v1")

# Uploads estáticos
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "pedidos").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
def startup():
    """Cria tabelas e seed de tipo_pedido."""
    Base.metadata.create_all(bind=engine)
    # Migrações
    def run_migration(sql: str, desc: str):
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
                print(f"Migration: {desc}")
        except Exception as e:
            err = str(e).lower()
            if "duplicate column" in err or "already exists" in err or "duplicate column name" in err:
                pass
            elif "no such column" in err:
                pass  # Coluna antiga já renomeada
            else:
                raise

    run_migration("ALTER TABLE pedidos ADD COLUMN comentario_medidas TEXT", "coluna comentario_medidas")
    run_migration("ALTER TABLE pedidos ADD COLUMN forma_peca_id INTEGER", "coluna forma_peca_id")
    # Renomear medida_seio_a_seio -> medida_distancia_busto (pedidos)
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE pedidos RENAME COLUMN medida_seio_a_seio TO medida_distancia_busto"))
            conn.commit()
            print("Migration: pedidos.medida_seio_a_seio -> medida_distancia_busto")
    except Exception as e:
        err = str(e).lower()
        if "no such column" in err or "duplicate column" in err or "does not exist" in err or "undefined" in err:
            pass
        else:
            raise
    # Renomear medida_seio_a_seio -> medida_distancia_busto (clientes)
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE clientes RENAME COLUMN medida_seio_a_seio TO medida_distancia_busto"))
            conn.commit()
            print("Migration: clientes.medida_seio_a_seio -> medida_distancia_busto")
    except Exception as e:
        err = str(e).lower()
        if "no such column" in err or "duplicate column" in err or "does not exist" in err or "undefined" in err:
            pass
        else:
            raise
    from sqlalchemy.orm import Session
    from app.core.database import SessionLocal
    from app.domains.pedidos.seed import seed_tipo_pedido
    from app.domains.pedidos.seed_forma_peca import seed_forma_peca
    from app.domains.users.seed import seed_admin_user
    db = SessionLocal()
    try:
        n = seed_tipo_pedido(db)
        if n:
            print(f"Seed: {n} tipos de pedido inseridos")
        nf = seed_forma_peca(db)
        if nf:
            print(f"Seed: {nf} formas de peça inseridas")
        if seed_admin_user(db):
            print("Seed: usuário admin criado (ilma@atelieilmaguerra.com)")
        # Seed plano (receita + despesas) se tabela vazia
        from app.domains.plano.models import PlanoItem
        from app.domains.plano.seed_plano import seed_plano
        if db.query(PlanoItem).count() == 0:
            # app_dev/backend/app/main.py -> projeto/PLANO 2026...
            excel_path = Path(__file__).resolve().parents[3] / "PLANO 2026 ATELIE ILMA GUERRA.xlsx"
            if excel_path.exists():
                nr, nd = seed_plano(db, excel_path)
                print(f"Seed: plano importado ({nr} receitas, {nd} despesas)")
    finally:
        db.close()

    # ── Migração DDL: adicionar colunas ausentes ───────────────────────────
    _ddl_migrations = [
        "ALTER TABLE pagamentos ADD COLUMN despesa_id INTEGER REFERENCES despesas(id)",
    ]
    for _ddl in _ddl_migrations:
        try:
            with engine.connect() as _conn:
                _conn.execute(text(_ddl))
                _conn.commit()
        except Exception as _e:
            _err = str(_e).lower()
            if "duplicate column" in _err or "already exists" in _err:
                pass
            else:
                pass  # coluna já existe ou tabela não existe ainda — ignorar

    # ── Migração: popular tabela pagamentos (idempotente) ──────────────────
    from app.domains.plano.pagamentos_model import Pagamento
    from app.domains.plano.transacoes_models import DespesaTransacao as DT
    from app.domains.pedidos.models import Pedido as PedidoModel
    from calendar import monthrange
    from datetime import date as date_type

    db2 = SessionLocal()
    try:
        if db2.query(Pagamento).count() == 0:
            # 1. Despesas: copiar despesas_transacoes → pagamentos
            for t in db2.query(DT).all():
                ano, m = int(t.anomes[:4]), int(t.anomes[4:])
                data_def = date_type(ano, m, monthrange(ano, m)[1])
                plano = t.plano_item
                tipo_item = plano.tipo_item if plano else ""
                detalhe   = plano.detalhe   if plano else ""
                descricao = f"{detalhe} · {tipo_item}" if detalhe else (tipo_item or "Despesa")
                db2.add(Pagamento(
                    anomes        = t.anomes,
                    tipo          = "despesa",
                    origem        = "despesa_manual",
                    plano_item_id = t.plano_item_id,
                    data          = t.data or data_def,
                    valor         = float(t.valor or 0),
                    descricao     = t.descricao or descricao,
                ))

            # 2. Receitas: pedidos entregues → pagamentos
            for p in db2.query(PedidoModel).filter(PedidoModel.status == "Entregue").all():
                data_pag  = p.data_entrega or date_type.today()
                anomes    = f"{data_pag.year}{data_pag.month:02d}"
                tipo_nome = p.tipo_pedido.nome if p.tipo_pedido else "Pedido"
                cliente   = p.cliente.nome if p.cliente else ""
                descricao = f"{tipo_nome} · {cliente}" if cliente else tipo_nome
                db2.add(Pagamento(
                    anomes    = anomes,
                    tipo      = "receita",
                    origem    = "pedido",
                    pedido_id = p.id,
                    data      = data_pag,
                    valor     = float(p.valor_pecas or 0),
                    descricao = descricao,
                ))

            db2.commit()
            print("Migration: pagamentos populados")
    finally:
        db2.close()

    # ── Migração: popular tabela despesas a partir de pagamentos tipo=despesa sem despesa_id ──
    from app.domains.plano.despesas_model import Despesa
    db3 = SessionLocal()
    try:
        if db3.query(Despesa).count() == 0:
            pags_despesa = (
                db3.query(Pagamento)
                .filter(Pagamento.tipo == "despesa", Pagamento.despesa_id == None)
                .all()
            )
            for pag in pags_despesa:
                pi = pag.plano_item
                tipo_item = pi.tipo_item if pi else "Outros"
                detalhe   = pi.detalhe   if pi else None
                categoria = pi.categoria if pi else "Custo Fixo"
                despesa = Despesa(
                    anomes        = pag.anomes,
                    plano_item_id = pag.plano_item_id,
                    tipo_item     = tipo_item,
                    detalhe       = detalhe,
                    categoria     = categoria,
                    data          = pag.data,
                    valor         = pag.valor,
                    descricao     = pag.descricao,
                )
                db3.add(despesa)
                db3.flush()
                pag.despesa_id = despesa.id
            db3.commit()
            if pags_despesa:
                print(f"Migration: {len(pags_despesa)} despesas criadas a partir de pagamentos")
    finally:
        db3.close()

    # ── Migração: zerar valor_realizado legado de plano_itens órfãos ──────────
    # Plano_itens com valor_planejado=0 e valor_realizado preenchido que NÃO estão
    # em despesas_transacoes são itens criados por lançamentos via /despesas.
    # Seu valor_realizado legado deve ser zerado para não contaminar o service.
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                UPDATE plano_itens SET valor_realizado = NULL
                WHERE valor_planejado = 0
                AND tipo = 'despesa'
                AND valor_realizado IS NOT NULL
                AND id NOT IN (
                    SELECT DISTINCT plano_item_id FROM despesas_transacoes
                    WHERE plano_item_id IS NOT NULL
                )
            """))
            conn.commit()
            if result.rowcount:
                print(f"Migration: {result.rowcount} plano_itens órfãos zerados")
    except Exception:
        pass


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
