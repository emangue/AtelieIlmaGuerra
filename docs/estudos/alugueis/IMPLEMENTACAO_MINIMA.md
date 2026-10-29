# Implementação mínima — Pedidos, Aluguéis e Acervo

Este documento transforma o PoC em um mapa de implementação sem criar uma
segunda gestão.

## Decisão principal

O aluguel continua sendo um `Pedido` do app de gestão. A modalidade será
`confeccao` (padrão dos registros atuais) ou `aluguel`.

Serão criadas somente as tabelas necessárias para o acervo e para os itens
reservados. Clientes, autenticação, pagamentos, histórico e navegação continuam
sendo os existentes.

```text
Pedido existente
  ├── modalidade=confeccao  → fluxo atual, sem mudança
  └── modalidade=aluguel    → datas + itens do acervo + fluxo de devolução

Pedido ──< PedidoAcervoItem >── AcervoItem
Pedido ──< Pagamento (já existe)
Pedido ──< HistoricoAlteracao (já existe)
Pedido ──< Prova/Termo de condição ──< Fotos, checks e aceite
```

## O que já pode ser reutilizado

| Necessidade | Recurso atual | Ação |
|---|---|---|
| Login e permissões | `auth`, `users`, JWT | Reutilizar |
| Cliente | `clientes` e `/api/v1/clientes` | Reutilizar |
| Lista de pedidos | `/api/v1/pedidos/ativos`, `/todos` | Estender resposta com modalidade e datas de aluguel |
| Criar/editar pedido | `POST /pedidos`, `PATCH /pedidos/{id}` | Aceitar campos de aluguel condicionalmente |
| Status | `PATCH /pedidos/{id}/status` | Reutilizar com estados contextuais de aluguel |
| Pagamentos | `POST /pedidos/{id}/pagamento`, `/pagamentos` | Reutilizar `pedido_id`; nenhuma nova conexão |
| Histórico | `historico_alteracoes` | Reutilizar para acervo e aluguel |
| Fotos/upload | upload atual de pedidos | Reutilizar; galeria de acervo pode começar com uma foto |
| Contato da cliente | telefone já associado ao cliente | Usar para montar o compartilhamento manual no WhatsApp |
| Navegação | layout e menu mobile atuais | Adicionar apenas o item “Acervo” ao menu |
| Calendário | rota existente, hoje placeholder | Integrar depois, sem bloquear a primeira versão |

## Banco de dados mínimo

### Alterações em `pedidos`

Novas colunas, todas opcionais para preservar registros legados:

- `modalidade` — default `confeccao`;
- `data_retirada`;
- `data_devolucao_prevista`;
- `data_devolucao_real`;
- `valor_caucao`;
- `status_caucao` — `nao_aplicavel`, `pendente`, `devolvida` ou `retida`.

O `status` atual continua existindo, mas será interpretado conforme a
modalidade. Confecção mantém `Encomenda`, `Cortado`, `Provado`, `Pronto` e
`Entregue`; aluguel usa `Orçamento`, `Reservado`, `Retirado`, `Devolvido`,
`Finalizado` e `Cancelado`.

### Nova tabela `acervo_itens`

- `id`, `codigo` único;
- `nome`, `categoria` (`vestido` ou `acessorio`);
- `tamanho`, `cor`, `descricao`;
- `valor_aluguel_padrao`, `valor_reposicao`;
- `status_item` (`disponivel`, `manutencao`, `inativo`);
- `foto_url`, `observacao`, `created_at`, `updated_at`.

### Nova tabela `pedido_acervo_itens`

- `id`, `pedido_id`, `acervo_item_id`;
- `valor_unitario` — cópia do preço no momento do aluguel;
- `observacao_retirada`, `observacao_devolucao`;
- `valor_dano` opcional;
- restrição para não repetir o mesmo item no pedido.

Para a primeira versão, cada vestido ou acessório físico será um cadastro
individual. Isso simplifica disponibilidade, manutenção e histórico. Quantidade
para itens idênticos pode ser adicionada depois se for realmente necessária.

### Registro de condição, fotos e aceite

O aluguel reutilizará o domínio de provas vinculado ao Pedido, com dois modelos
de registro próprios da modalidade:

