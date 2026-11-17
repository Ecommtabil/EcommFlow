import 'server-only';
import type { PoolClient } from 'pg';
import { digitos, mascaraDoc, MEIOS_ENVIO, normalizar, RAMOS, REGIMES } from './format';

export type DadosCliente = {
  razao_social?: string | null;
  cnpj: string;
  cod_alter?: string | null;
  grupo?: string | null;
  ramo?: string | null;
  regime?: string | null;
  entrada?: string | null; // YYYY-MM
  responsavel_id?: number | null;
  meio_envio?: string | null;
  contato?: string | null;
  contato_documentos?: string | null;
  ativo?: boolean | null;
};

/** Colunas da planilha de importação/exportação (mesma ordem nos dois). */
export const COLUNAS_PLANILHA = [
  'CNPJ/CPF', 'RAZÃO SOCIAL', 'CÓD ALTER', 'GRUPO', 'RAMO', 'REGIME', 'ENTRADA NO ESCRITÓRIO (MM/AAAA)',
  'RESPONSÁVEL (ANALISTA)', 'MEIO DE ENVIO', 'CONTATO', 'E-MAIL / WHATSAPP', 'ATIVO (SIM/NÃO)',
] as const;

/** Normaliza valores digitados livremente para as listas do sistema (aceita acentos/minúsculas). */
export const normRamo = (v?: string | null) => (v ? RAMOS.find((r) => normalizar(r) === normalizar(v)) ?? null : null);
export const normMeio = (v?: string | null) => (v ? MEIOS_ENVIO.find((m) => normalizar(m) === normalizar(v)) ?? null : null);
export const normRegime = (v?: string | null) => (v ? REGIMES.find((r) => normalizar(r) === normalizar(v)) ?? null : null);

/**
 * Cria ou atualiza um cliente (chave: CNPJ/CPF dentro do escritório).
 * - parcial=true (importação): campos vazios mantêm o valor atual.
 * - Cliente que havia sido excluído com o mesmo CNPJ é reativado.
 * Retorna 'criado' | 'atualizado' e o id.
 */
export async function gravarCliente(c: PoolClient, esc: number, d: DadosCliente, opts: { id?: number | null; parcial?: boolean } = {}) {
  const doc = digitos(d.cnpj);
  if (![11, 14].includes(doc.length)) throw new Error('CNPJ (14 dígitos) ou CPF (11 dígitos) inválido');
  let grupo: number | null | undefined = undefined;
  if (d.grupo) {
    const g = await c.query(
      `INSERT INTO grupos (escritorio_id, nome) VALUES ($1, $2)
       ON CONFLICT (escritorio_id, nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
      [esc, d.grupo.trim().toUpperCase()],
    );
    grupo = g.rows[0].id;
  } else if (!opts.parcial) grupo = null;

  const existente = opts.id
    ? (await c.query('SELECT id FROM clientes WHERE id = $1 AND escritorio_id = $2', [opts.id, esc])).rows[0]
    : (await c.query("SELECT id FROM clientes WHERE escritorio_id = $1 AND regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = $2 ORDER BY excluido_em NULLS FIRST LIMIT 1", [esc, doc])).rows[0];
  if (opts.id && !existente) throw new Error('Cliente não encontrado');

  const campos: Record<string, unknown> = {
    razao_social: d.razao_social ? d.razao_social.trim().toUpperCase() : undefined,
    cnpj: mascaraDoc(doc),
    cod_alter: d.cod_alter,
    grupo_id: grupo,
    ramo: d.ramo,
    regime: d.regime,
    entrada_escritorio: d.entrada ? `${d.entrada}-01` : d.entrada,
    operador_padrao: d.responsavel_id,
    meio_envio: d.meio_envio,
    contato: d.contato,
    contato_documentos: d.contato_documentos,
    ativo: d.ativo,
  };
  // parcial: ignora vazios; completo: vazio vira NULL
  const usar = Object.entries(campos).filter(([, v]) => (opts.parcial ? v !== undefined && v !== null && v !== '' : v !== undefined));
  const vals = usar.map(([, v]) => (v === '' ? null : v));

  if (existente) {
    const sets = usar.map(([k], i) => `${k} = $${i + 3}`);
    sets.push('excluido_em = NULL');
    if (!usar.some(([k]) => k === 'ativo')) sets.push('ativo = TRUE');
    await c.query(`UPDATE clientes SET ${sets.join(', ')} WHERE id = $1 AND escritorio_id = $2`, [existente.id, esc, ...vals]);
    return { acao: 'atualizado' as const, id: existente.id as number };
  }
  if (!campos.razao_social) throw new Error('Razão social obrigatória para empresa nova');
  const cols = usar.map(([k]) => k);
  const r = await c.query(
    `INSERT INTO clientes (escritorio_id, ${cols.join(', ')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
    [esc, ...vals],
  );
  return { acao: 'criado' as const, id: r.rows[0].id as number };
}
