// components/TransactionTable.jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { formatarValor } from '@/utils/formatar';

export default function TransactionTable({ transacoes }) {
  if (transacoes.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transação encontrada com os filtros atuais</p>
      </div>
    );
  }

  return (
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
            {transacoes.map((transacao) => (
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
    </div>
  );
}