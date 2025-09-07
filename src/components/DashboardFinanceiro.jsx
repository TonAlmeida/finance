'use client';

import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Calendar, Filter, Download, Wallet, ArrowUpCircle, ArrowDownCircle, BarChart3, Target, Users, Folder, Search, FileText, FolderOpen, Crown, Zap, PieChart } from 'lucide-react';

// Função para formatar valores em reais com ponto de milhar
const formatarValor = (valor) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

// Função para filtrar transações por período
const filtrarPorPeriodo = (transacoes, periodo) => {
  const hoje = new Date();
  const dataLimite = new Date();
  
  switch (periodo) {
    case '7d':
      dataLimite.setDate(hoje.getDate() - 7);
      break;
    case '15d':
      dataLimite.setDate(hoje.getDate() - 15);
      break;
    case '30d':
      dataLimite.setDate(hoje.getDate() - 30);
      break;
    case '90d':
      dataLimite.setDate(hoje.getDate() - 90);
      break;
    case 'mensal':
      dataLimite.setDate(1); // Primeiro dia do mês atual
      break;
    case 'anual':
      dataLimite.setMonth(0, 1); // Primeiro dia do ano atual
      break;
    case 'todos':
    default:
      return transacoes; // Retorna todas as transações
  }
  
  return transacoes.filter(transacao => {
    const dataTransacao = new Date(transacao.data);
    return dataTransacao >= dataLimite;
  });
};

