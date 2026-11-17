/** Filtros da tela de Cadastros → Clientes (usados na lista e na exportação para Excel). */
export type FiltroClientes = { q?: string; grupo?: string; operador?: string; regime?: string; meio?: string };

export function filtroClientesSql(esc: number, sp: FiltroClientes) {
  const params: unknown[] = [esc, sp.q || '', sp.grupo || '', sp.operador || '', sp.regime || '', sp.meio || ''];
  const where = `c.escritorio_id = $1 AND c.excluido_em IS NULL
    AND ($2 = '' OR c.razao_social ILIKE '%' || $2 || '%' OR g.nome ILIKE '%' || $2 || '%'
         OR (length(regexp_replace($2, '\\D', '', 'g')) > 2 AND regexp_replace(COALESCE(c.cnpj,''), '\\D', '', 'g') LIKE '%' || regexp_replace($2, '\\D', '', 'g') || '%'))
    AND ($3 = '' OR g.nome = $3)
    AND ($4 = '' OR c.operador_padrao::text = $4 OR ($4 = '0' AND c.operador_padrao IS NULL))
    AND ($5 = '' OR c.regime = $5)
    AND ($6 = '' OR c.meio_envio = $6 OR ($6 = 'NI' AND c.meio_envio IS NULL))`;
  return { where, params };
}
