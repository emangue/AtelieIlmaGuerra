# Projeto — Registro de Provas com Fotos

**Status:** proposta para validação

**Versão:** 1.1

**Data:** 29/10/2026
**Escopo da primeira entrega:** fotos e documento comprobatório; vídeos ficam fora da versão inicial.

## 1. Decisão de produto

O registro de prova será uma seção do Pedido, não um cadastro ou banco separado. Um Pedido poderá ter várias provas e cada prova poderá conter várias fotos, observações e um documento final.

Os três campos atuais `foto_url`, `foto_url_2` e `foto_url_3` continuarão servindo como referências gerais da peça. Eles não serão usados como evidência de prova, pois não oferecem quantidade variável, contexto, autoria, trilha de auditoria ou imutabilidade.

## 2. Problema

Durante uma prova, decisões sobre caimento, medidas, ajustes solicitados e estado da peça são combinadas presencialmente. Hoje essas informações podem ficar apenas na memória, em mensagens dispersas ou em fotos sem contexto. Em caso de divergência, o ateliê não consegue reconstruir com segurança o que foi observado e aceito em cada data.

O custo de não resolver é retrabalho, conflito com clientes, dificuldade de demonstrar a evolução do serviço e exposição jurídica e reputacional.

## 3. Objetivos

1. Permitir registrar uma prova completa em até três minutos pelo celular.
2. Vincular cada foto a um Pedido, data, etapa, responsável e conjunto de observações.
3. Impedir alterações silenciosas depois da finalização da prova.
4. Gerar um documento legível que reconstrua o ocorrido e identifique tecnicamente os arquivos associados.
5. Manter acesso restrito, rastreável e compatível com uma política de retenção e privacidade.

## 4. Não objetivos da primeira versão

- Gravação ou upload de vídeos.
- Reconhecimento facial ou biometria.
- Coleta de geolocalização, coordenadas ou validação de presença física.
- Assinatura digital qualificada ICP-Brasil.
- Integração automática com a API oficial do WhatsApp; na primeira versão, o sistema gera um link para compartilhamento manual.
- Portal permanente para a cliente consultar todas as fotos; o acesso inicial será temporário e restrito a uma prova.
- Substituir orientação jurídica sobre base legal, texto do termo e prazo de retenção.

## 5. Usuários e histórias principais

- Como atendente, quero abrir uma prova dentro do Pedido para registrar data, etapa e contexto.
- Como costureira, quero fotografar o caimento e escrever os ajustes combinados para não depender da memória.
- Como responsável pelo ateliê, quero finalizar a prova para preservar uma versão que não possa ser editada silenciosamente.
- Como responsável pelo ateliê, quero gerar um documento com fotos, observações, horários e identificadores para reconstruir o atendimento.
- Como cliente, quero ser informada sobre o registro e confirmar ciência das observações antes da finalização.
- Como administradora, quero saber quem criou, consultou ou anulou um registro.

## 6. Jornada proposta

### 6.1 Início

Na tela de detalhes do Pedido haverá uma seção **Provas** com a linha do tempo das provas anteriores e o botão **Registrar nova prova**.

### 6.2 Registro

O formulário solicitará:

- etapa: primeira prova, prova intermediária, prova final ou entrega;
- data e hora, preenchidas automaticamente e editáveis antes da finalização;
- observações da profissional;
- solicitações e observações atribuídas à cliente;
- fotos capturadas pela câmera ou escolhidas do aparelho;
- confirmação de que a cliente foi informada sobre o registro;
- nome da pessoa que acompanhou a prova, quando diferente da titular do Pedido.

Cada foto terá uma legenda opcional, por exemplo: “barra antes do ajuste”, “caimento lateral” ou “ajuste solicitado no busto”.

### 6.3 Revisão e envio para aceite

Antes de finalizar, a tela mostrará um resumo com fotos e observações. A atendente deverá confirmar que revisou o conteúdo com a cliente.

A atendente confirma o telefone mascarado, a validade do link e envia ou compartilha o convite. A cliente abre uma página temporária, sem criar conta, e pode **concordar**, **pedir correção** ou **informar que não concorda**.

O aceite da primeira entrega combina:

