'use client';
import '../simples.css';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANEXOS, AnexoId, COLUNAS_ANEXO, Coluna, DICA_COLUNA, DadosSimples, MESES, NOME_ANEXO, NOME_COLUNA, Previa, TRIBUTOS_ANEXO,
  TabelasPorAno, Tributo, absMes, anoDe, calcularEmpresa, chaveMes, corFaixa, descricaoOrigem, diasNoMes, extrapolar, mes0De,
  mesCorrenteSugerido, projetar, receitaEmpresaMes, rotuloFaixa, ultimoMesFechado,
} from '@/lib/simples/motor';
import { TABELA_2025 } from '@/lib/simples/tabela2025';
import { fBRL, fNum, fPP, fPct, lerColagem, lerValor } from '@/lib/simples/formato';
import { salvarDadosCalculo } from '@/app/actions/simples';
import { COR_ANEXO, COR_TRIBUTO, Grafico, Rosca } from './Graficos';
import { TabelasEditor } from './TabelasEditor';

export const SeloFaixa = ({ f }: { f: number }) => <span className={`sn-faixa ${corFaixa(f)}`}>{rotuloFaixa(f)}</span>;
const NEG = 'Valores negativos não são aceitos e foram ignorados.';
const mesAno = (abs: number) => `${MESES[mes0De(abs)]}/${anoDe(abs)}`;
const Num = ({ n }: { n: number }) => <span className="sn-num">{n}</span>;

/** Campo em R$: mostra formatado; aceita digitação BR/US e colagem de blocos do Excel. */
function CampoValor({ valor, onValor, onColar, titulo }: { valor: number; onValor: (v: number) => void; onColar?: (m: string[][]) => void; titulo?: string }) {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input className="sn-inp" value={txt ?? (valor ? fNum(valor) : '')} placeholder="0,00" inputMode="decimal" title={titulo}
      onFocus={(e) => { setTxt(valor ? fNum(valor) : ''); e.target.select(); }}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        if (txt === null) return;
        const v = lerValor(txt);
        if (v != null && v < 0) alert(NEG); else onValor(v ?? 0);
        setTxt(null);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onPaste={(e) => { const t = e.clipboardData.getData('text'); if (onColar && /[\t\n]/.test(t.trim())) { e.preventDefault(); setTxt(null); onColar(lerColagem(t)); } }} />
  );
}

