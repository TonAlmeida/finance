'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

/******************************
 * Types & Constants
 ******************************/
type Transacao = {
  data: string; // DD/MM/YYYY
  valor: number; // positivo = entrada, negativo = saída
  identificador: string;
  descricao: string;
  categoria: string;
  formaPagamento?: string;
  destinatario?: string;
  parcelas?: string;
  origemArquivo?: string;
};

const STORAGE_KEY = 'uli_transacoes_v4_improved';

const CATEGORIAS_INICIAIS = [
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Moradia',
  'Compras',
  'Lazer',
  'Viagem',
  'Dívidas',
  'Investimentos',
  'Impostos',
  'Serviços',
  'Assinaturas',
  'Pets',
  'Outros',
];

const CHART_COLORS = ['#60a5fa', '#7c3aed', '#34d399', '#f97316', '#ef4444', '#f59e0b', '#06b6d4', '#a78bfa'];

const formatarValor = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/******************************
 * Utils: parsing / dates
 ******************************/
function parseValorRobusto(raw?: string | number): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s/g, '');
  s = s.replace(/^R\$\s?/, '');
  s = s.replace(/−/g, '-');
  const negativo = /^-/.test(s) || /-$/.test(s);
  s = s.replace(/^-|-$|\+/g, '');

  if (/\d+\.\d{3}(?:\.\d{3})*,\d{1,2}$/.test(s) || (s.includes('.') && s.includes(','))) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
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
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const m = s.match(/(\d{1,2})[^\d](\d{1,2})[^\d](\d{4})/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  return null;
}

function dataParaTimestamp(ddmmyyyy: string) {
  const p = ddmmyyyy.split('/');
  if (p.length !== 3) return 0;
  const [d, m, y] = p.map(Number);
  return new Date(y, m - 1, d).getTime();
}

function detectarSeparador(linha: string) {
  if (linha.includes(';')) return ';';
  if (linha.includes(',')) return ',';
  return ',';
}

function inferirCategoria(desc: string) {
  const d = (desc || '').toLowerCase();
  if (d.includes('pix') || d.includes('transfer')) return 'Transferência';
  if (d.includes('restaurante') || d.includes('supermercado') || d.includes('aliment')) return 'Alimentação';
  if (d.includes('uber') || d.includes('transporte') || d.includes('combust')) return 'Transporte';
  if (d.includes('luz') || d.includes('água') || d.includes('internet') || d.includes('celular')) return 'Utilidades';
  if (d.includes('salário') || d.includes('salario') || d.includes('rendimento')) return 'Rendimento';
  return 'Outros';
}

/******************************
 * CSV Parser (improved)
 ******************************/
function parseCsvContent(content: string, origem = 'arquivo'): Transacao[] {
  const linhas = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return [];
  const primeira = linhas[0].toLowerCase();
  const hasHeader = primeira.includes('data') || primeira.includes('valor') || primeira.includes('descricao');
  const start = hasHeader ? 1 : 0;
  const resultados: Transacao[] = [];

  for (let i = start; i < linhas.length; i++) {
    const row = linhas[i];
    const sep = detectarSeparador(row);
    const cols = row.split(sep).map((c) => c.trim());

    let dataRaw = '',
      valorRaw = '',
      descricao = '',
      id = '',
      categoria = '',
      forma = '',
      destinatario = '',
      parcelas = '';

    if (cols.length >= 8) {
      dataRaw = cols[0];
      valorRaw = cols[1];
      descricao = cols[2];
      id = cols[3];
      categoria = cols[4];
      forma = cols[5];
      destinatario = cols[6];
      parcelas = cols[7];
    } else if (cols.length === 6) {
      [dataRaw, valorRaw, descricao, id, categoria, forma] = cols;
    } else if (cols.length === 5) {
      [dataRaw, valorRaw, descricao, categoria, forma] = cols;
    } else if (cols.length === 4) {
      [dataRaw, valorRaw, id, descricao] = cols;
    } else if (cols.length === 3) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(cols[0]) || /^\d{2}\/\d{2}\/\d{4}$/.test(cols[0])) {
        [dataRaw, valorRaw, descricao] = cols;
      } else {
        [descricao, valorRaw, id] = cols;
      }
    } else if (cols.length === 2) {
      [descricao, valorRaw] = cols;
      id = `csv-${i}-${Date.now()}`;
      dataRaw = new Date().toLocaleDateString('pt-BR');
    } else continue;

    const dataNorm = normalizarDataParaDDMMYYYY(dataRaw) || new Date().toLocaleDateString('pt-BR');
    const valorNum = parseValorRobusto(valorRaw);
    if (valorNum === null) continue;
    const cat = categoria || inferirCategoria(descricao || '');

    resultados.push({
      data: dataNorm,
      valor: valorNum,
      identificador: id || `csv-${Date.now()}-${i}`,
      descricao: descricao || 'Sem descrição',
      categoria: cat,
      formaPagamento: forma || undefined,
      destinatario: destinatario || undefined,
      parcelas: parcelas || undefined,
      origemArquivo: origem,
    });
  }

  return resultados;
}

