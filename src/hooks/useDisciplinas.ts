import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Disciplina } from '../types';

export function useDisciplinas(editalId?: string | null) {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisciplinas = useCallback(async () => {
    setLoading(true);

    let query = supabase.from('disciplinas').select('*').order('nome');

    if (editalId) {
      // Carrega as disciplinas do edital selecionado (templates do sistema)
      query = query.eq('edital_id', editalId);
    } else {
      // Sem concurso selecionado: disciplinas criadas pelo usuário (sem edital vinculado)
      query = query.is('edital_id', null);
    }

    const { data, error } = await query;
    if (!error && data) {
      setDisciplinas(data);
    }
    setLoading(false);
  }, [editalId]);

  useEffect(() => {
    fetchDisciplinas();

    // Inscrição em tempo real para disciplinas
    const channel = supabase
      .channel('realtime-disciplinas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disciplinas'
        },
        () => {
          fetchDisciplinas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDisciplinas]);

  const createDisciplina = async (nome: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('disciplinas')
      .insert({ nome, user_id: user.id, edital_id: editalId ?? null })
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
