import Link from 'next/link';
import { exigirUsuario } from '@/lib/auth';

export const metadata = { title: 'EcommFlow · Ferramentas' };

export default async function Ferramentas() {
  await exigirUsuario();
  return (
    <>
      <h2 style={{ margin: '0 0 4px' }}>🧰 Ferramentas</h2>
      <p className="mut" style={{ margin: '0 0 16px' }}>Ferramentas de apuração que substituem as planilhas do dia a dia.</p>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        <div className="card">
          <h3>🧮 Cálculo do Simples Nacional</h3>
          <p className="desc" style={{ minHeight: 54 }}>DAS mês a mês por anexo, com receita segregada (ST de ICMS, monofásico e retenção de ISS), RBT12 automático e partilha por tributo.</p>
          <Link className="btn" href="/ferramentas/simples-nacional">Abrir calculadora</Link>
        </div>
      </div>
    </>
  );
}
