import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Edital {
  id: string;
  sigla: string;
  nome: string;
  tipo: 'militar' | 'civil' | 'federal';
  orgao: string;
  data_prova: string; // ISO date string
  image_url?: string;
  descricao?: string;
}

interface ConcursoContextType {
  concursoAlvo: Edital | null;
  setConcursoAlvo: (c: Edital | null) => void;
}

const ConcursoContext = createContext<ConcursoContextType | undefined>(undefined);

export function ConcursoProvider({ children }: { children: ReactNode }) {
  const [concursoAlvo, setConcursoAlvoState] = useState<Edital | null>(() => {
    try {
      const saved = localStorage.getItem('concurso-alvo');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setConcursoAlvo = (c: Edital | null) => {
    setConcursoAlvoState(c);
    if (c) {
      localStorage.setItem('concurso-alvo', JSON.stringify(c));
    } else {
      localStorage.removeItem('concurso-alvo');
    }
  };

  return (
    <ConcursoContext.Provider value={{ concursoAlvo, setConcursoAlvo }}>
      {children}
    </ConcursoContext.Provider>
  );
}

export function useConcurso() {
  const ctx = useContext(ConcursoContext);
  if (!ctx) throw new Error('useConcurso must be used inside ConcursoProvider');
  return ctx;
}
