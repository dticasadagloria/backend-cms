-- Adiciona colunas para guardar o nome e contacto do solicitante público
-- (requisições submetidas pelo URL público sem autenticação)
ALTER TABLE requisicoes
  ADD COLUMN IF NOT EXISTS nome_solicitante    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contacto_solicitante VARCHAR(50);
