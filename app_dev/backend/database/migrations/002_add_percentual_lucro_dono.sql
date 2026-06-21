-- Migration 002: adiciona percentual_lucro_dono na tabela pedidos
-- Rodar na VM: psql $DATABASE_URL -f 002_add_percentual_lucro_dono.sql
-- 50% para Ajustes, 100% para o resto (backfill automático)

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS percentual_lucro_dono FLOAT DEFAULT 100.0;

UPDATE pedidos
SET percentual_lucro_dono = 50.0
FROM tipo_pedido
WHERE pedidos.tipo_pedido_id = tipo_pedido.id
  AND LOWER(tipo_pedido.nome) = 'ajustes'
  AND pedidos.percentual_lucro_dono IS NULL;

UPDATE pedidos SET percentual_lucro_dono = 100.0 WHERE percentual_lucro_dono IS NULL;
