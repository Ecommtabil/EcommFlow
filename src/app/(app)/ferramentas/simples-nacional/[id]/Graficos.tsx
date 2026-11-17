'use client';
// Gráficos em SVG (sem bibliotecas externas) no padrão visual azul-marinho + dourado.

export const COR_ANEXO: Record<string, string> = { I: '#0f2944', II: '#5b7fb5', III: '#c9a227', IV: '#7f8ea3', V: '#a7bcd9' };
export const COR_TRIBUTO: Record<string, string> = { CPP: '#0f2944', IRPJ: '#5b7fb5', CSLL: '#a7bcd9', COFINS: '#c9a227', PIS: '#e3cf8a', ICMS: '#7f8ea3', IPI: '#3d5a80', ISS: '#b08d57' };
const GRADE = '#eef1f5', TXT = '#64748b', GOLD = '#c9a227';

const W = 640, H = 260, L = 50, R = 50, T = 12, B = 34;
export const curto = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
function escala(max: number, n = 4) {
  if (max <= 0) return { max: 1, passo: 0.25 };
  const bruto = max / n, p = 10 ** Math.floor(Math.log10(bruto)), r = bruto / p;
  const passo = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
  return { max: passo * Math.ceil(max / passo), passo };
}
/** Curva suave (Catmull-Rom → Bézier). */
function suave(p: [number, number][]) {
  if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : '';
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export interface SerieLinha { nome: string; cor: string; valores: (number | null)[]; projetarDesde?: number }

export function Grafico({ rotulos, barras = [], linhas = [], barrasDireita = false, fmtL = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, fmtB = curto, minL, legenda }: {
  rotulos: string[]; barras?: { nome: string; cor: string; valores: number[] }[]; linhas?: SerieLinha[]; barrasDireita?: boolean;
  fmtL?: (v: number) => string; fmtB?: (v: number) => string; minL?: number; legenda?: { nome: string; cor: string; tipo: 'barra' | 'linha' | 'tracejada' }[];
}) {
  const n = rotulos.length || 1, larg = (W - L - R) / n, x = (i: number) => L + larg * i + larg / 2;
  const soma = rotulos.map((_, i) => barras.reduce((s, b) => s + Math.max(0, b.valores[i] || 0), 0));
  const eb = escala(Math.max(0, ...soma));
  const vl = linhas.flatMap((l) => l.valores.filter((v): v is number => v != null));
  const lo = minL ?? 0;
  const el = escala(Math.max(lo, ...vl) - lo);
  const yB = (v: number) => T + (H - T - B) * (1 - v / eb.max);
  const yL = (v: number) => T + (H - T - B) * (1 - (v - lo) / el.max);
  const nt = barras.length && !linhas.length ? Math.round(eb.max / eb.passo) : Math.round(el.max / el.passo);
  const ticks = Array.from({ length: nt + 1 }, (_, i) => i / nt);
  const eixoB = barras.length > 0, eixoL = linhas.length > 0;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => <line key={t} x1={L} x2={W - R} y1={T + (H - T - B) * (1 - t)} y2={T + (H - T - B) * (1 - t)} stroke={GRADE} />)}
        {eixoB && ticks.map((t) => <text key={'b' + t} x={barrasDireita ? W - R + 8 : L - 8} y={T + (H - T - B) * (1 - t) + 4} fontSize="11" fill={TXT} textAnchor={barrasDireita ? 'start' : 'end'}>{fmtB(eb.max * t)}</text>)}
        {eixoL && ticks.map((t) => <text key={'l' + t} x={barrasDireita || !eixoB ? L - 8 : W - R + 8} y={T + (H - T - B) * (1 - t) + 4} fontSize="11" fill={TXT} textAnchor={barrasDireita || !eixoB ? 'end' : 'start'}>{fmtL(lo + el.max * t)}</text>)}
        {rotulos.map((r, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {barras.map((b) => {
                const v = Math.max(0, b.valores[i] || 0); const y0 = yB(acc), y1 = yB(acc + v); acc += v;
                return v > 0 ? <rect key={b.nome} x={x(i) - larg * 0.3} width={larg * 0.6} y={y1} height={Math.max(0, y0 - y1)} fill={b.cor} rx={2}><title>{`${r} · ${b.nome}: ${fmtB(v)}`}</title></rect> : null;
              })}
              <text x={x(i)} y={H - 12} fontSize={n > 12 ? 9.5 : 11} fill={TXT} textAnchor="middle">{r}</text>
            </g>
          );
        })}
        {linhas.map((l) => {
          const pts = l.valores.map((v, i) => (v == null ? null : ([x(i), yL(v)] as [number, number])));
          const corte = l.projetarDesde ?? pts.length;
          const cheios = pts.slice(0, corte).filter(Boolean) as [number, number][];
          const proj = pts.slice(Math.max(0, corte - 1)).filter(Boolean) as [number, number][];
          return (
            <g key={l.nome}>
              <path d={suave(cheios)} fill="none" stroke={l.cor} strokeWidth={2.2} />
              {corte < pts.length && <path d={suave(proj)} fill="none" stroke={l.cor} strokeWidth={2.2} strokeDasharray="4 4" />}
              {pts.map((p, i) => !p ? null : (corte < pts.length && i >= corte)
                ? <circle key={i} cx={p[0]} cy={p[1]} r={4.5} fill={GOLD} stroke={l.cor} strokeWidth={1.5}><title>{`${rotulos[i]} · ${l.nome}: ${fmtL(l.valores[i]!)}`}</title></circle>
                : <circle key={i} cx={p[0]} cy={p[1]} r={3.8} fill="#fff" stroke={l.cor} strokeWidth={1.8}><title>{`${rotulos[i]} · ${l.nome}: ${fmtL(l.valores[i]!)}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      {legenda && (
        <div className="sn-leg">
          {legenda.map((g) => (
            <span key={g.nome}>
              {g.tipo === 'barra' ? <i style={{ background: g.cor }} /> : (
                <svg width="22" height="10" style={{ marginRight: 6, verticalAlign: -1 }}>
                  <line x1="0" x2="22" y1="5" y2="5" stroke={g.cor} strokeWidth="2" strokeDasharray={g.tipo === 'tracejada' ? '3 3' : undefined} />
                  {g.tipo === 'linha' && <circle cx="11" cy="5" r="3.2" fill="#fff" stroke={g.cor} strokeWidth="1.6" />}
                </svg>)}
              {g.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Rosca({ itens, fmt }: { itens: { nome: string; valor: number; cor: string }[]; fmt: (v: number) => string }) {
  const tot = itens.reduce((s, i) => s + i.valor, 0);
  if (tot <= 0) return <p className="sn-desc">Lance as receitas para ver a composição do DAS.</p>;
  let ang = -Math.PI / 2;
  const gap = itens.length > 1 ? 0.012 : 0;
  const arcos = itens.map((i) => {
    const a = (i.valor / tot) * Math.PI * 2, a0 = ang + gap, a1 = ang + a - gap; ang += a;
    const p = (t: number, r: number) => `${100 + r * Math.cos(t)},${100 + r * Math.sin(t)}`;
    const g = a1 - a0 > Math.PI ? 1 : 0;
    return { ...i, d: a >= Math.PI * 2 - 1e-9 ? 'M100,10 A90,90 0 1 1 99.99,10 L99.99,55 A45,45 0 1 0 100,55 Z' : `M${p(a0, 90)} A90,90 0 ${g} 1 ${p(a1, 90)} L${p(a1, 52)} A52,52 0 ${g} 0 ${p(a0, 52)} Z` };
  });
  return (
    <div>
      <svg viewBox="0 0 200 200" style={{ width: 190, display: 'block', margin: '0 auto 12px' }}>{arcos.map((a) => <path key={a.nome} d={a.d} fill={a.cor}><title>{`${a.nome}: ${fmt(a.valor)}`}</title></path>)}</svg>
      {itens.map((i) => (
        <div key={i.nome} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', fontSize: 14 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: i.cor, marginRight: 10, flexShrink: 0 }} />
          <span style={{ flex: 1, color: '#0f172a' }}>{i.nome}</span>
          <span style={{ width: 80, textAlign: 'right', color: '#7b8798' }}>{((i.valor / tot) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
          <span style={{ width: 120, textAlign: 'right', color: '#0f2944' }}>{fmt(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}
