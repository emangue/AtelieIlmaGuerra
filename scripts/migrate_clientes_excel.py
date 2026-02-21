#!/usr/bin/env python3
"""
Script de migração: Clientes (1).xlsx → tabela clientes (SQLite)

Uso:
  cd AtelieIlmaGuerra
  python scripts/migrate_clientes_excel.py

Requer: pip install openpyxl
"""
import sys
from pathlib import Path

# Adicionar backend ao path
backend_path = Path(__file__).resolve().parent.parent / "app_dev" / "backend"
sys.path.insert(0, str(backend_path))

import openpyxl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.domains.clientes.models import Cliente
from app.core.database import Base


def _norm(val):
    """Normaliza valor: NA -> None, número como string."""
    if val is None:
        return None
    if isinstance(val, str) and val.strip().upper() in ("NA", "N/A", ""):
        return None
    if isinstance(val, (int, float)) and val == 0 and not isinstance(val, bool):
        return None
    return val


def _norm_telefone(val):
    """Telefone: NA -> None, número vira string."""
    v = _norm(val)
    if v is None:
        return None
    s = str(int(v)) if isinstance(v, (int, float)) else str(v).strip()
    return s if s else None


def _norm_bool(val):
    """SIM/NAO -> True/False."""
    v = _norm(val)
    if v is None:
        return False
    return str(v).strip().upper() == "SIM"


def _norm_float(val):
    v = _norm(val)
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _norm_date(val):
    from datetime import datetime as dt, date as d
    v = _norm(val)
    if v is None:
        return None
    # datetime -> date (SQLite exige date, não datetime)
    if hasattr(v, "date") and callable(getattr(v, "date")):
        return v.date()
    if isinstance(v, d):
        return v
    if isinstance(v, str):
        try:
            parsed = dt.fromisoformat(v.replace("Z", "+00:00"))
            return parsed.date()
        except (ValueError, TypeError):
            return None
    return None


def run_migration(excel_path: Path, dry_run: bool = False):
    """Migra sheet Clientes do Excel para a tabela clientes."""
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)

    # Garantir que a tabela existe
    Base.metadata.create_all(bind=engine)

    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    ws = wb["Clientes"]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if len(rows) < 2:
        print("Planilha vazia ou sem dados.")
        return

    header = [str(c).strip() if c else "" for c in rows[0]]
    data_rows = rows[1:]

    # Mapeamento coluna -> índice
    col_map = {h: i for i, h in enumerate(header)}

    def get(row, name, default=None):
        idx = col_map.get(name)
        if idx is None:
            return default
        if idx >= len(row):
            return default
        return row[idx]

    created = 0
    skipped = 0
    errors = []

    db = SessionLocal()
    try:
        for i, row in enumerate(data_rows):
            appsheet_id = _norm(get(row, "ID"))
            nome = _norm(get(row, "Nome"))

            if not nome or not str(nome).strip():
                skipped += 1
                continue

            # Verificar se já existe por appsheet_id
            if appsheet_id:
                existing = db.query(Cliente).filter(Cliente.appsheet_id == appsheet_id).first()
                if existing:
                    skipped += 1
                    continue

            try:
                cliente = Cliente(
                    appsheet_id=appsheet_id,
                    nome=str(nome).strip(),
                    telefone=_norm_telefone(get(row, "Telefone")),
                    primeiro_agendamento=_norm(get(row, "PrimeiroAgendamento")),
                    data_cadastro=_norm_date(get(row, "DataCadastro")),
                    flag_medidas=_norm_bool(get(row, "FlagMedidas")),
                    medida_ombro=_norm_float(get(row, "MedidaOmbro")),
                    medida_busto=_norm_float(get(row, "MedidaBusto")),
                    medida_cinto=_norm_float(get(row, "MedidaCinto")),
                    medida_quadril=_norm_float(get(row, "MedidaQuadril")),
                    medida_comprimento_corpo=_norm_float(get(row, "MedidaComprimentoCorpo")),
                    medida_comprimento_vestido=_norm_float(get(row, "MedidaComprimentoVestido")),
                    medida_seio_a_seio=_norm_float(get(row, "MedidaSeioaSeio")),
                    medida_raio_busto=_norm_float(get(row, "MedidaRaioDeBusto")),
                    medida_altura_busto=_norm_float(get(row, "MedidaAlturaDeBusto")),
                    medida_frente=_norm_float(get(row, "MedidaFrente")),
                    medida_costado=_norm_float(get(row, "MedidaCostado")),
                    medida_comprimento_calca=_norm_float(get(row, "MedidaComprimentoCalca")),
                    medida_comprimento_blusa=_norm_float(get(row, "MedidaComprimentoBlusa")),
                    medida_largura_manga=_norm_float(get(row, "MedidaLarguraDaManga")),
                    medida_comprimento_manga=_norm_float(get(row, "MedidaComprimentoDaManga")),
                    medida_punho=_norm_float(get(row, "MedidaPunho")),
                    medida_comprimento_saia=_norm_float(get(row, "MedidaComprimentoDaSaia")),
                    medida_comprimento_bermuda=_norm_float(get(row, "MedidaComprimentoDaBermuda")),
                )
                if not dry_run:
                    db.add(cliente)
                created += 1
            except Exception as e:
                errors.append((i + 2, nome, str(e)))

        if not dry_run:
            db.commit()
    finally:
        db.close()

    print(f"Migração concluída: {created} criados, {skipped} ignorados.")
    if errors:
        print(f"Erros ({len(errors)}):")
        for row_num, nome, msg in errors[:10]:
            print(f"  Linha {row_num} ({nome}): {msg}")
        if len(errors) > 10:
            print(f"  ... e mais {len(errors) - 10} erros.")
    if dry_run:
        print("(dry-run: nenhum dado foi gravado)")


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    excel_path = project_root / "Clientes (1).xlsx"

    if not excel_path.exists():
        print(f"Arquivo não encontrado: {excel_path}")
        sys.exit(1)

    dry_run = "--dry-run" in sys.argv
    run_migration(excel_path, dry_run=dry_run)
