-- ═══════════════════════════════════════════════════════════════════════════
-- Geração automática e centralizada do "codigo" das crianças (C001, C002...)
--
-- Antes: só o backend gerava (gerarProximoCodigo() em criancaModel.js, com
-- SELECT ... ORDER BY id DESC LIMIT 1), por isso qualquer insert feito fora
-- da API (ex: os 122 registos históricos inseridos directo por SQL) ficava
-- com codigo = NULL. A partir daqui a geração vive na base de dados, via
-- trigger + sequence — funciona sempre, venha o insert de onde vier, e é
-- seguro sob inserts concorrentes (a sequence é atómica; "MAX + 1" não era).
--
-- Seguro correr mais que uma vez (idempotente).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Backfill dos registos existentes sem código, por ordem de criação (id),
--    continuando a partir do maior código numérico já em uso.
DO $$
DECLARE
  proximo INTEGER;
  r RECORD;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(codigo FROM 2)::INTEGER), 0) + 1
    INTO proximo
    FROM criancas
    WHERE codigo ~ '^C[0-9]+$';

  FOR r IN
    SELECT id FROM criancas WHERE codigo IS NULL ORDER BY id ASC
  LOOP
    UPDATE criancas SET codigo = 'C' || LPAD(proximo::TEXT, 3, '0') WHERE id = r.id;
    proximo := proximo + 1;
  END LOOP;
END $$;

-- 2. A partir daqui, código é sempre único e obrigatório.
CREATE UNIQUE INDEX IF NOT EXISTS criancas_codigo_unique_idx ON criancas (codigo);
ALTER TABLE criancas ALTER COLUMN codigo SET NOT NULL;

-- 3. Sequence para gerar a parte numérica — atómica, sem risco de colisão
--    em inserts concorrentes (ao contrário de "SELECT MAX(...) + 1").
--    Arranca a seguir ao maior código já existente (incluindo o backfill acima).
CREATE SEQUENCE IF NOT EXISTS criancas_codigo_seq;
SELECT setval(
  'criancas_codigo_seq',
  (SELECT COALESCE(MAX(SUBSTRING(codigo FROM 2)::INTEGER), 0) FROM criancas WHERE codigo ~ '^C[0-9]+$')
);

-- 4. Trigger: só gera código se vier NULL — se algum caller (backend ou SQL
--    directo) mandar um código explícito, respeita-o; senão gera um novo.
--    Isto é o que garante que a geração "não pode ser saltada": corre para
--    QUALQUER insert na tabela, independentemente de passar pela API.
CREATE OR REPLACE FUNCTION gerar_codigo_crianca()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo IS NULL THEN
    NEW.codigo := 'C' || LPAD(nextval('criancas_codigo_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_codigo_crianca ON criancas;
CREATE TRIGGER trg_gerar_codigo_crianca
  BEFORE INSERT ON criancas
  FOR EACH ROW
  EXECUTE FUNCTION gerar_codigo_crianca();