function CelulaRbt({ d, m, valor, origem, conferencia, onManual }: { d: DadosSimples; m: number; valor: number; origem: string; conferencia?: { rbt12: number; arquivo: string }; onManual: (v: number | null) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const manual = d.rbt12Manual[m] != null;
  const dif = conferencia ? Math.abs(conferencia.rbt12 - valor) : 0;
  const ok = () => { const v = lerValor(edit); if (v != null && v >= 0) onManual(v); else if (v != null) alert(NEG); setEdit(null); };
  if (edit !== null) return (
    <span className="sn-rbt">
      <input className="sn-inp" autoFocus value={edit} onChange={(e) => setEdit(e.target.value)} style={{ width: 120, padding: '5px 8px' }}
        onKeyDown={(e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') setEdit(null); }} />
      <button className="sn-ico" onClick={ok} title="Confirmar">✔</button>
    </span>
  );
  return (
    <span className={`sn-rbt ${manual ? 'man' : ''}`} title={origem}>
      {conferencia && dif > 1 && <span title={`RBT12 do PGDAS-D (${conferencia.arquivo}): ${fBRL(conferencia.rbt12)}. Diferença de ${fBRL(dif)}.`} style={{ color: '#d97706' }}>⚠</span>}
      {fNum(valor)}
      <button className="sn-ico" title="Editar manualmente" onClick={() => setEdit(fNum(valor))}>✎</button>
      {manual && <button className="sn-ico" title="Voltar ao valor calculado" onClick={() => onManual(null)}>↺</button>}
    </span>
  );
}

function HistoricoImportacoes() {
  return (
    <div className="sn-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Histórico de importações</h3>
        <button className="sn-btn sm" disabled title="Disponível com a importação de receitas">↶ Desfazer última</button>
      </div>
      <table className="sn-tbl">
        <thead><tr><th>Data</th><th style={{ textAlign: 'left' }}>Usuário</th><th style={{ textAlign: 'left' }}>Origem</th><th style={{ textAlign: 'left' }}>Arquivo</th><th>Meses</th><th>Sobrescritos</th><th>Ignorados</th></tr></thead>
        <tbody><tr><td colSpan={7} className="sn-desc" style={{ textAlign: 'left' }}>Nenhuma importação ainda.</td></tr></tbody>
      </table>
    </div>
  );
}

export function SimplesApp({ id, empresa, dadosIniciais, tabelas: tabelasProp, gestor, abaInicial, versaoInicial, atualizado }: {
  id: number; empresa: { razao: string; cnpj: string | null }; dadosIniciais: DadosSimples; tabelas: TabelasPorAno; gestor: boolean;
  abaInicial?: string; versaoInicial?: number; atualizado: { em: string; por: string | null };
}) {
  const [d, setD] = useState<DadosSimples>(dadosIniciais);
  const [tabelas, setTabelas] = useState<TabelasPorAno>(tabelasProp);
  useEffect(() => setTabelas(tabelasProp), [tabelasProp]);
  const [aba, setAba] = useState<string>(abaInicial && ['resumo', 'projecao', 'tabelas', ...d.anexos].includes(abaInicial) ? abaInicial : d.anexos[0]);
  const [status, setStatus] = useState<{ t: 'ok' | 'salvando' | 'erro'; msg?: string }>({ t: 'ok', msg: atualizado.por ? `Salvo por ${atualizado.por}` : 'Salvo' });
  const [cad, setCad] = useState(false);
  const primeira = useRef(true);

  // Salvamento automático (sem botão "Salvar")
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setStatus({ t: 'salvando' });
    const h = setTimeout(async () => {
      const r = await salvarDadosCalculo(id, d);
      setStatus(r.ok ? { t: 'ok', msg: 'Salvo' } : { t: 'erro', msg: r.erro });
    }, 700);
    return () => clearTimeout(h);
  }, [d, id]);

  const res = useMemo(() => calcularEmpresa(d, tabelas, TABELA_2025), [d, tabelas]);
  const mude = (f: (x: DadosSimples) => void) => setD((old) => { const x: DadosSimples = JSON.parse(JSON.stringify(old)); f(x); return x; });
  const setReceita = (a: AnexoId, m: number, c: Coluna, v: number) => mude((x) => { x.receitas[a]![m] = { ...x.receitas[a]![m], [c]: v }; });
  const colarGrade = (a: AnexoId, m0: number, c0: number, mat: string[][]) => {
    let neg = false;
    mude((x) => mat.forEach((linha, i) => linha.forEach((cel, j) => {
      const m = m0 + i, c = COLUNAS_ANEXO[a][c0 + j];
      if (m > 11 || !c) return;
      const v = lerValor(cel); if (v == null) return; if (v < 0) { neg = true; return; }
      x.receitas[a]![m] = { ...x.receitas[a]![m], [c]: v };
    })));
    if (neg) setTimeout(() => alert(NEG));
  };
  const colarAnoAnterior = (m0: number, mat: string[][]) => {
    let neg = false;
    mude((x) => mat.flat().forEach((cel, i) => { const m = m0 + i; if (m > 11) return; const v = lerValor(cel); if (v == null) return; if (v < 0) { neg = true; return; } x.anoAnterior[m] = v; }));
    if (neg) setTimeout(() => alert(NEG));
  };

  const totAnoAnt = d.anoAnterior.reduce((s, v) => s + v, 0);
  const abas: [string, string][] = [...d.anexos.map((a) => [a, `Anexo ${a}`] as [string, string]), ['resumo', 'Resumo consolidado'], ['projecao', 'Projeção da alíquota'], ['tabelas', 'Tabelas do Simples']];
  const abaAtual = abas.some(([k]) => k === aba) ? aba : d.anexos[0];
  const etapa2 = 'Disponível na próxima etapa (importação e exportação)';

  return (
    <div className="sn">
      <Link className="sn-crumb" href="/ferramentas/simples-nacional">← Empresas</Link>
      <div className="sn-top">
        <div>
          <h2 className="sn-tit">{empresa.razao}</h2>
          <div className="sn-sub">CNPJ {empresa.cnpj || 'não informado'} · Ano-calendário {d.ano} · {d.anexos.map((a) => `Anexo ${a}`).join(', ')} · DAS no ano <b>{fBRL(res.das)}</b></div>
        </div>
        <div className="sn-acoes">
          <span className="sn-salvo" style={{ color: status.t === 'erro' ? '#b42318' : undefined }}>{status.t === 'salvando' ? '⏳ Salvando…' : status.t === 'erro' ? `⚠ ${status.msg}` : `✔ ${status.msg}`}</span>
          <button className="sn-btn" onClick={() => setCad(!cad)}>✎ Editar cadastro</button>
          <button className="sn-btn pri" disabled title={etapa2}>⇪ Importar receitas</button>
          <button className="sn-btn" disabled title={etapa2}>▦ Excel</button>
          <button className="sn-btn" disabled title={etapa2}>⎙ PDF</button>
        </div>
      </div>

      {cad && (
        <div className="sn-card">
          <h3>Editar cadastro</h3>
          <p className="sn-desc" style={{ marginTop: -4 }}>Razão social e CNPJ vêm do cadastro de clientes. Desmarcar um anexo não apaga os valores lançados nele (voltam se for marcado de novo). Mudar o ano não desloca as receitas.</p>
          <div className="sn-cad">
            <div><label className="sn-lbl">Ano-calendário</label><input className="sn-inp" style={{ textAlign: 'left' }} type="number" min={2018} max={2100} defaultValue={d.ano}
              onBlur={(e) => { const a = parseInt(e.target.value); if (a >= 2018 && a <= 2100) { if (a !== d.ano) mude((x) => { x.ano = a; }); } else alert('Ano-calendário inválido.'); }} /></div>
            <div><label className="sn-lbl">Anexos em que a empresa atua</label>
              <div className="sn-tabs min" style={{ marginBottom: 0 }}>{ANEXOS.map((a) => (
                <button key={a} className={d.anexos.includes(a) ? 'on' : ''} onClick={() => {
                  const marcar = !d.anexos.includes(a);
                  if (!marcar && d.anexos.length === 1) return alert('Selecione pelo menos um anexo.');
                  mude((x) => { x.anexos = ANEXOS.filter((k) => (k === a ? marcar : x.anexos.includes(k))); if (!x.receitas[a]) x.receitas[a] = Array.from({ length: 12 }, () => ({})); });
                }}>{a} {NOME_ANEXO[a]}</button>))}</div>
            </div>
          </div>
        </div>
      )}

      {res.alertasGerais.map((a) => <div key={a.msg} className="sn-alerta">⚠ {a.msg}</div>)}

      <div className="sn-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3>Receita bruta dos 12 meses do ano anterior ({d.ano - 1})</h3>
          <span style={{ color: '#475569' }}>Total: <b style={{ color: '#0f2944' }}>{fBRL(totAnoAnt)}</b></span>
        </div>
        <p className="sn-desc" style={{ margin: '0 0 14px' }}>Receita total da empresa (todos os anexos) em cada mês de {d.ano - 1}. Serve para calcular o RBT12 dos primeiros meses do ano. Dá para colar uma coluna ou linha do Excel a partir de qualquer mês.</p>
        <div className="sn-ant">
          {MESES.map((nm, m) => (
            <div key={m}><label>{nm}/{d.ano - 1}</label>
              <CampoValor valor={d.anoAnterior[m]} onValor={(v) => mude((x) => { x.anoAnterior[m] = v; })} onColar={(mat) => colarAnoAnterior(m, mat)} /></div>
          ))}
        </div>
        <div className="sn-ini">
          <label className="sn-chk"><input type="checkbox" checked={d.inicioAtividade} onChange={(e) => mude((x) => { x.inicioAtividade = e.target.checked; if (e.target.checked && !x.mesInicio) x.mesInicio = `${x.ano}-01`; })} /> Empresa em início de atividade</label>
          {d.inicioAtividade && (
            <label className="sn-chk">Primeiro mês de atividade
              <input className="sn-inp" style={{ width: 170, textAlign: 'left' }} type="month" value={d.mesInicio ?? `${d.ano}-01`} max={`${d.ano}-12`} onChange={(e) => e.target.value && mude((x) => { x.mesInicio = e.target.value; })} /></label>
          )}
          <span className="sn-desc">{d.inicioAtividade
            ? 'RBT12 proporcional (LC 123, art. 18, §2º): média dos meses de atividade × 12; no 1º mês, a receita do próprio mês × 12.'
            : 'RBT12 = soma da receita dos 12 meses anteriores ao mês de apuração.'}</span>
        </div>
      </div>

      <div className="sn-tabs">{abas.map(([k, t]) => <button key={k} className={abaAtual === k ? 'on' : ''} onClick={() => setAba(k)}>{t}</button>)}</div>

      {d.anexos.includes(abaAtual as AnexoId) && <AbaAnexo a={abaAtual as AnexoId} d={d} res={res} setReceita={setReceita} colarGrade={colarGrade} setManual={(m, v) => mude((x) => { x.rbt12Manual[m] = v; })} />}
      {abaAtual === 'resumo' && <AbaResumo d={d} res={res} />}
      {abaAtual === 'projecao' && <AbaProjecao d={d} tabelas={tabelas} setPrevia={(p) => mude((x) => { x.previa = p; })} />}
      {abaAtual === 'tabelas' && <TabelasEditor tabelas={tabelas} setTabelas={setTabelas} anoEmpresa={d.ano} gestor={gestor} idCalculo={id} versaoInicial={versaoInicial} />}

      <HistoricoImportacoes />
    </div>
  );
}

// ---------------------------------------------------------------- aba do anexo
function AbaAnexo({ a, d, res, setReceita, colarGrade, setManual }: {
  a: AnexoId; d: DadosSimples; res: ReturnType<typeof calcularEmpresa>;
  setReceita: (a: AnexoId, m: number, c: Coluna, v: number) => void; colarGrade: (a: AnexoId, m: number, c: number, mat: string[][]) => void; setManual: (m: number, v: number | null) => void;
}) {
  const cols = COLUNAS_ANEXO[a], trib = TRIBUTOS_ANEXO[a], R = res.porAnexo[a]!;
  const tot = (f: (r: (typeof R)[0]) => number) => R.reduce((s, r) => s + f(r), 0);
  const aa = String(d.ano).slice(2);
  return (
    <>
      <p style={{ color: '#475569', margin: '0 0 14px' }}>Anexo {a} – {NOME_ANEXO[a]} · tabela versão {res.anoTabela}</p>
      {a === 'IV' && <div className="sn-info" style={{ marginTop: 0, marginBottom: 14 }}>ℹ No Anexo IV a CPP (INSS patronal) não está no DAS: é recolhida à parte, via GPS/DCTFWeb.</div>}
      <div className="sn-card">
        <h3><Num n={1} />Receitas do mês</h3>
        <p className="sn-desc" style={{ margin: '0 0 12px' }}>Separe a receita por tipo. Dá para colar um bloco do Excel (várias linhas e colunas) a partir de qualquer célula. Valores negativos não são aceitos.</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="sn-tbl">
            <thead><tr><th>Mês</th>{cols.map((c) => <th key={c} className={c === cols[0] ? 'sep' : ''}><u title={DICA_COLUNA[c]}>{NOME_COLUNA[c]}</u></th>)}
              <th><u title="Soma das colunas de receita deste anexo no mês.">Receita total</u></th>
              <th><u title="Receita bruta da empresa toda nos 12 meses anteriores. Clique no lápis para digitar um valor manual.">RBT12</u></th></tr></thead>
            <tbody>
              {MESES.map((nm, m) => (
                <tr key={m}>
                  <td className="mes">{nm}/{aa}</td>
                  {cols.map((c, j) => <td key={c} className={j === 0 ? 'sep' : ''}><CampoValor valor={d.receitas[a]?.[m]?.[c] ?? 0} onValor={(v) => setReceita(a, m, c, v)} onColar={(mat) => colarGrade(a, m, j, mat)} titulo={DICA_COLUNA[c]} /></td>)}
                  <td style={{ fontWeight: 700, color: '#0f2944' }}>{fNum(R[m].receita)}</td>
                  <td><CelulaRbt d={d} m={m} valor={R[m].rbt12.valor} origem={descricaoOrigem(R[m].rbt12)} conferencia={d.conferencias[chaveMes(absMes(d.ano, m))]} onManual={(v) => setManual(m, v)} /></td>
                </tr>
              ))}
              <tr className="tot"><td>Totais</td>{cols.map((c) => <td key={c}>{fNum(tot((r) => r.colunas[c] ?? 0))}</td>)}<td>{fNum(tot((r) => r.receita))}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="sn-card">
        <h3><Num n={2} />Resultado — DAS do mês</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="sn-tbl">
            <thead>
              <tr><th colSpan={7} style={{ background: '#f6f8fb' }} />{trib.map((t) => <th key={t} colSpan={2} className="grp sep">{t}</th>)}
                {cols.length > 1 && <th colSpan={cols.length} className="grp sep">Imposto por tipo de receita</th>}<th className="grp sep" /></tr>
              <tr><th>Mês</th><th><u title="Soma das receitas do anexo no mês">Receita total</u></th><th>RBT12</th><th style={{ textAlign: 'center' }}>Faixa</th>
                <th><u title="Alíquota da faixa (tabela do Simples)">Alíq. nominal</u></th><th><u title="Parcela a deduzir da faixa">Parcela a deduzir</u></th><th><u title="(RBT12 × alíq. nominal − parcela) ÷ RBT12">Alíq. efetiva</u></th>
                {trib.map((t) => [<th key={t + 'p'} className="sep">%</th>, <th key={t + 'v'}>R$</th>])}
                {cols.length > 1 && cols.map((c, j) => <th key={c} className={j === 0 ? 'sep' : ''}><u title={DICA_COLUNA[c]}>{NOME_COLUNA[c]}</u></th>)}
                <th className="sep">Total do DAS</th></tr>
            </thead>
            <tbody>
              {R.map((r, m) => (
                <tr key={m}>
                  <td className="mes">{MESES[m]}{r.alertas.length > 0 && <span title={r.alertas.map((x) => x.msg).join('\n')} style={{ color: r.alertas.some((x) => x.nivel === 'erro') ? '#b42318' : '#d97706', marginLeft: 4 }}>⚠</span>}</td>
                  <td>{fNum(r.receita)}</td><td>{fNum(r.rbt12.valor)}</td><td style={{ textAlign: 'center' }}><SeloFaixa f={r.faixa} /></td>
                  <td>{r.calculado ? fPct(r.aliqNominal, 2) : '—'}</td><td>{r.calculado ? fNum(r.deducao) : '—'}</td>
                  <td style={{ fontWeight: 700, color: '#0f2944' }}>{r.calculado ? fPct(r.ae) : r.receita > 0 && r.faixa === 0 ? <span style={{ color: '#b42318' }}>Informe o RBT12</span> : '—'}</td>
                  {trib.map((t) => [<td key={t + 'p'} className="pct sep">{r.calculado ? fPct(r.partilha[t] ?? 0, 2) : '—'}</td>, <td key={t + 'v'}>{fNum(r.tributos[t] ?? 0)}</td>])}
                  {cols.length > 1 && cols.map((c, j) => <td key={c} className={j === 0 ? 'sep' : ''}>{fNum(r.porColuna[c] ?? 0)}</td>)}
                  <td className="dasg sep">{r.faixa === 7 ? <span style={{ color: '#b42318' }}>Excedeu o limite</span> : fNum(r.das)}</td>
                </tr>
              ))}
              <tr className="tot"><td>TOTAIS</td><td>{fNum(tot((r) => r.receita))}</td><td colSpan={5} />
                {trib.map((t) => [<td key={t + 'p'} />, <td key={t + 'v'}>{fNum(tot((r) => r.tributos[t] ?? 0))}</td>])}
                {cols.length > 1 && cols.map((c) => <td key={c}>{fNum(tot((r) => r.porColuna[c] ?? 0))}</td>)}<td className="gold">{fNum(tot((r) => r.das))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- resumo
function AbaResumo({ d, res }: { d: DadosSimples; res: ReturnType<typeof calcularEmpresa> }) {
  const ordem: Tributo[] = ['CPP', 'IRPJ', 'CSLL', 'COFINS', 'PIS', 'ICMS', 'IPI', 'ISS'];
  const tribs = ordem.filter((t) => (res.porTributo[t] ?? 0) > 0.005);
  const umAnexo = d.anexos.length === 1;
  return (
    <>
      <div className="sn-kpis">
        <div className="sn-kpi"><div className="l">Faturamento no ano</div><div className="v">{fBRL(res.faturamento)}</div><div className="s">Receita bruta de todos os anexos</div></div>
        <div className="sn-kpi"><div className="l">DAS total no ano</div><div className="v">{fBRL(res.das)}</div><div className="s">DAS ÷ faturamento: {fPct(res.aliquotaPaga, 2)}</div></div>
        <div className="sn-kpi"><div className="l">Alíquota efetiva média ponderada</div><div className="v">{fPct(res.aeMedia)}</div><div className="s">Média das alíquotas efetivas pesada pela receita</div></div>
        <div className="sn-kpi"><div className="l">Economia com ST / monofásico / retenção</div><div className="v">{fBRL(res.economia)}</div><div className="s">Imposto sem segregação − imposto pago</div></div>
      </div>
      <div className="sn-g2">
        <div className="sn-card"><h3>DAS mensal por anexo</h3>
          <Grafico rotulos={MESES} barras={d.anexos.map((a) => ({ nome: `Anexo ${a}`, cor: COR_ANEXO[a], valores: res.porAnexo[a]!.map((r) => r.das) }))}
            legenda={d.anexos.map((a) => ({ nome: `Anexo ${a}`, cor: COR_ANEXO[a], tipo: 'barra' as const }))} /></div>
        <div className="sn-card"><h3>Alíquota efetiva × RBT12</h3>
          <Grafico rotulos={MESES} barrasDireita barras={[{ nome: 'RBT12', cor: '#dfe6f0', valores: res.rbt12.map((r) => r.valor) }]}
            linhas={d.anexos.map((a) => ({ nome: `Alíq. efetiva Anexo ${a}`, cor: COR_ANEXO[a], valores: res.porAnexo[a]!.map((r) => (r.calculado ? r.ae : null)) }))}
            fmtL={(v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            legenda={[{ nome: 'RBT12', cor: '#dfe6f0', tipo: 'barra' }, ...d.anexos.map((a) => ({ nome: `Alíq. efetiva Anexo ${a}`, cor: COR_ANEXO[a], tipo: 'linha' as const }))]} /></div>
      </div>
      <div className="sn-g2 r">
        <div className="sn-card"><h3>Composição do DAS anual por tributo</h3>
          <Rosca itens={tribs.map((t) => ({ nome: t, valor: res.porTributo[t] ?? 0, cor: COR_TRIBUTO[t] }))} fmt={fBRL} /></div>
        <div className="sn-card"><h3>DAS por mês (todos os anexos)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="sn-tbl">
              <thead><tr><th>Mês</th><th className="sep">Receita</th><th>RBT12</th><th style={{ textAlign: 'center' }}>Faixa</th>{d.anexos.map((a) => <th key={a}>DAS Anexo {a}</th>)}<th className="sep">Total do DAS</th></tr></thead>
              <tbody>
                {MESES.map((nm, m) => {
                  const conf = d.conferencias[chaveMes(absMes(d.ano, m))];
                  const dif = conf?.das != null ? Math.abs(conf.das - res.dasMes[m]) : 0;
                  return (
                    <tr key={m}><td className="mes">{nm}</td><td className="sep">{fNum(res.receitaMes[m])}</td><td style={{ color: '#1b3a7c' }}>{fNum(res.rbt12[m].valor)}</td>
                      <td style={{ textAlign: 'center' }}><SeloFaixa f={res.porAnexo[d.anexos[0]]![m].faixa} /></td>
                      {d.anexos.map((a) => <td key={a}>{fNum(res.porAnexo[a]![m].das)}</td>)}
                      <td className="dasg sep">
                        {conf?.das != null && (dif <= 0.05
                          ? <span style={{ color: '#2f7a46', marginRight: 4 }} title={`DAS declarado no PGDAS-D (${conf.arquivo}): ${fBRL(conf.das)}. Confere com o cálculo.`}>✔</span>
                          : <span style={{ color: '#d97706', marginRight: 4 }} title={`DAS declarado no PGDAS-D (${conf.arquivo}): ${fBRL(conf.das)}. Diferença de ${fBRL(dif)}.`}>⚠</span>)}
                        {fNum(res.dasMes[m])}</td></tr>
                  );
                })}
                <tr className="tot"><td>TOTAIS</td><td>{fNum(res.faturamento)}</td><td colSpan={2} />{d.anexos.map((a) => <td key={a}>{fNum(res.porAnexo[a]!.reduce((s, r) => s + r.das, 0))}</td>)}<td className="gold">{fNum(res.das)}</td></tr>
              </tbody>
            </table>
          </div>
          {umAnexo ? null : <p className="sn-desc" style={{ marginBottom: 0 }}>A faixa mostrada é a da empresa (RBT12 único para todos os anexos).</p>}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- projeção
function Variacao({ de, para, rotulo }: { de: number; para: number; rotulo: string }) {
  const v = para - de;
  if (Math.abs(v) < 0.0000005) return <span className="sn-var eq">sem variação</span>;
  return <span className={`sn-var ${v > 0 ? 'up' : 'dn'}`}>{v > 0 ? '↗' : '↘'} {fPP(v)} vs {rotulo}</span>;
}

function AbaProjecao({ d, tabelas, setPrevia }: { d: DadosSimples; tabelas: TabelasPorAno; setPrevia: (p: Previa) => void }) {
  const sugerido = mesCorrenteSugerido(d);
  const previa: Previa = d.previa ?? { mesCorrente: sugerido, valores: {}, parcial: false, dia: diasNoMes(sugerido) };
  const p = useMemo(() => projetar(d, tabelas, TABELA_2025, previa), [d, tabelas, previa]);
  const set = (o: Partial<Previa>) => setPrevia({ ...previa, ...o });
  const opcoes = Array.from({ length: 13 }, (_, i) => absMes(d.ano, i));
  const ult = ultimoMesFechado(d);
  const lancado = anoDe(p.corrente) === d.ano ? receitaEmpresaMes(d, mes0De(p.corrente)) : 0;
  const nC = mesAno(p.corrente), nP = mesAno(p.proximo);
  const hoje = new Date();
  const absHoje = absMes(hoje.getFullYear(), hoje.getMonth());
  const semBase = ult == null && d.anoAnterior.every((v) => !v);
  const corteSerie = p.serie.findIndex((s) => s.tipo !== 'fechado');
  return (
    <>
      <div className="sn-card sn-rel">
        <div><b>Relatório para o cliente</b><div className="sn-desc">PDF em A4 com a alíquota projetada de {nP}, comparativo, gráfico, histórico e observações.</div></div>
        <button className="sn-btn cinza" disabled title="Disponível na próxima etapa (exportação)">⎙ Gerar relatório A4</button>
      </div>

      <div className="sn-card">
        <h3><Num n={1} />Prévia do faturamento do mês corrente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 16 }}>
          <div>
            <label className="sn-lbl">Mês corrente</label>
            <select className="sn-sel" style={{ width: '100%' }} value={p.corrente} onChange={(e) => { const m = Number(e.target.value); set({ mesCorrente: m, dia: previa.parcial && m === absHoje ? hoje.getDate() : diasNoMes(m) }); }}>
              {opcoes.map((m) => <option key={m} value={m}>{mesAno(m)}{m === sugerido ? ' · sugerido' : ''}</option>)}
            </select>
            <div className="sn-desc" style={{ fontSize: 12, marginTop: 6 }}>Sugerido: o mês seguinte ao último mês fechado ({ult == null ? 'nenhum' : mesAno(ult)}).</div>
          </div>
          <div>
            {d.anexos.map((a) => (
              <div key={a} style={{ marginBottom: 8 }}><label className="sn-lbl">Faturamento de {nC}{d.anexos.length > 1 ? ` — Anexo ${a}` : ''}{previa.parcial ? ` (até o dia ${previa.dia})` : ''}</label>
                <CampoValor valor={previa.valores[a] ?? 0} onValor={(v) => set({ valores: { ...previa.valores, [a]: Math.max(0, v) } })} /></div>
            ))}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="sn-chk"><input type="checkbox" checked={previa.parcial} onChange={(e) => set({ parcial: e.target.checked, dia: e.target.checked && p.corrente === absHoje ? hoje.getDate() : diasNoMes(p.corrente) })} /> É um valor parcial do mês</label>
              {previa.parcial && <label className="sn-chk">apurado até o dia <input className="sn-inp" type="number" min={1} max={diasNoMes(p.corrente)} value={previa.dia} style={{ width: 70 }}
                onChange={(e) => set({ dia: Math.min(diasNoMes(p.corrente), Math.max(1, parseInt(e.target.value) || 1)) })} /> de {diasNoMes(p.corrente)}</label>}
            </div>
            {previa.parcial && <p className="sn-desc">Estimativa para o mês inteiro pela média diária: <b>{fBRL(d.anexos.reduce((s, a) => s + extrapolar(previa.valores[a] ?? 0, previa.dia, p.corrente), 0))}</b></p>}
            {lancado > 0 && (
              <p className="sn-desc">Já existe faturamento lançado para {nC}: {fBRL(lancado)}. A projeção usa a prévia digitada.{' '}
                <button className="sn-btn sm" onClick={() => set({ parcial: false, dia: diasNoMes(p.corrente), valores: Object.fromEntries(d.anexos.map((a) => [a, COLUNAS_ANEXO[a].reduce((s, c) => s + (d.receitas[a]?.[mes0De(p.corrente)]?.[c] ?? 0), 0)])) })}>Usar valor lançado</button></p>
            )}
          </div>
        </div>
        <div className="sn-info">🗓 A alíquota de {nP} usa o faturamento dos 12 meses anteriores ({mesAno(p.corrente - 11)} a {nC}). Por isso a prévia de {nC} já permite projetar a alíquota de {nP}. A alíquota de {nC} já está definida pelos meses fechados.</div>
        {semBase && <div className="sn-info" style={{ color: '#9a6700' }}>⚠ Lance ou importe os meses fechados (e o faturamento do ano anterior) para a projeção ficar correta.</div>}
        {p.rbtProximo.origem === 'manual' && <div className="sn-info" style={{ color: '#9a6700' }}>⚠ O RBT12 de {nP} foi digitado manualmente na grade de receitas; a prévia não altera essa projeção.</div>}
      </div>

      <div className="sn-card">
        <h3><Num n={2} />Evolução da alíquota</h3>
        {d.anexos.map((a) => {
          const u = p.ultimoRes?.porAnexo[a], c = p.correnteRes[a]!, n = p.proximoRes[a]!;
          return (
            <div key={a} style={{ marginBottom: 12 }}>
              {d.anexos.length > 1 && <div style={{ fontWeight: 600, color: '#0f2944', margin: '4px 0 8px' }}>Anexo {a} – {NOME_ANEXO[a]}</div>}
              <div className="sn-proj">
                <div className="sn-pc">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="k">Último mês calculado</span>{u && <SeloFaixa f={u.faixa} />}</div>
                  {p.ultimo != null && u ? <>
                    <div className="m">{mesAno(p.ultimo)}</div>
                    <div className="al">Alíquota efetiva</div><div className="big">{fPct(u.ae)}</div>
                    <div className="li"><span>Faturamento</span><b>{fBRL(u.receita)}</b></div>
                    <div className="li"><span>RBT12</span><b>{fBRL(u.rbt12.valor)}</b></div>
                    <div className="li"><span>DAS</span><b>{fBRL(u.das)}</b></div>
                  </> : <><div className="m">Nenhum mês fechado</div><div className="al">Lance os meses fechados</div></>}
                </div>
                <div className="arrow">→</div>
                <div className="sn-pc">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="k">Mês corrente</span><SeloFaixa f={c.faixa} /></div>
                  <div className="m">{nC}</div>
                  <div className="al">Alíquota efetiva</div><div className="big">{c.calculado ? fPct(c.ae) : '—'}</div>
                  <div className="li"><span>Prévia do faturamento</span><b>{fBRL(p.previaPorAnexo[a] ?? 0)}</b></div>
                  <div className="li"><span>RBT12</span><b>{fBRL(p.rbtCorrente.valor)}</b></div>
                  <div className="li"><span>DAS estimado</span><b>{fBRL(c.das)}</b></div>
                  {u && c.calculado && p.ultimo != null && <Variacao de={u.ae} para={c.ae} rotulo={mesAno(p.ultimo)} />}
                </div>
                <div className="arrow g">→</div>
                <div className="sn-pc dark">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="k">Próximo mês · projeção</span><SeloFaixa f={n.faixa} /></div>
                  <div className="m">{nP}</div>
                  <div className="al">Alíquota efetiva</div><div className="big">{n.calculado ? fPct(n.ae) : '—'}</div>
                  <div className="li"><span>RBT12 projetado</span><b>{fBRL(p.rbtProximo.valor)}</b></div>
                  <div className="li"><span>Alíquota nominal</span><b>{n.calculado ? fPct(n.aliqNominal) : '—'}</b></div>
                  <div className="li"><span>Dedução da faixa</span><b>{n.calculado ? fBRL(n.deducao) : '—'}</b></div>
                  {n.calculado && c.calculado && <div><Variacao de={c.ae} para={n.ae} rotulo={nC} />{u && p.ultimo != null && <Variacao de={u.ae} para={n.ae} rotulo={mesAno(p.ultimo)} />}</div>}
                </div>
              </div>
            </div>
          );
        })}
        {p.alertas.map((a) => <div key={a.msg} className="sn-info" style={{ color: a.nivel === 'erro' ? '#b42318' : '#9a6700' }}>⚠ {a.msg}</div>)}
      </div>

      <div className="sn-g2">
        <div className="sn-card"><h3><Num n={3} />Como se chega ao RBT12 de {nP}</h3>
          {p.ponte ? (
            <table className="sn-ponte" style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
              <tr><td>RBT12 de {nC}</td><td>{fBRL(p.ponte.rbtCorrente)}</td></tr>
              <tr><td>+ Faturamento de {nC} (prévia)</td><td>{fBRL(p.ponte.previa)}</td></tr>
              <tr><td>− Faturamento de {mesAno(p.ponte.mesSai)} (sai da conta)</td><td>({fBRL(p.ponte.sai)})</td></tr>
              <tr className="t"><td>= RBT12 de {nP}</td><td>{fBRL(p.rbtProximo.valor)}</td></tr>
            </tbody></table>
          ) : <p>RBT12 de {nP}: <b>{fBRL(p.rbtProximo.valor)}</b> ({{ manual: 'valor digitado', proporcional: 'proporcional ao início de atividade', 'primeiro-mes': 'primeiro mês de atividade', 'sem-atividade': 'sem atividade', calculado: 'calculado' }[p.rbtProximo.origem]}).</p>}
          {p.folgaProximaFaixa != null && <p className="sn-desc" style={{ marginTop: 14 }}>Faltam <b style={{ color: '#0f2944' }}>{fBRL(p.folgaProximaFaixa)}</b> de RBT12 para {nP} passar para a faixa {p.faixaProximo + 1}.</p>}
          {p.maximoManterFaixa != null && <p className="sn-desc">Para {nP} ficar na faixa {p.faixaCorrente} (a mesma de {nC}), o faturamento de {nC} pode ir até <b style={{ color: '#0f2944' }}>{fBRL(p.maximoManterFaixa)}</b>.</p>}
        </div>
        <div className="sn-card"><h3><Num n={4} />Alíquota efetiva mês a mês</h3>
          <Grafico rotulos={p.serie.map((s) => (s.tipo === 'corrente' ? '' : mesAno(s.abs) + (s.tipo === 'projetado' ? ' (proj.)' : '')))}
            linhas={d.anexos.map((a) => ({ nome: `Anexo ${a}`, cor: COR_ANEXO[a], valores: p.serie.map((s) => s.ae[a] ?? null), projetarDesde: corteSerie }))}
            minL={Math.max(0, Math.floor(Math.min(...p.serie.flatMap((s) => Object.values(s.ae) as number[]), 1) * 250) / 250)}
            fmtL={(v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            legenda={d.anexos.flatMap((a) => [{ nome: `Anexo ${a}`, cor: COR_ANEXO[a], tipo: 'linha' as const }, { nome: `Anexo ${a} · projeção`, cor: COR_ANEXO[a], tipo: 'tracejada' as const }])} /></div>
      </div>
    </>
  );
}