- link individual e de curta duração, enviado ao canal informado no Pedido;
- resumo idêntico ao que será preservado no documento;
- caixa explícita de ciência e concordância;
- nome completo digitado pela cliente;
- data e hora do servidor, versão do texto e hash do resumo aceito.

O sistema não armazenará o token em texto puro. Na primeira entrega, o link será compartilhado manualmente por um texto pronto no WhatsApp ou copiado para outro canal; não haverá SMS nem código de uso único. Uma assinatura desenhada poderá existir como complemento P1, mas não será o mecanismo principal.

Sem segundo fator, o sistema registra uma manifestação feita por meio de um link individual enviado ao contato cadastrado, mas não deve afirmar que verificou a identidade por SMS ou que produziu assinatura qualificada. A trilha continua preservando qual versão foi apresentada, qual ação ocorreu e quando.

### 6.4 Finalização

Ao finalizar:

1. as fotos recebem hash SHA-256;
2. os dados passam a ser imutáveis;
3. o sistema grava um evento de auditoria;
4. após o aceite, ou após o registro explícito de recusa/ausência de aceite, é gerado o **Relatório de Prova** em PDF;
5. o PDF recebe identificador único e hash próprio;
6. qualquer correção posterior gera uma retificação, sem substituir o registro original.

## 7. Conteúdo do Relatório de Prova

O documento conterá:

- identificação do ateliê;
- número e cliente do Pedido;
- número sequencial e etapa da prova;
- data, hora e responsável pelo atendimento;
- observações da profissional;
- solicitações registradas em nome da cliente;
- miniaturas das fotos e respectivas legendas;
- nome original, data de envio e hash resumido de cada foto;
- registro da ciência ou eventual recusa;
- identificador, data de emissão, versão e hash do documento;
- aviso de que o relatório representa o registro realizado no sistema naquela data.

O documento também apresentará uma tabela de decisões com item verificado, situação observada, ajuste combinado, responsável, prazo e eventual impacto de preço. Na seção de aceite, registrará o resultado, o canal mascarado, o horário do servidor, a versão do termo e o hash do resumo. O documento não exibirá IP completo, token, código de uso único ou outros segredos.

O PDF não deve afirmar que possui assinatura digital qualificada quando isso não for verdade.

## 8. Modelo de dados

### 8.1 `pedido_provas`

| Campo | Tipo sugerido | Finalidade |
|---|---|---|
| `id` | inteiro/UUID | Identificador |
| `pedido_id` | FK obrigatória | Pedido relacionado |
| `numero` | inteiro | Sequência dentro do Pedido |
| `etapa` | enum/string | Primeira, intermediária, final ou entrega |
| `status` | enum | Rascunho, finalizada, retificada ou anulada |
| `realizada_em` | datetime com timezone | Momento da prova |
| `observacoes_profissional` | texto | Constatações e ajustes |
| `observacoes_cliente` | texto | Solicitações atribuídas à cliente |
| `acompanhante_nome` | string opcional | Pessoa presente |
| `ciencia_metodo` | enum | Presencial, recusa ou não aplicável |
| `ciencia_nome` | string opcional | Pessoa que declarou ciência |
| `ciencia_em` | datetime opcional | Momento da ciência |
| `termo_versao` | string | Texto apresentado naquele momento |
| `criado_por_id` | FK usuário | Autoria |
| `criado_em` | datetime | Auditoria |
| `finalizado_por_id` | FK usuário opcional | Responsável pela finalização |
| `finalizado_em` | datetime opcional | Imutabilidade |
| `retifica_prova_id` | FK opcional | Vínculo com registro corrigido |
| `anulado_em` | datetime opcional | Anulação lógica |
| `anulado_por_id` | FK opcional | Responsável pela anulação |
| `anulacao_motivo` | texto opcional | Justificativa obrigatória |

Restrição recomendada: unicidade de `(pedido_id, numero)`.

### 8.2 `pedido_prova_checks`

Registra decisões de forma estruturada, evitando que informações importantes existam apenas em texto livre.

