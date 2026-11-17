import { NextRequest, NextResponse } from 'next/server';
import { sessao } from '@/lib/auth';
import { q } from '@/lib/db';
import { planilhaClientes, respostaXlsx } from '@/lib/planilha';
import { filtroClientesSql } from '@/lib/filtroClientes';

export const dynamic = 'force-dynamic';

/** Exporta para Excel as empresas do filtro atual da tela de Cadastros. */
export async function GET(req: NextRequest) {
  const s = await sessao();
  if (!s || s.perfil !== 'gestor') return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const { where, params } = filtroClientesSql(s.esc, sp);
  const C = await q<Record<string, any>>(
    `SELECT c.cnpj, c.razao_social, c.cod_alter, g.nome AS grupo, c.ramo, c.regime, c.entrada_escritorio, o.nome AS responsavel,
            c.meio_envio, c.contato, c.contato_documentos, c.ativo
       FROM clientes c LEFT JOIN grupos g ON g.id = c.grupo_id LEFT JOIN operadores o ON o.id = c.operador_padrao
      WHERE ${where} ORDER BY c.razao_social`, params);
  const ops = await q<{ nome: string }>('SELECT nome FROM operadores WHERE escritorio_id = $1 AND ativo ORDER BY nome', [s.esc]);
  const linhas = C.map((c) => [c.cnpj, c.razao_social, c.cod_alter, c.grupo, c.ramo, c.regime,
    c.entrada_escritorio ? `${c.entrada_escritorio.slice(5, 7)}/${c.entrada_escritorio.slice(0, 4)}` : null,
    c.responsavel, c.meio_envio, c.contato, c.contato_documentos, c.ativo ? 'SIM' : 'NÃO']);
  const hoje = new Date().toISOString().slice(0, 10);
  return respostaXlsx(await planilhaClientes(linhas, ops.map((o) => o.nome), false), `empresas_${hoje}.xlsx`);
}
