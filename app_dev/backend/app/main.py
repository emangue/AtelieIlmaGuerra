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

# Importar modelos para criar tabelas
from .domains.clientes.models import Cliente  # noqa: F401
from .domains.pedidos.models import Pedido, TipoPedido, FormaPeca, FormaPecaMedida, tipo_pedido_forma_peca  # noqa: F401
from .domains.parametros.models import ParametrosOrcamento  # noqa: F401
from .domains.orcamentos.models import Orcamento  # noqa: F401
from .domains.despesas.models import DespesaDetalhada  # noqa: F401
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
        if "no such column" in err or "duplicate column" in err:
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
        if "no such column" in err or "duplicate column" in err:
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
    finally:
        db.close()


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