| Campo | Tipo sugerido | Finalidade |
|---|---|---|
| `id` | inteiro/UUID | Identificador |
| `prova_id` | FK obrigatória | Prova relacionada |
| `categoria` | enum/string | Medidas, caimento, acabamento, condição da peça, prazo ou outro |
| `descricao` | texto | O que foi verificado |
| `resultado` | enum | Conforme, ajustar, não se aplica ou pendente |
| `ajuste_combinado` | texto opcional | Decisão tomada |
| `solicitado_por` | enum | Cliente, ateliê ou ambos |
| `responsavel` | string opcional | Quem executará o próximo passo |
| `prazo` | date opcional | Data combinada |
| `impacto_preco_centavos` | inteiro opcional | Acréscimo ou desconto acordado |
| `ordem` | inteiro | Ordem de exibição no resumo |

### 8.3 `pedido_prova_midias`

| Campo | Tipo sugerido | Finalidade |
|---|---|---|
| `id` | inteiro/UUID | Identificador |
| `prova_id` | FK obrigatória | Prova relacionada |
| `tipo` | enum | Inicialmente apenas `foto` |
| `storage_key` | string | Chave privada no armazenamento |
| `nome_original` | string | Rastreabilidade |
| `mime_type` | string | Tipo validado pelo conteúdo |
| `tamanho_bytes` | inteiro | Controle de limite |
| `largura` / `altura` | inteiro | Metadados da imagem |
| `sha256` | string | Verificação de integridade |
| `legenda` | string opcional | Contexto da foto |
| `capturada_em` | datetime opcional | Metadado disponível e confiável |
| `enviada_em` | datetime | Registro do servidor |
| `enviada_por_id` | FK usuário | Autoria |
| `removida_em` | datetime opcional | Exclusão lógica antes da finalização |
| `remocao_motivo` | texto opcional | Auditoria |

Não haverá exclusão física comum depois da finalização. Pedidos de eliminação seguirão política própria, com registro do motivo e análise de eventual obrigação ou direito de conservação.

### 8.4 `pedido_prova_aceites`

Tabela append-only que preserva cada tentativa ou manifestação da cliente.

| Campo | Tipo sugerido | Finalidade |
|---|---|---|
| `id` | inteiro/UUID | Identificador |
| `prova_id` | FK obrigatória | Prova relacionada |
| `status` | enum | Enviado, visualizado, aceito, correção solicitada, não concordou ou expirado |
| `metodo` | enum | Link com código, presencial assistido ou recusa registrada |
| `nome_declarado` | string opcional | Nome digitado pela cliente |
| `canal_mascarado` | string opcional | Telefone ou e-mail sem exposição integral |
| `token_digest` | string opcional | Digest do token; nunca o token bruto |
| `resumo_sha256` | string | Versão exata apresentada à cliente |
| `termo_versao` | string | Texto exibido |
| `ocorrido_em` | datetime com timezone | Horário do servidor |
| `user_agent_resumido` | string opcional | Contexto técnico minimizado |
| `ip_protegido` | string opcional | Dado minimizado, protegido e sujeito à política de retenção |
| `observacao` | texto opcional | Motivo de correção ou discordância |
| `registrado_por_id` | FK usuário opcional | Operador, quando houver assistência presencial |

Não se atualiza um aceite anterior. Um novo envio, correção ou aceite gera outro evento. O resumo aceito deve ser reconstruível pelo hash e pela versão preservada.

### 8.5 `pedido_prova_documentos`

Armazena versão, chave privada, hash SHA-256, data de emissão, usuário emissor e prova relacionada. Uma retificação gera outro documento; não sobrescreve o anterior.

### 8.6 Eventos de auditoria

O domínio poderá reutilizar `HistoricoAlteracao`, desde que passe a registrar eventos append-only para criação, upload, remoção pré-finalização, finalização, visualização, download, emissão, retificação e anulação.

## 9. Armazenamento e segurança

Os arquivos não serão guardados como conteúdo binário no banco. O banco armazenará somente metadados, hashes e chaves privadas.

Para produção, a recomendação é armazenamento de objetos privado e criptografado, com:

- URLs assinadas e de curta duração;
- proibição de URL pública permanente;
- criptografia em trânsito e em repouso;
- versionamento ou retenção para registros finalizados;
- backup em destino separado;
- política de ciclo de vida;
- validação de extensão, MIME e assinatura real do arquivo;
- limite inicial sugerido de 10 MB por foto e 12 fotos por prova;
- remoção de metadados EXIF desnecessários, preservando somente o que tiver finalidade definida;
- autorização por Pedido e perfil do usuário em toda leitura e download.

