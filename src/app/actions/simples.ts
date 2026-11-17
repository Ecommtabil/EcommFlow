'use server';
import { revalidatePath } from 'next/cache';
import { exigirGestor, exigirUsuario } from '@/lib/auth';
import { ErroNegocio, executar, num, txt } from '@/lib/acao';
import { msgErro, q1, tx } from '@/lib/db';
import { ANEXOS, AnexoId, DadosSimples, TabelasSimples, dadosVazios, normalizar, validarTabela } from '@/lib/simples/motor';
import { TABELA_2025 } from '@/lib/simples/tabela2025';
import { tabelasDoEscritorio } from '@/lib/simples/servidor';

const BASE = '/ferramentas/simples-nacional';
const anoValido = (a: number | null) => a !== null && a >= 2018 && a <= 2100;

/** Cria o cálculo de uma empresa do cadastro para um ano-calendário. */
export async function criarCalculo(fd: FormData) {
  const s = await exigirUsuario();
  await executar(fd, async () => {
    const cliente = num(fd, 'cliente');
    const ano = num(fd, 'ano');
    const anexos = ANEXOS.filter((a) => fd.getAll('anexos').includes(a));
    if (!cliente) throw new ErroNegocio('Escolha a empresa.');
    if (!anoValido(ano)) throw new ErroNegocio('Ano-calendário inválido.');
    if (!anexos.length) throw new ErroNegocio('Selecione pelo menos um anexo.');
    const c = await q1('SELECT 1 FROM clientes WHERE id = $1 AND escritorio_id = $2 AND excluido_em IS NULL', [cliente, s.esc]);
    if (!c) throw new ErroNegocio('Empresa não encontrada.');
    const ja = await q1<{ id: number }>('SELECT id FROM sn_calculos WHERE cliente_id = $1 AND ano = $2', [cliente, ano]);
    if (ja) throw new ErroNegocio(`Esta empresa já tem cálculo para ${ano}. Abra-o na lista.`);
    const r = await tx(s, (x) => x.query(
      'INSERT INTO sn_calculos (escritorio_id, cliente_id, ano, dados, criado_por, atualizado_por) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id',
      [s.esc, cliente, ano, JSON.stringify(dadosVazios(ano!, anexos)), s.id]));
    return `${BASE}/${r.rows[0].id}`;
  }, 'Empresa adicionada à calculadora.', BASE);
}

/** Salvamento automático da tela da empresa (receitas, RBT12, ano anterior, cadastro, prévia). */
export async function salvarDadosCalculo(id: number, entrada: DadosSimples): Promise<{ ok: boolean; erro?: string; em?: string }> {
  const s = await exigirUsuario();
  try {
    if (!anoValido(Number(entrada?.ano))) return { ok: false, erro: 'Ano-calendário inválido.' };
    const d = normalizar({ ...entrada, ano: Number(entrada.ano) });
    if (!d.anexos.length) return { ok: false, erro: 'Selecione pelo menos um anexo.' };
    // Mantém valores de anexos desmarcados (voltam se o anexo for marcado de novo)
    for (const a of ANEXOS) if (entrada.receitas?.[a] && !d.receitas[a]) d.receitas[a] = entrada.receitas[a];
    for (const a of Object.keys(d.receitas) as AnexoId[]) d.receitas[a] = (d.receitas[a] ?? []).map((m) =>
      Object.fromEntries(Object.entries(m ?? {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0).map(([k, v]) => [k, Number(v)])));
    const atual = await q1<{ cliente_id: number }>('SELECT cliente_id FROM sn_calculos WHERE id = $1 AND escritorio_id = $2', [id, s.esc]);
    if (!atual) return { ok: false, erro: 'Cálculo não encontrado.' };
    const dup = await q1('SELECT 1 FROM sn_calculos WHERE cliente_id = $1 AND ano = $2 AND id <> $3', [atual.cliente_id, d.ano, id]);
    if (dup) return { ok: false, erro: `Esta empresa já tem outro cálculo para ${d.ano}.` };
    const r = await tx(s, (x) => x.query(
      'UPDATE sn_calculos SET ano = $1, dados = $2, atualizado_por = $3, atualizado_em = now() WHERE id = $4 AND escritorio_id = $5 RETURNING atualizado_em',
      [d.ano, JSON.stringify(d), s.id, id, s.esc]));
    return { ok: true, em: String(r.rows[0].atualizado_em) };
  } catch (e) {
    return { ok: false, erro: msgErro(e) };
  }
}

export async function excluirCalculo(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const r = await tx(s, (x) => x.query('DELETE FROM sn_calculos WHERE id = $1 AND escritorio_id = $2', [num(fd, 'id'), s.esc]));
    if (!r.rowCount) throw new ErroNegocio('Cálculo não encontrado.');
    return BASE;
  }, 'Cálculo excluído (a empresa continua no cadastro).', BASE);
}

