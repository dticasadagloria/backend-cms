-- ═══════════════════════════════════════════════════════════════════════════
-- Migração: sistema de "Aulas" para a Escolinha da Verdade
-- Corre este ficheiro por ordem, no Neon SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Novo role "Escolinha" (id=5, confirmado livre)
INSERT INTO roles (id, nome) VALUES (5, 'Escolinha')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de aulas (equivalente a "cultos", mas própria da Escolinha)
CREATE TABLE aulas (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER NOT NULL REFERENCES branches(id),
  data          DATE NOT NULL,
  horario       TIME,
  turma         VARCHAR(20) NOT NULL CHECK (turma IN ('Pequenos','Grandes')),
  tema          VARCHAR(150),
  professor     VARCHAR(150),
  observacoes   TEXT,
  criado_por    INTEGER REFERENCES users(id),
  criado_em     TIMESTAMP DEFAULT now()
);

-- 3. Liga presencas_escolinha a aulas
ALTER TABLE presencas_escolinha ADD COLUMN aula_id INTEGER REFERENCES aulas(id);

-- 4. Backfill do único registo histórico (2026-07-26, Pequenos, filial Zimpeto)
INSERT INTO aulas (branch_id, data, turma, tema, observacoes)
VALUES (8, '2026-07-26', 'Pequenos', NULL, 'Migrado do registo histórico único de presencas_escolinha')
RETURNING id;
-- ↑ Guarda o "id" devolvido aqui (ex: 1) e usa-o no UPDATE abaixo em vez de <AULA_ID>.

UPDATE presencas_escolinha
SET aula_id = <AULA_ID>
WHERE data_presenca = '2026-07-26' AND turma = 'Pequenos';

-- 5. Confirma que todas as linhas ficaram ligadas antes de continuar
SELECT COUNT(*) AS sem_aula_id FROM presencas_escolinha WHERE aula_id IS NULL;
-- ↑ Se isto não der 0, PARA aqui e investiga antes de avançar para o passo 6.

-- 6. Torna aula_id obrigatório e a chave de unicidade correta
ALTER TABLE presencas_escolinha ALTER COLUMN aula_id SET NOT NULL;
ALTER TABLE presencas_escolinha DROP CONSTRAINT IF EXISTS presencas_escolinha_crianca_id_data_presenca_key;
ALTER TABLE presencas_escolinha ADD CONSTRAINT presencas_escolinha_crianca_aula_key UNIQUE (crianca_id, aula_id);

-- 7. Remove as colunas antigas, agora redundantes (info já vem de aulas via JOIN)
ALTER TABLE presencas_escolinha DROP COLUMN data_presenca;
ALTER TABLE presencas_escolinha DROP COLUMN turma;

-- ═══════════════════════════════════════════════════════════════════════════
-- Extra: campo "idade" (inteiro) em vez de "data_nascimento" no cadastro de crianças
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE criancas ADD COLUMN idade INTEGER;
ALTER TABLE criancas DROP COLUMN data_nascimento;
