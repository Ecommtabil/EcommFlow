-- Gera as tarefas do próximo ciclo de todas as rotinas (forçando, mesmo fora da janela de antecedência)
SELECT count(gerar_tarefa_rotina(id, CURRENT_DATE, TRUE)) AS tarefas_criadas FROM rotinas WHERE ativa;
