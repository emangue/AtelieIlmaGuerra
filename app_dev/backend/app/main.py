"""
FastAPI Main - Ateliê Ilma Guerra
"""
import traceback as tb_module
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .core.database import engine, Base, SessionLocal
from .domains.auth.router import router as auth_router
from .domains.users.router import router as users_router
from .domains.contracts.router import router as contracts_router
from .domains.clientes.router import router as clientes_router
from .domains.pedidos.router import router as pedidos_router
from .domains.parametros.router import router as parametros_router
from .domains.orcamentos.router import router as orcamentos_router
from .domains.dashboard.router import router as dashboard_router
from .domains.plano.router import router as plano_router
from .domains.plano.pagamentos_router import router as pagamentos_router
from .domains.despesas.router import router as despesas_router
from .domains.error_logs.router import router as logs_router
from .domains.error_logs.repository import LogRepository
from .domains.historico.router import router as historico_router
from .domains.atendimentos.router import router as atendimentos_router

# Importar modelos para criar tabelas
from .domains.clientes.models import Cliente  # noqa: F401
from .domains.pedidos.models import Pedido, TipoPedido, FormaPeca, FormaPecaMedida, tipo_pedido_forma_peca  # noqa: F401
from .domains.parametros.models import ParametrosOrcamento, ParametroTaxa  # noqa: F401
from .domains.orcamentos.models import Orcamento  # noqa: F401
from .domains.plano.models import PlanoItem  # noqa: F401
from .domains.plano.pagamentos_model import Pagamento  # noqa: F401
from .domains.users.models import User  # noqa: F401
from .domains.despesas.models import DespesaDetalhada  # noqa: F401
from .domains.error_logs.models import ErrorLog  # noqa: F401
from .domains.historico.models import HistoricoAlteracao  # noqa: F401
from .domains.atendimentos.models import PedidoAtendimento  # noqa: F401

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
app.include_router(plano_router, prefix="/api/v1")
app.include_router(pagamentos_router, prefix="/api/v1")
app.include_router(despesas_router, prefix="/api/v1")
app.include_router(logs_router, prefix="/api/v1")
app.include_router(historico_router, prefix="/api/v1")
app.include_router(atendimentos_router, prefix="/api/v1")


