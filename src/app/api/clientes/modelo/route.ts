import { NextResponse } from 'next/server';
import { sessao } from '@/lib/auth';
import { q } from '@/lib/db';
import { planilhaClientes, respostaXlsx } from '@/lib/planilha';

export const dynamic = 'force-dynamic';

/** Planilha modelo para importação de empresas. */
export async function GET() {
  const s = await sessao();
  if (!s || s.perfil !== 'gestor') return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const ops = await q<{ nome: string }>('SELECT nome FROM operadores WHERE escritorio_id = $1 AND ativo ORDER BY nome', [s.esc]);
  return respostaXlsx(await planilhaClientes([], ops.map((o) => o.nome), true), 'modelo_empresas_ecommflow.xlsx');
}
