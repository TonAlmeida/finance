export type Transacao = {
  data: string; // DD/MM/YYYY
  valor: number;
  identificador: string;
  descricao: string;
  categoria: string;
  formaPagamento?: string;
  destinatario?: string;
  parcelas?: string;
  origemArquivo?: string;
};