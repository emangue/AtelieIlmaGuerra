"""
FastAPI do site de atendimento — atendimento.atelieilmaguerra.com.br

Superfície deliberadamente pequena: auth, clientes, catálogo, atendimentos e
histórico. Não existe aqui router nem model de pedidos, financeiro, plano,
despesas, parâmetros, dashboard, contratos ou logs — o isolamento em relação ao
sistema de gestão é estrutural, não uma checagem de permissão que dá para
esquecer numa rota nova.

Compartilha o arquivo SQLite com o app de gestão, mas NUNCA cria nem altera
schema: quem faz DDL é o backend de gestão (app_dev).
"""
import sys
import traceback as tb_module
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from .core.config import settings
from .domains.atendimentos.router import router as atendimentos_router
from .domains.auth.router import router as auth_router
from .domains.catalogo.router import router as catalogo_router
from .domains.clientes.router import router as clientes_router
from .domains.historico.router import router as historico_router

# Importados para registrar os models no metadata (relacionamentos precisam).
from .domains.atendimentos.models import PedidoAtendimento  # noqa: F401
from .domains.catalogo.models import FormaPeca, FormaPecaMedida, TipoPedido  # noqa: F401
from .domains.clientes.models import Cliente  # noqa: F401
from .domains.historico.models import HistoricoAlteracao  # noqa: F401
from .domains.users.models import User  # noqa: F401

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API do site de atendimento do Ateliê Ilma Guerra",
    # Em produção o schema fica fechado: é útil em dev, mas não há razão para
    # publicar o mapa da API num site que fica aberto na internet.
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(clientes_router, prefix="/api/v1")
app.include_router(catalogo_router, prefix="/api/v1")
app.include_router(atendimentos_router, prefix="/api/v1")
app.include_router(historico_router, prefix="/api/v1")


def _log_erro(request: Request, exc: Exception) -> None:
    """Traceback vai para o stderr (journalctl -u atelie-atendimento-backend)."""
    print(
        f"[erro] {request.method} {request.url.path}\n"
        + "".join(tb_module.format_exception(type(exc), exc, exc.__traceback__)),
        file=sys.stderr,
        flush=True,
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    _log_erro(request, exc)
    return JSONResponse(
        status_code=422,
        content={"detail": "Não foi possível salvar: verifique se todos os campos obrigatórios foram preenchidos."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    _log_erro(request, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno no servidor. O ocorrido foi registrado para análise."},
    )


# Fotos: mesmo diretório do gestão, para a URL sobreviver à aprovação.
UPLOADS_DIR = Path(settings.UPLOADS_DIR)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "atendimento").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/")
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
