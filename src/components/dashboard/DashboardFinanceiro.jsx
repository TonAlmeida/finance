// pages/index.js
import { useState, useMemo, useRef } from 'react';
import Head from 'next/head';

export default function DashboardFinanceiro() {
  // Estados para os dados e filtros
  const [transacoes, setTransacoes] = useState([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [pastaSelecionada, setPastaSelecionada] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const fileInputRef = useRef(null);

  // Estado para nova transação
  const [novaTransacao, setNovaTransacao] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: '',
    descricao: '',
    categoria: 'Outros',
    tipo: 'saida'
  });

  // Função para formatar valores monetários
  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Função para extrair destinatários das transações
  const extrairDestinatarios = (transacoes) => {
    const destinatariosMap = {};
    
    transacoes.forEach(transacao => {
      // Tenta extrair o nome do destinatário da descrição
      let nome = "Desconhecido";
      const match = transacao.descricao.match(/Transferência.*?- (.*?) -/);
      if (match && match[1]) {
        nome = match[1];
      } else if (transacao.descricao.includes('Pix')) {
        nome = transacao.descricao.split(' - ')[1] || "Destinatário Pix";
      }
      
      if (!destinatariosMap[nome]) {
        destinatariosMap[nome] = {
          nome,
          count: 0,
          total: 0,
          tipo: transacao.valor > 0 ? 'entrada' : 'saida'
        };
      }
      
      destinatariosMap[nome].count += 1;
      destinatariosMap[nome].total += Math.abs(transacao.valor);
    });
    
    return Object.values(destinatariosMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Função para categorizar transações
  const categorizarTransacao = (descricao) => {
    const desc = descricao.toLowerCase();
    
    if (desc.includes('pix') || desc.includes('transferência')) {
      return 'Transferência';
    } else if (desc.includes('alimentação') || desc.includes('restaurante') || desc.includes('supermercado')) {
      return 'Alimentação';
    } else if (desc.includes('transporte') || desc.includes('uber') || desc.includes('combustível')) {
      return 'Transporte';
    } else if (desc.includes('luz') || desc.includes('água') || desc.includes('internet')) {
      return 'Utilidades';
    } else if (desc.includes('salário') || desc.includes('rendimento')) {
      return 'Rendimento';
    } else {
      return 'Outros';
    }
  };

  // Filtrar transações por período
  const filtrarPorPeriodo = (transacoes, periodo, ano) => {
    const hoje = new Date();
    let dataInicio;
    
    switch (periodo) {
      case '7d':
        dataInicio = new Date(hoje.setDate(hoje.getDate() - 7));
        break;
      case '15d':
        dataInicio = new Date(hoje.setDate(hoje.getDate() - 15));
        break;
      case '30d':
        dataInicio = new Date(hoje.setDate(hoje.getDate() - 30));
        break;
      case '90d':
        dataInicio = new Date(hoje.setDate(hoje.getDate() - 90));
        break;
      case 'mensal':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      case 'anual':
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        break;
      case 'todos':
      default:
        return transacoes;
    }
    
    return transacoes.filter(transacao => {
      const dataTransacao = new Date(transacao.data.split('/').reverse().join('-'));
      return dataTransacao >= dataInicio && 
             (ano === 'todos' || transacao.data.includes(ano));
    });
  };

  // Gerar opções de anos
  const gerarOpcoesAnos = (transacoes) => {
    const anos = new Set();
    transacoes.forEach(t => {
      const ano = t.data.split('/')[2];
      anos.add(ano);
    });
    return ['todos', ...Array.from(anos).sort().reverse()];
  };

  // Processar categorias corretamente
  const transacoesComCategoriasCorrigidas = useMemo(() => {
    return transacoes.map(transacao => ({
      ...transacao,
      categoria: categorizarTransacao(transacao.descricao)
    }));
  }, [transacoes]);

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

  // Função para processar arquivos CSV
  const processarArquivosCSV = (files) => {
    const novosDados = [];
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target.result;
        const linhas = content.split('\n');
        
        // Pular a primeira linha (cabeçalho)
        for (let i = 1; i < linhas.length; i++) {
          const linha = linhas[i].trim();
          if (!linha) continue;
          
          const partes = linha.split(',');
          if (partes.length >= 4) {
            novosDados.push({
              data: partes[0],
              valor: parseFloat(partes[1]),
              identificador: partes[2],
              descricao: partes[3]
            });
          }
        }
        
        // Atualizar o estado com os novos dados
        setTransacoes(prev => [...prev, ...novosDados]);
        setPastaSelecionada(`${files.length} arquivo(s) selecionado(s)`);
      };
      
      reader.readAsText(file);
    });
  };

  // Função para lidar com a seleção de arquivos
  const handleFileSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      processarArquivosCSV(files);
    }
  };

  // Função para adicionar transação manualmente
  const adicionarTransacao = () => {
    const valor = parseFloat(novaTransacao.valor);
    if (isNaN(valor) || !novaTransacao.descricao) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const valorComSinal = novaTransacao.tipo === 'entrada' ? Math.abs(valor) : -Math.abs(valor);
    
    const novaTransacaoCompleta = {
      data: novaTransacao.data.split('-').reverse().join('/'), // Formato DD/MM/YYYY
      valor: valorComSinal,
      identificador: `manual-${Date.now()}`,
      descricao: novaTransacao.descricao,
      categoria: novaTransacao.categoria
    };
    
    setTransacoes(prev => [...prev, novaTransacaoCompleta]);
    setModalAberto(false);
    
    // Resetar o formulário
    setNovaTransacao({
      data: new Date().toISOString().split('T')[0],
      valor: '',
      descricao: '',
      categoria: 'Outros',
      tipo: 'saida'
    });
  };

  // Componente Card
  const Card = ({ children, className = '' }) => (
    <div className={`bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg shadow-2xl ${className}`}>
      {children}
    </div>
  );

  const CardHeader = ({ children, className = '' }) => (
    <div className={`p-6 pb-3 ${className}`}>
      {children}
    </div>
  );

  const CardTitle = ({ children, className = '' }) => (
    <h3 className={`text-lg font-bold text-white ${className}`}>
      {children}
    </h3>
  );

  const CardDescription = ({ children, className = '' }) => (
    <p className={`text-slate-400 text-sm ${className}`}>
      {children}
    </p>
  );

  const CardContent = ({ children, className = '' }) => (
    <div className={`p-6 pt-3 ${className}`}>
      {children}
    </div>
  );

  // Componente Select
  const Select = ({ value, onValueChange, children, placeholder, className = '' }) => {
    const [open, setOpen] = useState(false);
    
    return (
      <div className={`relative ${className}`}>
        <button 
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm flex items-center justify-between"
          onClick={() => setOpen(!open)}
        >
          <span>{value || placeholder}</span>
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        {open && (
          <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg">
            {children}
          </div>
        )}
      </div>
    );
  };

  const SelectItem = ({ value, children, onSelect }) => (
    <div 
      className="px-3 py-2 text-sm text-white hover:bg-slate-700 cursor-pointer"
      onClick={() => {
        onSelect(value);
        setOpen(false);
      }}
    >
      {children}
    </div>
  );

  // Componente Input
  const Input = ({ placeholder, value, onChange, className = '', type = 'text' }) => (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm ${className}`}
    />
  );

  // Componente Badge
  const Badge = ({ children, variant = 'default', className = '' }) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    
    const variantClasses = {
      default: 'bg-slate-700 text-slate-300',
      outline: 'border border-slate-600 text-slate-300'
    };
    
    return (
      <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
        {children}
      </span>
    );
  };

  // Componente Button
  const Button = ({ children, onClick, className = '', variant = 'default' }) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none px-4 py-2';
    
    const variantClasses = {
      default: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-slate-700 text-white hover:bg-slate-600',
      outline: 'border border-slate-600 text-slate-300 hover:bg-slate-700'
    };
    
    return (
      <button 
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  };

  // Componente Dialog (Modal)
  const Dialog = ({ open, onOpenChange, children }) => {
    if (!open) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)}></div>
        <div className="relative z-50 bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full mx-4">
          {children}
        </div>
      </div>
    );
  };

  const DialogTrigger = ({ children, asChild, onClick }) => {
    if (asChild) {
      return React.cloneElement(children, { onClick });
    }
    
    return (
      <div onClick={onClick}>
        {children}
      </div>
    );
  };

  const DialogContent = ({ children }) => (
    <div className="p-6">
      {children}
    </div>
  );

  const DialogHeader = ({ children }) => (
    <div className="mb-4">
      {children}
    </div>
  );

  const DialogTitle = ({ children }) => (
    <h2 className="text-lg font-bold text-white">
      {children}
    </h2>
  );

  const DialogDescription = ({ children }) => (
    <p className="text-slate-400 text-sm mt-1">
      {children}
    </p>
  );

  // Componente Label
  const Label = ({ children, htmlFor, className = '' }) => (
    <label htmlFor={htmlFor} className={`text-sm font-medium text-slate-300 ${className}`}>
      {children}
    </label>
  );

  // Componente Textarea
  const Textarea = ({ placeholder, value, onChange, className = '', rows = 3 }) => (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      className={`bg-slate-700 border border-slate-600 text-white rounded-md px-3 py-2 text-sm ${className}`}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-900 to-blue-900 p-4 md:p-6">
      <Head>
        <title>RisofloraFinance</title>
        <meta name="description" content="Dashboard completo para análise e gestão financeira" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Título Principal */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pb-2">
            RisofloraFinance
          </h1>
          <p className="text-slate-300 mt-2">Dashboard completo para análise e gestão financeira</p>
        </div>

        {/* Botão de Selecionar Pasta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
              </svg>
              Origem dos Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <Button 
              onClick={selecionarPasta}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              Importar CSV
            </Button>
            
            <Dialog open={modalAberto} onOpenChange={setModalAberto}>
              <DialogTrigger asChild onClick={() => setModalAberto(true)}>
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  Adicionar Transação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Transação</DialogTitle>
                  <DialogDescription>
                    Preencha os detalhes da nova transação financeira.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="data" className="text-right">
                      Data
                    </Label>
                    <Input
                      id="data"
                      type="date"
                      value={novaTransacao.data}
                      onChange={(e) => setNovaTransacao({...novaTransacao, data: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="valor" className="text-right">
                      Valor
                    </Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={novaTransacao.valor}
                      onChange={(e) => setNovaTransacao({...novaTransacao, valor: e.target.value})}
                      className="col-span-3"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tipo" className="text-right">
                      Tipo
                    </Label>
                    <Select 
                      value={novaTransacao.tipo} 
                      onValueChange={(value) => setNovaTransacao({...novaTransacao, tipo: value})}
                      className="col-span-3"
                    >
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="categoria" className="text-right">
                      Categoria
                    </Label>
                    <Select 
                      value={novaTransacao.categoria} 
                      onValueChange={(value) => setNovaTransacao({...novaTransacao, categoria: value})}
                      className="col-span-3"
                    >
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Alimentação">Alimentação</SelectItem>
                      <SelectItem value="Transporte">Transporte</SelectItem>
                      <SelectItem value="Utilidades">Utilidades</SelectItem>
                      <SelectItem value="Rendimento">Rendimento</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="descricao" className="text-right">
                      Descrição
                    </Label>
                    <Textarea
                      id="descricao"
                      value={novaTransacao.descricao}
                      onChange={(e) => setNovaTransacao({...novaTransacao, descricao: e.target.value})}
                      className="col-span-3"
                      placeholder="Descrição da transação"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setModalAberto(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={adicionarTransacao}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              multiple
              accept=".csv"
            />
            
            <p className="text-slate-400 text-sm mt-2 md:mt-0 md:ml-4 flex items-center">
              {pastaSelecionada || 'Nenhum arquivo selecionado'}
            </p>
          </CardContent>
        </Card>

        {/* Saldo Total */}
        <Card className="bg-gradient-to-br from-blue-900/80 to-purple-900/80 border-blue-700/50 lg:col-span-3">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardDescription>Saldo Total</CardDescription>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo} className="w-32">
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="15d">Últimos 15 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="mensal">Este mês</SelectItem>
                  <SelectItem value="anual">Este ano</SelectItem>
                  <SelectItem value="todos">Todo o período</SelectItem>
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
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                </svg>
                {formatarValor(totalEntradas)}
              </div>
              <div className="text-red-400 text-sm flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
                {formatarValor(totalSaidas)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-900/80 to-emerald-900/80 border-green-700/50">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                Entradas
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-green-400">
                {formatarValor(totalEntradas)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-300 text-sm">
                {numeroEntradas} transações
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-400 h-2 rounded-full" 
                  style={{ width: `${(totalEntradas/(totalEntradas+totalSaidas))*100}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-900/80 to-rose-900/80 border-red-700/50">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>
                </svg>
                Saídas
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-red-400">
                {formatarValor(totalSaidas)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-300 text-sm">
                {numeroSaidas} transações
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-red-400 h-2 rounded-full" 
                  style={{ width: `${(totalSaidas/(totalEntradas+totalSaidas))*100}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                Transações
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {numeroTransacoes}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-xs">
                <span className="text-green-300">{numeroEntradas} entradas</span>
                <span className="text-red-300">{numeroSaidas} saídas</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Resumo do Ano Vigente */}
          <Card className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 border-purple-700/50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardDescription className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
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
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Lista de Transações
                </CardTitle>
                <CardDescription>
                  {transacoesFiltradas.length} transações encontradas
                </CardDescription>
              </div>
              
              {/* Seletor de período para a lista */}
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo} className="w-32">
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="15d">Últimos 15 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="mensal">Este mês</SelectItem>
                  <SelectItem value="anual">Este ano</SelectItem>
                  <SelectItem value="todos">Tudo</SelectItem>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="entradas">Apenas entradas</SelectItem>
                <SelectItem value="saidas">Apenas saídas</SelectItem>
              </Select>

              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectItem value="todos">Todas categorias</SelectItem>
                {categoriasUnicas.filter(cat => cat !== 'todos').map(categoria => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </Select>

              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {opcoesAnos.map(ano => (
                  <SelectItem key={ano} value={ano}>
                    {ano}
                  </SelectItem>
                ))}
              </Select>

              <div className="lg:col-span-2">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <Input
                    placeholder="Pesquisar descrição ou categoria..."
                    value={termoPesquisa}
                    onChange={(e) => setTermoPesquisa(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Tabela de Transações */}
            <div className="rounded-md border border-slate-700">
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="border-b border-slate-700">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-slate-400">Data</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-slate-400">Descrição</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-slate-400">Categoria</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoesFiltradas.length > 0 ? (
                      transacoesFiltradas.map((transacao, index) => (
                        <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 align-middle text-slate-300">{transacao.data}</td>
                          <td className="p-4 align-middle">
                            <div className="font-medium text-white">{transacao.descricao}</div>
                            <div className="text-xs text-slate-400 mt-1">{transacao.identificador}</div>
                          </td>
                          <td className="p-4 align-middle">
                            <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                              {transacao.categoria}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle text-right">
                            <div className={`font-bold ${transacao.valor > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatarValor(Math.abs(transacao.valor))}
                            </div>
                            <div className="text-xs text-slate-400">
                              {transacao.valor > 0 ? 'Entrada' : 'Saída'}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-400">
                          Nenhuma transação encontrada. Importe arquivos CSV ou adicione transações manualmente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Transações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
              </svg>
              Top Transações
            </CardTitle>
            <CardDescription>
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
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Exportar Relatório
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={exportarRelatorio}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
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