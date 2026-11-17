'use server';
import { exigirGestor } from '@/lib/auth';
import { ErroNegocio, bool, executar, num, txt } from '@/lib/acao';
import { revalidatePath } from 'next/cache';
import { msgErro, q, q1, tx } from '@/lib/db';
import { digitos, normalizar } from '@/lib/format';
import { gravarCliente, normMeio, normRamo, normRegime } from '@/lib/clientes';

export async function salvarCliente(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const id = num(fd, 'id');
    const doc = txt(fd, 'cnpj');
    if (!txt(fd, 'razao_social')) throw new ErroNegocio('Informe a razão social.');
    if (![11, 14].includes(digitos(doc).length)) throw new ErroNegocio('Informe um CNPJ (14 dígitos) ou CPF (11 dígitos) válido.');
    if (!id) {
      const dup = await q1("SELECT 1 FROM clientes WHERE escritorio_id = $1 AND excluido_em IS NULL AND regexp_replace(COALESCE(cnpj,''), '\\D', '', 'g') = $2", [s.esc, digitos(doc)]);
      if (dup) throw new ErroNegocio('Já existe uma empresa com este CNPJ/CPF.');
    }
    await tx(s, (c) => gravarCliente(c, s.esc, {
      razao_social: txt(fd, 'razao_social'), cnpj: doc, cod_alter: txt(fd, 'cod_alter') || null, grupo: txt(fd, 'grupo') || null,
      ramo: normRamo(txt(fd, 'ramo')), regime: normRegime(txt(fd, 'regime')), entrada: txt(fd, 'entrada') || null,
      responsavel_id: num(fd, 'operador'), meio_envio: normMeio(txt(fd, 'meio_envio')), contato: txt(fd, 'contato') || null,
      contato_documentos: txt(fd, 'contato_documentos') || null, ativo: bool(fd, 'ativo'),
    }, { id }));
  }, 'Cliente salvo.', '/cadastros');
}

/** Exclui a empresa: remove rotinas, tarefas em aberto e boletos não enviados; mantém o histórico passado. */
export async function excluirCliente(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const c = await q1<{ razao_social: string }>('SELECT razao_social FROM clientes WHERE id = $1 AND escritorio_id = $2 AND excluido_em IS NULL', [num(fd, 'id'), s.esc]);
    if (!c) throw new ErroNegocio('Empresa não encontrada.');
    await tx(s, (x) => x.query('SELECT excluir_cliente($1)', [num(fd, 'id')]));
    return '/cadastros';
  }, 'Empresa excluída. O histórico passado foi mantido.', '/cadastros');
}

export type ResultadoImportacao = { criados: number; atualizados: number; erros: { linha: number; msg: string }[]; total: number; erro?: string };

