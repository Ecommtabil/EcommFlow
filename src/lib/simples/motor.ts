// Motor de cálculo do Simples Nacional (LC 123/2006).
// Módulo puro (sem banco e sem tela): usado no servidor e no navegador.
// Precisão total nos cálculos; arredondamento só na exibição.

export type AnexoId = 'I' | 'II' | 'III' | 'IV' | 'V';
export type Tributo = 'CPP' | 'IRPJ' | 'CSLL' | 'COFINS' | 'PIS' | 'ICMS' | 'IPI' | 'ISS';
export type Coluna = 'integral' | 'st' | 'mono' | 'stMono' | 'semRet' | 'comRet';
export type MesReceita = Partial<Record<Coluna, number>>;
export interface FaixaTabela { aliquota: number; deducao: number; partilha: Partial<Record<Tributo, number>> }
export type TabelasSimples = Record<AnexoId, FaixaTabela[]>;
export type TabelasPorAno = Record<string, TabelasSimples>;

export interface Previa { mesCorrente: number; valores: Partial<Record<AnexoId, number>>; parcial: boolean; dia: number }
export interface Conferencia { rbt12: number; das?: number | null; arquivo: string }

/** Dados de um cálculo (empresa × ano-calendário). */
export interface DadosSimples {
  ano: number;
  anexos: AnexoId[];
  inicioAtividade: boolean;
  mesInicio: string | null;               // 'AAAA-MM'
  anoAnterior: number[];                  // 12 posições
  receitas: Partial<Record<AnexoId, MesReceita[]>>;
  rbt12Manual: (number | null)[];         // 12 posições
  conferencias: Record<string, Conferencia>;
  folha: Record<string, number>;
  previa?: Previa | null;
}

// ---------------------------------------------------------------- constantes
export const ANEXOS: AnexoId[] = ['I', 'II', 'III', 'IV', 'V'];
export const NOME_ANEXO: Record<AnexoId, string> = { I: 'Comércio', II: 'Indústria', III: 'Serviços', IV: 'Serviços', V: 'Serviços' };
export const LIMITES = [180000, 360000, 720000, 1800000, 3600000, 4800000];
export const TETO = 4800000;
export const SUBLIMITE = 3600000;
export const TETO_ISS = 0.05;
export const ANO_PADRAO = 2025;
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const TRIBUTOS_ANEXO: Record<AnexoId, Tributo[]> = {
  I: ['CPP', 'CSLL', 'ICMS', 'IRPJ', 'COFINS', 'PIS'],
  II: ['CPP', 'IPI', 'CSLL', 'ICMS', 'IRPJ', 'COFINS', 'PIS'],
  III: ['CPP', 'ISS', 'CSLL', 'IRPJ', 'COFINS', 'PIS'],
  IV: ['ISS', 'CSLL', 'IRPJ', 'COFINS', 'PIS'],
  V: ['CPP', 'ISS', 'CSLL', 'IRPJ', 'COFINS', 'PIS'],
};
export const COLUNAS_ANEXO: Record<AnexoId, Coluna[]> = {
  I: ['integral', 'st', 'mono', 'stMono'], II: ['integral', 'st', 'mono', 'stMono'],
  III: ['semRet', 'comRet'], IV: ['semRet', 'comRet'], V: ['semRet', 'comRet'],
};
export const EXCLUSOES: Record<Coluna, Tributo[]> = {
  integral: [], st: ['ICMS'], mono: ['COFINS', 'PIS'], stMono: ['ICMS', 'COFINS', 'PIS'], semRet: [], comRet: ['ISS'],
};
export const COLUNA_PRINCIPAL = (a: AnexoId): Coluna => (a === 'I' || a === 'II' ? 'integral' : 'semRet');
export const NOME_COLUNA: Record<Coluna, string> = {
  integral: 'Tributada integralmente', st: 'ST de ICMS', mono: 'Monofásico PIS/COFINS', stMono: 'ST ICMS + monofásico',
  semRet: 'Serviço sem retenção de ISS', comRet: 'Serviço com retenção de ISS',
};
export const DICA_COLUNA: Record<Coluna, string> = {
  integral: 'Receita sem nenhuma exclusão: paga todos os tributos do DAS.',
  st: 'Mercadorias com ICMS já recolhido por substituição tributária: o ICMS sai do DAS.',
  mono: 'Mercadorias com PIS e COFINS monofásicos: PIS e COFINS saem do DAS.',
  stMono: 'Mercadorias com ST de ICMS e PIS/COFINS monofásicos: os três saem do DAS.',
  semRet: 'Serviços em que o ISS é pago no próprio DAS.',
  comRet: 'Serviços com ISS retido pelo tomador: o ISS sai do DAS.',
};