def _record_error(request: Request, exc: Exception, status_code: int) -> None:
    """Grava o erro em error_logs numa sessão própria (a do request pode já estar inválida)."""
    db = SessionLocal()
    try:
        LogRepository(db).create(
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            exception_type=type(exc).__name__,
            message=str(exc),
            traceback="".join(tb_module.format_exception(type(exc), exc, exc.__traceback__)),
        )
    except Exception:
        pass  # nunca deixar o log de erro derrubar a resposta de erro
    finally:
        db.close()


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    _record_error(request, exc, 422)
    return JSONResponse(
        status_code=422,
        content={"detail": "Não foi possível salvar: verifique se todos os campos obrigatórios foram preenchidos."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    _record_error(request, exc, 500)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno no servidor. O ocorrido foi registrado para análise."},
    )


# Uploads estáticos
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "pedidos").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
def startup():
    """Cria tabelas e seed inicial."""
    Base.metadata.create_all(bind=engine)

    def run_migration(sql: str, desc: str):
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
                print(f"Migration: {desc}")
        except Exception as e:
            err = str(e).lower()
            if "duplicate column" in err or "already exists" in err or "no such column" in err:
                pass
            else:
                raise

    # Renomear colunas legado
    for col_old, col_new, tbl in [
        ("medida_seio_a_seio", "medida_distancia_busto", "pedidos"),
        ("medida_seio_a_seio", "medida_distancia_busto", "clientes"),
    ]:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {tbl} RENAME COLUMN {col_old} TO {col_new}"))
                conn.commit()
        except Exception:
            pass

    # Colunas novas
    run_migration("ALTER TABLE pedidos ADD COLUMN comentario_medidas TEXT", "pedidos.comentario_medidas")
    run_migration("ALTER TABLE pedidos ADD COLUMN forma_peca_id INTEGER", "pedidos.forma_peca_id")
    run_migration("ALTER TABLE pedidos ADD COLUMN pagamento_na_entrega BOOLEAN", "pedidos.pagamento_na_entrega")
    run_migration("ALTER TABLE pedidos ADD COLUMN criado_como_orcamento BOOLEAN DEFAULT FALSE NOT NULL", "pedidos.criado_como_orcamento")
    run_migration("ALTER TABLE pagamentos ADD COLUMN parcela_numero INTEGER", "pagamentos.parcela_numero")
    run_migration("ALTER TABLE pagamentos ADD COLUMN parcela_total INTEGER", "pagamentos.parcela_total")
    run_migration("ALTER TABLE pagamentos ADD COLUMN data_vencimento DATE", "pagamentos.data_vencimento")
    run_migration("ALTER TABLE pagamentos ADD COLUMN data_pagamento DATE", "pagamentos.data_pagamento")
    run_migration("ALTER TABLE pagamentos ADD COLUMN taxa_cartao REAL", "pagamentos.taxa_cartao")
    run_migration("ALTER TABLE pagamentos ADD COLUMN categoria VARCHAR(100)", "pagamentos.categoria")
    run_migration("ALTER TABLE pagamentos ADD COLUMN tipo_item VARCHAR(100)", "pagamentos.tipo_item")
    run_migration("ALTER TABLE pagamentos ADD COLUMN forma_pagamento VARCHAR(30)", "pagamentos.forma_pagamento")
    run_migration("ALTER TABLE pagamentos ADD COLUMN liquidacao_automatica BOOLEAN", "pagamentos.liquidacao_automatica")
    run_migration("ALTER TABLE pagamentos ADD COLUMN desconto_adiantamento REAL", "pagamentos.desconto_adiantamento")
    run_migration("ALTER TABLE pagamentos ADD COLUMN pagamento_pai_id INTEGER", "pagamentos.pagamento_pai_id")
    run_migration("ALTER TABLE pedidos ADD COLUMN canal_cartao VARCHAR(20)", "pedidos.canal_cartao")
    run_migration("ALTER TABLE pedidos ADD COLUMN data_compra_cartao DATE", "pedidos.data_compra_cartao")
    run_migration("ALTER TABLE pedidos ADD COLUMN taxa_cartao_valor REAL", "pedidos.taxa_cartao_valor")
    run_migration("ALTER TABLE pedidos ADD COLUMN taxa_cartao_percentual REAL", "pedidos.taxa_cartao_percentual")
    run_migration("ALTER TABLE pedidos ADD COLUMN taxa_cartao_manual BOOLEAN", "pedidos.taxa_cartao_manual")
    run_migration("ALTER TABLE pedidos ADD COLUMN desconto_pix_valor REAL", "pedidos.desconto_pix_valor")
    run_migration("ALTER TABLE pedidos ADD COLUMN desconto_pix_percentual REAL", "pedidos.desconto_pix_percentual")
    run_migration("ALTER TABLE pedidos ADD COLUMN desconto_pix_manual BOOLEAN", "pedidos.desconto_pix_manual")
    run_migration(
        "ALTER TABLE historico_alteracoes ADD COLUMN app VARCHAR(20) NOT NULL DEFAULT 'gestao'",
        "historico_alteracoes.app",
    )

    # Migrar campo data -> data_pagamento (legado)
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE pagamentos
                SET data_pagamento = data, data_vencimento = data
                WHERE data_pagamento IS NULL AND data IS NOT NULL
            """))
            conn.commit()
    except Exception:
        pass

    try:
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE pedidos
                SET criado_como_orcamento = TRUE
                WHERE status = 'Orçamento'
                  AND (criado_como_orcamento IS NULL OR criado_como_orcamento = FALSE)
            """))
            conn.commit()
    except Exception:
        pass

    try:
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE plano_itens
                SET detalhe = 'Andrea'
                WHERE tipo = 'despesa'
                  AND tipo_item = 'Colaboradores'
                  AND detalhe = 'Esli'
            """))
            conn.execute(text("""
                UPDATE pagamentos
                SET descricao = REPLACE(descricao, 'Esli', 'Andrea')
                WHERE descricao LIKE '%Esli%'
            """))
            conn.commit()
    except Exception:
        pass

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

        from app.domains.parametros.taxas import seed_parametros_taxas
        nt = seed_parametros_taxas(db)
        if nt:
            print(f"Seed: {nt} linhas de custo de receber inseridas")

        from app.domains.plano.seed_plano import seed_plano
        if db.query(PlanoItem).count() == 0:
            excel_path = Path(__file__).resolve().parents[3] / "PLANO 2026 ATELIE ILMA GUERRA.xlsx"
            if excel_path.exists():
                nr, nd = seed_plano(db, excel_path)
                print(f"Seed: plano importado ({nr} receitas, {nd} despesas)")

        db.query(PlanoItem).filter(
            PlanoItem.tipo == "despesa",
            PlanoItem.tipo_item == "Colaboradores",
            PlanoItem.detalhe == "Esli",
        ).update({"detalhe": "Andrea"}, synchronize_session=False)

        from app.domains.pedidos.models import Pedido
        from app.domains.pedidos.repository import _sync_repasse_funcionaria
        pedidos_entregues = db.query(Pedido).filter(Pedido.status == "Entregue").all()
        for pedido in pedidos_entregues:
            _sync_repasse_funcionaria(db, pedido)
        db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