O upload local atual de fotos de Pedido não atende sozinho aos requisitos de privacidade, escala e preservação deste projeto.

## 10. API proposta

- `POST /api/v1/pedidos/{pedido_id}/provas`
- `GET /api/v1/pedidos/{pedido_id}/provas`
- `GET /api/v1/provas/{prova_id}`
- `PATCH /api/v1/provas/{prova_id}` — somente rascunhos
- `POST /api/v1/provas/{prova_id}/midias/presign`
- `POST /api/v1/provas/{prova_id}/midias/confirmar`
- `DELETE /api/v1/provas/{prova_id}/midias/{midia_id}` — somente rascunhos
- `POST /api/v1/provas/{prova_id}/finalizar`
- `POST /api/v1/provas/{prova_id}/retificar`
- `POST /api/v1/provas/{prova_id}/anular`
- `GET /api/v1/provas/{prova_id}/documento`
- `GET /api/v1/provas/{prova_id}/midias/{midia_id}/acesso`
- `POST /api/v1/provas/{prova_id}/aceites/convites`
- `GET /api/v1/aceites/{token_publico}` — resumo temporário, sem revelar o Pedido completo
- `POST /api/v1/aceites/{token_publico}/aceitar`
- `POST /api/v1/aceites/{token_publico}/correcao`
- `POST /api/v1/aceites/{token_publico}/discordar`

As rotas públicas terão rate limit, expiração, uso único, resposta neutra para tokens inválidos e proteção contra enumeração. A confirmação exige que o hash do resumo ainda seja o mesmo; qualquer alteração invalida o convite e exige novo envio.

## 10.1 Arquitetura das telas

### Tela A — Detalhe do Pedido

Bloco **Provas e aceite** dentro do Pedido, após os dados do serviço e antes do histórico geral. Exibe linha do tempo e estados: rascunho, aguardando cliente, correção solicitada, aceito, finalizado e retificado. A ação principal é **Registrar nova prova**.

### Tela B — Registrar prova

Fluxo mobile em três passos curtos:

1. **Contexto:** etapa, data, pessoas presentes e observação geral.
2. **Fotos:** câmera/galeria, miniaturas ordenáveis e legenda por imagem.
3. **Checks:** linhas estruturadas de verificação, ajuste, responsável, prazo e impacto de preço.

O sistema oferece checks sugeridos — medidas e caimento, acabamento, condição da peça, prazo e próximo passo — mas permite adicionar outro. Para aluguel, condição na retirada e condição na devolução aparecem como sugestões específicas.

### Tela C — Revisar e enviar

Prévia fiel do resumo que a cliente verá, com alertas para foto sem legenda, ajuste sem responsável ou mudança de preço sem valor. A atendente confirma o telefone, escolhe **Gerar link de aceite** e então usa **Compartilhar no WhatsApp** ou **Copiar link**. O WhatsApp abre com texto pronto, mas a atendente ainda confirma a conversa e pressiona enviar. A integração automática é evolução posterior.

### Tela D — Aceite da cliente

Página mobile sem login e com identidade clara do ateliê. Mostra somente os dados necessários: Pedido, data, etapa, fotos, decisões e valores afetados. Ações visíveis e equivalentes:

- **Pedir correção**, com motivo obrigatório;
- **Não concordo**, com motivo opcional;
- **Li e estou de acordo**, seguido de nome completo.

O botão final dirá **Confirmar concordância**; não se usará texto genérico como “Continuar”. Antes da confirmação, a página informa que o registro será preservado com data e hora. Após concluir, apresenta protocolo e opção de baixar o documento.

### Tela E — Documento e histórico

O ateliê vê o relatório em formato semelhante a uma folha A4, o estado do aceite e a trilha de eventos. Fotos originais exigem autorização; o documento usa miniaturas e hashes resumidos. Retificações aparecem vinculadas sem apagar a versão anterior.

## 10.2 Estados e mensagens essenciais

