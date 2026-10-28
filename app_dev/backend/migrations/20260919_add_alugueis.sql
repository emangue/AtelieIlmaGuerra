-- Migração aditiva. O startup do FastAPI também cria estas tabelas via SQLAlchemy.
CREATE TABLE IF NOT EXISTS itens_acervo (
  id INTEGER PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(30) NOT NULL,
  tamanho VARCHAR(30), cor VARCHAR(80), valor_reposicao FLOAT,
  observacao TEXT, ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alugueis (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  data_reserva DATE NOT NULL, data_retirada DATE NOT NULL,
  data_devolucao_prevista DATE NOT NULL, data_retirada_real DATE,
  data_devolucao_real DATE, status VARCHAR(30) NOT NULL DEFAULT 'Reservado',
  valor_total FLOAT NOT NULL DEFAULT 0, valor_caucao FLOAT NOT NULL DEFAULT 0,
  forma_pagamento VARCHAR(50), observacao TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aluguel_itens (
  id INTEGER PRIMARY KEY,
  aluguel_id INTEGER NOT NULL REFERENCES alugueis(id) ON DELETE CASCADE,
  item_acervo_id INTEGER NOT NULL REFERENCES itens_acervo(id),
  valor_aluguel FLOAT NOT NULL DEFAULT 0,
  CONSTRAINT uq_aluguel_item UNIQUE (aluguel_id, item_acervo_id)
);

CREATE INDEX IF NOT EXISTS ix_alugueis_cliente_id ON alugueis(cliente_id);
CREATE INDEX IF NOT EXISTS ix_alugueis_data_retirada ON alugueis(data_retirada);
CREATE INDEX IF NOT EXISTS ix_alugueis_status ON alugueis(status);
CREATE INDEX IF NOT EXISTS ix_aluguel_itens_item_acervo_id ON aluguel_itens(item_acervo_id);
