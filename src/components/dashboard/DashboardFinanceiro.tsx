'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

// NOTE: This file is intentionally modular (multiple small components in one file)
// Drop into: src/components/dashboard/DashboardFinanceiro.tsx
// Requires: tailwindcss, recharts (npm i recharts), shadcn is optional for styling but not required here.

/******************************
 * Types & Utilities
 ******************************/

type Transacao = {
  data: string; // DD/MM/YYYY
  valor: number; // positive => entrada, negative => saida
  identificador: string;
  descricao: string;
  categoria: string;
  formaPagamento?: string;
  destinatario?: string;
  origemArquivo?: string;
};

const STORAGE_KEY = 'uli_transacoes_v3';

const CATEGORIAS_INICIAIS = [
  'Alimentação','Transporte','Saúde','Educação','Moradia','Compras','Lazer','Viagem','Dívidas','Investimentos','Impostos','Serviços','Assinaturas','Pets','Outros'
];

const formatarValor = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function parseValorRobusto(raw?: string | number): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s/g, '');
  s = s.replace(/^R\$\s?/, '');
  s = s.replace(/−/g, '-');
  const negativo = /^-/.test(s) || /-$/.test(s);
  s = s.replace(/^-|-$|\+/g, '');

  // Most common BR format: 1.234,56
  if (/\d+\.\d{3}(?:\.\d{3})*,\d{1,2}$/.test(s) || (s.includes('.') && s.includes(','))) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    // remove commas used as thousands (e.g. 1,234.56)
    if (/\d{1,3}(?:,\d{3})+\.\d+/.test(s)) s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negativo ? -Math.abs(n) : n;
}

