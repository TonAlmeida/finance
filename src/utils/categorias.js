// utils/categorias.js
export const categoriasCorrigidas = {
  'TABACARIA': 'Tabaco',
  'PANIFICADORA': 'Alimentação',
  'PADARIA': 'Alimentação',
  'RESTAURANTE': 'Alimentação',
  'LANCHONETE': 'Alimentação',
  'MERCADO': 'Alimentação',
  'SUPERMERCADO': 'Alimentação',
  'HORTIFRUTI': 'Alimentação',
  'ACOUGUE': 'Alimentação',
  'UBER': 'Transporte',
  'TAXI': 'Transporte',
  'POSTO': 'Transporte',
  'COMBUSTIVEL': 'Transporte',
  'ESTACIONAMENTO': 'Transporte',
  'FARMACIA': 'Saúde',
  'DROGARIA': 'Saúde',
  'HOSPITAL': 'Saúde',
  'CLINICA': 'Saúde',
  'DENTISTA': 'Saúde',
  'CINEMA': 'Entretenimento',
  'SHOPPING': 'Entretenimento',
  'LOJA': 'Compras',
  'SUPERMERCADO': 'Compras',
  'MERCADO': 'Compras',
  'PIX': 'Transferência',
  'TED': 'Transferência',
  'DOC': 'Transferência',
  'TRANSFERENCIA': 'Transferência',
  'SAUDE': 'Saúde',
  'EDUCACAO': 'Educação',
  'ESCOLA': 'Educação',
  'FACULDADE': 'Educação',
  'INTERNET': 'Utilidades',
  'AGUA': 'Utilidades',
  'LUZ': 'Utilidades',
  'TELEFONE': 'Utilidades'
};

export const categorizarTransacao = (descricao) => {
  const descUpper = descricao.toUpperCase();
  
  for (const [palavraChave, categoria] of Object.entries(categoriasCorrigidas)) {
    if (descUpper.includes(palavraChave)) {
      return categoria;
    }
  }
  
  // Fallback para transferências
  if (descUpper.includes('PIX') || descUpper.includes('TED') || descUpper.includes('DOC') || descUpper.includes('TRANSF')) {
    return 'Transferência';
  }
  
  // Fallback para compras
  if (descUpper.includes('LOJA') || descUpper.includes('SUPER') || descUpper.includes('MERCAD')) {
    return 'Compras';
  }
  
  return 'Outros';
};