/** Importa/atualiza empresas a partir da planilha modelo (chave: CNPJ/CPF). Células vazias mantêm o valor atual. */
export async function importarClientes(_prev: unknown, fd: FormData): Promise<ResultadoImportacao> {
  const s = await exigirGestor();
  const vazio = { criados: 0, atualizados: 0, erros: [], total: 0 };
  const f = fd.get('planilha');
  if (!(f instanceof File) || !f.size) return { ...vazio, erro: 'Selecione a planilha (.xlsx).' };
  if (!/\.xlsx$/i.test(f.name) || f.size > 10 * 1024 * 1024) return { ...vazio, erro: 'Envie um arquivo .xlsx de até 10 MB (use a planilha modelo).' };
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await f.arrayBuffer()); } catch { return { ...vazio, erro: 'Não foi possível ler a planilha.' }; }
  const ws = wb.worksheets.find((w) => w.name.toUpperCase().startsWith('EMPRESAS')) ?? wb.worksheets[0];
  if (!ws) return { ...vazio, erro: 'Planilha vazia.' };

  const cab = (ws.getRow(1).values as unknown[]).slice(1).map((v) => normalizar(String(v ?? '')));
  const col = (nome: string) => cab.findIndex((h) => h.startsWith(normalizar(nome))) + 1;
  const idx = { doc: col('CNPJ'), nome: col('RAZAO SOCIAL'), cod: col('COD ALTER'), grupo: col('GRUPO'), ramo: col('RAMO'), regime: col('REGIME'),
    entrada: col('ENTRADA'), resp: col('RESPONSAVEL'), meio: col('MEIO DE ENVIO'), contato: col('CONTATO'), email: col('E MAIL'), ativo: col('ATIVO') };
  if (!idx.doc || !idx.nome) return { ...vazio, erro: 'Cabeçalho inválido: as colunas "CNPJ/CPF" e "RAZÃO SOCIAL" são obrigatórias (use a planilha modelo).' };

  const ops = await q<{ id: number; nome: string }>('SELECT id, nome FROM operadores WHERE escritorio_id = $1', [s.esc]);
  const res: ResultadoImportacao = { ...vazio, erros: [] };
  const cel = (r: any, i: number) => {
    if (!i) return '';
    const v = r.getCell(i).value;
    if (v == null) return '';
    if (v instanceof Date) return `${String(v.getUTCMonth() + 1).padStart(2, '0')}/${v.getUTCFullYear()}`;
    if (typeof v === 'object') return String((v as any).text ?? (v as any).result ?? (v as any).richText?.map((t: any) => t.text).join('') ?? '').trim();
    return String(v).trim();
  };
  const linhas: { n: number; d: Parameters<typeof gravarCliente>[2] }[] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const doc = cel(r, idx.doc);
    if (!doc && !cel(r, idx.nome)) return;
    res.total++;
    const erro = (msg: string) => res.erros.push({ linha: n, msg });
    if (![11, 14].includes(digitos(doc).length)) return erro('CNPJ/CPF inválido');
    const ramoTxt = cel(r, idx.ramo), regTxt = cel(r, idx.regime), meioTxt = cel(r, idx.meio), respTxt = cel(r, idx.resp), entTxt = cel(r, idx.entrada), atTxt = cel(r, idx.ativo);
    const ramo = normRamo(ramoTxt); if (ramoTxt && !ramo) return erro(`Ramo "${ramoTxt}" não reconhecido`);
    const regime = normRegime(regTxt); if (regTxt && !regime) return erro(`Regime "${regTxt}" não reconhecido`);
    const meio = normMeio(meioTxt); if (meioTxt && !meio) return erro(`Meio de envio "${meioTxt}" não reconhecido`);
    const op = respTxt ? ops.find((o) => normalizar(o.nome) === normalizar(respTxt)) : undefined;
    if (respTxt && !op) return erro(`Responsável "${respTxt}" não é um usuário do sistema`);
    const m = entTxt.match(/^(\d{1,2})[/-](\d{4})$/) || entTxt.match(/^(\d{4})-(\d{2})/);
    if (entTxt && !m) return erro('Entrada deve estar no formato MM/AAAA');
    const entrada = m ? (m[1].length === 4 ? `${m[1]}-${m[2]}` : `${m[2]}-${m[1].padStart(2, '0')}`) : null;
    const ativo = atTxt ? !/^N/i.test(normalizar(atTxt)) : null;
    linhas.push({ n, d: { cnpj: doc, razao_social: cel(r, idx.nome) || null, cod_alter: cel(r, idx.cod) || null, grupo: cel(r, idx.grupo) || null,
      ramo, regime, entrada, responsavel_id: op?.id ?? null, meio_envio: meio, contato: cel(r, idx.contato) || null,
      contato_documentos: cel(r, idx.email) || null, ativo } });
  });
  if (res.total > 5000) return { ...vazio, erro: 'Limite de 5.000 empresas por importação.' };

  // Cada linha em sua própria transação: uma linha com erro não impede as demais
  for (const l of linhas) {
    try {
      const r = await tx(s, (c) => gravarCliente(c, s.esc, l.d, { parcial: true }));
      if (r.acao === 'criado') res.criados++; else res.atualizados++;
    } catch (e) {
      res.erros.push({ linha: l.n, msg: e instanceof Error && !(e as any).code ? e.message : msgErro(e) });
    }
  }
  res.erros.sort((a, b) => a.linha - b.linha);
  revalidatePath('/cadastros');
  return res;
}

