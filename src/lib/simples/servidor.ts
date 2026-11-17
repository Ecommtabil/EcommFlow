import 'server-only';
import { q, q1 } from '@/lib/db';
import { DadosSimples, TabelasPorAno, normalizar } from './motor';

export async function tabelasDoEscritorio(esc: number): Promise<TabelasPorAno> {
  const R = await q<{ ano: number; tabela: any }>('SELECT ano, tabela FROM sn_tabelas WHERE escritorio_id = $1 ORDER BY ano', [esc]);
  return Object.fromEntries(R.map((r) => [String(r.ano), r.tabela]));
}

export type CalculoLinha = { id: number; cliente_id: number; razao_social: string; cnpj: string | null; regime: string | null; ano: number; dados: DadosSimples; atualizado_em: string; atualizado_por: string | null };

export async function carregarCalculo(esc: number, id: number): Promise<CalculoLinha | undefined> {
  const r = await q1<any>(
    `SELECT s.id, s.cliente_id, c.razao_social, c.cnpj, c.regime, s.ano, s.dados, s.atualizado_em, o.nome AS atualizado_por
       FROM sn_calculos s JOIN clientes c ON c.id = s.cliente_id LEFT JOIN operadores o ON o.id = s.atualizado_por
      WHERE s.id = $1 AND s.escritorio_id = $2`, [id, esc]);
  if (!r) return undefined;
  return { ...r, dados: normalizar({ ...r.dados, ano: r.ano }) };
}
