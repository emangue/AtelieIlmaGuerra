"""
Gerador de PDF para contratos de vestido de noiva.
Idêntico ao contrato original, alterando apenas os dados da cliente.
"""
from io import BytesIO
from datetime import date

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_JUSTIFY

from .schemas import ContractData

# Dados fixos da CONTRATADA
CONTRATADA = {
    "nome": "Ateliê Ilma Guerra",
    "cnpj": "61.521.925/0001-72",
    "endereco": "Rua Castro Alves, nº 1957, Bairro Jardim Morumbi, Araraquara/SP",
    "telefone": "(16) 99654-15454",
    "proprietaria": "Ilma Guerra Leal Leandro",
}


def _format_cpf(cpf: str) -> str:
    """Formata CPF: 12345678901 -> 123.456.789-01"""
    cpf = "".join(c for c in cpf if c.isdigit())
    if len(cpf) == 11:
        return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
    return cpf


def _format_currency(valor: float) -> str:
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _format_date(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _format_date_range(d1: date, d2: date) -> str:
    return f"{_format_date(d1)} a {_format_date(d2)}"


def _split_specs(text: str) -> list:
    """Divide especificações por bullet (•) ou quebra de linha em itens."""
    items = [s.strip() for s in text.replace("•", "\n").split("\n") if s.strip()]
    return items if items else [text]


def _p(styles, text):
    return Paragraph(text, styles["Justify"])


def generate_contract_pdf(data: ContractData) -> BytesIO:
    """
    Gera PDF do contrato idêntico ao original.
    Altera apenas: dados da CONTRATANTE, especificações, tecidos, valores, datas, imagem, testemunhas.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Justify",
            parent=styles["Normal"],
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        )
    )

    story = []

    # Título
    story.append(Paragraph("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", styles["Heading1"]))
    story.append(Paragraph("CONFECÇÃO DE VESTIDO DE NOIVA SOB MEDIDA", styles["Heading2"]))
    story.append(Spacer(1, 0.5 * cm))

    # CONTRATANTE
    cpf_fmt = _format_cpf(data.cpf)
    contratante_text = (
        f"CONTRATANTE: {data.nome_completo}, {data.nacionalidade}, "
        f"portadora do CPF nº {cpf_fmt}"
    )
    if data.rg:
        contratante_text += f" e RG nº {data.rg}"
    contratante_text += (
        f", residente e domiciliada na {data.endereco}, "
        f"telefone {data.telefone}, doravante denominada CONTRATANTE."
    )
    story.append(_p(styles, contratante_text))
    story.append(Spacer(1, 0.3 * cm))

    # CONTRATADA
    contratada_text = (
        f"CONTRATADA: {CONTRATADA['nome']}, inscrito no CNPJ sob o nº {CONTRATADA['cnpj']}, "
        f"com sede na {CONTRATADA['endereco']}, telefone {CONTRATADA['telefone']}, "
        f"neste ato representado por sua proprietária, {CONTRATADA['proprietaria']}, "
        "doravante denominada simplesmente CONTRATADA."
    )
    story.append(_p(styles, contratada_text))
    story.append(Spacer(1, 0.5 * cm))

    # Preâmbulo
    story.append(_p(styles, "As partes acima identificadas têm, entre si, justo e acordado o presente contrato de prestação de serviços de confecção de vestido de noiva sob medida, que se regerá pelas cláusulas e condições seguintes."))
    story.append(Spacer(1, 0.5 * cm))

    # CLÁUSULA 1 – DO OBJETO
    story.append(Paragraph("CLÁUSULA 1 – DO OBJETO", styles["Heading3"]))
    story.append(_p(styles, "1.1. O presente contrato tem por objeto a confecção de vestido de noiva sob medida, conforme as especificações acordadas entre as partes:"))
    for item in _split_specs(data.especificacoes):
        story.append(_p(styles, f"• {item}"))
    story.append(_p(styles, "1.2. Os tecidos serão fornecidos pela CONTRATADA, sendo:"))
    for item in _split_specs(data.tecidos):
        story.append(_p(styles, f"• {item}"))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO
    valor_extenso = _format_currency(data.valor_total)
    story.append(Paragraph("CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO", styles["Heading3"]))
    story.append(_p(styles, f"2.1. Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de {valor_extenso}, podendo optar pelas seguintes formas de pagamento:"))
    story.append(_p(styles, "a) Pagamento à vista, em espécie ou via PIX, com desconto de 10%;"))
    story.append(_p(styles, "b) Pagamento por meio de cartão de crédito, com possibilidade de parcelamento, em até seis vezes sem acréscimo."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 3 – DAS PROVAS E ENTREGA
    story.append(Paragraph("CLÁUSULA 3 – DAS PROVAS E ENTREGA", styles["Heading3"]))
    story.append(_p(styles, "3.1. As provas serão realizadas em quatro etapas, com datas agendadas à medida que cada etapa ficar pronta. Os horários serão acordados de uma forma que fique bom para ambas as partes."))
    story.append(_p(styles, f"3.2. A primeira prova será realizada no mês de {data.primeira_prova_mes} e a prova final até o dia {_format_date(data.prova_final_data)}"))
    story.append(_p(styles, f"3.3. A semana dos dias {_format_date_range(data.semana_revisao_inicio, data.semana_revisao_fim)} ficarão reservados para revisão final antes da retirada ou entrega da peça."))
    story.append(_p(styles, "3.4. A entrega poderá ocorrer pela CONTRATADA no salão indicado pela CONTRATANTE, ou a retirada pela CONTRATANTE diretamente no ateliê, em ambos casos sem custo adicional."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 4 – DA DESISTÊNCIA E RESCISÃO
    story.append(Paragraph("CLÁUSULA 4 – DA DESISTÊNCIA E RESCISÃO", styles["Heading3"]))
    story.append(_p(styles, "4.1. Por parte da CONTRATANTE:"))
    story.append(_p(styles, "a) Desistência antes do início da produção: retenção de 20% do valor pago."))
    story.append(_p(styles, "b) Desistência com produção já iniciada: pagamento proporcional à mão de obra já executada."))
    story.append(_p(styles, "c) Desistência a partir da 3ª prova: será considerada recusa de peça em fase final, sem direito a reembolso."))
    story.append(_p(styles, "4.2. Por parte da CONTRATADA:"))
    story.append(_p(styles, "Em caso de desistência imotivada pela CONTRATADA, esta deverá:"))
    story.append(_p(styles, "• Restituir integralmente os valores pagos pela CONTRATANTE relativos aos serviços não executados;"))
    story.append(_p(styles, "• Efetuar eventual indenização proporcional pelos prejuízos comprovadamente causados."))
    story.append(_p(styles, "b) A restituição será realizada no prazo máximo de 10 (dez) dias úteis contados da notificação da rescisão."))
    story.append(_p(styles, "4.3. Em caso de conduta que prejudique de forma significativa o bom andamento da execução do contrato por qualquer das partes, a parte prejudicada poderá rescindir o contrato mediante notificação formal e escrita."))
    story.append(_p(styles, "4.3.1. Consideram-se comportamentos prejudiciais, a título exemplificativo: descumprimento reiterado de horários e prazos, recusa injustificada de comparecimento às provas, ou qualquer ato que inviabilize a continuidade da confecção do vestido."))
    story.append(_p(styles, "4.3.2. Em caso de rescisão por culpa da CONTRATANTE, aplicar-se-ão as penalidades da cláusula 4.1, com retenção proporcional dos valores pagos e multa compensatória de 10% sobre o valor total do contrato."))
    story.append(_p(styles, "4.3.3. Em caso de rescisão por culpa da CONTRATADA, esta deverá restituir integralmente os valores pagos pela CONTRATANTE relativos aos serviços não prestados, devolver os tecidos fornecidos e pagar multa compensatória de 10% sobre o valor total do contrato."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 5 – ALTERAÇÕES DE MODELO
    story.append(Paragraph("CLÁUSULA 5 – ALTERAÇÕES DE MODELO", styles["Heading3"]))
    story.append(_p(styles, "5.1. Alterações no modelo inicialmente definido somente poderão ser solicitadas pela CONTRATANTE até a realização da 1ª prova, incluindo ajustes como modificação no decote, que não impactam no modelo do vestido."))
    story.append(_p(styles, "5.2. Alterações consideradas substanciais — que impactem de forma significativa o design, a estrutura ou o volume de trabalho originalmente previsto — ensejará a elaboração de aditivo contratual, com readequação de valores e prazos de entrega, mediante anuência de ambas as partes."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 6 – SERVIÇOS ADICIONAIS NO DIA DO CASAMENTO
    valor_vestir = _format_currency(data.valor_servico_vestir)
    story.append(Paragraph("CLÁUSULA 6 – SERVIÇOS ADICIONAIS NO DIA DO CASAMENTO", styles["Heading3"]))
    story.append(_p(styles, "<b>6.1. VESTIR A NOIVA NO DIA DO CASAMENTO</b>"))
    story.append(_p(styles, f"6.1.1. Caso a CONTRATANTE deseje que a CONTRATADA esteja presente no dia do casamento para auxiliar na vestimenta do vestido, ou prestar qualquer suporte relacionado à peça confeccionada por intercorrência de terceiros, será cobrado o valor adicional de {valor_vestir} por hora de serviço."))
    story.append(_p(styles, "6.1.2. A solicitação deste serviço deverá ser feita com antecedência mínima de 15 (quinze) dias da data do evento, ficando sua execução condicionada à disponibilidade da agenda da CONTRATADA."))
    story.append(_p(styles, "6.1.3. Caso o serviço seja realizado em local diverso da cidade onde se encontra o ateliê, a CONTRATANTE será responsável pelo custeio do deslocamento, hospedagem (se necessário) e demais despesas correlatas, previamente acordadas entre as partes."))
    story.append(_p(styles, "6.1.4. O pagamento deste serviço será feito integralmente no ato da confirmação da contratação, não se confundindo com o valor do contrato principal."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 7 – DIREITO DE IMAGEM
    story.append(Paragraph("CLÁUSULA 7 – DIREITO DE IMAGEM", styles["Heading3"]))
    story.append(_p(styles, "7.1. A CONTRATANTE, de forma livre e esclarecida, desde já, autoriza a CONTRATADA a utilizar imagens fotográficas e/ou audiovisuais do vestido confeccionado, seja exposto em manequim, cabide ou sendo utilizado pela CONTRATANTE com o rosto totalmente oculto, para fins de portfólio profissional, divulgação em redes sociais, site e demais materiais promocionais do ateliê, sem qualquer ônus ou direito de remuneração futura."))
    story.append(_p(styles, "7.2. Caso a CONTRATANTE também autorize a divulgação de sua imagem pessoal completa (incluindo o rosto), deverá manifestar-se expressamente por meio da opção abaixo:"))
    if data.autoriza_imagem_completa:
        story.append(_p(styles, "( X ) Autorizo a divulgação do vestido incluindo minha imagem pessoal completa (rosto visível)."))
        story.append(_p(styles, "(   ) Não autorizo a divulgação do vestido com minha imagem pessoal completa, permitindo apenas as imagens com o rosto oculto."))
    else:
        story.append(_p(styles, "(   ) Autorizo a divulgação do vestido incluindo minha imagem pessoal completa (rosto visível)."))
        story.append(_p(styles, "( X ) Não autorizo a divulgação do vestido com minha imagem pessoal completa, permitindo apenas as imagens com o rosto oculto."))
    story.append(_p(styles, "7.3. A autorização concedida no item 7.2 poderá ser revogada a qualquer tempo pela CONTRATANTE, mediante comunicação escrita, sem efeitos retroativos sobre publicações já realizadas até a data da revogação."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 8 – RESPONSABILIDADES
    story.append(Paragraph("CLÁUSULA 8 – RESPONSABILIDADES", styles["Heading3"]))
    story.append(_p(styles, "8.1. A CONTRATADA não se responsabiliza por danos decorrentes do mau uso do vestido após a entrega."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 9 – ALTERAÇÃO DE MEDIDAS CORPORAL
    story.append(Paragraph("CLÁUSULA 9 – ALTERAÇÃO DE MEDIDAS CORPORAL (EMAGRECIMENTO OU GANHO DE PESO)", styles["Heading3"]))
    story.append(_p(styles, "9.1. A confecção do vestido será realizada com base nas medidas corporais da CONTRATANTE colhidas nas datas das provas programadas, conforme estipulado neste contrato."))
    story.append(_p(styles, "9.2. Caso a CONTRATANTE emagreça ou engorde de forma significativa entre uma prova e outra, ocasionando a incompatibilidade do vestido com as novas medidas, serão necessários ajustes extras."))
    story.append(_p(styles, "9.3. Ajustes mínimos decorrentes de pequenas variações corporais (até 7 cm em cintura, busto ou quadril) estão inclusos no valor contratado."))
    story.append(_p(styles, "9.4. Alterações superiores a esse limite serão consideradas modificações substanciais e implicarão:"))
    story.append(_p(styles, "a) Elaboração de orçamento adicional para novos ajustes ou recorte/reestruturação do vestido;"))
    story.append(_p(styles, "b) Eventual alteração no prazo de entrega, que será remarcado conforme a complexidade dos ajustes."))
    story.append(_p(styles, "9.5. Caso a CONTRATANTE não aceite o orçamento adicional ou o prazo estendido necessário para os ajustes, poderá optar pela retirada do vestido no estado em que se encontra, sem direito a reembolso dos valores já pagos."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 9 – VIGÊNCIA (original tem numeração duplicada)
    story.append(Paragraph("CLÁUSULA 9 – VIGÊNCIA", styles["Heading3"]))
    story.append(_p(styles, "9.1. O presente contrato vigorará a partir da assinatura até a entrega definitiva do vestido. O prazo poderá ser prorrogado por escrito caso ocorram alterações de modelo, variações de medidas ou situações excepcionais devidamente justificadas, mediante acordo entre as partes."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 10 – DISPOSIÇÕES GERAIS
    story.append(Paragraph("CLÁUSULA 10 – DISPOSIÇÕES GERAIS", styles["Heading3"]))
    story.append(_p(styles, "10.1. O presente contrato é celebrado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores a qualquer título, salvo nos casos expressamente previstos neste instrumento ou na legislação aplicável."))
    story.append(_p(styles, "10.2. A eventual tolerância de uma das partes quanto ao descumprimento de qualquer cláusula ou condição aqui prevista não constituirá novação, alteração contratual ou renúncia de direito, sendo considerada ato de mera liberalidade, que não impedirá a parte tolerante de exigir, a qualquer tempo, o cumprimento integral do contrato."))
    story.append(_p(styles, "10.3. Este instrumento poderá ser assinado de forma eletrônica, inclusive por meio de mensagens de aplicativos (como WhatsApp) ou correio eletrônico (e-mail), possuindo a mesma força probante e validade jurídica que a assinatura física, nos termos da legislação vigente."))
    story.append(_p(styles, "10.4. Para todos os efeitos legais, aplica-se subsidiariamente o Código Civil Brasileiro e o Código de Defesa do Consumidor, sem prejuízo das demais normas pertinentes que regulem a matéria."))
    story.append(Spacer(1, 0.3 * cm))

    # CLÁUSULA 11 – FORO
    story.append(Paragraph("CLÁUSULA 11 – FORO", styles["Heading3"]))
    story.append(_p(styles, "11.1. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem, de comum acordo, o Foro da Comarca de Araraquara/SP, renunciando expressamente a qualquer outro, por mais privilegiado que seja, salvo quando houver disposição legal específica que determine foro diverso de forma obrigatória."))
    story.append(Spacer(1, 0.5 * cm))

    # Assinaturas (igual ao original: CONTRATA para cliente)
    story.append(_p(styles, f"{data.cidade_contrato}, {_format_date(data.data_contrato)}."))
    story.append(_p(styles, f"{data.nome_completo} – CONTRATA"))
    story.append(_p(styles, f"{CONTRATADA['nome']} – CONTRATADA"))
    story.append(Spacer(1, 0.5 * cm))

    # Testemunhas
    story.append(_p(styles, "Testemunha 1:"))
    story.append(_p(styles, f"NOME: {data.testemunha1_nome or ''}"))
    story.append(_p(styles, f"CPF: {data.testemunha1_cpf or ''}"))
    story.append(_p(styles, "Testemunha 2:"))
    story.append(_p(styles, f"NOME: {data.testemunha2_nome or ''}"))
    story.append(_p(styles, f"CPF: {data.testemunha2_cpf or ''}"))

    doc.build(story)
    buffer.seek(0)
    return buffer