// ---------------------------------------------------------------- tabelas do Simples (somente gestores)
function tabelaValida(t: TabelasSimples): TabelasSimples {
  const o = {} as TabelasSimples;
  for (const a of ANEXOS) {
    if (!Array.isArray(t?.[a]) || t[a].length !== 6) throw new ErroNegocio('Tabela inválida.');
    o[a] = t[a].map((f, i) => {
      const n = (v: unknown, padrao: number) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : padrao; };
      const ref = TABELA_2025[a][i];
      return { aliquota: n(f.aliquota, ref.aliquota), deducao: n(f.deducao, ref.deducao),
        partilha: Object.fromEntries(Object.keys(ref.partilha).map((k) => [k, n((f.partilha as any)?.[k], 0)])) };
    });
  }
  return o;
}

export type RespTabela = { ok: boolean; erro?: string; avisos?: string[] };

export async function salvarTabelaSimples(ano: number, tabela: TabelasSimples): Promise<RespTabela> {
  const s = await exigirGestor();
  try {
    if (!(ano >= 2000 && ano <= 2100)) return { ok: false, erro: 'Ano inválido.' };
    const t = tabelaValida(tabela);
    await tx(s, (x) => x.query(
      `INSERT INTO sn_tabelas (escritorio_id, ano, tabela, atualizado_por) VALUES ($1,$2,$3,$4)
       ON CONFLICT (escritorio_id, ano) DO UPDATE SET tabela = EXCLUDED.tabela, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
      [s.esc, ano, JSON.stringify(t), s.id]));
    revalidatePath(BASE, 'layout');
    return { ok: true, avisos: validarTabela(t) };
  } catch (e) {
    return { ok: false, erro: e instanceof ErroNegocio ? e.message : msgErro(e) };
  }
}

/** Nova versão: do ano da empresa (se ainda não existir) ou maior ano + 1, copiando a versão de origem. */
export async function novaVersaoTabela(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const tabelas = await tabelasDoEscritorio(s.esc);
    const anos = Object.keys(tabelas).map(Number);
    const anoEmpresa = num(fd, 'ano_empresa');
    const origem = num(fd, 'origem') ?? 2025;
    const alvo = anoEmpresa && !anos.includes(anoEmpresa) ? anoEmpresa : Math.max(2025, ...anos) + 1;
    const t = tabelas[String(origem)] ?? TABELA_2025;
    await tx(s, async (x) => {
      if (!anos.length) await x.query('INSERT INTO sn_tabelas (escritorio_id, ano, tabela, atualizado_por) VALUES ($1, 2025, $2, $3) ON CONFLICT DO NOTHING', [s.esc, JSON.stringify(TABELA_2025), s.id]);
      await x.query('INSERT INTO sn_tabelas (escritorio_id, ano, tabela, atualizado_por) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [s.esc, alvo, JSON.stringify(t), s.id]);
    });
    return `${txt(fd, 'back').split('?')[0] || BASE}?aba=tabelas&versao=${alvo}`;
  }, 'Nova versão das tabelas criada.', BASE);
}

export async function restaurarTabelaPadrao(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const ano = num(fd, 'versao') ?? 2025;
    await tx(s, (x) => x.query(
      `INSERT INTO sn_tabelas (escritorio_id, ano, tabela, atualizado_por) VALUES ($1,$2,$3,$4)
       ON CONFLICT (escritorio_id, ano) DO UPDATE SET tabela = EXCLUDED.tabela, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
      [s.esc, ano, JSON.stringify(TABELA_2025), s.id]));
  }, 'Valores da LC 123/2006 restaurados.', BASE);
}

export async function excluirVersaoTabela(fd: FormData) {
  const s = await exigirGestor();
  await executar(fd, async () => {
    const ano = num(fd, 'versao');
    await tx(s, (x) => x.query('DELETE FROM sn_tabelas WHERE escritorio_id = $1 AND ano = $2', [s.esc, ano]));
    return `${txt(fd, 'back').split('?')[0] || BASE}?aba=tabelas`;
  }, 'Versão excluída. Sem versões próprias, vale a tabela padrão da LC 123/2006 (2025).', BASE);
}
