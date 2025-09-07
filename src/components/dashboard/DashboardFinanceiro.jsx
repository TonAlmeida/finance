// components/DashboardFinanceiro.jsx
'use client';

import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Calendar, Download, ArrowUpCircle, ArrowDownCircle, Users, Folder, Search, FileText, FolderOpen, Crown, PieChart, Target } from 'lucide-react';

import { formatarValor, extrairDestinatarios, gerarOpcoesAnos, filtrarPorPeriodo } from '@/utils/formatar';
import { categorizarTransacao } from '@/utils/categorias';
import Loading from '@/components/Loading';
import MetricCard from '@/components/dashboard/components/MetricCard';
import TransactionTable from '@/components/dashboard/components/TransactionTable';

export default function DashboardFinanceiro({ dados }) {
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const fileInputRef = useRef(null);

  if (!dados) {
    return <Loading />;
  }
    // Processar categorias corretamente
  const transacoesComCategoriasCorrigidas = useMemo(() => {
    return dados.transacoes.map(transacao => ({
      ...transacao,
      categoria: categorizarTransacao(transacao.descricao)
    }));
  }, [dados.transacoes]);

  const { periodo, evolucao_diaria, _info } = dados;

  // Filtrar transações
  const transacoesFiltradas = useMemo(() => {
    let transacoesFiltradas = transacoesComCategoriasCorrigidas;
    
    // Filtrar por período
    transacoesFiltradas = filtrarPorPeriodo(transacoesFiltradas, filtroPeriodo, filtroAno);
    
    // Filtrar por categoria
    if (filtroCategoria !== 'todos') {
      transacoesFiltradas = transacoesFiltradas.filter(t => t.categoria === filtroCategoria);
    }
    
    // Filtrar por tipo
    if (filtroTipo !== 'todos') {
      if (filtroTipo === 'entradas') {
        transacoesFiltradas = transacoesFiltradas.filter(t => t.valor > 0);
      } else if (filtroTipo === 'saidas') {
        transacoesFiltradas = transacoesFiltradas.filter(t => t.valor < 0);
      }
    }
    
    // Filtrar por termo de pesquisa
    if (termoPesquisa) {
      const termo = termoPesquisa.toLowerCase();
      transacoesFiltradas = transacoesFiltradas.filter(t => 
        t.descricao.toLowerCase().includes(termo) || 
        t.categoria.toLowerCase().includes(termo)
      );
    }
    
    return transacoesFiltradas;
  }, [transacoesComCategoriasCorrigidas, filtroPeriodo, filtroAno, filtroCategoria, filtroTipo, termoPesquisa]);

  // Calcular métricas
  const entradas = transacoesFiltradas.filter(t => t.valor > 0);
  const saidas = transacoesFiltradas.filter(t => t.valor < 0);
  
  const totalEntradas = entradas.reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = saidas.reduce((sum, t) => sum + Math.abs(t.valor), 0);
  const saldo = totalEntradas - totalSaidas;
  
  const numeroTransacoes = transacoesFiltradas.length;
  const numeroEntradas = entradas.length;
  const numeroSaidas = saidas.length;

  // Calcular projeção anual
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
        diasNoPeriodo = new Date().getDate();
        break;
      case 'anual':
        const inicioAno = new Date(hoje.getFullYear(), 0, 1);
        diasNoPeriodo = Math.max(1, Math.floor((hoje - inicioAno) / (1000 * 60 * 60 * 24)));
        break;
      case 'todos':
      default:
        diasNoPeriodo = transacoesFiltradas.length > 0 ? 30 : 1;
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
  const topDestinatarios = useMemo(() => extrairDestinatarios(transacoesFiltradas), [transacoesFiltradas]);
  const categoriasUnicas = ['todos', ...new Set(transacoesComCategoriasCorrigidas.map(t => t.categoria))];
  const opcoesAnos = gerarOpcoesAnos(transacoesComCategoriasCorrigidas);
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
                {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Entradas"
            value={formatarValor(totalEntradas)}
            icon={TrendingUp}
            subtitle={`${numeroEntradas} transações`}
            progressValue={(totalEntradas/(totalEntradas+totalSaidas))*100}
            progressColor="bg-green-400"
            valueColor="text-green-400"
          />
          
          <MetricCard
            title="Saídas"
            value={formatarValor(totalSaidas)}
            icon={TrendingDown}
            subtitle={`${numeroSaidas} transações`}
            progressValue={(totalSaidas/(totalEntradas+totalSaidas))*100}
            progressColor="bg-red-400"
            valueColor="text-red-400"
          />
          
          <MetricCard
            title="Transações"
            value={numeroTransacoes}
            icon={PieChart}
            subtitle={
              <div className="flex justify-between">
                <span className="text-green-300">{numeroEntradas} entradas</span>
                <span className="text-red-300">{numeroSaidas} saídas</span>
              </div>
            }
            valueColor="text-white"
          />
          
          {/* Resumo do Ano Vigente */}
          <Card className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 border-purple-700/50 shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardDescription className="text-slate-200 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Resumo {new Date().getFullYear()}
                </CardDescription>

              </div>
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
                {/* Lista de Transações com Filtros */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Lista de Transações
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {transacoesFiltradas.length} transações encontradas
                </CardDescription>
              </div>
              
              {/* Seletor de período para a lista */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-300" />
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-xs h-8 w-32">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="15d">Últimos 15 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                    <SelectItem value="mensal">Este mês</SelectItem>
                    <SelectItem value="anual">Este ano</SelectItem>
                    <SelectItem value="todos">Tudo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
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

              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Filtrar por ano" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="todos">Todos os anos</SelectItem>
                  {opcoesAnos.map(ano => (
                    <SelectItem key={ano} value={ano}>
                      {ano}
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

            <TransactionTable transacoes={transacoesFiltradas} />
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

        {/* Botão de Exportar com seletor de período */}
        <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-white flex items-center gap-2 text-sm md:text-base">
                <Download className="w-4 h-4 md:w-5 md:h-5" />
                Exportar Relatório
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-300" />
              </div>
            </div>
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
  );
}