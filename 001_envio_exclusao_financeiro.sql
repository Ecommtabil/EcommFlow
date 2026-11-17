-- =====================================================================
-- Migração 001 – EcommFlow
--  * Cadastro de empresas: MEIO DE ENVIO, CONTATO, ramo HOLDING, exclusão (mantendo histórico)
--  * Acesso ao Módulo Financeiro por usuário (inicial: Junior e Eliezer)
--  * Cobranças: gerar boleto todo dia 01 e enviar 2 dias antes do vencimento
-- Segura para rodar em produção: não apaga dados e pode ser executada mais de uma vez.
-- =====================================================================

-- Controle de migrações aplicadas
CREATE TABLE IF NOT EXISTS schema_migracoes (
    nome         VARCHAR(80) PRIMARY KEY,
    aplicada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 1. Estrutura (idempotente)
-- ---------------------------------------------------------------------
ALTER TABLE clientes   ADD COLUMN IF NOT EXISTS meio_envio  VARCHAR(30);
ALTER TABLE clientes   ADD COLUMN IF NOT EXISTS contato     VARCHAR(160);
ALTER TABLE clientes   ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ;
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS acesso_financeiro BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_meio_envio_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_meio_envio_check CHECK (meio_envio IN
    ('E-MAIL', 'WHATSAPP', 'E-MAIL E WHATSAPP', 'PORTAL', 'DOCUMENTO FISICO', 'OUTRO'));

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_ramo_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_ramo_check CHECK (ramo IN
    ('INDUSTRIA', 'COMERCIO', 'SERVICO', 'COMERCIO E SERVICO', 'INDUSTRIA E COMERCIO',
     'TRANSPORTE', 'LOCACAO/ALUGUEL', 'HOLDING'));

CREATE INDEX IF NOT EXISTS idx_clientes_ativos ON clientes (escritorio_id) WHERE excluido_em IS NULL;

-- Departamentos restritos (FINANCEIRO): responsável precisa ter acesso ao Financeiro
CREATE OR REPLACE FUNCTION trg_tarefas_permissao() RETURNS TRIGGER AS $$
DECLARE u operadores; dest operadores; restrito BOOLEAN;
BEGIN
    SELECT * INTO dest FROM operadores WHERE id = NEW.operador_id;
    IF dest.escritorio_id <> NEW.escritorio_id THEN
        RAISE EXCEPTION 'Responsável não pertence a este escritório';
    END IF;
    SELECT restrito_gestor INTO restrito FROM departamentos WHERE id = NEW.departamento_id;
    -- verifica só na criação ou quando o responsável/departamento muda (tarefas antigas continuam editáveis)
    IF restrito AND NOT dest.acesso_financeiro AND (TG_OP = 'INSERT' OR NEW.operador_id IS DISTINCT FROM OLD.operador_id
                                                   OR NEW.departamento_id IS DISTINCT FROM OLD.departamento_id) THEN
        RAISE EXCEPTION 'Tarefas do Financeiro só podem ser atribuídas a usuários com acesso ao Módulo Financeiro';
    END IF;

    IF operador_atual() IS NULL THEN RETURN NEW; END IF;   -- processos automáticos
    SELECT * INTO u FROM operadores WHERE id = operador_atual();
    IF TG_OP = 'INSERT' THEN
        NEW.criado_por := u.id;
        RETURN NEW;
    END IF;
    IF u.perfil <> 'gestor' THEN
        IF NEW.operador_id IS DISTINCT FROM OLD.operador_id AND OLD.operador_id <> u.id THEN
            RAISE EXCEPTION 'Operadores só podem transferir as próprias tarefas';
        END IF;
        IF NEW.conferida_por IS DISTINCT FROM OLD.conferida_por THEN
            RAISE EXCEPTION 'Somente gestores podem conferir tarefas';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rotinas de clientes excluídos não geram mais tarefas
CREATE OR REPLACE FUNCTION gerar_tarefas(hoje DATE DEFAULT CURRENT_DATE) RETURNS INT AS $$
DECLARE r RECORD; qtd INT := 0;
BEGIN
    FOR r IN SELECT ro.id FROM rotinas ro LEFT JOIN clientes c ON c.id = ro.cliente_id
              WHERE ro.ativa AND c.excluido_em IS NULL LOOP
        IF gerar_tarefa_rotina(r.id, hoje) IS NOT NULL THEN qtd := qtd + 1; END IF;
    END LOOP;
    RETURN qtd;
END;
$$ LANGUAGE plpgsql;

-- Exclusão segura: remove o que é futuro/em aberto e mantém o histórico passado
CREATE OR REPLACE FUNCTION excluir_rotina(p_rotina INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM boletos b USING tarefas t
     WHERE t.rotina_id = p_rotina AND t.status <> 'concluida'
       AND (b.tarefa_gerar_id = t.id OR b.tarefa_enviar_id = t.id)
       AND b.enviado_em IS NULL AND b.pago_em IS NULL;
    DELETE FROM tarefas WHERE rotina_id = p_rotina AND status <> 'concluida';
    UPDATE tarefas SET rotina_id = NULL WHERE rotina_id = p_rotina;   -- histórico concluído fica
    DELETE FROM rotinas WHERE id = p_rotina;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION excluir_boleto(p_boleto INT) RETURNS BOOLEAN AS $$
DECLARE b boletos;
BEGIN
    SELECT * INTO b FROM boletos WHERE id = p_boleto;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF b.enviado_em IS NOT NULL OR b.pago_em IS NOT NULL THEN
        RAISE EXCEPTION 'Boletos já enviados ou recebidos fazem parte do histórico e não podem ser excluídos';
    END IF;
    DELETE FROM boletos WHERE id = p_boleto;
    DELETE FROM tarefas WHERE id IN (b.tarefa_gerar_id, b.tarefa_enviar_id) AND status <> 'concluida';
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION excluir_cobranca(p_cobranca INT) RETURNS VOID AS $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM rotinas WHERE cobranca_id = p_cobranca LOOP
        PERFORM excluir_rotina(r.id);
    END LOOP;
    DELETE FROM boletos WHERE cobranca_id = p_cobranca AND enviado_em IS NULL AND pago_em IS NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION excluir_cliente(p_cliente INT) RETURNS VOID AS $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM rotinas WHERE cliente_id = p_cliente LOOP
        PERFORM excluir_rotina(r.id);
    END LOOP;
    DELETE FROM boletos WHERE cliente_id = p_cliente AND enviado_em IS NULL AND pago_em IS NULL;
    DELETE FROM tarefas WHERE cliente_id = p_cliente AND status <> 'concluida';
    UPDATE clientes SET excluido_em = now(), ativo = FALSE WHERE id = p_cliente;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 2. Ajustes de dados (executados UMA única vez)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migracoes WHERE nome = '001_envio_exclusao_financeiro') THEN
        RAISE NOTICE 'Migração 001 já aplicada anteriormente - ajustes de dados ignorados.';
        RETURN;
    END IF;

    -- Acesso ao Financeiro: Junior e Eliezer
    UPDATE operadores SET acesso_financeiro = TRUE WHERE usuario IN ('Junior', 'Eliezer');

    -- Cobranças: gerar todo dia 01; enviar 2 dias antes do vencimento do boleto
    UPDATE rotinas SET dia_mes = 1 WHERE acao_financeira = 'gerar_boleto' AND periodicidade <> 'unica';
    UPDATE rotinas SET dia_mes = GREATEST(dia_vencimento_boleto - 2, 1)
     WHERE acao_financeira = 'enviar_boleto' AND periodicidade <> 'unica' AND dia_vencimento_boleto IS NOT NULL;

    -- Tarefas em aberto dessas cobranças: novos prazos
    UPDATE tarefas t SET prazo = date_trunc('month', b.vencimento)::date
      FROM boletos b
     WHERE b.tarefa_gerar_id = t.id AND t.status <> 'concluida' AND b.gerado_em IS NULL;
    UPDATE tarefas t SET prazo = GREATEST(b.vencimento - 2, date_trunc('month', b.vencimento)::date)
      FROM boletos b
     WHERE b.tarefa_enviar_id = t.id AND t.status <> 'concluida' AND b.enviado_em IS NULL;
    UPDATE tarefas SET status = 'pendente' WHERE status = 'atrasada' AND prazo >= CURRENT_DATE;
    UPDATE tarefas SET status = 'atrasada' WHERE status IN ('pendente','em_andamento') AND prazo < CURRENT_DATE;

    INSERT INTO schema_migracoes (nome) VALUES ('001_envio_exclusao_financeiro');
END $$;
