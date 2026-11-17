'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { importarClientes, type ResultadoImportacao } from '@/app/actions/cadastros';

function Enviar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? 'Importando…' : 'Importar'}</button>;
}

export function Importar() {
  const [r, acao] = useFormState(importarClientes, null as ResultadoImportacao | null);
  return (
    <>
      <form action={acao} className="card form" style={{ maxWidth: 760 }}>
        <ol className="mut" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li><a href="/api/clientes/modelo"><b>Baixe a planilha modelo</b></a> (ou exporte a lista atual em Cadastros → Exportar Excel).</li>
          <li>Preencha uma empresa por linha. CNPJ/CPF e Razão social são obrigatórios.</li>
          <li>CNPJ já cadastrado é <b>atualizado</b> (células em branco mantêm o valor atual); CNPJ novo é <b>cadastrado</b>.</li>
        </ol>
        <input type="file" name="planilha" accept=".xlsx" required className="drop" style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><Enviar /><Link className="btn gh" href="/cadastros">Voltar</Link></div>
        {r?.erro && <div className="flash erro" style={{ marginTop: 12 }}>⚠ {r.erro}</div>}
      </form>
      {r && !r.erro && (
        <div className="card" style={{ marginTop: 12, maxWidth: 760 }}>
          <h3>Resultado da importação</h3>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="card kpi"><div className="l">Linhas lidas</div><div className="v">{r.total}</div></div>
            <div className="card kpi"><div className="l">✔ Cadastradas</div><div className="v" style={{ color: 'var(--ok)' }}>{r.criados}</div></div>
            <div className="card kpi"><div className="l">↻ Atualizadas</div><div className="v" style={{ color: 'var(--pri)' }}>{r.atualizados}</div></div>
            <div className="card kpi"><div className="l">✖ Com erro</div><div className="v" style={{ color: 'var(--bad)' }}>{r.erros.length}</div></div>
          </div>
          {r.erros.length > 0 && (
            <table><thead><tr><th>Linha</th><th>Problema (linha não importada)</th></tr></thead>
              <tbody>{r.erros.map((e, i) => <tr key={i}><td>{e.linha}</td><td style={{ color: 'var(--bad)' }}>{e.msg}</td></tr>)}</tbody></table>
          )}
          <Link className="btn" href="/cadastros" style={{ marginTop: 12 }}>Ver cadastros</Link>
        </div>
      )}
    </>
  );
}
