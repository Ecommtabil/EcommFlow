// Formatação e leitura de valores da calculadora (navegador e servidor).
export const fBRL = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fNum = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fPct = (v: number, casas = 4) => `${((Number.isFinite(v) ? v : 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const fPP = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} p.p.`;

/** Lê "1.234,56", "1,234.56", "1234.56", "R$ 1.234", "1.000" (= mil); parênteses ou "-" = negativo; inválido = null. */
export function lerValor(x: unknown): number | null {
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  let s = String(x ?? '').trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/R\$|\s/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s)) return null;
  const uv = s.lastIndexOf(','), up = s.lastIndexOf('.');
  if (uv >= 0 && up >= 0) s = uv > up ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (uv >= 0) s = (s.match(/,/g)!.length > 1 ? s.replace(/,/g, '') : s.replace(',', '.'));
  else if (up >= 0 && (s.match(/\./g)!.length > 1 || /\.\d{3}$/.test(s))) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Converte o texto colado do Excel em matriz (linhas × colunas). */
export const lerColagem = (t: string) => t.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