- **Termo de retirada:** condição das peças e acessórios entregues, fotos,
  observações, itens conferidos e responsabilidade de devolução;
- **Termo de devolução:** condição recebida, itens devolvidos, dano aparente,
  limpeza/manutenção, decisão sobre caução e eventual valor de dano.

As tabelas `pedido_provas`, `pedido_prova_checks`, `pedido_prova_midias`,
`pedido_prova_aceites` e `pedido_prova_documentos` permanecem subordinadas ao
Pedido. Não será criada uma base de clientes, aluguel ou documentos separada.

Na primeira entrega não haverá SMS, código de uso único, geolocalização nem
integração com a API oficial do WhatsApp. O servidor gerará um token aleatório
de alta entropia, armazenará apenas seu digest e entregará uma URL temporária
para compartilhamento manual. O link expira, pode ser cancelado, fica vinculado
ao hash exato do resumo e é invalidado quando o conteúdo muda ou quando a
manifestação é concluída.

## APIs novas ou alteradas

### Acervo — novo router dentro do backend de gestão

- `GET /api/v1/alugueis/acervo` — lista, filtros e disponibilidade opcional por período;
- `POST /api/v1/alugueis/acervo` — novo item;
- `PATCH /api/v1/alugueis/acervo/{id}` — edição, status e ativação/inativação;
- `POST /api/v1/alugueis/acervo/upload-foto` — upload da foto principal do item.

### Pedidos — extensão do router existente

O mesmo `POST /api/v1/pedidos` recebe, quando `modalidade=aluguel`:

- datas de retirada/devolução;
- caução;
- lista de `acervo_item_id` e preço negociado opcional.

O serviço valida conflito de datas numa transação antes de gravar. O mesmo
`PATCH /pedidos/{id}` edita o aluguel, mantendo a experiência atual de edição.

Não criar um endpoint separado de pagamento: o aluguel continua gerando
parcelas em `/pedidos/{id}/pagamento`.

### Provas, termos e aceite — extensão vinculada ao Pedido

- `POST /api/v1/pedidos/{pedido_id}/provas` — cria termo de retirada ou devolução;
- `POST /api/v1/provas/{prova_id}/midias` — adiciona fotos antes da finalização;
- `POST /api/v1/provas/{prova_id}/convite` — congela o resumo e gera link temporário;
- `POST /api/v1/provas/{prova_id}/cancelar-convite` — invalida o link atual;
- `GET /api/v1/aceites/{token}` — acesso público mínimo ao resumo;
- `POST /api/v1/aceites/{token}/aceitar` — nome, checkbox e confirmação explícita;
- `POST /api/v1/aceites/{token}/correcao` — pedido de correção;
- `POST /api/v1/aceites/{token}/discordar` — discordância registrada;
- `GET /api/v1/provas/{prova_id}/documento` — PDF e metadados de integridade.

O token bruto não será persistido nem aparecerá em logs. As rotas públicas terão
rate limit, validade curta, resposta neutra para token inválido e acesso somente
aos dados indispensáveis daquela versão do termo.

## Telas e conexões

### Pedidos Ativos

Alterar somente o necessário em `mobile/pedidos`:

- adicionar filtro `Todos / Confecção / Aluguel`;
- exibir badge de modalidade;
- para aluguel, trocar “Entrega” por “Retirada/Devolução”;
- manter busca, cards, pagamento, edição e ações existentes.

### Novo/Editar Pedido

Manter `mobile/pedidos/novo` e `mobile/pedidos/[id]`:

- seleção inicial de modalidade;
- campos de confecção continuam iguais;
- campos de aluguel aparecem condicionalmente;
- seletor chama `/api/v1/alugueis/acervo?data_retirada=&data_devolucao=` usando as datas informadas;
- salvar chama o mesmo endpoint de pedidos.

### Detalhe do Pedido de aluguel

Em `mobile/pedidos/[id]`, depois de **Itens reservados** e antes de
**Financeiro**, adicionar o bloco **Retirada, devolução e aceite**. Ele mostra:

- situação do termo de retirada e do termo de devolução;
- quantidade de fotos e checks de cada registro;
- estado do convite: rascunho, link gerado, visualizado, aceito, correção
  solicitada, discordância ou expirado;
- ações contextuais: `Registrar retirada`, `Compartilhar termo`,
  `Registrar devolução`, `Ver documento` e `Criar retificação`.

Não haverá nova aba principal. A cliente e a equipe sempre chegam ao recurso a
partir do Pedido existente.

### Registro de retirada/devolução

O formulário abre a partir do detalhe do aluguel e usa os itens já reservados.
Para cada item, os checks iniciais serão:

- peça/acessório correto e quantidade conferida;
- estado geral, manchas, rasgos, fechos e acabamentos;
- acessórios e componentes entregues;
- fotos com legenda;
- observações combinadas;
- condição da caução e eventual impacto financeiro;
- data prevista de devolução confirmada.

Na devolução, os mesmos itens aparecem lado a lado com o estado registrado na
retirada, reduzindo digitação e permitindo comparar fotos.

### Revisão e compartilhamento manual

Ao finalizar a revisão, o sistema congela o resumo e oferece:

- `Compartilhar no WhatsApp` — abre `wa.me` com o telefone da cliente e texto
  pronto; a atendente ainda escolhe a conversa e pressiona enviar;
- `Copiar link` — alternativa para outro canal;
- `Aceite presencial neste aparelho` — abre a mesma página pública para a
  cliente revisar no celular do ateliê, identificado como fluxo assistido.

Texto inicial sugerido:

> Olá, {nome}. Segue o resumo da {retirada/devolução} do seu aluguel no Ateliê
> Ilma Guerra. Confira as fotos e condições registradas. Você pode concordar ou
> pedir uma correção neste link: {link}. O link é individual e expira em 48 horas.

A página da cliente não exige conta. Ela mostra somente aquele resumo, permite
`Pedir correção`, `Não concordo` ou `Li e estou de acordo`, pede nome completo e
registra data/hora, versão do texto, hash do resumo e contexto técnico mínimo.
Sem segundo fator, o produto deve comunicar esse registro como **aceite por link
individual**, e não como identidade verificada por SMS ou assinatura qualificada.

### Acervo

O acervo fica na visão dedicada de `mobile/alugueis?acervo=1`, acessada pelo menu lateral:

- lista, busca e filtros;
- cadastro e edição no mesmo padrão visual de clientes/parâmetros;
- status de disponibilidade;
- histórico de aluguéis ao abrir um item.

### Outras áreas

- Clientes: histórico existente passa a identificar aluguéis.
- Financeiro: pagamentos de aluguel entram automaticamente porque continuam
  ligados a `pedido_id`.
- Dashboard/plano: excluir aluguéis dos KPIs de horas e produção; manter opção
  de receita consolidada.
- Calendário: segunda etapa, usando as datas dos pedidos de ambas as modalidades.
- Atendimento: nenhuma alteração nesta fase.

## Migração e segurança da produção

- Criar uma migração idempotente explícita para as colunas e tabelas novas.
- `modalidade` dos pedidos existentes deve ser preenchida como `confeccao`.
- Não alterar nenhum valor, parcela ou status legado.
- Bloquear sobreposição de reserva no backend, não apenas na tela.
- Registrar criar/editar/status/cancelar/devolver no histórico atual.
- Não permitir editar o termo enquanto houver convite válido; cancelar o convite
  e gerar nova versão quando o conteúdo precisar mudar.
- Não expor telefone completo, pagamentos ou outros dados do Pedido na página
  pública da cliente.
- Testar: pedido legado, disponibilidade, conflito de datas, cancelamento,
  devolução, caução, pagamento parcelado, expiração/cancelamento do link, pedido
  de correção, discordância, aceite, PDF e tentativa de edição posterior.

## Resultado

A primeira implementação acrescenta um domínio de dados pequeno, a tela de
acervo e uma jornada interna de registro/aceite, mas continua usando a mesma
aplicação, banco, autenticação, clientes, pedidos, pagamentos, histórico e padrão
de edição. A página pública da cliente é uma rota mínima do mesmo frontend. Não
há novo app, novo backend ou integração externa obrigatória nesta fase.
