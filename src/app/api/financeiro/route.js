import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Caminho absoluto para a pasta risoflora-finance
const CAMINHO_ABSOLUTO = '/home/ton/Downloads/risoflora-finance';

export async function GET() {
  try {
    // Verificar se a pasta existe no caminho absoluto
    if (!fs.existsSync(CAMINHO_ABSOLUTO)) {
      return NextResponse.json(
        { 
          error: 'Pasta não encontrada',
          message: `A pasta não foi encontrada no caminho: ${CAMINHO_ABSOLUTO}`,
          instrucoes: [
            '1. Verifique se o caminho está correto',
            '2. Crie a pasta: mkdir -p /home/ton/Downloads/risoflora-finance',
            '3. Coloque arquivos CSV na pasta'
          ]
        },
        { status: 404 }
      );
    }

    // Ler arquivos CSV
    const arquivos = fs.readdirSync(CAMINHO_ABSOLUTO).filter(arquivo => 
      arquivo.toLowerCase().endsWith('.csv')
    );

    if (arquivos.length === 0) {
      return NextResponse.json(
        { 
          error: 'Nenhum arquivo CSV encontrado',
          message: 'Coloque arquivos CSV na pasta "/home/ton/Downloads/risoflora-finance"',
          arquivos_encontrados: fs.readdirSync(CAMINHO_ABSOLUTO)
        },
        { status: 404 }
      );
    }

    // Processar arquivos
    const dados = await processarArquivos(CAMINHO_ABSOLUTO, arquivos);
    
    return NextResponse.json({
      ...dados,
      _info: {
        pasta: CAMINHO_ABSOLUTO,
        arquivos_processados: arquivos,
        total_arquivos: arquivos.length
      }
    });
  } catch (error) {
    console.error('Erro na API:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function processarArquivos(pasta, arquivos) {
  const transacoes = [];
  const categorias = {};
  const evolucaoDiaria = {};
  let totalGasto = 0;
  let quantidadeTransacoes = 0;
  let maiorGasto = 0;
  let dataMaisAntiga = null;
  let dataMaisRecente = null;

  const mapeamentoCategorias = {
    'TABACARIA': 'Tabaco',
    'PANIFICADORA': 'Alimentação',
    'PADARIA': 'Alimentação',
    'RESTAURANTE': 'Alimentação',
    'LANCHONETE': 'Alimentação',
    'MERCADO': 'Alimentação',
    'SUPERMERCADO': 'Alimentação',
    'UBER': 'Transporte',
    'TAXI': 'Transporte',
    'POSTO': 'Transporte',
    'COMBUSTIVEL': 'Transporte',
    'FARMACIA': 'Saúde',
    'DROGARIA': 'Saúde',
    'HOSPITAL': 'Saúde',
    'CLINICA': 'Saúde',
    'CINEMA': 'Entretenimento',
    'SHOPPING': 'Entretenimento',
    'LOJA': 'Compras',
    'TRANSFERENCIA': 'Transferência',
    'PIX': 'Transferência',
    'TED': 'Transferência',
    'DOC': 'Transferência',
    'SAO FELIX': 'Tabaco',
    'IDEAL': 'Alimentação',
    'OLIVEIRA': 'Transferência'
  };

  // Processar cada arquivo
  for (const arquivo of arquivos) {
    const caminhoArquivo = path.join(pasta, arquivo);
    
    try {
      const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
      const linhas = conteudo.split('\n').filter(linha => linha.trim());

      // Pular cabeçalho se existir
      const linhasParaProcessar = linhas[0].includes('Data,Valor,Identificador') 
        ? linhas.slice(1) 
        : linhas;

      for (let i = 0; i < linhasParaProcessar.length; i++) {
        const linha = linhasParaProcessar[i];
        
        // Dividir a linha por vírgulas, mas considerar que a descrição pode conter vírgulas
        const primeiraVirgula = linha.indexOf(',');
        const segundaVirgula = linha.indexOf(',', primeiraVirgula + 1);
        const terceiraVirgula = linha.indexOf(',', segundaVirgula + 1);

        if (primeiraVirgula === -1 || segundaVirgula === -1) continue;

        const dataStr = linha.slice(0, primeiraVirgula).trim();
        const valorStr = linha.slice(primeiraVirgula + 1, segundaVirgula).trim();
        const identificador = linha.slice(segundaVirgula + 1, terceiraVirgula !== -1 ? terceiraVirgula : undefined).trim();
        const descricao = terceiraVirgula !== -1 ? linha.slice(terceiraVirgula + 1).trim() : '';

        try {
          // Converter valor
          const valor = parseFloat(valorStr.replace(',', '.').replace(/[^\d.-]/g, ''));
          if (isNaN(valor)) continue;

          // Determinar categoria
          let categoria = 'Outros';
          const descUpper = descricao.toUpperCase();
          
          for (const [palavra, cat] of Object.entries(mapeamentoCategorias)) {
            if (descUpper.includes(palavra)) {
              categoria = cat;
              break;
            }
          }

          // Converter data (formato DD/MM/YYYY)
          const partesData = dataStr.split('/');
          if (partesData.length !== 3) continue;
          
          const [dia, mes, ano] = partesData;
          const data = new Date(`${ano}-${mes}-${dia}`);
          if (isNaN(data.getTime())) continue;

          // Atualizar datas
          if (!dataMaisAntiga || data < dataMaisAntiga) dataMaisAntiga = data;
          if (!dataMaisRecente || data > dataMaisRecente) dataMaisRecente = data;

          // Atualizar estatísticas (apenas para valores negativos - gastos)
          if (valor < 0) {
            const valorAbs = Math.abs(valor);
            totalGasto += valorAbs;
            quantidadeTransacoes++;
            
            if (valorAbs > maiorGasto) maiorGasto = valorAbs;

            // Atualizar categorias
            categorias[categoria] = (categorias[categoria] || 0) + valorAbs;

            // Atualizar evolução diária
            evolucaoDiaria[dataStr] = (evolucaoDiaria[dataStr] || 0) + valorAbs;
          }

          transacoes.push({
            data: dataStr,
            valor,
            identificador: identificador || `id-${arquivo}-${i}-${Date.now()}`,
            descricao,
            categoria
          });

        } catch (error) {
          console.log('Erro ao processar linha:', error, linha);
        }
      }
    } catch (error) {
      console.log('Erro ao ler arquivo:', arquivo, error);
    }
  }

  // Formatar categorias
  const totalCategorias = Object.values(categorias).reduce((sum, val) => sum + val, 0);
  const categoriasFormatadas = Object.entries(categorias).map(([nome, total]) => ({
    nome,
    total: Math.round(total * 100) / 100,
    percentual: totalCategorias > 0 ? Math.round((total / totalCategorias) * 100 * 100) / 100 : 0
  }));

  // Formatar evolução diária
  const evolucaoFormatada = Object.entries(evolucaoDiaria)
    .sort(([dataA], [dataB]) => {
      const [diaA, mesA, anoA] = dataA.split('/');
      const [diaB, mesB, anoB] = dataB.split('/');
      return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
    })
    .map(([data, total]) => ({
      data,
      total: Math.round(total * 100) / 100
    }));

  return {
    periodo: {
      inicio: dataMaisAntiga ? formatarData(dataMaisAntiga) : '',
      fim: dataMaisRecente ? formatarData(dataMaisRecente) : ''
    },
    resumo: {
      total_gasto: Math.round(totalGasto * 100) / 100,
      quantidade_transacoes: quantidadeTransacoes,
      media_por_transacao: quantidadeTransacoes > 0 ? Math.round((totalGasto / quantidadeTransacoes) * 100) / 100 : 0,
      maior_gasto: Math.round(maiorGasto * 100) / 100
    },
    transacoes: transacoes.sort((a, b) => {
      const [diaA, mesA, anoA] = a.data.split('/');
      const [diaB, mesB, anoB] = b.data.split('/');
      return new Date(anoB, mesB - 1, diaB) - new Date(anoA, mesA - 1, diaA);
    }),
    categorias: categoriasFormatadas,
    evolucao_diaria: evolucaoFormatada
  };
}

function formatarData(data) {
  const dia = data.getDate().toString().padStart(2, '0');
  const mes = (data.getMonth() + 1).toString().padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}