export async function salvarUsuario(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const id = num(fd, 'id');
    const nome = txt(fd, 'nome');
    const usuario = txt(fd, 'usuario');
    const perfil = txt(fd, 'perfil') === 'gestor' ? 'gestor' : 'operador';
    const senha = String(fd.get('senha') || '');
    if (!nome || !/^[A-Za-z0-9._-]{3,40}$/.test(usuario)) throw new ErroNegocio('Informe nome e usuário (3 a 40 caracteres, sem espaços).');
    if (senha && (senha.length < 8 || !/\d/.test(senha) || !/[A-Za-z]/.test(senha)))
      throw new ErroNegocio('A senha deve ter pelo menos 8 caracteres, com letras e números.');
    if (!id && !senha) throw new ErroNegocio('Defina a senha inicial do novo usuário.');
    if (id === s.id && (perfil !== 'gestor' || !bool(fd, 'ativo'))) throw new ErroNegocio('Você não pode remover o próprio acesso de gestor.');
    await tx(s, async (c) => {
      let uid = id;
      if (id) {
        const r = await c.query('UPDATE operadores SET nome=$1, usuario=$2, perfil=$3::perfil_usuario, email=$4, ativo=$5 WHERE id=$6 AND escritorio_id=$7',
          [nome, usuario, perfil, txt(fd, 'email') || null, bool(fd, 'ativo'), id, s.esc]);
        if (!r.rowCount) throw new ErroNegocio('Usuário não encontrado.');
      } else {
        const r = await c.query('INSERT INTO operadores (escritorio_id, nome, usuario, perfil, email) VALUES ($1,$2,$3,$4::perfil_usuario,$5) RETURNING id',
          [s.esc, nome, usuario, perfil, txt(fd, 'email') || null]);
        uid = r.rows[0].id;
      }
      if (senha) await c.query("UPDATE operadores SET senha_hash = crypt($1, gen_salt('bf', 10)) WHERE id = $2", [senha, uid]);
      // Acesso ao Módulo Financeiro: só quem já tem acesso pode conceder ou retirar
      if (s.fin && fd.has('fin_presente')) {
        const fin = bool(fd, 'acesso_financeiro');
        if (uid === s.id && !fin) throw new ErroNegocio('Você não pode retirar o seu próprio acesso ao Financeiro.');
        await c.query('UPDATE operadores SET acesso_financeiro = $1 WHERE id = $2 AND escritorio_id = $3', [fin, uid, s.esc]);
      }
    });
  }, 'Usuário salvo.', '/cadastros?aba=usuarios');
}

export async function alterarMinhaSenha(fd: FormData) {
  const { exigirUsuario } = await import('@/lib/auth');
  const s = await exigirUsuario();
  await executar(fd, async () => {
    const atual = String(fd.get('atual') || '');
    const nova = String(fd.get('nova') || '');
    if (nova !== String(fd.get('confirma') || '')) throw new ErroNegocio('A confirmação não confere com a nova senha.');
    if (nova.length < 8 || !/\d/.test(nova) || !/[A-Za-z]/.test(nova)) throw new ErroNegocio('A nova senha deve ter pelo menos 8 caracteres, com letras e números.');
    const ok = await q1("SELECT 1 FROM operadores WHERE id = $1 AND senha_hash = crypt($2, senha_hash)", [s.id, atual]);
    if (!ok) throw new ErroNegocio('Senha atual incorreta.');
    await tx(s, (c) => c.query("UPDATE operadores SET senha_hash = crypt($1, gen_salt('bf', 10)) WHERE id = $2", [nova, s.id]));
  }, 'Senha alterada com sucesso.', '/conta');
}
