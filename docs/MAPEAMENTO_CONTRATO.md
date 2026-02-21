# Mapeamento do Contrato - Dados para o Gerador

Baseado no documento: `Contrato Aline Albuquerque.docx.pdf`

## Dados do CONTRATANTE (cliente) - Preenchidos no formulário

| Campo | Exemplo | Tipo |
|-------|---------|------|
| nome_completo | Aline Silva de Albuquerque | string |
| cpf | 538.827.008-40 | string |
| rg | 57.979.815-X | string |
| endereco | Avenida João dos Santos, nº 374, Alto dos Pinheiros II | string |
| telefone | (16) 99202-7463 | string |
| nacionalidade | brasileira | string (default) |

## Dados da CONTRATADA (Ateliê) - Fixos ou configuráveis

| Campo | Valor | Tipo |
|-------|-------|------|
| cnpj | 61.521.925/0001-72 | string |
| endereco | Rua Castro Alves, nº 1957, Bairro Jardim Morumbi, Araraquara/SP | string |
| telefone | (16) 99654-15454 | string |
| proprietaria | Ilma Guerra Leal Leandro | string |

## Especificações do Vestido

| Campo | Exemplo | Tipo |
|-------|---------|------|
| especificacoes | Vestido estilo alfaiataria... (texto longo) | textarea |
| tecidos | West chic da empresa Otimotex... | textarea |

## Valores e Datas

| Campo | Exemplo | Tipo |
|-------|---------|------|
| valor_total | 2800.00 | number |
| valor_servico_vestir | 150.00 | number (fixo) |
| primeira_prova_mes | março | string |
| prova_final_data | 29/05/2026 | date |
| semana_revisao_inicio | 01/06/2026 | date |
| semana_revisao_fim | 05/06/2026 | date |
| data_contrato | 12/01/2026 | date |
| cidade_contrato | Araraquara | string |

## Direito de Imagem

| Campo | Opções | Tipo |
|-------|--------|------|
| autoriza_imagem_completa | true/false | boolean |

## Testemunhas

| Campo | Tipo |
|-------|------|
| testemunha1_nome | string |
| testemunha1_cpf | string |
| testemunha2_nome | string |
| testemunha2_cpf | string |
