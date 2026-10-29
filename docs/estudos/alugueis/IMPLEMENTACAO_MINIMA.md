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
- Testar: pedido legado, disponibilidade, conflito de datas, cancelamento,
  devolução, caução e pagamento parcelado.

## Resultado

A primeira implementação acrescenta um domínio de dados pequeno e duas telas
novas, mas continua usando a mesma aplicação, banco, autenticação, clientes,
pedidos, pagamentos, histórico e padrão de edição. Não há novo frontend, novo
backend ou nova integração externa.
