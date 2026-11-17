export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export const fmtData = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

export const fmtDataHora = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const fmtComp = (d?: string | null) => (d ? `${MESES[+d.slice(5, 7) - 1]}/${d.slice(0, 4)}` : '—');

export const STATUS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};
export const PRIORIDADE: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const SITUACAO_BOLETO: Record<string, string> = {
  recebido: 'Recebido',
  a_receber: 'A receber',
  vencido: 'Vencido',
  nao_gerado: 'Não gerado',
};
export const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real'];
export const RAMOS = ['INDUSTRIA', 'COMERCIO', 'SERVICO', 'COMERCIO E SERVICO', 'INDUSTRIA E COMERCIO', 'TRANSPORTE', 'LOCACAO/ALUGUEL', 'HOLDING'];
export const MEIOS_ENVIO = ['E-MAIL', 'WHATSAPP', 'E-MAIL E WHATSAPP', 'PORTAL', 'DOCUMENTO FISICO', 'OUTRO'];
export const ROTULO_MEIO: Record<string, string> = { 'E-MAIL': 'E-mail', WHATSAPP: 'WhatsApp', 'E-MAIL E WHATSAPP': 'E-mail e WhatsApp', PORTAL: 'Portal', 'DOCUMENTO FISICO': 'Documento físico', OUTRO: 'Outro' };
/** Tarefas de envio de guia mostram MEIO DE ENVIO e CONTATO da empresa */
export const ehEnvioGuia = (titulo: string) => /ENVIO DE GUIA|ENVIAR GUIA/i.test(titulo);

export const digitos = (x?: string | null) => (x || '').replace(/\D/g, '');

export function mascaraDoc(x: string): string {
  const d = digitos(x).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

/** Converte "1.234,56" ou "1234.56" em número */
export function parseValor(v: string): number {
  const s = (v || '').trim();
  if (!s) return NaN;
  return s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
}

export const normalizar = (x?: string | null) =>
  (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