// ---------------------------------------------------------------- utilidades
const pos = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
export const absMes = (ano: number, mes0: number) => ano * 12 + mes0;
export const anoDe = (abs: number) => Math.floor(abs / 12);
export const mes0De = (abs: number) => ((abs % 12) + 12) % 12;
export const rotuloMes = (abs: number) => `${MESES[mes0De(abs)]}/${String(anoDe(abs)).slice(2)}`;
export const rotuloMesLongo = (abs: number) => `${MESES_LONGOS[mes0De(abs)]}/${anoDe(abs)}`;
export const chaveMes = (abs: number) => `${anoDe(abs)}-${String(mes0De(abs) + 1).padStart(2, '0')}`;
export const absDeChave = (k: string) => { const [a, m] = k.split('-').map(Number); return absMes(a, m - 1); };
export const diasNoMes = (abs: number) => new Date(anoDe(abs), mes0De(abs) + 1, 0).getDate();

export function dadosVazios(ano: number, anexos: AnexoId[] = ['I']): DadosSimples {
  return normalizar({ ano, anexos, inicioAtividade: false, mesInicio: null, anoAnterior: [], receitas: {}, rbt12Manual: [], conferencias: {}, folha: {}, previa: null });
}

/** Garante 12 meses por anexo, 12 posições no ano anterior e no RBT12 manual. */
export function normalizar(d: Partial<DadosSimples> & { ano: number }): DadosSimples {
  const anexos = ANEXOS.filter((a) => (d.anexos ?? ['I']).includes(a));
  const receitas: Partial<Record<AnexoId, MesReceita[]>> = { ...(d.receitas ?? {}) };
  for (const a of anexos) receitas[a] = Array.from({ length: 12 }, (_, i) => ({ ...(receitas[a]?.[i] ?? {}) }));
  return {
    ano: d.ano,
    anexos: anexos.length ? anexos : ['I'],
    inicioAtividade: !!d.inicioAtividade,
    mesInicio: d.mesInicio ?? null,
    anoAnterior: Array.from({ length: 12 }, (_, i) => pos(d.anoAnterior?.[i])),
    receitas,
    rbt12Manual: Array.from({ length: 12 }, (_, i) => { const v = d.rbt12Manual?.[i]; return v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)); }),
    conferencias: d.conferencias ?? {},
    folha: d.folha ?? {},
    previa: d.previa ?? null,
  };
}

// ---------------------------------------------------------------- tabelas
/** Versão vigente: a do próprio ano; senão a mais recente anterior; senão a mais antiga; senão a padrão. */
export function anoVersaoVigente(tabelas: TabelasPorAno, ano: number): number {
  const anos = Object.keys(tabelas).map(Number).sort((a, b) => a - b);
  if (!anos.length) return ANO_PADRAO;
  const ant = anos.filter((a) => a <= ano);
  return ant.length ? ant[ant.length - 1] : anos[0];
}
export function tabelaVigente(tabelas: TabelasPorAno, ano: number, padrao: TabelasSimples): TabelasSimples {
  return tabelas[String(anoVersaoVigente(tabelas, ano))] ?? padrao;
}
export function validarTabela(t: TabelasSimples): string[] {
  const avisos: string[] = [];
  for (const a of ANEXOS) t[a]?.forEach((f, i) => {
    const soma = Object.values(f.partilha).reduce((s, v) => s + (v || 0), 0);
    if (Math.abs(soma - 100) > 0.005) avisos.push(`Anexo ${a}, faixa ${i + 1}: a partilha soma ${soma.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% (deveria ser 100%).`);
  });
  return avisos;
}

