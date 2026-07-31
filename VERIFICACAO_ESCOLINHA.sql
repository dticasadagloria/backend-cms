-- 1. Confirma se role_id=5 está livre
SELECT * FROM roles ORDER BY id;

-- 2. Confirma se já há dados reais em presencas_escolinha (decide o backfill)
SELECT COUNT(*) AS total_registos,
       COUNT(DISTINCT data_presenca) AS dias_distintos,
       MIN(data_presenca) AS primeiro,
       MAX(data_presenca) AS ultimo
FROM presencas_escolinha;

-- 3. Se houver registos, mostra-os agrupados para decidires a filial de backfill
SELECT data_presenca, turma, COUNT(*) AS presencas
FROM presencas_escolinha
GROUP BY data_presenca, turma
ORDER BY data_presenca DESC;
