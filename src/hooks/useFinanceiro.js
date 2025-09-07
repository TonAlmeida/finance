import { useState, useEffect } from 'react';

export function useFinanceiro() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);
      
      const response = await fetch('/api/financeiro');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erro ao carregar dados');
      }
      
      setDados(data);
    } catch (error) {
      setErro(error.message);
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  return { 
    dados, 
    carregando, 
    erro, 
    recarregar: carregarDados 
  };
}