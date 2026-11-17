import { exigirFinanceiro } from '@/lib/auth';
import { q } from '@/lib/db';
import { CobrancaPdf } from './CobrancaPdf';

export const metadata = { title: 'EcommFlow · Cobrança a partir de PDF' };

export default async function NovaCobrancaPdf() {
  const s = await exigirFinanceiro();
  const resp = await q<{ id: number; nome: string }>('SELECT id, nome FROM operadores WHERE escritorio_id = $1 AND ativo AND acesso_financeiro ORDER BY nome', [s.esc]);
  return <CobrancaPdf responsaveis={resp} eu={s.id} />;
}
