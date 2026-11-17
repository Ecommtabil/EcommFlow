import { exigirFinanceiro } from '@/lib/auth';
import { FinTabs } from './FinTabs';

export default async function FinLayout({ children }: { children: React.ReactNode }) {
  await exigirFinanceiro();
  return (
    <>
      <h2 style={{ margin: '0 0 14px' }}>💰 Módulo Financeiro</h2>
      <FinTabs />
      {children}
    </>
  );
}