// ---------------------------------------------------------------- receitas e RBT12
export const receitaAnexoMes = (d: DadosSimples, a: AnexoId, m: number) =>
  COLUNAS_ANEXO[a].reduce((s, c) => s + pos(d.receitas[a]?.[m]?.[c]), 0);
export const receitaEmpresaMes = (d: DadosSimples, m: number) => d.anexos.reduce((s, a) => s + receitaAnexoMes(d, a, m), 0);

export type FonteReceita = (abs: number) => number;
export const fontePadrao = (d: DadosSimples): FonteReceita => (abs) => {
  const ano = anoDe(abs), m = mes0De(abs);
  if (ano === d.ano - 1) return pos(d.anoAnterior[m]);
  if (ano === d.ano) return receitaEmpresaMes(d, m);
  return 0;
};

export type OrigemRbt12 = 'manual' | 'calculado' | 'proporcional' | 'primeiro-mes' | 'sem-atividade';
export interface Rbt12 { valor: number; origem: OrigemRbt12; meses?: number }

export function rbt12(d: DadosSimples, abs: number, fonte: FonteReceita = fontePadrao(d)): Rbt12 {
  if (anoDe(abs) === d.ano) {
    const man = d.rbt12Manual[mes0De(abs)];
    if (man != null) return { valor: man, origem: 'manual' };
  }
  if (d.inicioAtividade) {
    const ini = d.mesInicio ? absDeChave(d.mesInicio) : absMes(d.ano, 0);
    const n = abs - ini;
    if (n < 0) return { valor: 0, origem: 'sem-atividade' };
    if (n === 0) return { valor: fonte(abs) * 12, origem: 'primeiro-mes' };
    if (n < 12) {
      let s = 0;
      for (let i = 1; i <= n; i++) s += fonte(abs - i);
      return { valor: (s / n) * 12, origem: 'proporcional', meses: n };
    }
  }
  let s = 0;
  for (let i = 1; i <= 12; i++) s += fonte(abs - i);
  return { valor: s, origem: 'calculado' };
}

export function descricaoOrigem(r: Rbt12): string {
  switch (r.origem) {
    case 'manual': return 'Valor digitado manualmente';
    case 'proporcional': return `Proporcional: média de ${r.meses} mês(es) de atividade × 12`;
    case 'primeiro-mes': return '1º mês de atividade: receita do mês × 12';
    case 'sem-atividade': return 'Antes do início de atividade';
    default: return 'Calculado: soma dos 12 meses anteriores';
  }
}

// ---------------------------------------------------------------- faixa, alíquota e partilha
export function faixaDe(rbt: number): number {
  if (rbt <= 0) return 0;
  for (let i = 0; i < 6; i++) if (rbt <= LIMITES[i]) return i + 1;
  return 7;
}
export const corFaixa = (f: number) => (f === 0 ? 'neutro' : f <= 2 ? 'verde' : f <= 4 ? 'amarelo' : f === 5 ? 'laranja' : 'vermelho');
export const rotuloFaixa = (f: number) => (f === 0 ? '—' : f === 7 ? 'Acima do teto' : `Faixa ${f}`);

export function aliquotaEfetiva(rbt: number, f: FaixaTabela): number {
  if (rbt <= 0) return 0;
  return (rbt * (f.aliquota / 100) - f.deducao) / rbt;
}

