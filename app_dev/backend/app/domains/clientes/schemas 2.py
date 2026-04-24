"""
Schemas do domínio Clientes.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ClienteBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    cpf: Optional[str] = Field(None, max_length=20)
    rg: Optional[str] = Field(None, max_length=50)
    endereco: Optional[str] = Field(None, max_length=500)
    telefone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=255)
    primeiro_agendamento: Optional[str] = Field(None, max_length=100)
    data_cadastro: Optional[date] = None
    flag_medidas: bool = Field(default=False)
    medida_ombro: Optional[float] = None
    medida_busto: Optional[float] = None
    medida_cinto: Optional[float] = None
    medida_quadril: Optional[float] = None
    medida_comprimento_corpo: Optional[float] = None
    medida_comprimento_vestido: Optional[float] = None
    medida_distancia_busto: Optional[float] = None
    medida_raio_busto: Optional[float] = None
    medida_altura_busto: Optional[float] = None
    medida_frente: Optional[float] = None
    medida_costado: Optional[float] = None
    medida_comprimento_calca: Optional[float] = None
    medida_comprimento_blusa: Optional[float] = None
    medida_largura_manga: Optional[float] = None
    medida_comprimento_manga: Optional[float] = None
    medida_punho: Optional[float] = None
    medida_comprimento_saia: Optional[float] = None
    medida_comprimento_bermuda: Optional[float] = None


class ClienteCreate(ClienteBase):
    appsheet_id: Optional[str] = Field(None, max_length=50)


class ClienteUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    cpf: Optional[str] = Field(None, max_length=20)
    rg: Optional[str] = Field(None, max_length=50)
    endereco: Optional[str] = Field(None, max_length=500)
    telefone: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=255)
    primeiro_agendamento: Optional[str] = Field(None, max_length=100)
    data_cadastro: Optional[date] = None
    flag_medidas: Optional[bool] = None
    medida_ombro: Optional[float] = None
    medida_busto: Optional[float] = None
    medida_cinto: Optional[float] = None
    medida_quadril: Optional[float] = None
    medida_comprimento_corpo: Optional[float] = None
    medida_comprimento_vestido: Optional[float] = None
    medida_distancia_busto: Optional[float] = None
    medida_raio_busto: Optional[float] = None
    medida_altura_busto: Optional[float] = None
    medida_frente: Optional[float] = None
    medida_costado: Optional[float] = None
    medida_comprimento_calca: Optional[float] = None
    medida_comprimento_blusa: Optional[float] = None
    medida_largura_manga: Optional[float] = None
    medida_comprimento_manga: Optional[float] = None
    medida_punho: Optional[float] = None
    medida_comprimento_saia: Optional[float] = None
    medida_comprimento_bermuda: Optional[float] = None


class ClienteListItem(BaseModel):
    id: int
    nome: str
    telefone: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class ClienteDetail(ClienteBase):
    id: int
    appsheet_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
