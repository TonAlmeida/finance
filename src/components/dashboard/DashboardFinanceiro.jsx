// components/DashboardFinanceiro.jsx
'use client';

import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Calendar, Download, ArrowUpCircle, ArrowDownCircle, Users, Folder, Search, FileText, FolderOpen, Crown, PieChart, Target } from 'lucide-react';

import { formatarValor, extrairDestinatarios, gerarOpcoesAnos, filtrarPorPeriodo } from '@/utils/formatar';
import { categorizarTransacao } from '@/utils/categorias';
import Loading from '@/components/Loading';
import MetricCard from '@/components/dashboard/components/MetricCard';
import TransactionTable from '@/components/dashboard/components/TransactionTable';

export default function DashboardFinanceiro({ dados }) {
  const [filtroPeriodo, setFiltroPeriodo] = useState('30d');
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
  const transacoesFiltradasPorPeriodo = useMemo(() => {
    return filtrarPorPeriodo(transacoesComCategoriasCorrigidas, filtroPeriodo);
  }, [filtroPeriodo, transacoesComCategoriasCorrigidas]);

  // Calcular métricas
  const entradas = transacoesFiltradasPorPeriodo.filter(t => t.valor > 0);
  const saidas = transacoesFiltradasPorPeriodo.filter(t => t.valor < 0);
  
  const totalEntradas = entradas.reduce((sum, t) => sum + t.valor, 0);
  const totalSaidas = saidas.reduce((sum, t) => sum + Math.abs(t.valor), 0);
  const saldo = totalEntradas - totalSaidas;
  
  const numeroTransacoes = transacoesFiltradasPorPeriodo.length;
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
        diasNoPeriodo = transacoesFiltradasPorPeriodo.length > 0 ? 30 : 1;
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
  const topDestinatarios = useMemo(() => extrairDestinatarios(transacoesFiltradasPorPeriodo), [transacoesFiltradasPorPeriodo]);
  const categoriasUnicas = ['todos', ...new Set(transacoesComCategoriasCorrigidas.map(t => t.categoria))];

  const exportarRelatorio = () => {
    const csvContent = [
      ['Data', 'Descrição', 'Categoria', 'Valor', 'Tipo'],
      ...transacoesFiltradasPorPeriodo.map(t => [
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <TransactionTable transacoes={transacoesFiltradasPorPeriodo} />
          </CardContent>
        </Card>

        {/* Resto do código permanece similar... */}
      </div>
    </div>
  );
}