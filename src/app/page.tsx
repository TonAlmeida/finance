'use client';

import { useFinanceiro } from '@/hooks/useFinanceiro';
import DashboardFinanceiro from '@/components/dashboard/DashboardFinanceiro';
import Loading from '@/components/Loading';
import ErrorMessage from '@/components/ErrorMessage';

export default function HomePage() {
  const { dados, carregando, erro, recarregar } = useFinanceiro();

  if (carregando) {
    return <Loading />;
  }

  if (erro) {
    return <ErrorMessage mensagem={erro} onRetry={recarregar} />;
  }

  if (!dados) {
    return <ErrorMessage mensagem="Nenhum dado financeiro disponível" onRetry={recarregar} />;
  }

  return <DashboardFinanceiro dados={dados} />;
}