| Estado | Experiência |
|---|---|
| Rascunho | Editável somente por perfis autorizados |
| Aguardando cliente | Conteúdo congelado; editar exige cancelar o convite e criar nova versão |
| Correção solicitada | Motivo destacado e ação “Criar versão corrigida” |
| Não concordou | Registro preservado, sem apresentar concordância inexistente |
| Aceito | Conteúdo e aceite imutáveis; PDF disponível |
| Link expirado | Novo convite preserva os eventos anteriores |
| Retificado | Original permanece acessível e aponta para a versão válida |

## 10.3 Escolha do mecanismo de aceite

| Opção | Atrito | Força do registro | Decisão |
|---|---:|---:|---|
| Link individual + nome digitado | Muito baixo | Preserva intenção, conteúdo e horário; não verifica posse por segundo fator | **Escolhido para P0** |
| Aceite presencial assistido no aparelho do ateliê | Muito baixo | Menor independência do dispositivo/canal | Fallback, identificado como assistido |
| Assinatura desenhada | Médio | Complemento visual, mas fraco quando isolado | Opcional em P1 |
| Link + código enviado por SMS | Baixo | Acrescenta verificação do telefone | P1, quando houver provedor |
| Provedor externo de assinatura eletrônica | Médio/alto | Evidência e operação especializadas | Avaliar em P2 se o risco justificar |

O objetivo não é simular uma assinatura qualificada. É demonstrar, de forma proporcional e pouco friccionante, **quem recebeu qual versão, o que foi apresentado, qual ação tomou e quando isso ocorreu**.

## 11. Requisitos da primeira entrega (P0)

- Prova vinculada obrigatoriamente a um Pedido existente.
- Uma ou mais fotos com legenda opcional.
- Observações da profissional e da cliente em campos distintos.
- Registro do usuário e dos horários pelo servidor.
- Estado rascunho e estado finalizado.
- Fotos privadas, autorizadas e identificadas por hash.
- Registro de ciência, recusa ou não aplicabilidade.
- Aceite remoto por link temporário, nome digitado e confirmação explícita.
- Texto pronto e compartilhamento manual no WhatsApp, sem dependência de API externa.
- Opções explícitas para pedir correção e registrar discordância.
- Checks estruturados, incluindo impacto de preço quando aplicável.
- Documento PDF gerado na finalização.
- Imutabilidade após finalização.
- Retificação sem sobrescrever o original.
- Auditoria de criação, finalização, visualização, download, retificação e anulação.
- Política de erro para upload interrompido e arquivo inválido.

## 12. Melhorias posteriores (P1/P2)

### P1

- assinatura desenhada opcional, sempre vinculada ao mesmo resumo e trilha de aceite;
- código de uso único por SMS ou WhatsApp oficial, após contratação de provedor;
- envio do relatório por e-mail ou WhatsApp mediante ação explícita;
- comparação visual entre provas;
- lembrete de prova agendada sem registro;
- impressão com QR code para validação do identificador e hash.

### P2

- vídeos, após confirmar necessidade e custo de armazenamento;
- assinatura eletrônica por provedor externo;
- portal temporário para ciência remota;
- legal hold e política avançada de retenção;
- carimbo do tempo por autoridade externa.

## 13. Critérios de aceitação essenciais

- Dado um Pedido existente, quando uma usuária autorizada cria uma prova, então ela aparece na linha do tempo daquele Pedido e não em outro.
- Dado um rascunho, quando uma foto inválida ou acima do limite é enviada, então o sistema rejeita o arquivo sem criar mídia órfã.
- Dada uma prova sem foto, quando a usuária tenta finalizar, então o sistema impede a operação e explica o requisito.
- Dada uma prova finalizada, quando qualquer usuário tenta editar campos ou excluir fotos pela API, então a operação é recusada e auditada.
- Dada uma retificação, quando ela é finalizada, então o registro original permanece acessível e o vínculo entre versões é exibido.
- Dado um usuário sem acesso ao Pedido, quando solicita uma foto ou documento, então recebe negação sem revelar a existência do arquivo.
- Dada uma foto armazenada, quando seu conteúdo é recalculado, então o hash deve corresponder ao registrado.
- Dada uma finalização bem-sucedida, quando o PDF é aberto, então apresenta todos os dados, fotos e identificadores previstos.
- Dado um convite válido, quando a cliente pede correção, então o conteúdo não é marcado como aceito e o motivo aparece no Pedido.
- Dado um resumo alterado depois de um convite, quando a cliente tenta aceitar o link anterior, então o sistema recusa a confirmação e exige novo convite.
- Dado um aceite concluído, quando qualquer usuário tenta editar o resumo aceito, então a operação é recusada e auditada.
- Dado um token inválido, expirado, cancelado ou já concluído, quando alguém abre o link, então o sistema apresenta resposta neutra sem revelar dados do Pedido.