// Função para extrair destinatários das descrições
const extrairDestinatarios = (transacoes) => {
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

// Gerar anos para o seletor
const gerarOpcoesAnos = () => {
  const anos = [];
  const anoAtual = new Date().getFullYear();
  for (let i = anoAtual; i >= anoAtual - 5; i--) {
    anos.push(i.toString());
  }
  anos.push('todos');
  return anos;
};

// Categorias corrigidas baseadas em padrões brasileiros
const categoriasCorrigidas = {
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

const categorizarTransacao = (descricao) => {
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

export default function DashboardFinanceiro({ dados }) {
  const [filtroPeriodo, setFiltroPeriodo] = useState('30d');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const fileInputRef = useRef(null);

  if (!dados) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  // Processar categorias corretamente
  const transacoesComCategoriasCorrigidas = useMemo(() => {
    return dados.transacoes.map(transacao => ({
      ...transacao,
      categoria: categorizarTransacao(transacao.descricao)
    }));
  }, [dados.transacoes]);

  const { periodo, evolucao_diaria, _info } = dados;

  // Filtrar transações com base nos filtros selecionados
  const transacoesFiltradasPorPeriodo = useMemo(() => {
  if (!dados || !Array.isArray(dados.transacoes)) return [];

  if (filtroPeriodo === 'todos') return dados.transacoes;

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  let dataInicio = new Date(hoje);

  switch (filtroPeriodo) {
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

  return dados.transacoes.filter(t => {
    const dataTransacao = new Date(t.data);
    return dataTransacao >= dataInicio && dataTransacao <= hoje;
  });
}, [filtroPeriodo, dados]);




  // Calcular métricas principais com base nos filtros
  const entradas = transacoesFiltradasPorPeriodo.filter(t => t.valor > 0);
  const saidas = transacoesFiltradasPorPeriodo.filter(t => t.valor < 0);
  
  const totalEntradas = entradas.reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = saidas.reduce((sum, t) => sum + Math.abs(t.valor), 0);
  const saldo = totalEntradas - totalSaidas;
  
  const numeroTransacoes = transacoesFiltradasPorPeriodo.length;
  const numeroEntradas = entradas.length;
  const numeroSaidas = saidas.length;

  // Calcular projeção anual baseada no período selecionado
const calcularProjecaoAnual = () => {
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


  const projecaoAnual = calcularProjecaoAnual();

  // Extrair top destinatários
  const topDestinatarios = useMemo(() => extrairDestinatarios(transacoesFiltradasPorPeriodo), [transacoesFiltradasPorPeriodo]);

  // Obter categorias únicas para o filtro
  const categoriasUnicas = ['todos', ...new Set(transacoesComCategoriasCorrigidas.map(t => t.categoria))];

  // Função para exportar relatório
  const exportarRelatorio = () => {
    const csvContent = [
      ['Data', 'Descrição', 'Categoria', 'Valor', 'Tipo'],
      ...transacoesFiltradas.map(t => [
        t.data,
        t.descricao,
        t.categoria,
        Math.abs(t.valor).toString().replace('.', ','),
        t.valor > 0 ? 'Entrada' : 'Saída'
      ])
    ].map(e => e.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-financeiro-${filtroPeriodo}-${filtroAno}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Função para selecionar pasta
  const selecionarPasta = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('Pasta selecionada:', file);
      alert(`Pasta "${file.name}" selecionada!`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-900 to-blue-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Título Principal */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pb-2">
            RisofloraFinance
          </h1>
          <p className="text-slate-300 mt-2">Dashboard completo para análise e gestão financeira</p>
        </div>

        {/* Botão de Selecionar Pasta */}
        <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
              <Folder className="w-4 h-4 md:w-5 md:h-5" />
              Origem dos Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={selecionarPasta}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Selecionar Pasta de Origem
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              webkitdirectory="true"
              directory="true"
              multiple
            />
            <p className="text-slate-400 text-xs mt-2 truncate">
              {_info?.pasta || 'Nenhuma pasta selecionada'}
            </p>
          </CardContent>
        </Card>

        {/* Saldo Total com Filtro de Período para Transações */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Saldo Total */}
          <Card className="bg-gradient-to-br from-blue-900/80 to-purple-900/80 border-blue-700/50 shadow-2xl lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardDescription className="text-slate-200">Saldo Total</CardDescription>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-300" />
                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger className="bg-blue-800/40 border-blue-600/50 text-white text-xs h-8 w-32">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="15d">Últimos 15 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="90d">Últimos 90 dias</SelectItem>
                      <SelectItem value="mensal">Este mês</SelectItem>
                      <SelectItem value="anual">Este ano</SelectItem>
                      <SelectItem value="todos">Todo o período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CardTitle className={`text-3xl font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatarValor(saldo)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-300 text-sm">
                Período: {filtroPeriodo} • {filtroAno === 'todos' ? 'Todos os anos' : `Ano ${filtroAno}`}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-green-400 text-sm flex items-center">
                  <ArrowUpCircle className="w-4 h-4 mr-1" />
                  {formatarValor(totalEntradas)}
                </div>
                <div className="text-red-400 text-sm flex items-center">
                  <ArrowDownCircle className="w-4 h-4 mr-1" />
                  {formatarValor(totalSaidas)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo do Ano Vigente */}
          <Card className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 border-purple-700/50 shadow-2xl">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-200 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Resumo {new Date().getFullYear()}
              </CardDescription>
              <CardTitle className={`text-xl font-bold ${projecaoAnual.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatarValor(projecaoAnual.saldo)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-300 text-xs">
                <div className="flex justify-between">
                  <span>Entradas:</span>
                  <span className="text-green-300">{formatarValor(projecaoAnual.entradas)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Saídas:</span>
                  <span className="text-red-300">{formatarValor(projecaoAnual.saidas)}</span>
                </div>
                <div className="mt-2 text-slate-400 text-xs">
                  Projeção baseada no período atual
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entradas */}
          <Card className="bg-gradient-to-br from-green-900/70 to-emerald-900/70 border-green-700/50 shadow-xl">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Entradas
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-green-400">
                {formatarValor(totalEntradas)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-green-300 text-sm flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {numeroEntradas} transações
              </div>
              <Progress value={(totalEntradas/(totalEntradas+totalSaidas))*100} className="mt-2 h-2 bg-green-900/50" indicatorclassname="bg-green-400" />
            </CardContent>
          </Card>

          {/* Saídas */}
          <Card className="bg-gradient-to-br from-red-900/70 to-orange-900/70 border-red-700/50 shadow-xl">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-200 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Saídas
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-red-400">
                {formatarValor(totalSaidas)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-red-300 text-sm flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {numeroSaidas} transações
              </div>
              <Progress value={(totalSaidas/(totalEntradas+totalSaidas))*100} className="mt-2 h-2 bg-red-900/50" indicatorclassname="bg-red-400" />
            </CardContent>
          </Card>

          {/* Total Transações */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-xl">
            <CardHeader className="pb-3">
              <CardDescription className="text-slate-200 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Transações
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {numeroTransacoes}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-300 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-300">{numeroEntradas} entradas</span>
                  <span className="text-red-300">{numeroSaidas} saídas</span>
                </div>
              </div>
              <div className="flex mt-2">
                <div 
                  className="h-2 bg-green-400 rounded-l-full" 
                  style={{ width: `${(numeroEntradas/numeroTransacoes)*100}%` }}
                />
                <div 
                  className="h-2 bg-red-400 rounded-r-full" 
                  style={{ width: `${(numeroSaidas/numeroTransacoes)*100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Transações com Filtros */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Lista de Transações
            </CardTitle>
            <CardDescription className="text-slate-400">
              {transacoesFiltradasPorPeriodo.length} transações encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="entradas">Apenas entradas</SelectItem>
                  <SelectItem value="saidas">Apenas saídas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {categoriasUnicas.filter(cat => cat !== 'todos').map(categoria => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Pesquisar descrição ou categoria..."
                    value={termoPesquisa}
                    onChange={(e) => setTermoPesquisa(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Tabela de Transações */}
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader className="bg-slate-700 sticky top-0">
                    <TableRow>
                      <TableHead className="text-slate-300">Data</TableHead>
                      <TableHead className="text-slate-300">Descrição</TableHead>
                      <TableHead className="text-slate-300">Categoria</TableHead>
                      <TableHead className="text-slate-300 text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transacoesFiltradasPorPeriodo.map((transacao) => (
                      <TableRow key={transacao.identificador} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="text-slate-300 font-mono">{transacao.data}</TableCell>
                        <TableCell className="text-white max-w-xs truncate" title={transacao.descricao}>
                          {transacao.descricao}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            transacao.categoria === 'Entrada' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            transacao.categoria === 'Saída' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }>
                            {transacao.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          transacao.valor > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatarValor(transacao.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {transacoesFiltradasPorPeriodo.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma transação encontrada com os filtros atuais</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Transações */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              Top Transações
            </CardTitle>
            <CardDescription className="text-slate-400">
              Principais destinatários por número de transações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDestinatarios.slice(0, 8).map((destinatario, index) => (
                <div key={destinatario.nome} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 shadow-lg' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-amber-700' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {destinatario.nome}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {destinatario.count} transação{destinatario.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className={`font-bold ${destinatario.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                      {formatarValor(destinatario.total)}
                    </div>
                    <Badge variant="outline" className={
                      destinatario.tipo === 'entrada' ? 
                      'bg-green-500/20 text-green-400 border-green-500/30 text-xs' : 
                      'bg-red-500/20 text-red-400 border-red-500/30 text-xs'
                    }>
                      {destinatario.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Seletor de Período e Exportação */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Seletor de Período */}
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                Seletor de Período
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-xs md:text-sm">
                  <SelectValue placeholder="Selecionar período" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="mensal">Este mês</SelectItem>
                  <SelectItem value="anual">Este ano</SelectItem>
                  <SelectItem value="todos">Todo o período</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-xs md:text-sm">
                  <SelectValue placeholder="Selecionar ano" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {gerarOpcoesAnos().map(ano => (
                    <SelectItem key={ano} value={ano}>
                      {ano === 'todos' ? 'Todos os anos' : ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Botão de Exportar */}
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <Download className="w-4 h-4 md:w-5 md:h-5" />
                Exportar Relatório
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={exportarRelatorio}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
              >
                <FileText className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              <p className="text-slate-400 text-xs mt-2">
                Período: {filtroPeriodo} • {filtroAno === 'todos' ? 'Todos os anos' : `Ano ${filtroAno}`}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}