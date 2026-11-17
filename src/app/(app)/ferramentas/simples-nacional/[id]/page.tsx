import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehGestor, exigirUsuario } from '@/lib/auth';
import { carregarCalculo, tabelasDoEscritorio } from '@/lib/simples/servidor';
import { SimplesApp } from './SimplesApp';

export const metadata = { title: 'EcommFlow · Simples Nacional' };

export default async function EmpresaSimples({ params, searchParams: sp }: { params: { id: string }; searchParams: { aba?: string; versao?: string } }) {
  const s = await exigirUsuario();
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) notFound();
  const [c, tabelas] = await Promise.all([carregarCalculo(s.esc, id), tabelasDoEscritorio(s.esc)]);
  if (!c) return (<p>Cálculo não encontrado. <Link href="/ferramentas/simples-nacional">Voltar para a lista</Link></p>);
  return (
    <SimplesApp key={c.id} id={c.id} empresa={{ razao: c.razao_social, cnpj: c.cnpj }} dadosIniciais={c.dados} tabelas={tabelas}
      gestor={ehGestor(s)} abaInicial={sp.aba} versaoInicial={sp.versao ? Number(sp.versao) : undefined}
      atualizado={{ em: c.atualizado_em, por: c.atualizado_por }} />
  );
}
