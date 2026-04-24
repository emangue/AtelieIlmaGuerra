"""
Router do domínio Contracts - Geração de contratos PDF.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from sqlalchemy.orm import Session

from .schemas import ContractData, ContractListItem, ContractDetail
from .service import ContractService


router = APIRouter(prefix="/contracts", tags=["Contracts"])


@router.post("/preview")
def preview_contract(data: ContractData, db: Session = Depends(get_db)):
    """
    Gera PDF para pré-visualização (não salva no banco).
    Retorna PDF para exibir no navegador (inline).
    """
    service = ContractService(db)
    pdf_buffer = service.preview_pdf(data)
    filename = f"Contrato_{data.nome_completo.replace(' ', '_')}_preview.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/generate")
def generate_contract(data: ContractData, db: Session = Depends(get_db)):
    """
    Salva contrato no banco e retorna PDF para download.
    """
    service = ContractService(db)
    contract, pdf_buffer = service.create_and_generate(data)
    filename = f"Contrato_{data.nome_completo.replace(' ', '_')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Contract-Id": str(contract.id),
        },
    )


@router.get("")
def list_contracts(db: Session = Depends(get_db)):
    """Lista histórico de contratos gerados."""
    service = ContractService(db)
    contracts = service.list_contracts()
    return [
        {
            "id": c.id,
            "nome_completo": c.nome_completo,
            "data_contrato": c.data_contrato.isoformat() if c.data_contrato else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in contracts
    ]


@router.get("/{contract_id}/pdf")
def download_contract_pdf(contract_id: int, db: Session = Depends(get_db)):
    """Regenera e retorna PDF do contrato para download."""
    service = ContractService(db)
    c = service.get_contract(contract_id)
    pdf_buffer = service.regenerate_pdf(contract_id)
    filename = f"Contrato_{c.nome_completo.replace(' ', '_')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{contract_id}/preview")
def preview_contract_pdf(contract_id: int, db: Session = Depends(get_db)):
    """Retorna PDF para visualização inline (iframe)."""
    service = ContractService(db)
    c = service.get_contract(contract_id)
    pdf_buffer = service.regenerate_pdf(contract_id)
    filename = f"Contrato_{c.nome_completo.replace(' ', '_')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.patch("/{contract_id}", response_model=ContractDetail)
def update_contract(contract_id: int, data: ContractData, db: Session = Depends(get_db)):
    """Atualiza dados do contrato."""
    service = ContractService(db)
    c = service.update_contract(contract_id, data)
    return ContractDetail(
        id=c.id,
        nome_completo=c.nome_completo,
        cpf=c.cpf,
        rg=c.rg or "",
        endereco=c.endereco,
        telefone=c.telefone,
        nacionalidade=c.nacionalidade or "brasileira",
        especificacoes=c.especificacoes,
        tecidos=c.tecidos,
        valor_total=c.valor_total,
        valor_servico_vestir=c.valor_servico_vestir or 150,
        primeira_prova_mes=c.primeira_prova_mes or "março",
        prova_final_data=c.prova_final_data,
        semana_revisao_inicio=c.semana_revisao_inicio,
        semana_revisao_fim=c.semana_revisao_fim,
        data_contrato=c.data_contrato,
        cidade_contrato=c.cidade_contrato or "Araraquara",
        autoriza_imagem_completa=c.autoriza_imagem_completa or False,
        testemunha1_nome=c.testemunha1_nome or "",
        testemunha1_cpf=c.testemunha1_cpf or "",
        testemunha2_nome=c.testemunha2_nome or "",
        testemunha2_cpf=c.testemunha2_cpf or "",
        created_at=c.created_at,
    )


@router.get("/{contract_id}", response_model=ContractDetail)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    """Retorna dados completos de um contrato."""
    service = ContractService(db)
    c = service.get_contract(contract_id)
    return ContractDetail(
        id=c.id,
        nome_completo=c.nome_completo,
        cpf=c.cpf,
        rg=c.rg or "",
        endereco=c.endereco,
        telefone=c.telefone,
        nacionalidade=c.nacionalidade or "brasileira",
        especificacoes=c.especificacoes,
        tecidos=c.tecidos,
        valor_total=c.valor_total,
        valor_servico_vestir=c.valor_servico_vestir or 150,
        primeira_prova_mes=c.primeira_prova_mes or "março",
        prova_final_data=c.prova_final_data,
        semana_revisao_inicio=c.semana_revisao_inicio,
        semana_revisao_fim=c.semana_revisao_fim,
        data_contrato=c.data_contrato,
        cidade_contrato=c.cidade_contrato or "Araraquara",
        autoriza_imagem_completa=c.autoriza_imagem_completa or False,
        testemunha1_nome=c.testemunha1_nome or "",
        testemunha1_cpf=c.testemunha1_cpf or "",
        testemunha2_nome=c.testemunha2_nome or "",
        testemunha2_cpf=c.testemunha2_cpf or "",
        created_at=c.created_at,
    )
