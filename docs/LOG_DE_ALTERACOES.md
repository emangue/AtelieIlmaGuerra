# Log de alterações — quem mudou o quê

## Por que

A Neusa (assessora de IA do ateliê, `ProjetoNeusa`) vai passar a escrever no
app pela API — mudar status de pedido, criar pedido, editar cliente, anexar
foto. Ela vai logar com uma conta própria (`role="user"`, distinta da conta
da Ilma), justamente para dar pra separar "isso a Ilma mudou" de "isso a
Neusa mudou". Mas hoje o app **não registra quem fez cada alteração** — o
usuário autenticado é exigido em todo endpoint de escrita, mas o `user_id`
nunca é salvo em lugar nenhum.

Confirmado lendo o backend: todo router de escrita já teria o
`user_id` disponível via `get_user_id_from_token` (é dependência obrigatória
em `clientes`, `orcamentos`, `parametros`, `contracts`, `plano`,
`pagamentos`; em `pedidos` está por rota). Só falta usar esse dado.

## O que precisamos

Um log de alterações genérico — não só pra pedido, pra **qualquer coisa do
app** que um usuário (Ilma, Neusa, ou qualquer conta futura) criar, editar
ou apagar. No mínimo:

- **quem**: `user_id` + nome (pra aparecer "Ilma Guerra" ou "Neusa", não um
  número)
- **o quê**: em qual tabela/domínio (pedido, cliente, orçamento, despesa,
  parâmetro, contrato, plano_item, pagamento) e o id do registro
- **que tipo de mudança**: criou, editou, mudou status, apagou
- **quando**: timestamp
- idealmente, **o que mudou de fato** — de/para nos campos alterados (não
  precisa ser todo campo do banco; um resumo tipo `{"status": {"de":
  "Provado", "para": "Pronto"}}` já resolve 90% do caso de uso)

## Proposta de modelo de dados

Uma tabela só, reaproveitada por todos os domínios — não uma tabela de
histórico por domínio:

```python
class HistoricoAlteracao(Base):
    __tablename__ = "historico_alteracoes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_nome = Column(String(200), nullable=False)   # desnormalizado — nome não muda se o usuário for desativado depois
    entidade = Column(String(50), nullable=False)      # "pedido", "cliente", "orcamento", "despesa", "parametro", "contrato", "plano_item", "pagamento"
    entidade_id = Column(Integer, nullable=True)        # null em ações que não têm um id único (ex: copiar-mes)
    acao = Column(String(30), nullable=False)           # "criou", "editou", "mudou_status", "apagou"
    resumo = Column(Text, nullable=True)                 # texto curto, tipo "status: Provado → Pronto"
    diff_json = Column(Text, nullable=True)              # JSON: {"campo": {"de": ..., "para": ...}, ...}
    criado_em = Column(DateTime, default=datetime.utcnow)
```

Índice em `(entidade, entidade_id)` pra consultar "todo histórico do pedido
#412" rápido, e em `criado_em` pra listar por período.

## Como aplicar sem reescrever cada endpoint

Um helper único, chamado de dentro de cada rota de escrita — não um
middleware genérico automático (não dá pra montar um diff decente sem saber
a forma de cada entidade), mas um helper pequeno que cada rota chama
explicitamente:

```python
def registrar_alteracao(
    db: Session, *, user_id: int, user_nome: str,
    entidade: str, entidade_id: int | None, acao: str,
    resumo: str = "", antes: dict | None = None, depois: dict | None = None,
) -> None:
    diff = _montar_diff(antes, depois) if antes and depois else None
    db.add(HistoricoAlteracao(
        user_id=user_id, user_nome=user_nome, entidade=entidade,
        entidade_id=entidade_id, acao=acao, resumo=resumo,
        diff_json=json.dumps(diff, ensure_ascii=False) if diff else None,
    ))
```

E cada endpoint de escrita chama isso antes do `commit()`. Prioridade de
onde ligar primeiro (pela ordem em que a Neusa vai escrever, ver
`ProjetoNeusa/PLANO.md` seção 4):

1. `pedidos/router.py` — `PATCH /{id}/status`, `PATCH /{id}`, `POST`,
   `POST /upload-foto`, `DELETE`
2. `clientes/router.py` — `POST`, `PATCH`, `DELETE`
3. Resto dos domínios de escrita (`orcamentos`, `despesas`, `parametros`,
   `contracts`, `plano`, `pagamentos`) — pode entrar depois, mas a tabela
   já nasce genérica pra cobrir todos sem redesenho.

## Achado à parte — corrigir junto

`despesas/router.py` **não exige autenticação** (não tem
`Depends(get_user_id_from_token)` em lugar nenhum) — os outros seis routers
de escrita todos exigem. Sem usuário autenticado não dá pra saber quem
editou uma despesa, e de quebra qualquer um com a URL consegue mexer nela
sem login. Vale corrigir isso junto, é o mesmo tipo de buraco.

## Pra depois (não bloqueia o essencial acima)

- Endpoint `GET /historico?entidade=pedido&entidade_id=412` pra listar o
  histórico de um registro — a Neusa e o app front-end os dois se
  beneficiam disso.
- Tela no app mostrando o histórico (ex: aba "Histórico" no detalhe do
  pedido).
- Se um dia `pedidos`/outras tabelas quiserem guardar `criado_por`/
  `atualizado_por` direto no próprio registro (mais rápido de consultar que
  juntar com o histórico) — mas isso é otimização, o log já resolve o
  requisito de rastreabilidade sozinho.

## Contexto de segurança, só pra registrar

Enquanto estava explorando o backend pra este pedido, notei que
`app_dev/backend/app/domains/users/seed.py` tem o e-mail e a senha do
usuário admin (a conta da Ilma) em texto puro, direto no código-fonte.
Não é o foco deste documento, mas vale considerar trocar essa senha e não
deixar credencial em texto puro versionada.
