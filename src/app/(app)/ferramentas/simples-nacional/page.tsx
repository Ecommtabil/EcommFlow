import Link from 'next/link';
import { ehGestor, exigirUsuario } from '@/lib/auth';
import { q } from '@/lib/db';
import { clientesOpcoes } from '@/lib/tarefas';
import { ANEXOS, NOME_ANEXO, calcularEmpresa, normalizar } from '@/lib/simples/motor';
import { TABELA_2025 } from '@/lib/simples/tabela2025';
import { tabelasDoEscritorio } from '@/lib/simples/servidor';
import { fBRL } from '@/lib/simples/formato';
import { criarCalculo, excluirCalculo } from '@/app/actions/simples';
import { BotaoConfirmar } from '@/components/BotaoConfirmar';

export const metadata = { title: 'EcommFlow · Simples Nacional' };

export default async function ListaSimples({ searchParams: sp }: { searchParams: { q?: string; nova?: string } }) {
  const s = await exigirUsuario();
  const busca = (sp.q || '').trim();
  const [L, tabelas, clientes] = await Promise.all([
    q<{ id: number; razao_social: string; cnpj: string | null; ano: number; dados: any; atualizado_em: string }>(
      `SELECT s.id, c.razao_social, c.cnpj, s.ano, s.dados, s.atualizado_em FROM sn_calculos s JOIN clientes c ON c.id = s.cliente_id
        WHERE s.escritorio_id = $1 AND c.excluido_em IS NULL
          AND ($2 = '' OR c.razao_social ILIKE '%' || $2 || '%' OR regexp_replace(COALESCE(c.cnpj,''), '\\D', '', 'g') LIKE '%' || NULLIF(regexp_replace($2, '\\D', '', 'g'), '') || '%')
        ORDER BY c.razao_social, s.ano DESC`, [s.esc, busca]),
    tabelasDoEscritorio(s.esc),
    clientesOpcoes(s),
  ]);
  const regime = await q<{ id: number; regime: string | null }>('SELECT id, regime FROM clientes WHERE escritorio_id = $1', [s.esc]);
  const simples = new Set(regime.filter((r) => r.regime === 'Simples Nacional' || r.regime === 'MEI').map((r) => r.id));
  const opcoes = [...clientes.filter((c) => simples.has(c.id)), ...clientes.filter((c) => !simples.has(c.id))];
  const anoAtual = new Date().getFullYear();
  return (
    <>
      <div className="mut" style={{ fontSize: 13 }}><Link href="/ferramentas">🧰 Ferramentas</Link> › Cálculo do Simples Nacional</div>
      <h2 style={{ margin: '4px 0' }}>Empresas</h2>
      <p className="mut" style={{ margin: '0 0 14px' }}>Cada empresa tem um ano-calendário e os anexos em que atua. Abra uma empresa para lançar as receitas e ver o DAS.</p>

      <details className="card" style={{ marginBottom: 14 }} open={sp.nova === '1' || L.length === 0}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Nova empresa na calculadora</summary>
        <form action={criarCalculo} className="form" style={{ marginTop: 12 }}>
          <input type="hidden" name="back" value="/ferramentas/simples-nacional?nova=1" />
          <label>Empresa (do cadastro de clientes) *</label>
          <select name="cliente" required defaultValue="">
            <option value="" disabled>Escolha a empresa…</option>
            <optgroup label="Simples Nacional / MEI">{opcoes.filter((c) => simples.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.razao_social}{c.cnpj ? ` · ${c.cnpj}` : ''}</option>)}</optgroup>
            <optgroup label="Outros regimes">{opcoes.filter((c) => !simples.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.razao_social}{c.cnpj ? ` · ${c.cnpj}` : ''}</option>)}</optgroup>
          </select>
          <div className="row">
            <div><label>Ano-calendário *</label><input type="number" name="ano" min={2018} max={2100} defaultValue={anoAtual} required /></div>
            <div>
              <label>Anexos em que a empresa atua *</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
                {ANEXOS.map((a) => (
                  <label key={a} style={{ display: 'flex', gap: 5, alignItems: 'center', margin: 0, color: 'var(--tx)' }}>
                    <input type="checkbox" name="anexos" value={a} defaultChecked={a === 'I'} style={{ width: 'auto' }} /> {a} – {NOME_ANEXO[a]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button className="btn" style={{ marginTop: 12 }}>Salvar e abrir</button>
        </form>
      </details>

      {(L.length > 0 || busca) && (
        <form className="filtros">
          <input name="q" placeholder="🔎 Buscar por razão social ou CNPJ" defaultValue={busca} style={{ minWidth: 300 }} />
          <button className="btn sm">Buscar</button>
          {busca && <Link className="btn sm gh" href="/ferramentas/simples-nacional">✕ Limpar</Link>}
          <span className="mut right" style={{ alignSelf: 'center' }}>{L.length} cálculo(s)</span>
        </form>
      )}
      {busca && !L.length && <p className="mut">Nenhuma empresa encontrada para “{busca}”.</p>}

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' }}>
        {L.map((e) => {
          const d = normalizar({ ...e.dados, ano: e.ano });
          const r = calcularEmpresa(d, tabelas, TABELA_2025);
          return (
            <div key={e.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{e.razao_social}</b>
                {ehGestor(s) && (
                  <form action={excluirCalculo}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="back" value="/ferramentas/simples-nacional" />
                    <BotaoConfirmar title="Excluir cálculo" mensagem={`Excluir o cálculo de ${e.ano} de “${e.razao_social}”?\n\nTodas as receitas lançadas neste cálculo serão apagadas. A empresa continua no cadastro de clientes.`}>🗑</BotaoConfirmar></form>
                )}
              </div>
              <div className="desc">{e.cnpj || 'CNPJ não informado'} · Ano {e.ano}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{d.anexos.map((a) => <span key={a} className="tag pendente">Anexo {a}</span>)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span><span className="desc">Faturamento no ano</span><br /><b>{fBRL(r.faturamento)}</b></span>
                <span style={{ textAlign: 'right' }}><span className="desc">DAS no ano</span><br /><b>{fBRL(r.das)}</b></span>
              </div>
              <Link className="btn sm" href={`/ferramentas/simples-nacional/${e.id}`} style={{ marginTop: 6, textAlign: 'center' }}>Abrir empresa</Link>
            </div>
          );
        })}
      </div>
      {!L.length && !busca && <p className="mut">Nenhuma empresa na calculadora. Adicione a primeira acima (empresa do cadastro, ano-calendário e anexos).</p>}
    </>
  );
}
