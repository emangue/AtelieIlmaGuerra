# Site de atendimento — `atendimento.atelieilmaguerra.com.br`

App separado para quem ajuda a Ilma no balcão: cadastrar clientes e registrar
pedidos/orçamentos que entram numa fila de aprovação. Quem atende **não vê**
faturamento, margem, custo de materiais, plano financeiro, despesas nem
parâmetros de precificação.

O isolamento é **estrutural, não uma permissão**: este backend simplesmente não
tem model nem rota para esses dados. Não existe checagem para alguém esquecer ao
criar uma rota nova.

```
app_atendimento/
├── backend/    FastAPI  :8002  — auth, clientes, catálogo, atendimentos, histórico
└── frontend/   Next 15  :3005  — login, clientes, novo, enviados, histórico
```

## Como conversa com o app de gestão (`../app_dev`)

Os dois processos abrem **o mesmo arquivo SQLite**
(`app_dev/backend/database/atelie.db`), mas com visões diferentes:

| Tabela | Gestão | Atendimento |
|---|---|---|
| `users`, `clientes` | leitura e escrita | leitura e escrita |
| `tipo_pedido`, `forma_peca` | leitura e escrita | leitura (sem as colunas de meta) |
| `pedidos_atendimento` | lê e aprova/recusa | cria e edita enquanto pendente |
| `historico_alteracoes` | vê tudo | só as linhas com `app='atendimento'` |
| `pedidos`, `plano_itens`, `pagamentos`, `despesas`, `parametros`, … | acesso total | **não existem aqui** |

### Duas regras que não podem ser quebradas

1. **Só o gestão faz DDL.** Este app nunca roda `Base.metadata.create_all` nem
   migration. Ao adicionar coluna, mexa em `app_dev` e reinicie aquele backend
   primeiro — ele é o dono do schema.
2. **`JWT_SECRET_KEY` diferente do gestão.** Junto com a claim `app` no token
   (`"gestao"` vs `"atendimento"`), é o que impede uma sessão de um site valer no
   outro. Ver `app/domains/auth/jwt_utils.py`.

## Arquivos espelhados

Alguns arquivos são cópia literal de `app_dev` e trazem uma nota `ESPELHO de …`
no topo: models de `users`, `clientes` e `historico_alteracoes`, mais
`password_utils`, `rate_limit`, `roles` e os schemas de cliente. **Mexeu lá,
mexa aqui.** É o preço do isolamento — a alternativa seria um pacote
compartilhado, que reabriria o acoplamento que este app existe para evitar.

## Perfis de acesso

| Role | Gestão | Atendimento |
|---|---|---|
| `admin` (Ilma) | entra | entra |
| `user` | entra | 403 |
| `atendimento` (ajudante) | 403 | entra |

O login do ajudante é criado pela própria Ilma, na tela **Perfil** do sistema de
gestão, escolhendo a função "Atendimento".

## Fluxo

1. Ajudante busca ou cadastra a cliente e registra o pedido/orçamento — sem
   nenhum campo de custo. As medidas já salvas na ficha vêm preenchidas.
2. O registro nasce `pendente`. Enquanto está pendente, dá para editar e
   cancelar; depois de revisado, fica só leitura.
3. A Ilma abre `/mobile/atendimento` no gestão, completa custos e valor, e
   aprova → nasce um `Pedido` de verdade pelo mesmo `PedidoService.create` do
   formulário normal (margem, snapshot de parâmetros e avisos de pedido atípico
   inclusos). Ou recusa com um motivo, que volta para o atendimento.
4. Tudo que foi feito neste site aparece em `/historico`, com autor e o diff.

## Rodando local

Os dois apps sobem juntos por `.claude/launch.json`:
`backend` :8001, `frontend` :3001, `backend-atendimento` :8002,
`frontend-atendimento` :3005.

```bash
cd app_atendimento/frontend && npm install && npm run dev
```

O backend reaproveita o venv do gestão em dev (as dependências são as mesmas);
na VM cada um tem o seu. Deploy: `/deploy-atelie`, seção "Deploy do site de
atendimento".
