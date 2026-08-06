"""
Configurações do backend do site de atendimento.

Aponta para o MESMO banco do app de gestão — mas este processo só conhece as
tabelas users, clientes, pedidos_atendimento, historico_alteracoes e os
catálogos tipo_pedido/forma_peca. Não existe aqui model nem rota de pedidos,
financeiro, plano, despesas ou parâmetros.
"""
from pathlib import Path
from typing import Union

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    APP_NAME: str = "Ateliê Ilma Guerra - Atendimento"
    APP_VERSION: str = "1.0.0"
    # Default False de propósito: DEBUG controla o flag `secure` do cookie de
    # sessão. Se o .env sumir num deploy, é melhor falhar fechado.
    DEBUG: bool = False

    # Mesmo arquivo usado pelo backend de gestão.
    DATABASE_PATH: Path = Path(
        "/Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/backend/database/atelie.db"
    )
    DATABASE_URL: str = ""

    # As fotos vão para o mesmo diretório do gestão, para que a URL continue
    # válida depois que o atendimento virar pedido.
    UPLOADS_DIR: Path = Path(
        "/Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/backend/uploads"
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"sqlite:///{self.DATABASE_PATH}"

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")

    BACKEND_CORS_ORIGINS: Union[list[str], str] = "http://localhost:3005,http://127.0.0.1:3005"
    HOST: str = "0.0.0.0"
    PORT: int = 8002

    # OBRIGATORIAMENTE diferente do segredo do app de gestão: é o que impede um
    # token daqui de ser aceito lá (e vice-versa).
    JWT_SECRET_KEY: str = "dev-secret-atendimento-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @property
    def is_production(self) -> bool:
        return not self.DEBUG

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]
        return self.BACKEND_CORS_ORIGINS


settings = Settings()