function normalizarDataParaDDMMYYYY(raw?: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const m = s.match(/(\d{2}).(\d{2}).(\d{4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return null;
}

function dataParaTimestamp(ddmmyyyy: string) {
  const p = ddmmyyyy.split('/');
  if (p.length !== 3) return 0;
  const [d, m, y] = p.map(Number);
  return new Date(y, m-1, d).getTime();
}

function detectarSeparador(linha: string) {
  if (linha.includes(';')) return ';';
  if (linha.includes(',')) return ',';
  return ',';
}

/******************************
 * Small UI primitives
 ******************************/

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className='' }) => (
  <div className={`rounded-2xl p-4 shadow-lg bg-gradient-to-br ${className}`}>{children}</div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs text-slate-300 mb-1">{children}</div>
);

/******************************
 * CSV Parser (overwrite mode)
 ******************************/

async function parseMultipleCsvFiles(files: File[]): Promise<Transacao[]> {
  const all: Transacao[] = [];
  for (const file of files) {
    try {
      const text = await file.text();
      const parsed = parseCsvContent(text, file.name);
      all.push(...parsed);
    } catch (err) {
      console.error('Erro ao ler', file.name, err);
    }
  }
  // dedupe by identificador
  const map = new Map<string, Transacao>();
  for (const t of all) {
    if (!map.has(t.identificador)) map.set(t.identificador, t);
  }
  return Array.from(map.values()).sort((a,b) => dataParaTimestamp(b.data) - dataParaTimestamp(a.data));
}

function parseCsvContent(content: string, origem = 'arquivo'): Transacao[] {
  const linhas = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (linhas.length === 0) return [];
  const primeira = linhas[0].toLowerCase();
  const hasHeader = primeira.includes('data') || primeira.includes('valor') || primeira.includes('descricao');
  const start = hasHeader ? 1 : 0;
  const resultados: Transacao[] = [];

  for (let i = start; i < linhas.length; i++) {
    const row = linhas[i];
    const sep = detectarSeparador(row);
    const cols = row.split(sep).map(c => c.trim());
    // guess columns
    let dataRaw = '', valorRaw = '', id = '', descricao = '', categoria = '';
    if (cols.length >= 4) {
      dataRaw = cols[0]; valorRaw = cols[1]; id = cols[2]; descricao = cols.slice(3).join(' - ');
    } else if (cols.length === 3) {
      // try common patterns
      // data, valor, descricao
      if (/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(cols[0])) {
        dataRaw = cols[0]; valorRaw = cols[1]; descricao = cols[2]; id = `csv-${i}-${Date.now()}`;
      } else {
        descricao = cols[0]; valorRaw = cols[1]; id = cols[2] || `csv-${i}-${Date.now()}`;
      }
    } else if (cols.length === 2) {
      descricao = cols[0]; valorRaw = cols[1]; id = `csv-${i}-${Date.now()}`; dataRaw = new Date().toLocaleDateString('pt-BR');
    } else continue;

    const dataNorm = normalizarDataParaDDMMYYYY(dataRaw) || new Date().toLocaleDateString('pt-BR');
    const valorNum = parseValorRobusto(valorRaw);
    if (valorNum === null) continue;
    const cat = categoria || inferirCategoria(descricao || '');
    resultados.push({ data: dataNorm, valor: valorNum, identificador: id || `csv-${Date.now()}-${i}`, descricao: descricao || 'Sem descrição', categoria: cat, origemArquivo: origem });
  }
  return resultados;
}

function inferirCategoria(desc: string) {
  const d = (desc||'').toLowerCase();
  if (d.includes('pix') || d.includes('transfer')) return 'Transferência';
  if (d.includes('restaurante') || d.includes('supermercado') || d.includes('aliment')) return 'Alimentação';
  if (d.includes('uber') || d.includes('transporte') || d.includes('combustível')) return 'Transporte';
  if (d.includes('luz') || d.includes('água') || d.includes('internet') || d.includes('celular')) return 'Utilidades';
  if (d.includes('salário') || d.includes('salario') || d.includes('rendimento')) return 'Rendimento';
  return 'Outros';
}

/******************************
 * Subcomponents
 ******************************/

function ThemeToggle({ dark, setDark }: { dark: boolean; setDark: (v:boolean)=>void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setDark(false)} className={`px-3 py-1 rounded-lg ${!dark ? 'bg-white text-slate-900' : 'bg-slate-700 text-white'}`}>Claro</button>
      <button onClick={() => setDark(true)} className={`px-3 py-1 rounded-lg ${dark ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'bg-slate-700 text-white'}`}>Escuro</button>
    </div>
  );
}

const ColorDot = ({ color }: { color: string }) => <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: color }} />;

function SmallStats({ entradas, saidas, saldo }: { entradas:number; saidas:number; saldo:number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card className="from-white/5 to-white/0 border border-slate-700">
        <div className="text-sm text-slate-300">Entradas</div>
        <div className="text-xl font-semibold text-emerald-300">{formatarValor(entradas)}</div>
      </Card>
      <Card className="from-white/5 to-white/0 border border-slate-700">
        <div className="text-sm text-slate-300">Saídas</div>
        <div className="text-xl font-semibold text-red-400">{formatarValor(saidas)}</div>
      </Card>
      <Card className={`from-white/5 to-white/0 border border-slate-700`}> 
        <div className="text-sm text-slate-300">Saldo</div>
        <div className={`text-xl font-semibold ${saldo>=0 ? 'text-emerald-300' : 'text-red-400'}`}>{formatarValor(saldo)}</div>
      </Card>
    </div>
  );
}

