'use client';
import { useEffect, useRef, useState } from 'react';
import { ANEXOS, AnexoId, LIMITES, NOME_ANEXO, TRIBUTOS_ANEXO, TabelasPorAno, TabelasSimples, anoVersaoVigente, validarTabela } from '@/lib/simples/motor';
import { TABELA_2025 } from '@/lib/simples/tabela2025';
import { fNum } from '@/lib/simples/formato';
import { excluirVersaoTabela, novaVersaoTabela, restaurarTabelaPadrao, salvarTabelaSimples } from '@/app/actions/simples';
import { BotaoConfirmar } from '@/components/BotaoConfirmar';

function Num({ v, on, ro }: { v: number; on: (n: number) => void; ro: boolean }) {
  const [t, setT] = useState<string | null>(null);
  const exib = v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  if (ro) return <span>{exib}</span>;
  return <input className="sn-tinp" value={t ?? exib}
    onFocus={(e) => { setT(String(v).replace('.', ',')); e.target.select(); }} onChange={(e) => setT(e.target.value)}
    onBlur={() => { const s = (t ?? '').trim(); const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); if (s && Number.isFinite(n) && n >= 0) on(n); setT(null); }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function TabelasEditor({ tabelas, setTabelas, anoEmpresa, gestor, idCalculo, versaoInicial }: {
  tabelas: TabelasPorAno; setTabelas: (t: TabelasPorAno) => void; anoEmpresa: number; gestor: boolean; idCalculo: number; versaoInicial?: number;
}) {
  const anos = Object.keys(tabelas).map(Number).sort((a, b) => a - b);
  const versoes = anos.length ? anos : [2025];
  const vigente = anoVersaoVigente(tabelas, anoEmpresa);
  const [versao, setVersao] = useState<number>(versaoInicial && versoes.includes(versaoInicial) ? versaoInicial : vigente);
  const [anexo, setAnexo] = useState<AnexoId>('I');
  const [msg, setMsg] = useState('');
  const t: TabelasSimples = tabelas[String(versao)] ?? TABELA_2025;
  const pend = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { if (!versoes.includes(versao)) setVersao(vigente); }, [versoes.join(','), versao, vigente]); // eslint-disable-line

  const alterar = (f: number, campo: string, n: number) => {
    const nova: TabelasSimples = JSON.parse(JSON.stringify(t));
    if (campo === 'aliquota' || campo === 'deducao') nova[anexo][f][campo] = n; else (nova[anexo][f].partilha as Record<string, number>)[campo] = n;
    setTabelas({ ...tabelas, [String(versao)]: nova });
    setMsg('⏳ Salvando…');
    clearTimeout(pend.current);
    pend.current = setTimeout(async () => { const r = await salvarTabelaSimples(versao, nova); setMsg(r.ok ? '✔ Salvo' : `⚠ ${r.erro}`); }, 600);
  };
  const avisos = validarTabela(t);
  const back = `/ferramentas/simples-nacional/${idCalculo}?aba=tabelas&versao=${versao}`;
  const trib = TRIBUTOS_ANEXO[anexo];
  return (
    <div className="sn-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Tabelas do Simples Nacional</h3>
        <div className="sn-acoes">
          <span className="sn-salvo">{msg}</span>
          <select className="sn-sel" value={versao} onChange={(e) => setVersao(Number(e.target.value))}>{versoes.map((a) => <option key={a} value={a}>Versão {a}</option>)}</select>
          {gestor && <>
            <form action={novaVersaoTabela}><input type="hidden" name="ano_empresa" value={anoEmpresa} /><input type="hidden" name="origem" value={versao} /><input type="hidden" name="back" value={back} /><button className="sn-btn">⧉ Nova versão</button></form>
            <form action={restaurarTabelaPadrao}><input type="hidden" name="versao" value={versao} /><input type="hidden" name="back" value={back} />
              <BotaoConfirmar className="sn-btn" mensagem={`Sobrescrever a versão ${versao} com os valores da LC 123/2006?`}>↺ Restaurar LC 123</BotaoConfirmar></form>
            {anos.length > 1 && <form action={excluirVersaoTabela}><input type="hidden" name="versao" value={versao} /><input type="hidden" name="back" value={back} />
              <BotaoConfirmar className="sn-btn" mensagem={`Excluir a versão ${versao} das tabelas? As empresas passam a usar a versão vigente mais próxima.`}>🗑 Excluir versão</BotaoConfirmar></form>}
          </>}
        </div>
      </div>
      <p style={{ color: '#475569', margin: '0 0 12px' }}>Cada versão vale a partir do seu ano. Esta empresa (ano {anoEmpresa}) usa a <b style={{ color: '#0f2944' }}>versão {vigente}</b>. {gestor
        ? 'As alterações são salvas na hora e recalculam todas as empresas que usam a versão.'
        : 'Somente gestores podem alterar as tabelas.'}</p>
      <div className="sn-tabs min">{ANEXOS.map((a) => <button key={a} className={anexo === a ? 'on' : ''} onClick={() => setAnexo(a)}>Anexo {a} – {NOME_ANEXO[a]}</button>)}</div>
      <div style={{ overflowX: 'auto' }}><table className="sn-tbl">
        <thead><tr><th>Faixa</th><th className="sep"><u title="Limite da faixa (fixo por lei)">RBT12 até</u></th><th><u title="Alíquota nominal">Alíquota (%)</u></th><th><u title="Parcela a deduzir">Dedução (R$)</u></th>{trib.map((x) => <th key={x}><u title={`Partilha do ${x}`}>{x} (%)</u></th>)}<th><u title="Soma da partilha (deve ser 100%)">Soma</u></th></tr></thead>
        <tbody>{t[anexo].map((f, i) => {
          const soma = trib.reduce((s, x) => s + (f.partilha[x] ?? 0), 0);
          return (
            <tr key={i}><td className="mes">{i + 1}</td><td className="sep" style={{ color: '#64748b' }}>{fNum(LIMITES[i])}</td>
              <td><Num v={f.aliquota} on={(n) => alterar(i, 'aliquota', n)} ro={!gestor} /></td>
              <td><Num v={f.deducao} on={(n) => alterar(i, 'deducao', n)} ro={!gestor} /></td>
              {trib.map((x) => <td key={x}><Num v={f.partilha[x] ?? 0} on={(n) => alterar(i, x, n)} ro={!gestor} />{x === 'ISS' && i === 4 ? ' *' : ''}</td>)}
              <td style={{ color: Math.abs(soma - 100) <= 0.005 ? '#2f7a46' : '#b42318', fontWeight: 600 }}>{soma.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td></tr>
          );
        })}</tbody>
      </table></div>
      {avisos.map((a) => <div key={a} className="sn-info" style={{ color: '#9a6700' }}>⚠ {a}</div>)}
      <p className="sn-desc" style={{ marginBottom: 0 }}>
        {(anexo === 'III' || anexo === 'IV' || anexo === 'V') && <>(*) Teto do ISS de 5% efetivo: o excedente vai, de forma proporcional, para os tributos federais da mesma faixa.<br /></>}
        Na faixa 6, o {anexo === 'I' || anexo === 'II' ? 'ICMS' : 'ISS'} é recolhido fora do DAS.
        {anexo === 'IV' && <><br />No Anexo IV a CPP não está no DAS (GPS/DCTFWeb).</>}
      </p>
    </div>
  );
}
