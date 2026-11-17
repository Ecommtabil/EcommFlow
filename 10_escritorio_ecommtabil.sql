-- Licença: Ecommtabil
INSERT INTO escritorios (nome, slug, cnpj) VALUES ('Ecommtabil', 'ecommtabil', '37.199.856/0001-48');
SELECT set_config('app.escritorio_id', (SELECT id::text FROM escritorios WHERE slug = 'ecommtabil'), false);

INSERT INTO departamentos (nome, restrito_gestor) VALUES
    ('RECURSOS HUMANOS', FALSE), ('CONSULTORIA EMPRESARIAL', FALSE), ('SOCIETARIO', FALSE),
    ('DEPARTAMENTO PESSOAL', FALSE), ('FISCAL', FALSE), ('CONTABIL', FALSE),
    ('TRIAGEM DE DOCUMENTOS', FALSE), ('FINANCEIRO', TRUE);

-- Usuários (senhas NÃO ficam neste arquivo: definir com  npm run senha -- <usuario>)
INSERT INTO operadores (nome, usuario, email, perfil) VALUES
    ('Junior',    'Junior',    'fiscal@ecommtabil.com.br', 'gestor'),
    ('Eliezer',   'Eliezer',   NULL, 'gestor'),
    ('Pedrinho',  'Pedrinho',  NULL, 'operador'),
    ('Elaine',    'Elaine',    NULL, 'operador'),
    ('Jaqueline', 'Jaqueline', NULL, 'operador'),
    ('Caio',      'Caio',      NULL, 'operador'),
    ('Leonardo',  'Leonardo',  NULL, 'operador');