## 14. Estratégia de testes

### Backend

- permissões por perfil e por Pedido;
- validação de MIME, assinatura, tamanho e quantidade;
- associação cruzada indevida entre Pedido, prova e mídia;
- hash, finalização, imutabilidade, retificação e anulação;
- transações incompletas e limpeza de uploads órfãos;
- auditoria e acesso temporário a arquivos.

### Frontend

- câmera e galeria em celular;
- upload lento, interrompido e repetido;
- ordenação, legenda e remoção antes de finalizar;
- revisão da ciência;
- estados vazio, carregando, erro, rascunho e finalizado;
- acessibilidade básica e funcionamento em tela pequena.

### End-to-end

Criar Pedido → registrar prova → adicionar fotos e checks → revisar → gerar convite → compartilhar texto no WhatsApp → cliente pede correção → corrigir e reenviar → cliente aceita pelo link → gerar PDF → consultar histórico → tentar edição indevida → criar retificação.

### Operação

- restauração de banco e arquivos em ambiente isolado;
- expiração de URLs assinadas;
- acesso negado após remoção de permissão;
- monitoramento de falhas de upload e emissão de documento.

## 15. Entregas e estimativa relativa

### Fase 0 — decisões bloqueantes

- validar texto de ciência e base legal com profissional jurídico/LGPD;
- definir prazo de retenção;
- escolher armazenamento privado;
- definir perfis autorizados.

### Fase 1 — fundação técnica

Migrações, modelos, permissões, armazenamento, upload de foto e testes de segurança.

### Fase 2 — experiência e documento

Linha do tempo no Pedido, formulário mobile, finalização, auditoria e PDF.

### Fase 3 — endurecimento e piloto

Testes end-to-end, restauração, observabilidade, treinamento e piloto com poucos Pedidos.

Estimativa inicial: três ciclos curtos de implementação, sem incluir contratação/configuração externa de armazenamento nem revisão jurídica. A estimativa definitiva depende das decisões da Fase 0.

## 16. Métricas de sucesso

- pelo menos 90% das provas realizadas no piloto registradas no mesmo dia;
- pelo menos 95% das provas iniciadas concluídas sem erro de upload;
- tempo mediano de registro inferior a três minutos;
- 100% das provas finalizadas com auditoria, hashes e PDF;
- zero mídia acessível por URL pública permanente;
- restauração de uma prova completa validada em teste trimestral.

## 17. Questões para aprovação

### Bloqueantes

1. Qual texto será apresentado à cliente e quem fará sua revisão jurídica?
2. Por quanto tempo fotos e relatórios devem ser preservados?
3. Quais perfis podem visualizar e baixar as imagens?
4. A cliente receberá uma cópia automaticamente ou somente quando solicitar?
5. Qual armazenamento privado será utilizado em produção?

### Não bloqueantes

1. A assinatura desenhada entra logo após o piloto?
2. O relatório precisa seguir o mesmo visual dos contratos atuais?
3. Devemos registrar a entrega como uma etapa de prova ou como evento próprio?

## 18. Cuidados legais e de privacidade

O objetivo técnico é melhorar contexto, integridade, rastreabilidade e conservação; ele não garante sozinho a aceitação do documento em uma disputa. A definição de base legal, texto de ciência, direitos da cliente e retenção deve ser revisada por profissional habilitado.

Referências oficiais para essa revisão:

- Código de Processo Civil, especialmente os dispositivos sobre meios de prova e documentos eletrônicos: <https://planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105compilada.htm>
- Resolução CD/ANPD nº 2/2022: <https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022>
- Orientações da ANPD sobre RIPD: <https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd>