export function partilhaEfetiva(anexo: AnexoId, faixa: number, ae: number, f: FaixaTabela) {
  const trib = TRIBUTOS_ANEXO[anexo];
  const p: Partial<Record<Tributo, number>> = {};
  for (const t of trib) p[t] = (f.partilha[t] ?? 0) / 100;
  if (faixa === 6) { if ('ICMS' in p) p.ICMS = 0; if ('ISS' in p) p.ISS = 0; }
  let issLimitado = false;
  if ((anexo === 'III' || anexo === 'IV' || anexo === 'V') && ae > 0 && ae * (p.ISS ?? 0) > TETO_ISS + 1e-12) {
    const novo = TETO_ISS / ae;
    const exc = (p.ISS ?? 0) - novo;
    p.ISS = novo;
    const fed = trib.filter((t) => t !== 'ISS' && (p[t] ?? 0) > 0);
    const soma = fed.reduce((s, t) => s + (p[t] ?? 0), 0);
    if (soma > 0) for (const t of fed) p[t] = (p[t] ?? 0) + exc * ((p[t] ?? 0) / soma);
    issLimitado = true;
  }
  return { partilha: p, issLimitado };
}

export interface Alerta { nivel: 'erro' | 'aviso' | 'info'; msg: string }
export interface ResultadoMes {
  mes: number; receita: number; colunas: MesReceita; rbt12: Rbt12; faixa: number;
  aliqNominal: number; deducao: number; ae: number; partilha: Partial<Record<Tributo, number>>;
  tributos: Partial<Record<Tributo, number>>; porColuna: Partial<Record<Coluna, number>>;
  das: number; semSegregacao: number; calculado: boolean; issLimitado: boolean; alertas: Alerta[];
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number, c = 0) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c })}%`;

/** Cálculo de um anexo num mês (receita já segregada por coluna). */
export function calcularAnexoMes(anexo: AnexoId, mes: number, colunas: MesReceita, rb: Rbt12, tabela: TabelasSimples, inicioAtividade: boolean): ResultadoMes {
  const receita = COLUNAS_ANEXO[anexo].reduce((s, c) => s + pos(colunas[c]), 0);
  const faixa = faixaDe(rb.valor);
  const alertas: Alerta[] = [];
  const base: ResultadoMes = { mes, receita, colunas, rbt12: rb, faixa, aliqNominal: 0, deducao: 0, ae: 0, partilha: {}, tributos: {}, porColuna: {}, das: 0, semSegregacao: 0, calculado: false, issLimitado: false, alertas };
  if (faixa === 0) {
    if (receita > 0) alertas.push({ nivel: 'erro', msg: inicioAtividade ? 'Informe o RBT12.' : 'Há receita no mês, mas o RBT12 está zerado. Informe o RBT12.' });
    return base;
  }
  if (faixa === 7) {
    alertas.push({ nivel: 'erro', msg: `Excedeu o limite do Simples Nacional (RBT12 ${brl(rb.valor)} acima de ${brl(TETO)}).` });
    return base;
  }
  const f = tabela[anexo][faixa - 1];
  const ae = aliquotaEfetiva(rb.valor, f);
  const { partilha, issLimitado } = partilhaEfetiva(anexo, faixa, ae, f);
  const tributos: Partial<Record<Tributo, number>> = {};
  const porColuna: Partial<Record<Coluna, number>> = {};
  let das = 0;
  for (const c of COLUNAS_ANEXO[anexo]) {
    const r = pos(colunas[c]);
    let soma = 0;
    for (const t of TRIBUTOS_ANEXO[anexo]) {
      if (EXCLUSOES[c].includes(t)) continue;
      const v = r * ae * (partilha[t] ?? 0);
      tributos[t] = (tributos[t] ?? 0) + v;
      soma += v;
    }
    porColuna[c] = soma;
    das += soma;
  }
  for (const t of TRIBUTOS_ANEXO[anexo]) tributos[t] = tributos[t] ?? 0;
  const somaPart = TRIBUTOS_ANEXO[anexo].reduce((s, t) => s + (partilha[t] ?? 0), 0);
  if (faixa === 6 && rb.valor > SUBLIMITE)
    alertas.push({ nivel: 'aviso', msg: anexo === 'I' || anexo === 'II' ? 'Acima do sublimite de R$ 3,6 milhões: ICMS recolhido fora do DAS.' : 'Acima do sublimite de R$ 3,6 milhões: ISS recolhido fora do DAS.' });
  if (issLimitado) alertas.push({ nivel: 'info', msg: 'ISS limitado a 5% efetivo; a diferença foi transferida aos tributos federais.' });
  if (rb.valor > 0.9 * TETO) alertas.push({ nivel: 'aviso', msg: `RBT12 em ${pct(rb.valor / TETO, 1)} do teto de R$ 4,8 milhões.` });
  else if (faixa < 6 && rb.valor > 0.9 * LIMITES[faixa - 1])
    alertas.push({ nivel: 'aviso', msg: `RBT12 em ${pct(rb.valor / LIMITES[faixa - 1], 1)} do limite da faixa ${faixa} (${brl(LIMITES[faixa - 1])}).` });
  return { ...base, aliqNominal: f.aliquota / 100, deducao: f.deducao, ae, partilha, tributos, porColuna, das, semSegregacao: receita * ae * somaPart, calculado: true, issLimitado };
}

// ---------------------------------------------------------------- empresa (ano inteiro)
export interface ResultadoEmpresa {
  anoTabela: number;
  rbt12: Rbt12[];
  porAnexo: Partial<Record<AnexoId, ResultadoMes[]>>;
  dasMes: number[]; receitaMes: number[];
  faturamento: number; das: number; aeMedia: number; aliquotaPaga: number; economia: number;
  porTributo: Partial<Record<Tributo, number>>;
  alertasGerais: Alerta[];
  avisosTabela: string[];
}

export function calcularEmpresa(d: DadosSimples, tabelas: TabelasPorAno, padrao: TabelasSimples): ResultadoEmpresa {
  const anoTabela = anoVersaoVigente(tabelas, d.ano);
  const tabela = tabelaVigente(tabelas, d.ano, padrao);
  const fonte = fontePadrao(d);
  const rbts = Array.from({ length: 12 }, (_, m) => rbt12(d, absMes(d.ano, m), fonte));
  const porAnexo: Partial<Record<AnexoId, ResultadoMes[]>> = {};
  const dasMes = Array(12).fill(0), receitaMes = Array(12).fill(0);
  const porTributo: Partial<Record<Tributo, number>> = {};
  let faturamento = 0, das = 0, aePond = 0, semSeg = 0;
  for (const a of d.anexos) {
    porAnexo[a] = Array.from({ length: 12 }, (_, m) => {
      const r = calcularAnexoMes(a, m, d.receitas[a]?.[m] ?? {}, rbts[m], tabela, d.inicioAtividade);
      dasMes[m] += r.das; receitaMes[m] += r.receita;
      faturamento += r.receita; das += r.das; semSeg += r.semSegregacao;
      if (r.calculado) aePond += r.ae * r.receita;
      for (const [t, v] of Object.entries(r.tributos)) porTributo[t as Tributo] = (porTributo[t as Tributo] ?? 0) + (v ?? 0);
      return r;
    });
  }
  const alertasGerais: Alerta[] = [];
  const ex = rbts.findIndex((r) => r.valor > TETO);
  if (ex >= 0) alertasGerais.push({ nivel: 'erro', msg: `Excedeu o limite do Simples Nacional a partir de ${rotuloMesLongo(absMes(d.ano, ex))}.` });
  return {
    anoTabela, rbt12: rbts, porAnexo, dasMes, receitaMes, faturamento, das,
    aeMedia: faturamento > 0 ? aePond / faturamento : 0,
    aliquotaPaga: faturamento > 0 ? das / faturamento : 0,
    economia: semSeg - das, porTributo, alertasGerais, avisosTabela: validarTabela(tabela),
  };
}

// ---------------------------------------------------------------- projeção
export const extrapolar = (valor: number, dia: number, abs: number) => {
  const dias = diasNoMes(abs);
  if (!(valor > 0) || !(dia >= 1)) return Math.max(0, valor || 0);
  return (valor / Math.min(dia, dias)) * dias;
};

export function ultimoMesFechado(d: DadosSimples, antesDe?: number): number | null {
  const lim = antesDe == null ? 12 : Math.min(12, antesDe - absMes(d.ano, 0));
  for (let m = lim - 1; m >= 0; m--) if (receitaEmpresaMes(d, m) > 0) return absMes(d.ano, m);
  return null;
}
export function mesCorrenteSugerido(d: DadosSimples): number {
  const u = ultimoMesFechado(d);
  return u == null ? absMes(d.ano, 0) : Math.min(u + 1, absMes(d.ano + 1, 0));
}

export interface ResultadoProjecao {
  corrente: number; proximo: number; ultimo: number | null;
  previaPorAnexo: Partial<Record<AnexoId, number>>; previaTotal: number;
  rbtCorrente: Rbt12; rbtProximo: Rbt12;
  ultimoRes: { faixa: number; ae: number; receita: number; rbt12: number; das: number; porAnexo: Partial<Record<AnexoId, ResultadoMes>> } | null;
  correnteRes: Partial<Record<AnexoId, ResultadoMes>>; proximoRes: Partial<Record<AnexoId, ResultadoMes>>;
  dasEstimado: number; faixaCorrente: number; faixaProximo: number;
  ponte: { rbtCorrente: number; previa: number; sai: number; mesSai: number } | null;
  folgaProximaFaixa: number | null; maximoManterFaixa: number | null;
  serie: { abs: number; tipo: 'fechado' | 'corrente' | 'projetado'; ae: Partial<Record<AnexoId, number>> }[];
  alertas: Alerta[];
}

export function projetar(d: DadosSimples, tabelas: TabelasPorAno, padrao: TabelasSimples, previa: Previa): ResultadoProjecao {
  const corrente = previa.mesCorrente;
  const proximo = corrente + 1;
  const previaPorAnexo: Partial<Record<AnexoId, number>> = {};
  for (const a of d.anexos) {
    const v = pos(previa.valores[a]);
    previaPorAnexo[a] = previa.parcial ? extrapolar(v, previa.dia, corrente) : v;
  }
  const previaTotal = d.anexos.reduce((s, a) => s + (previaPorAnexo[a] ?? 0), 0);
  const base = fontePadrao(d);
  const fonte: FonteReceita = (abs) => (abs === corrente ? previaTotal : base(abs));
  const rbtCorrente = rbt12(d, corrente, fonte);
  const rbtProximo = rbt12(d, proximo, fonte);
  const tabC = tabelaVigente(tabelas, anoDe(corrente), padrao);
  const tabP = tabelaVigente(tabelas, anoDe(proximo), padrao);

  // Divide a prévia pelos tipos de receita na proporção do último mês fechado daquele anexo
  const ultimo = ultimoMesFechado(d, corrente);
  const dividir = (a: AnexoId, v: number): MesReceita => {
    const ref = ultimo != null && anoDe(ultimo) === d.ano ? d.receitas[a]?.[mes0De(ultimo)] : undefined;
    const tot = ref ? COLUNAS_ANEXO[a].reduce((s, c) => s + pos(ref[c]), 0) : 0;
    if (!ref || tot <= 0) return { [COLUNA_PRINCIPAL(a)]: v };
    const o: MesReceita = {};
    for (const c of COLUNAS_ANEXO[a]) o[c] = v * (pos(ref[c]) / tot);
    return o;
  };
  const correnteRes: Partial<Record<AnexoId, ResultadoMes>> = {};
  const proximoRes: Partial<Record<AnexoId, ResultadoMes>> = {};
  for (const a of d.anexos) {
    correnteRes[a] = calcularAnexoMes(a, mes0De(corrente), dividir(a, previaPorAnexo[a] ?? 0), rbtCorrente, tabC, d.inicioAtividade);
    proximoRes[a] = calcularAnexoMes(a, mes0De(proximo), { [COLUNA_PRINCIPAL(a)]: 0 }, rbtProximo, tabP, d.inicioAtividade);
  }
  const dasEstimado = d.anexos.reduce((s, a) => s + (correnteRes[a]?.das ?? 0), 0);

  let ultimoRes: ResultadoProjecao['ultimoRes'] = null;
  if (ultimo != null) {
    const rb = rbt12(d, ultimo, base);
    const tab = tabelaVigente(tabelas, anoDe(ultimo), padrao);
    const pa: Partial<Record<AnexoId, ResultadoMes>> = {};
    for (const a of d.anexos) pa[a] = calcularAnexoMes(a, mes0De(ultimo), d.receitas[a]?.[mes0De(ultimo)] ?? {}, rb, tab, d.inicioAtividade);
    const rec = d.anexos.reduce((s, a) => s + (pa[a]?.receita ?? 0), 0);
    const aeP = d.anexos.reduce((s, a) => s + (pa[a]?.ae ?? 0) * (pa[a]?.receita ?? 0), 0);
    ultimoRes = { faixa: faixaDe(rb.valor), ae: rec > 0 ? aeP / rec : pa[d.anexos[0]]?.ae ?? 0, receita: rec, rbt12: rb.valor, das: d.anexos.reduce((s, a) => s + (pa[a]?.das ?? 0), 0), porAnexo: pa };
  }

  const faixaCorrente = faixaDe(rbtCorrente.valor), faixaProximo = faixaDe(rbtProximo.valor);
  const ponte = rbtCorrente.origem === 'calculado' && rbtProximo.origem === 'calculado'
    ? { rbtCorrente: rbtCorrente.valor, previa: previaTotal, sai: fonte(corrente - 12), mesSai: corrente - 12 } : null;
  const folgaProximaFaixa = faixaProximo >= 1 && faixaProximo <= 5 ? LIMITES[faixaProximo - 1] - rbtProximo.valor : null;
  const maximoManterFaixa = rbtProximo.origem === 'calculado' && faixaCorrente >= 1 && faixaCorrente <= 5
    ? Math.max(0, LIMITES[faixaCorrente - 1] - (rbtProximo.valor - previaTotal)) : null;

  const serie: ResultadoProjecao['serie'] = [];
  for (let m = 0; m < 12; m++) {
    const abs = absMes(d.ano, m);
    if (abs >= corrente || receitaEmpresaMes(d, m) <= 0) continue;
    const rb = rbt12(d, abs, base);
    const tab = tabelaVigente(tabelas, d.ano, padrao);
    const ae: Partial<Record<AnexoId, number>> = {};
    for (const a of d.anexos) { const fx = faixaDe(rb.valor); if (fx >= 1 && fx <= 6) ae[a] = aliquotaEfetiva(rb.valor, tab[a][fx - 1]); }
    serie.push({ abs, tipo: 'fechado', ae });
  }
  const aeDe = (r: Partial<Record<AnexoId, ResultadoMes>>) => { const o: Partial<Record<AnexoId, number>> = {}; for (const a of d.anexos) if (r[a]?.calculado) o[a] = r[a]!.ae; return o; };
  serie.push({ abs: corrente, tipo: 'corrente', ae: aeDe(correnteRes) });
  serie.push({ abs: proximo, tipo: 'projetado', ae: aeDe(proximoRes) });

  const alertas: Alerta[] = [];
  const vistos = new Set<string>();
  for (const r of [...Object.values(correnteRes), ...Object.values(proximoRes)]) for (const al of r?.alertas ?? [])
    if (!vistos.has(al.msg)) { vistos.add(al.msg); alertas.push(al); }

  return { corrente, proximo, ultimo, previaPorAnexo, previaTotal, rbtCorrente, rbtProximo, ultimoRes, correnteRes, proximoRes, dasEstimado, faixaCorrente, faixaProximo, ponte, folgaProximaFaixa, maximoManterFaixa, serie, alertas };
}
