import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Tema } from '../types';

export function useTemas(disciplinaId: string | null) {
  const [temas, setTemas] = useState<Tema[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemas = useCallback(async () => {
    if (!disciplinaId) {
      setTemas([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('temas')
      .select('*')
      .eq('disciplina_id', disciplinaId)
      .order('nome');

    if (!error && data) {
      setTemas(data);
    }
    setLoading(false);
  }, [disciplinaId]);

  useEffect(() => {
    fetchTemas();
  }, [fetchTemas]);

  const createTema = async (nome: string) => {
    if (!disciplinaId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('temas')
      .insert({ nome, disciplina_id: disciplinaId, user_id: user.id })
      .select()
      .single();

    if (!error && data) {
      setTemas(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      return data;
    }
    return null;
  };

  return { temas, loading, createTema, refetch: fetchTemas };
}
