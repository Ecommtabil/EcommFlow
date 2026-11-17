import 'server-only';
import ExcelJS from 'exceljs';
import { COLUNAS_PLANILHA } from './clientes';
import { MEIOS_ENVIO, RAMOS, REGIMES } from './format';

export type LinhaCliente = (string | null)[];

/** Monta a planilha de empresas (modelo vazio ou exportação) com listas de validação. */
export async function planilhaClientes(linhas: LinhaCliente[], responsaveis: string[], modelo: boolean): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EcommFlow';
  const ws = wb.addWorksheet('EMPRESAS', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUNAS_PLANILHA.map((h, i) => ({ header: h, key: `c${i}`, width: [20, 48, 11, 22, 22, 18, 16, 22, 20, 28, 30, 10][i] }));
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  cab.alignment = { vertical: 'middle', wrapText: true };
  cab.height = 32;
  [1, 2].forEach((c) => (cab.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }));
  linhas.forEach((l) => ws.addRow(l));
  if (modelo) ws.addRow(['00.000.000/0001-00', 'EMPRESA EXEMPLO LTDA (apague esta linha)', '', '', 'COMERCIO', 'Simples Nacional', '01/2026', responsaveis[0] ?? '', 'E-MAIL', 'Maria - Financeiro', 'financeiro@exemplo.com.br', 'SIM']);
  ws.getColumn(1).numFmt = '@';
  ws.getColumn(7).numFmt = '@';

  // Listas (aba oculta) para os campos de escolha
  const L = wb.addWorksheet('LISTAS', { state: 'veryHidden' });
  const listas = [RAMOS, REGIMES, MEIOS_ENVIO, responsaveis, ['SIM', 'NÃO']];
  listas.forEach((itens, i) => itens.forEach((v, j) => (L.getCell(j + 1, i + 1).value = v)));
  const ref = (i: number) => `LISTAS!$${String.fromCharCode(65 + i)}$1:$${String.fromCharCode(65 + i)}$${Math.max(listas[i].length, 1)}`;
  const max = Math.max(linhas.length + 500, 1000);
  for (let r = 2; r <= max; r++) {
    [[5, 0], [6, 1], [9, 2], [8, 3], [12, 4]].forEach(([c, li]) => {
      ws.getCell(r, c).dataValidation = { type: 'list', allowBlank: true, formulae: [ref(li)], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Escolha um item da lista.' };
    });
  }

  const I = wb.addWorksheet('INSTRUÇÕES');
  I.getColumn(1).width = 110;
  [
    'COMO PREENCHER A PLANILHA DE EMPRESAS',
    '',
    '• Preencha a aba EMPRESAS (uma empresa por linha). Não altere os títulos da linha 1.',
    '• Obrigatórios: CNPJ/CPF e RAZÃO SOCIAL (para empresa nova).',
    '• Se o CNPJ/CPF já existir no sistema, a empresa é ATUALIZADA; se não existir, é CADASTRADA.',
    '• Na atualização, células em branco mantêm o valor atual do sistema.',
    '• RAMO, REGIME, MEIO DE ENVIO, RESPONSÁVEL e ATIVO: escolha um item da lista da célula.',
    '• RESPONSÁVEL (ANALISTA) = usuário do escritório responsável pela empresa.',
    '• CONTATO = pessoa do cliente que recebe as guias (ex.: Maria - Financeiro).',
    '• ENTRADA NO ESCRITÓRIO no formato MM/AAAA (ex.: 03/2026).',
    '• Importe em Cadastros → Clientes → Importar planilha.',
  ].forEach((t, i) => { const c = I.getCell(i + 1, 1); c.value = t; if (i === 0) c.font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } }; });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function respostaXlsx(buf: Buffer, nome: string) {
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