async function parseMultipleCsvFiles(files: File[]): Promise<{ parsed: Transacao[]; summary: { imported: number; duplicates: number; totalRows: number } }> {
  const all: Transacao[] = [];
  let totalRows = 0;
  for (const f of files) {
    try {
      const text = await f.text();
      const parsed = parseCsvContent(text, f.name);
      totalRows += parsed.length;
      all.push(...parsed);
    } catch (e) {
      console.error('Erro ao ler', f.name, e);
    }
  }
  const map = new Map<string, Transacao>();
  let duplicates = 0;
  for (const t of all) {
    if (!map.has(t.identificador)) map.set(t.identificador, t);
    else duplicates++;
  }
  const unique = Array.from(map.values()).sort((a, b) => dataParaTimestamp(b.data) - dataParaTimestamp(a.data));
  return { parsed: unique, summary: { imported: unique.length, duplicates, totalRows } };
}

/******************************
 * Small UI primitives (componentizados)
 ******************************/
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl p-4 shadow-2xl bg-white/5 backdrop-blur-sm ${className}`}>{children}</div>
);

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs px-2 py-0.5 rounded-full bg-white/6">{children}</span>
);

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l1.7 3.4L17 7l-3.3 1.6L12 12l-1.7-3.4L7 7l3.3-1.6L12 2z" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

/******************************
 * Charts components
 ******************************/
function GraficoPizza({ dados }: { dados: { name: string; value: number }[] }) {
  return (
    <div style={{ width: '100%', height: 220 }} className="py-2">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={dados} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={4} label={(entry) => entry.name}>
            {dados.map((d, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <ReTooltip formatter={(value: number) => formatarValor(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoLinha({ pontos }: { pontos: { date: string; saldo: number }[] }) {
  return (
    <div style={{ width: '100%', height: 240 }} className="py-2">
      <ResponsiveContainer>
        <LineChart data={pontos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatarValor(v as number)} width={80} />
          <ReTooltip formatter={(val: number) => formatarValor(val)} />
          <Line type="monotone" dataKey="saldo" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutWidget({ value, target = 1 }: { value: number; target?: number }) {
  const percentual = Math.max(0, Math.min(1, value / target));
  const remainder = 1 - percentual;
  const display = Math.round(percentual * 100);
  return (
    <div className="w-full p-4">
      <div className="rounded-2xl bg-white/90 p-6 shadow-inner flex flex-col items-center justify-center">
        <div style={{ width: 220, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[{ v: percentual }, { v: remainder }]} dataKey="v" cx="50%" cy="50%" innerRadius={72} outerRadius={96} startAngle={90} endAngle={-270}>
                <Cell key="a" fill="#7c3aed" />
                <Cell key="b" fill="#eee" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="-mt-40 text-center">
          <div className="text-sm text-slate-500">Net Profit Margin %</div>
          <div className="text-4xl font-bold text-rose-500">{display}%</div>
          <div className="text-xs text-slate-400">Target {Math.round(target * 100)}%</div>
        </div>
      </div>
    </div>
  );
}

/******************************
 * Modal (inline)
 ******************************/
function ModalNovaTransacao({
  open,
  onClose,
  categorias,
  adicionar,
}: {
  open: boolean;
  onClose: () => void;
  categorias: string[];
  adicionar: (t: Transacao) => void;
}) {
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    valor: '',
    descricao: '',
    categoria: categorias[0] || 'Outros',
    formaPagamento: '',
    destinatario: '',
    parcelas: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        data: new Date().toISOString().slice(0, 10),
        valor: '',
        descricao: '',
        categoria: categorias[0] || 'Outros',
        formaPagamento: '',
        destinatario: '',
        parcelas: '',
      });
    }
  }, [open, categorias]);

  const submit = () => {
    const valor = parseValorRobusto(form.valor);
    if (valor === null) {
      alert('Valor inválido');
      return;
    }
    const dataNorm = normalizarDataParaDDMMYYYY(form.data) || new Date().toLocaleDateString('pt-BR');
    const t: Transacao = {
      data: dataNorm,
      valor,
      identificador: `manual-${Date.now()}`,
      descricao: form.descricao || 'Sem descrição',
      categoria: form.categoria || 'Outros',
      formaPagamento: form.formaPagamento || undefined,
      destinatario: form.destinatario || undefined,
      parcelas: form.parcelas || undefined,
    };
    adicionar(t);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Adicionar nova transação</h3>
          <button onClick={onClose} className="text-slate-400">Fechar</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs">Data</label>
            <input type="date" className="w-full p-2 rounded bg-slate-700 text-white" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs">Valor</label>
            <input placeholder="1234,56" className="w-full p-2 rounded bg-slate-700 text-white" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs">Descrição</label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs">Categoria</label>
            <select className="w-full p-2 rounded bg-slate-700 text-white" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs">Forma de pagamento</label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.formaPagamento} onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs">Destinatário</label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.destinatario} onChange={(e) => setForm((f) => ({ ...f, destinatario: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs">Parcelas (opcional)</label>
            <input className="w-full p-2 rounded bg-slate-700 text-white" value={form.parcelas} onChange={(e) => setForm((f) => ({ ...f, parcelas: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-3 py-2 rounded bg-slate-700">Cancelar</button>
          <button onClick={submit} className="px-4 py-2 rounded bg-gradient-to-r from-green-500 to-emerald-400 text-slate-900 font-semibold">Adicionar</button>
        </div>
      </div>
    </div>
  );
}

/******************************
 * Main: DashboardFinanceiro
 ******************************/
export default function DashboardFinanceiro() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [trans, setTrans] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_INICIAIS);
  const [modalOpen, setModalOpen] = useState(false);
  const [dark, setDark] = useState(true);

  // filtros / UI
  const [periodo, setPeriodo] = useState<'todos' | '7d' | '15d' | '30d' | '90d' | 'mensal' | 'anual'>('todos');
  const [ano, setAno] = useState<'todos' | string>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'todos' | string>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entradas' | 'saidas'>('todos');
  const [termo, setTermo] = useState('');
  const [limite, setLimite] = useState<number>(20);

  // feedback import
  const [importSummary, setImportSummary] = useState<{ imported: number; duplicates: number; totalRows: number } | null>(null);

  // nova categoria controlada
  const [novaCategoriaInput, setNovaCategoriaInput] = useState('');

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Transacao[] = JSON.parse(raw);
        setTrans(parsed);
        const cats = Array.from(new Set([...CATEGORIAS_INICIAIS, ...parsed.map((t) => t.categoria || '')].filter(Boolean)));
        setCategorias(cats);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trans));
    } catch (e) {
      console.error(e);
    }
  }, [trans]);

  // import (sobrescrever conforme pedido)
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const { parsed, summary } = await parseMultipleCsvFiles(arr);
    setTrans(parsed); // sobrescreve
    setImportSummary(summary);

    // add categories found
    const cats = Array.from(new Set([...categorias, ...parsed.map((p) => p.categoria || '')].filter(Boolean)));
    setCategorias(cats);

    // limpa o input
    if (fileRef.current) fileRef.current.value = '';

    // limpa summary depois de 6s
    setTimeout(() => setImportSummary(null), 6000);
  };

  // add manual
  const adicionarTransacao = (t: Transacao) => {
    setTrans((prev) => {
      const all = [t, ...prev];
      all.sort((a, b) => dataParaTimestamp(b.data) - dataParaTimestamp(a.data));
      return all;
    });
    if (!categorias.includes(t.categoria)) setCategorias((p) => [t.categoria, ...p]);
  };

  const criarCategoria = (nome: string) => {
    const v = nome.trim();
    if (!v) return;
    if (!categorias.includes(v)) setCategorias((p) => [v, ...p]);
  };

  // normalized list
  const transComCategorias = useMemo(() => trans.map((t) => ({ ...t, categoria: t.categoria || inferirCategoria(t.descricao) })), [trans]);

  const anosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    transComCategorias.forEach((t) => {
      const parts = t.data.split('/');
      if (parts[2]) s.add(parts[2]);
    });
    return ['todos', ...Array.from(s).sort((a, b) => Number(b) - Number(a))];
  }, [transComCategorias]);

  // filtering
  const transFiltradas = useMemo(() => {
    let arr = transComCategorias.slice();
    if (periodo !== 'todos') {
      const agora = Date.now();
      let inicio = 0;
      switch (periodo) {
        case '7d':
          inicio = agora - 7 * 24 * 60 * 60 * 1000;
          break;
        case '15d':
          inicio = agora - 15 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          inicio = agora - 30 * 24 * 60 * 60 * 1000;
          break;
        case '90d':
          inicio = agora - 90 * 24 * 60 * 60 * 1000;
          break;
        case 'mensal': {
          const d = new Date();
          inicio = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
          break;
        }
        case 'anual': {
          const d = new Date();
          inicio = new Date(d.getFullYear(), 0, 1).getTime();
          break;
        }
      }
      arr = arr.filter((t) => dataParaTimestamp(t.data) >= inicio);
    }
    if (ano !== 'todos') arr = arr.filter((t) => t.data.split('/')[2] === ano);
    if (categoriaFiltro !== 'todos') arr = arr.filter((t) => t.categoria === categoriaFiltro);
    if (tipoFiltro !== 'todos') {
      if (tipoFiltro === 'entradas') arr = arr.filter((t) => t.valor > 0);
      if (tipoFiltro === 'saidas') arr = arr.filter((t) => t.valor < 0);
    }
    if (termo.trim()) {
      const low = termo.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.descricao.toLowerCase().includes(low) ||
          t.categoria.toLowerCase().includes(low) ||
          (t.destinatario || '').toLowerCase().includes(low) ||
          (t.formaPagamento || '').toLowerCase().includes(low)
      );
    }
    arr.sort((a, b) => dataParaTimestamp(b.data) - dataParaTimestamp(a.data));
    return arr;
  }, [transComCategorias, periodo, ano, categoriaFiltro, tipoFiltro, termo]);

  // aggregates
  const entradas = useMemo(() => transFiltradas.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0), [transFiltradas]);
  const saidas = useMemo(() => transFiltradas.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0), [transFiltradas]);
  const saldo = entradas - saidas;

  const categoriasResumo = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transFiltradas) {
      const v = Math.abs(t.valor);
      map.set(t.categoria, (map.get(t.categoria) || 0) + v);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transFiltradas]);

  const timeline = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...trans].sort((a, b) => dataParaTimestamp(a.data) - dataParaTimestamp(b.data));
    let running = 0;
    for (const t of sorted) {
      running += t.valor;
      const [d, m, y] = t.data.split('/');
      const key = `${m}/${y}`;
      map.set(key, running);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ date: k, saldo: Math.round(v * 100) / 100 }));
  }, [trans]);

  const topDest = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; total: number; tipo: 'entrada' | 'saida' }>();
    for (const t of transFiltradas) {
      const key = (t.destinatario || t.descricao).slice(0, 40);
      if (!map.has(key)) map.set(key, { nome: key, count: 0, total: 0, tipo: t.valor > 0 ? 'entrada' : 'saida' });
      const cur = map.get(key)!;
      cur.count += 1;
      cur.total += Math.abs(t.valor);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [transFiltradas]);

  // pagination simple
  const perPage = limite;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transFiltradas.length / perPage));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [transFiltradas.length, perPage, totalPages, page]);
  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, transFiltradas.length);
  useEffect(() => setPage(1), [limite]);

  // inline category editing
  const [editingCategoriaFor, setEditingCategoriaFor] = useState<string | null>(null);
  const [novaCategoriaTempForId, setNovaCategoriaTempForId] = useState<Record<string, string>>({});

  function atribuirCategoria(id: string, categoria: string) {
    if (categoria === '__nova') {
      setEditingCategoriaFor(id);
      setNovaCategoriaTempForId((s) => ({ ...s, [id]: '' }));
      return;
    }
    setTrans((prev) => prev.map((t) => (t.identificador === id ? { ...t, categoria } : t)));
    if (!categorias.includes(categoria)) setCategorias((p) => [categoria, ...p]);
    setEditingCategoriaFor(null);
  }

  function criarEAtribuirNovaCategoria(id: string, nome: string) {
    const v = nome.trim();
    if (!v) return;
    if (!categorias.includes(v)) setCategorias((p) => [v, ...p]);
    setTrans((prev) => prev.map((t) => (t.identificador === id ? { ...t, categoria: v } : t)));
    setNovaCategoriaTempForId((s) => ({ ...s, [id]: '' }));
    setEditingCategoriaFor(null);
  }

  //limpar dados
  function limpardados() {
    setTrans([])
    localStorage.clear();
  }

  //Formatar data
  function formatDate(dateString: string) {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // formato DD/MM/YYYY
}


  return (
    <div className={`${dark ? 'bg-gradient-to-br from-purple-700 to-indigo-600 text-white' : 'bg-white text-slate-900'} min-h-screen p-8 md:flex`}> 
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="max-w-4xl flex flex-col gap-4 justify-between items-center md:flex-row">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold drop-shadow">RisofloraFinance</h1>
            <p className="text-sm text-white/80 mt-1">um pé na roça e outro no jardim</p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">{/*aqui edita o layout dos botões no início*/}
            <div className="flex items-center gap-2">
              <button onClick={() => setDark(false)} className={`cursor-pointer px-3 py-1 rounded-lg bg-white text-blue-600`}>Claro</button>
              <button onClick={() => setDark(true)} className={`cursor-pointer px-3 py-1 rounded-lg text-white ${dark ? 'bg-transparent' : 'bg-gradient-to-r from-purple-600 to-blue-500'}`}>Escuro</button>
            </div>

            <div className='flex gap-3 p-3'>
              <button onClick={() => setModalOpen(true)} className="cursor-pointer px-4 py-2 rounded bg-gradient-to-r from-green-400 to-emerald-400 text-slate-900 font-semibold shadow sm:text-xs">+ Nova transação</button>

              <div className="relative">
                <input ref={fileRef} type="file" accept=".csv,text/csv" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="cursor-pointer px-3 py-2 rounded bg-gradient-to-r from-blue-500 to-indigo-500 shadow sm:text-xs">Importar CSV</button>
              </div>
            </div>
          </div>
        </header>

        {/* Import summary (sutil) */}
        {importSummary && (
          <div className="p-3 rounded-lg bg-white/10 text-sm max-w-md">{importSummary.imported} transações importadas • {importSummary.duplicates} duplicatas ignoradas</div>
        )}

        <section className="max-w-4xl grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Resumo ampliado com cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="from-white/5 to-white/2 border border-white/10">
                <div className={`text-sm ${!dark ? 'text-gray-500' : 'text-white/80'}`}>Total Entradas</div>
                <div className="text-2xl font-bold mt-2">{formatarValor(entradas || 0)}</div>
                <div className={`text-xs mt-1 ${dark ? 'text-white/80' : 'text-gray-500'}`}>vs previous month</div>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white border border-white/10">
                <div className="text-sm">Total Saídas</div>
                <div className="text-2xl font-bold mt-2">{formatarValor(saidas || 0)}</div>
                <div className="text-xs mt-1 opacity-90">vs previous month</div>
              </Card>

              <div className='bg-white rounded-lg p-5'>
                <div className={`text-2xl font-bold mt-2 text-black`}>Saldo Total</div>
                <div className={`text-3xl font-bold mt-2 ${saldo > 0 ? 'text-green-500' : 'text-red-500'}`}>{formatarValor(saldo)}</div>
                <div className="text-sm text-gray-600 bold-500 mt-1">{formatarValor(entradas)} - {formatarValor(saidas)}</div>
              </div>

              <Card>
                <div className="mt-3 space-y-1 text-xs text-white/60">
                  <div className={`text-sm ${!dark ? 'text-gray-500' : 'text-white/80'}`}>Total de transações:</div>
                  <div className={`text-2xl font-bold mt-2 ${dark ? 'text-white/80' : 'text-black'}`}>{transFiltradas.length}</div>
                  <div className={`text-xs mt-1 ${dark ? 'text-white/80' : 'text-gray-500'}`}>
                    Ticket médio:{' '}
                    {formatarValor(
                      transFiltradas.length > 0
                        ? (entradas + saidas) / transFiltradas.length
                        : 0
                    )}
                  </div>
                </div>
              </Card>

            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <h4 className="font-semibold mb-2">Gastos por categoria</h4>
                <GraficoPizza dados={categoriasResumo.slice(0, 8)} />
              </Card>

              <Card>
                <h4 className="font-semibold mb-2">Evolução do saldo</h4>
                <GraficoLinha pontos={timeline} />
              </Card>
            </div>

            {/* Lista com paginação e edição de categoria */}
            <Card>
              <div style={{flexDirection: 'column'}} className="flex justify-between items-start mb-3">
                <h4 className="font-semibold">Transações</h4>
                <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
                  <input placeholder="Pesquisar..." value={termo} onChange={(e) => setTermo(e.target.value)} className="p-2 rounded bg-slate-700 text-white" />
                  <select value={String(limite)} onChange={(e) => setLimite(Number(e.target.value))} className="cursor-pointer p-2 rounded bg-slate-700 text-white">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {transFiltradas.slice(start, end).map((t) => (
                  <div key={t.identificador} className="p-3 rounded-xl bg-white/6 border border-white/6 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-white/80">{t.data}</div>

                        {editingCategoriaFor === t.identificador ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={t.categoria}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__nova') {
                                  setNovaCategoriaTempForId((s) => ({ ...s, [t.identificador]: '' }));
                                  return;
                                }
                                atribuirCategoria(t.identificador, val);
                              }}
                              className="cursor-pointer p-1 rounded bg-slate-700 text-sm"
                            >
                              {categorias.map((cOpt) => (
                                <option className='cursor-pointer' key={cOpt} value={cOpt}>
                                  {cOpt}
                                </option>
                              ))}
                              <option value="__nova">+ Nova...</option>
                            </select>

                            {novaCategoriaTempForId[t.identificador] !== undefined ? (
                              <div className="flex items-center gap-2">
                                <input
                                  value={novaCategoriaTempForId[t.identificador] || ''}
                                  onChange={(e) => setNovaCategoriaTempForId((s) => ({ ...s, [t.identificador]: e.target.value }))}
                                  className="p-1 rounded bg-slate-700 text-sm"
                                  placeholder="Nova categoria"
                                />
                                <button
                                  onClick={() => criarEAtribuirNovaCategoria(t.identificador, novaCategoriaTempForId[t.identificador] || '')}
                                  className="cursor-pointer px-2 py-1 rounded bg-indigo-500 text-white text-sm"
                                >
                                  Criar
                                </button>
                                <button onClick={() => setEditingCategoriaFor(null)} className="cursor-pointer px-2 py-1 rounded bg-slate-600 text-sm">Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => setEditingCategoriaFor(null)} className="cursor-pointer px-2 py-1 rounded bg-slate-600 text-sm">OK</button>
                            )}
                          </div>
                        ) : (
                          <>
                            <span className="font-medium truncate max-w-xl">{t.descricao}</span>
                            <button onClick={() => setEditingCategoriaFor(t.identificador)} className="cursor-pointer ml-2 text-xs bg-white/8 px-2 py-0.5 rounded">{t.categoria}</button>
                          </>
                        )}
                      </div>

                      <div className="text-xs text-white/60 mt-1">
                        {t.destinatario ? `Para: ${t.destinatario}` : 'Sem destinatário'} {t.formaPagamento ? `• ${t.formaPagamento}` : ''} {t.parcelas ? `• ${t.parcelas}` : ''} • {t.origemArquivo || 'Manual'}
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div className={`font-semibold ${t.valor >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>{formatarValor(t.valor)}</div>
                      <div className="text-xs text-white/60 mt-1">ID: {t.identificador}</div>
                    </div>
                  </div>
                ))}

                {transFiltradas.length === 0 && <div className="text-sm text-white/60 p-4">Nenhuma transação encontrada</div>}
              </div>

              {/* paginação simples */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(1)} className="text-xs sm:text-sm cursor-pointer px-2 py-1 rounded bg-slate-700 disabled:opacity-40 text-white">Primeira</button>
                  <button disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} className="text-xs sm:text-sm cursor-pointer px-2 py-1 rounded bg-slate-700 disabled:opacity-40 text-white/90">Anterior</button>
                  <button disabled={page >= totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} className={`text-xs sm:text-sm cursor-pointer px-2 py-1 rounded bg-slate-700 disabled:opacity-40 text-white`}>Próxima</button>
                  <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="text-xs sm:text-sm cursor-pointer px-2 py-1 rounded bg-slate-700 disabled:opacity-40 text-white">Última</button>
                </div>
              </div>
              <p className="text-sm text-white/70">Página {page} de {totalPages}</p>
              {/* exportar no final */}
              <div className="flex flex-col mt-4 items-center justify-start sm:justify-between sm:flex-row sm:items-start">
                &copy; Tonzinho
                <div className='flex gap-2'>
                  <button onClick={() => {
                  // exporta todas as filtradas
                  const toExport = transFiltradas;
                  if (!toExport.length) return;
                  

                  const headers = ['Data', 'Valor', 'Identificador', 'Descrição'];

                  const rows = toExport.map((t) => [
                    formatDate(t.data),
                    Number(t.valor).toFixed(2), // já é number, não precisa de replace
                    t.identificador ?? '',
                    t.descricao ?? '',
                  ]);


                  // Monta CSV com escape de aspas
                  const csv = [
                    headers.join(','), // cabeçalho
                    ...rows.map((r) =>
                      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
                    ),
                  ].join('\n') + '\n';

                  // Cria e baixa o CSV
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transacoes_filtradas_${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);





                }} className="text-xs sm:text-md px-4 py-2 rounded bg-gradient-to-r from-purple-500 to-pink-500">Exportar transações (filtradas)</button>
                <button onClick={limpardados} className='hover:bg-red-500/60 text-xs sm:text-md cursor-pointer py-2 px-4 text-white/80 border-2 border-red-400 rounded-lg'>LIMPAR DADOS</button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>


      <ModalNovaTransacao open={modalOpen} onClose={() => setModalOpen(false)} categorias={categorias} adicionar={adicionarTransacao} />
    </div>
  );
}
