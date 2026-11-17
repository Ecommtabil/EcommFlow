import { exigirGestor } from '@/lib/auth';
import { Importar } from './Importar';

export const metadata = { title: 'EcommFlow · Importar empresas' };

export default async function Page() {
  await exigirGestor();
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>Importar empresas por planilha</h2>
      <Importar />
    </>
  );
}
