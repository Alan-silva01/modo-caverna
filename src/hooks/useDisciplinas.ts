import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Disciplina } from '../types';

export function useDisciplinas() {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisciplinas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('disciplinas')
      .select('*')
      .order('nome');

    if (!error && data) {
      setDisciplinas(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDisciplinas();
  }, [fetchDisciplinas]);

  const createDisciplina = async (nome: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('disciplinas')
      .insert({ nome, user_id: user.id })
      .select()
      .single();

    if (!error && data) {
      setDisciplinas(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      return data;
    }
    return null;
  };

  return { disciplinas, loading, createDisciplina, refetch: fetchDisciplinas };
}
