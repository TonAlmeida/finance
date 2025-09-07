// utils/formatar.js
export const formatarValor = (valor) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

export const extrairDestinatarios = (transacoes) => {
  const destinatarios = {};
  
  transacoes.forEach(transacao => {
    let destinatario = 'Desconhecido';
    const descricao = transacao.descricao;
    
    // Padrões comuns em descrições brasileiras
    if (descricao.includes(' - ')) {
      const partes = descricao.split(' - ');
      if (partes.length >= 2) {
        destinatario = partes[1].split(' - ')[0].split(' (')[0].split(' CNPJ:')[0];
      }
    } else if (descricao.includes('para ')) {
      destinatario = descricao.split('para ')[1]?.split(' - ')[0] || 'Desconhecido';
    } else if (descricao.includes('POR ')) {
      destinatario = descricao.split('POR ')[1]?.split(' - ')[0] || 'Desconhecido';
    }
    
    // Limitar e limpar o nome
    destinatario = destinatario.trim();
    if (destinatario.length > 25) {
      destinatario = destinatario.substring(0, 25) + '...';
    }
    
    if (destinatarios[destinatario]) {
      destinatarios[destinatario].count++;
      destinatarios[destinatario].total += Math.abs(transacao.valor);
    } else {
      destinatarios[destinatario] = {
        count: 1,
        total: Math.abs(transacao.valor),
        tipo: transacao.valor > 0 ? 'entrada' : 'saida'
      };
    }
  });
  
  return Object.entries(destinatarios)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.count - a.count);
};

export const gerarOpcoesAnos = () => {
  const anos = [];
  const anoAtual = new Date().getFullYear();
  for (let i = anoAtual; i >= anoAtual - 5; i--) {
    anos.push(i.toString());
  }
  anos.push('todos');
  return anos;
};

export const filtrarPorPeriodo = (transacoes, periodo) => {
  if (!transacoes || !Array.isArray(transacoes)) return [];

  if (periodo === 'todos') return transacoes;

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  let dataInicio = new Date(hoje);

  switch (periodo) {
    case '7d':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6);
      break;
    case '15d':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 14);
      break;
    case '30d':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29);
      break;
    case '90d':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 89);
      break;
    case 'mensal':
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      break;
    case 'anual':
      dataInicio = new Date(hoje.getFullYear(), 0, 1);
      break;
    default:
      dataInicio = new Date(0);
  }

  dataInicio.setHours(0, 0, 0, 0);

  return transacoes.filter(t => {
    const dataTransacao = new Date(t.data);
    return dataTransacao >= dataInicio && dataTransacao <= hoje;
  });
};