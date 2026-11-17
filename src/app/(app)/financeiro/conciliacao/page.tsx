import { exigirFinanceiro } from '@/lib/auth';
import { Conciliacao } from './Conciliacao';

export const metadata = { title: 'EcommFlow · Conciliar boletos' };

export default async function Page() {
  await exigirFinanceiro();
  return <Conciliacao />;
}
