// Calcular projeção anual baseada no período selecionado
export const calcularProjecaoAnual = (filtroPeriodo, totalEntradas, totalSaidas) => {
  let diasNoPeriodo;
  const hoje = new Date();

  switch (filtroPeriodo) {
    case '7d':
      diasNoPeriodo = 7;
      break;
    case '15d':
      diasNoPeriodo = 15;
      break;
    case '30d':
      diasNoPeriodo = 30;
      break;
    case '90d':
      diasNoPeriodo = 90;
      break;
    case 'mensal':
      diasNoPeriodo = new Date().getDate(); // Dias corridos do mês atual
      break;
    case 'anual':
      const inicioAno = new Date(hoje.getFullYear(), 0, 1);
      diasNoPeriodo = Math.max(1, Math.floor((hoje - inicioAno) / (1000 * 60 * 60 * 24)));
      break;
    case 'todos':
    default:
      diasNoPeriodo = transacoesFiltradasPorPeriodo.length > 0 ? 30 : 1; // Fallback
  }

  if (diasNoPeriodo === 0) diasNoPeriodo = 1;

  const entradasDiarias = totalEntradas / diasNoPeriodo;
  const saidasDiarias = totalSaidas / diasNoPeriodo;

  return {
    entradas: filtroPeriodo === 'anual' ? entradasDiarias * 365 : totalEntradas,
    saidas: filtroPeriodo === 'anual' ? saidasDiarias * 365 : totalSaidas,
    saldo: filtroPeriodo === 'anual' ? (entradasDiarias - saidasDiarias) * 365 : (totalEntradas - totalSaidas)
  };
};