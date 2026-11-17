'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { BoletoModelo, criarCobrancaDoPdf, lerBoletoModelo } from '@/app/actions/financeiro';

const brl = (v?: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (d?: string) => (d ? d.split('-').reverse().join('/') : '—');

function Enviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending} style={{ marginTop: 12 }}>{pending ? 'Processando…' : children}</button>;
}

export function CobrancaPdf({ responsaveis, eu }: { responsaveis: { id: number; nome: string }[]; eu: number }) {
  const [d, ler] = useFormState<BoletoModelo | null, FormData>(lerBoletoModelo, null);
  const [cadastrar, setCadastrar] = useState<'' | 'sim' | 'nao'>('');
  const diaV = d?.vencimento ? parseInt(d.vencimento.slice(8, 10), 10) : 0;
  return (
    <>
      <form action={ler} className="card form">
        <h3>📄 Nova cobrança mensal a partir de 1 boleto (PDF)</h3>
        <p className="desc">Envie um boleto do cliente. O sistema lê o pagador, o valor e o vencimento e cria a rotina mensal:
          gerar todo dia <b>01</b> e enviar <b>2 dias antes do vencimento</b>.</p>
        <input type="file" name="pdf" accept="application/pdf,.pdf" required onChange={() => setCadastrar('')} />
        <Enviar>Ler boleto</Enviar>
        {d?.erro && <p className="desc" style={{ color: 'var(--bad, #b91c1c)' }}>⚠ {d.erro}</p>}
      </form>

      {d && !d.erro && (
        <form action={criarCobrancaDoPdf} className="card form" style={{ marginTop: 14 }}>
          <input type="hidden" name="dados" value={JSON.stringify(d)} />
          <input type="hidden" name="back" value="/financeiro/cobrancas/pdf" />
          <h3>Dados lidos do boleto</h3>
          <table><tbody>
            <tr><td className="desc">Pagador</td><td><b>{d.pagador}</b> · {d.documento}</td></tr>
            <tr><td className="desc">Valor</td><td><b>{brl(d.valor)}</b></td></tr>
            <tr><td className="desc">Vencimento</td><td>{data(d.vencimento)} → todo dia <b>{diaV}</b></td></tr>
            <tr><td className="desc">Rotinas</td><td>Gerar: dia <b>01</b> · Enviar: dia <b>{Math.max(diaV - 2, 1)}</b></td></tr>
          </tbody></table>

          {d.cliente ? (
            <p>Empresa: <b>{d.cliente.razao_social}</b> {d.cliente.porNome && <span className="desc">(encontrada pelo nome — confira)</span>}
              {d.jaTemCobranca && <><br /><span className="tag atrasada">⚠ Esta empresa já possui cobrança mensal. Uma nova será criada.</span></>}</p>
          ) : (
            <div style={{ margin: '10px 0' }}>
              <p><b>Empresa não cadastrada. Deseja cadastrar a empresa?</b></p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={`btn sm ${cadastrar === 'sim' ? '' : 'gh'}`} onClick={() => setCadastrar('sim')}>Sim, cadastrar</button>
                <button type="button" className={`btn sm ${cadastrar === 'nao' ? '' : 'gh'}`} onClick={() => setCadastrar('nao')}>Não</button>
              </div>
              {cadastrar === 'sim' && (<>
                <input type="hidden" name="cadastrar" value="sim" />
                <label>Razão social</label><input name="novo_nome" defaultValue={d.pagador} required />
              </>)}
              {cadastrar === 'nao' && <p className="desc">Sem o cadastro da empresa não é possível criar a cobrança.</p>}
            </div>
          )}

          <label>Responsável</label>
          <select name="responsavel" defaultValue={eu}>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
          {(d.cliente || cadastrar === 'sim') && <Enviar>✔ Criar cobrança mensal</Enviar>}
        </form>
      )}
    </>
  );
}