function ModalNovaTransacao({ open, onClose, categorias, adicionar }: { open:boolean; onClose:()=>void; categorias:string[]; adicionar: (t:Transacao)=>void }){
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0,10), valor: '', descricao: '', categoria: categorias[0]||'Outros', formaPagamento: '', destinatario: '', parcelas: '1' });

  useEffect(()=>{ if(open) setForm({ data: new Date().toISOString().slice(0,10), valor: '', descricao: '', categoria: categorias[0]||'Outros', formaPagamento: '', destinatario: '', parcelas: '1' }); },[open, categorias]);

  const submit = () => {
    const valor = parseValorRobusto(form.valor);
    if (valor === null) { alert('Valor inválido'); return; }
    const dataNorm = normalizarDataParaDDMMYYYY(form.data) || new Date().toLocaleDateString('pt-BR');
    const t: Transacao = { data: dataNorm, valor: valor, identificador: `manual-${Date.now()}`, descricao: form.descricao || 'Sem descrição', categoria: form.categoria || 'Outros', formaPagamento: form.formaPagamento || undefined, destinatario: form.destinatario || undefined };
    adicionar(t);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative z-50 w-full max-w-2xl p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Adicionar nova transação</h3>
          <button onClick={onClose} className="text-slate-400">Fechar</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <input type="date" className="w-full p-2 rounded bg-slate-700 text-white" value={form.data} onChange={(e)=>setForm(f=>({...f, data:e.target.value}))} />
          </div>
          <div>
            <Label>Valor</Label>
            <input placeholder="1234,56" className="w-full p-2 rounded bg-slate-700 text-white" value={form.valor} onChange={(e)=>setForm(f=>({...f, valor:e.target.value}))} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.descricao} onChange={(e)=>setForm(f=>({...f, descricao:e.target.value}))} />
          </div>
          <div>
            <Label>Categoria</Label>
            <select className="w-full p-2 rounded bg-slate-700 text-white" value={form.categoria} onChange={(e)=>setForm(f=>({...f, categoria:e.target.value}))}>
              {categorias.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.formaPagamento} onChange={(e)=>setForm(f=>({...f, formaPagamento:e.target.value}))} />
          </div>
          <div>
            <Label>Destinatário</Label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.destinatario} onChange={(e)=>setForm(f=>({...f, destinatario:e.target.value}))} />
          </div>
          <div>
            <Label>Parcelas (opcional)</Label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.parcelas} onChange={(e)=>setForm(f=>({...f, parcelas:e.target.value}))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-3 py-2 rounded bg-slate-700">Cancelar</button>
          <button onClick={submit} className="px-4 py-2 rounded bg-gradient-to-r from-green-500 to-emerald-400 text-white">Adicionar</button>
        </div>
      </div>
    </div>
  );
}

