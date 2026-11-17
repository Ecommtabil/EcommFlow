-- =====================================================================
-- Migração 002 – Módulo Ferramentas: Cálculo do Simples Nacional
-- Idempotente: pode ser executada mais de uma vez. Não altera dados existentes.
-- =====================================================================
CREATE TABLE IF NOT EXISTS schema_migracoes (
    nome        VARCHAR(120) PRIMARY KEY,
    aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um cálculo por empresa (cliente do cadastro) e ano-calendário.
-- As receitas, o RBT12 manual, o ano anterior, a prévia da projeção e as conferências ficam em "dados" (JSON).
-- Resultados (DAS, alíquotas, partilha) NÃO são gravados: são sempre recalculados pelo motor.
CREATE TABLE IF NOT EXISTS sn_calculos (
    id             SERIAL PRIMARY KEY,
    escritorio_id  INT NOT NULL REFERENCES escritorios(id),
    cliente_id     INT NOT NULL REFERENCES clientes(id),
    ano            SMALLINT NOT NULL CHECK (ano BETWEEN 2018 AND 2100),
    dados          JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_por     INT REFERENCES operadores(id) ON DELETE SET NULL,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_por INT REFERENCES operadores(id) ON DELETE SET NULL,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cliente_id, ano)
);
CREATE INDEX IF NOT EXISTS sn_calculos_esc_idx ON sn_calculos (escritorio_id, ano);

-- Tabelas do Simples versionadas por ano (por escritório). Sem linhas = usa a padrão LC 123/2006 (2025) do sistema.
CREATE TABLE IF NOT EXISTS sn_tabelas (
    escritorio_id  INT NOT NULL REFERENCES escritorios(id),
    ano            SMALLINT NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
    tabela         JSONB NOT NULL,
    atualizado_por INT REFERENCES operadores(id) ON DELETE SET NULL,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (escritorio_id, ano)
);

INSERT INTO schema_migracoes (nome) VALUES ('002_ferramentas_simples_nacional') ON CONFLICT DO NOTHING;
