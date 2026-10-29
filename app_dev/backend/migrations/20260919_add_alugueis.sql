-- Aluguéis são Pedidos: compartilham cliente, histórico, contratos e pagamentos.
-- Em bancos existentes, as colunas de pedidos são adicionadas idempotentemente
-- pelo startup da API; este arquivo documenta/cria as tabelas auxiliares.
CREATE TABLE IF NOT EXISTS itens_acervo (
  id INTEGER PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(30) NOT NULL,
  tamanho VARCHAR(30), cor VARCHAR(80), valor_aluguel_padrao FLOAT,
  valor_reposicao FLOAT, status_item VARCHAR(30) NOT NULL DEFAULT 'disponivel',
  foto_url VARCHAR(500),
  observacao TEXT, ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedido_acervo_itens (
  id INTEGER PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_acervo_id INTEGER NOT NULL REFERENCES itens_acervo(id),
  valor_aluguel FLOAT NOT NULL DEFAULT 0,
  observacao_retirada TEXT,
  observacao_devolucao TEXT,
  valor_dano FLOAT,
  CONSTRAINT uq_pedido_acervo_item UNIQUE (pedido_id, item_acervo_id)
);

CREATE INDEX IF NOT EXISTS ix_pedido_acervo_itens_pedido_id ON pedido_acervo_itens(pedido_id);
CREATE INDEX IF NOT EXISTS ix_pedido_acervo_itens_item_acervo_id ON pedido_acervo_itens(item_acervo_id);