function GraficoPizza({ dados }: { dados: { name:string; value:number }[] }){
  const colors = ['#60a5fa','#7c3aed','#34d399','#f97316','#ef4444','#f59e0b','#06b6d4','#a78bfa'];
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={dados} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4} label={(entry)=>entry.name}>
            {dados.map((d,i)=>(<Cell key={i} fill={colors[i % colors.length]} />))}
          </Pie>
          <ReTooltip formatter={(value:number)=>formatarValor(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoLinha({ pontos }: { pontos: { date:string; saldo:number }[] }){
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={pontos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.05} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v)=>formatarValor(v)} width={80} />
          <ReTooltip formatter={(val:number)=>(formatarValor(val))} />
          <Line type="monotone" dataKey="saldo" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/******************************
 * Main Dashboard (modular)
 ******************************/

export default function DashboardFinanceiro(){
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [trans, setTrans] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_INICIAIS);
  const [modalOpen, setModalOpen] = useState(false);
  const [dark, setDark] = useState(true);

  // filters
  const [periodo, setPeriodo] = useState<'todos'|'7d'|'15d'|'30d'|'90d'|'mensal'|'anual'>('todos');
  const [ano, setAno] = useState<'todos'|string>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'todos'|string>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos'|'entradas'|'saidas'>('todos');
  const [termo, setTermo] = useState('');
  const [limite, setLimite] = useState(20);

  // load from storage
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed: Transacao[] = JSON.parse(raw);
        setTrans(parsed);
      }
    }catch(e){ console.error(e); }
  },[]);

  useEffect(()=>{
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(trans)); }catch(e){console.error(e);} },[trans]);

  // import (overwrite)
  const handleFiles = async (files: FileList | null) => {
    if(!files) return;
    const arr = Array.from(files);
    const parsed = await parseMultipleCsvFiles(arr);
    // overwrite existing per request
    setTrans(parsed);
  };

  // add transacao manually
  const adicionarTransacao = (t:Transacao) => {
    setTrans(prev => {
      const all = [t, ...prev];
      all.sort((a,b)=> dataParaTimestamp(b.data) - dataParaTimestamp(a.data));
      return all;
    });
    // add category if new
    if (!categorias.includes(t.categoria)) setCategorias(prev => [t.categoria, ...prev]);
  };

  // categories management
  const criarCategoria = (nome:string) => {
    if(!nome) return;
    if(!categorias.includes(nome)) setCategorias(prev => [nome, ...prev]);
  };

  // computed lists
  const transComCategorias = useMemo(()=> trans.map(t=> ({ ...t, categoria: t.categoria || inferirCategoria(t.descricao) })), [trans]);

  const anosDisponiveis = useMemo(()=>{
    const s = new Set<string>();
    transComCategorias.forEach(t=> { const ano = t.data.split('/')[2]; if(ano) s.add(ano); });
    return ['todos', ...Array.from(s).sort((a,b)=> Number(b)-Number(a))];
  },[transComCategorias]);

  const transFiltradas = useMemo(()=>{
    let arr = transComCategorias.slice();
    // periodo
    if(periodo !== 'todos'){
      const agora = Date.now();
      let inicio = 0;
      switch(periodo){
        case '7d': inicio = agora - 7*24*60*60*1000; break;
        case '15d': inicio = agora - 15*24*60*60*1000; break;
        case '30d': inicio = agora - 30*24*60*60*1000; break;
        case '90d': inicio = agora - 90*24*60*60*1000; break;
        case 'mensal': { const d = new Date(); inicio = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); break; }
        case 'anual': { const d = new Date(); inicio = new Date(d.getFullYear(), 0,1).getTime(); break; }
      }
      arr = arr.filter(t => dataParaTimestamp(t.data) >= inicio);
    }
    if(ano !== 'todos') arr = arr.filter(t=> t.data.split('/')[2] === ano);
    if(categoriaFiltro !== 'todos') arr = arr.filter(t=> t.categoria === categoriaFiltro);
    if(tipoFiltro !== 'todos'){
      if(tipoFiltro === 'entradas') arr = arr.filter(t=> t.valor > 0);
      if(tipoFiltro === 'saidas') arr = arr.filter(t=> t.valor < 0);
    }
    if(termo.trim()){
      const low = termo.toLowerCase();
      arr = arr.filter(t => t.descricao.toLowerCase().includes(low) || t.categoria.toLowerCase().includes(low) || (t.destinatario||'').toLowerCase().includes(low));
    }
    arr.sort((a,b)=> dataParaTimestamp(b.data) - dataParaTimestamp(a.data));
    return arr;
  },[transComCategorias, periodo, ano, categoriaFiltro, tipoFiltro, termo]);

  const entradas = useMemo(()=> transFiltradas.filter(t=>t.valor>0).reduce((s,t)=>s+t.valor,0), [transFiltradas]);
  const saidas = useMemo(()=> transFiltradas.filter(t=>t.valor<0).reduce((s,t)=>s+Math.abs(t.valor),0), [transFiltradas]);
  const saldo = entradas - saidas;

  const categoriasResumo = useMemo(()=>{
    const map = new Map<string, number>();
    for (const t of transFiltradas){
      const v = Math.abs(t.valor);
      map.set(t.categoria, (map.get(t.categoria) || 0) + v);
    }
    return Array.from(map.entries()).map(([name, value])=> ({ name, value })).sort((a,b)=> b.value - a.value);
  },[transFiltradas]);

  // ledger timeline for line chart (monthly balance)
  const timeline = useMemo(()=>{
    // create map month-year -> saldo acumulado (running by date)
    const map = new Map<string, number>();
    // sort asc
    const sorted = [...(trans || [])].sort((a,b)=> dataParaTimestamp(a.data) - dataParaTimestamp(b.data));
    let running = 0;
    for (const t of sorted){
      running += t.valor;
      const [d,m,y] = t.data.split('/');
      const key = `${m}/${y}`;
      map.set(key, running);
    }
    return Array.from(map.entries()).map(([k,v])=> ({ date: k, saldo: Math.round(v*100)/100 }));
  },[trans]);

  // top destinatarios
  const topDest = useMemo(()=>{
    const map = new Map<string, { nome:string; count:number; total:number; tipo: 'entrada'|'saida' }>();
    for(const t of transFiltradas){
      const key = (t.destinatario || t.descricao).slice(0,40);
      if(!map.has(key)) map.set(key, { nome:key, count:0, total:0, tipo: t.valor>0 ? 'entrada' : 'saida' });
      const cur = map.get(key)!; cur.count += 1; cur.total += Math.abs(t.valor);
    }
    return Array.from(map.values()).sort((a,b)=> b.count - a.count).slice(0,5);
  },[transFiltradas]);

  return (
    <div className={`${dark? 'bg-slate-950 text-white' : 'bg-white text-slate-900'} min-h-screen p-6`}> 
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-bold">RisofloraFinance</h1>
            <p className="text-sm text-slate-400">Dashboard financeiro — moderno e responsivo</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle dark={dark} setDark={setDark} />
            <button onClick={()=> setModalOpen(true)} className="px-4 py-2 rounded bg-gradient-to-r from-green-500 to-emerald-400 text-slate-900 font-semibold">+ Nova transação</button>
            <div className="relative">
              <input ref={fileRef} type="file" accept=".csv,text/csv" multiple onChange={(e)=> handleFiles(e.target.files)} className="hidden" />
              <button onClick={()=> fileRef.current?.click()} className="px-3 py-2 rounded bg-gradient-to-r from-blue-500 to-indigo-500">Importar CSV</button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className={`from-slate-900 to-slate-800 border border-slate-700`}>
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div>
                  <div className="text-sm text-slate-300">Saldo (filtrado)</div>
                  <div className={`text-3xl font-bold ${saldo >=0 ? 'text-emerald-300' : 'text-red-400'}`}>{formatarValor(saldo)}</div>
                  <div className="mt-2 text-xs text-slate-400">Entradas: {formatarValor(entradas)} • Saídas: {formatarValor(saidas)}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="w-44">
                    <label className="text-xs text-slate-300">Período</label>
                    <select value={periodo} onChange={(e)=> setPeriodo(e.target.value as any)} className="w-full p-2 rounded bg-slate-700 text-white">
                      <option value="todos">Todo o período</option>
                      <option value="7d">Últimos 7 dias</option>
                      <option value="15d">Últimos 15 dias</option>
                      <option value="30d">Últimos 30 dias</option>
                      <option value="90d">Últimos 90 dias</option>
                      <option value="mensal">Este mês</option>
                      <option value="anual">Este ano</option>
                    </select>
                  </div>

                  <div className="w-40">
                    <label className="text-xs text-slate-300">Categoria</label>
                    <select value={categoriaFiltro} onChange={(e)=> setCategoriaFiltro(e.target.value)} className="w-full p-2 rounded bg-slate-700 text-white">
                      <option value="todos">Todas</option>
                      {categorias.map(c=> <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="w-32">
                    <label className="text-xs text-slate-300">Tipo</label>
                    <select value={tipoFiltro} onChange={(e)=> setTipoFiltro(e.target.value as any)} className="w-full p-2 rounded bg-slate-700 text-white">
                      <option value="todos">Todos</option>
                      <option value="entradas">Entradas</option>
                      <option value="saidas">Saídas</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="from-white/5 to-white/0 border border-slate-700">
                <h4 className="font-semibold mb-2">Gastos por categoria</h4>
                <GraficoPizza dados={categoriasResumo.slice(0,8)} />
              </Card>

              <Card className="from-white/5 to-white/0 border border-slate-700">
                <h4 className="font-semibold mb-2">Evolução do saldo</h4>
                <GraficoLinha pontos={timeline} />
              </Card>
            </div>

            <Card className="from-white/5 to-white/0 border border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold">Transações</h4>
                <div className="flex items-center gap-2">
                  <input placeholder="Pesquisar..." value={termo} onChange={(e)=> setTermo(e.target.value)} className="p-2 rounded bg-slate-700 text-white" />
                  <select value={String(limite)} onChange={(e)=> setLimite(Number(e.target.value))} className="p-2 rounded bg-slate-700 text-white">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {transFiltradas.slice(0,limite).map(t=> (
                  <div key={t.identificador} className="p-3 rounded-xl bg-gradient-to-r from-slate-800/60 to-slate-700/50 border border-slate-700 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="text-sm text-slate-300">{t.data} • <span className="text-xs text-slate-400">{t.categoria}</span></div>
                      <div className="font-medium truncate max-w-xl">{t.descricao}</div>
                      <div className="text-xs text-slate-400 mt-1">{t.destinatario ? `Para: ${t.destinatario}` : ''} {t.formaPagamento ? `• ${t.formaPagamento}` : ''}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`font-semibold ${t.valor>=0? 'text-emerald-300' : 'text-red-400'}`}>{formatarValor(t.valor)}</div>
                      <div className="text-xs text-slate-400 mt-1">{t.origemArquivo || 'Manual'}</div>
                    </div>
                  </div>
                ))}
                {transFiltradas.length === 0 && <div className="text-sm text-slate-500 p-4">Nenhuma transação encontrada</div>}
              </div>

            </Card>

          </div>

          <aside className="space-y-4">
            <Card className="from-white/5 to-white/0 border border-slate-700">
              <h4 className="font-semibold mb-2">Resumo</h4>
              <SmallStats entradas={entradas} saidas={saidas} saldo={saldo} />
            </Card>

            <Card className="from-white/5 to-white/0 border border-slate-700">
              <h4 className="font-semibold mb-2">Top destinatários</h4>
              <ul className="space-y-2">
                {topDest.map((d, i)=> (
                  <li key={i} className="flex justify-between items-center">
                    <div className="text-sm truncate max-w-[140px]">{d.nome}</div>
                    <div className={`font-medium ${d.tipo==='entrada' ? 'text-emerald-300' : 'text-red-400'}`}>{formatarValor(d.total)}</div>
                  </li>
                ))}
                {topDest.length===0 && <li className="text-sm text-slate-500">Nenhum destinatário</li>}
              </ul>
            </Card>

            <Card className="from-white/5 to-white/0 border border-slate-700">
              <h4 className="font-semibold mb-2">Categorias</h4>
              <div className="flex flex-wrap gap-2">
                {categorias.map(c => (
                  <button key={c} onClick={()=> setCategoriaFiltro(c)} className={`px-2 py-1 rounded ${categoriaFiltro===c ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' : 'bg-slate-700 text-white'}`}>{c}</button>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-xs text-slate-300">Adicionar categoria</label>
                <CategoryCreator onCreate={criarCategoria} />
              </div>
            </Card>
          </aside>
        </section>

      </div>

      <ModalNovaTransacao open={modalOpen} onClose={()=> setModalOpen(false)} categorias={categorias} adicionar={adicionarTransacao} />
    </div>
  );
}

function CategoryCreator({ onCreate }: { onCreate: (nome:string)=>void }){
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2 mt-2">
      <input value={val} onChange={(e)=> setVal(e.target.value)} className="p-2 rounded bg-slate-700 text-white flex-1" placeholder="Nome da categoria" />
      <button onClick={()=>{ onCreate(val.trim()); setVal(''); }} className="px-3 py-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500">Adicionar</button>
    </div>
  );
}
