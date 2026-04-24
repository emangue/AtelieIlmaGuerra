"""
Configurações do Backend FastAPI - Ateliê Ilma Guerra
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Union


class Settings(BaseSettings):
    """Configurações da aplicação"""

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    APP_NAME: str = "Ateliê Ilma Guerra - API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_PATH: Path = Path(
        "/Users/emangue/Documents/ProjetoVSCode/AtelieIlmaGuerra/app_dev/backend/database/atelie.db"
    )
    DATABASE_URL: str = ""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"sqlite:///{self.DATABASE_PATH}"

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")

    BACKEND_CORS_ORIGINS: Union[list[str], str] = "http://localhost:3000,http://127.0.0.1:3000"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    JWT_SECRET_KEY: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Tempo máximo logado (1h)

    @property
    def is_production(self) -> bool:
        return not self.DEBUG

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]
        return self.BACKEND_CORS_ORIGINS


settings = Settings()
