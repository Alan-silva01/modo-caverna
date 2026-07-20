import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Edital } from '../contexts/ConcursoContext';

export function useEditais() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('editais')
      .select('*')
      .eq('ativo', true)
      .order('data_prova', { ascending: true });

    if (data) setEditais(data as Edital[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Inscrição em tempo real para editais
    const channel = supabase
      .channel('realtime-editais')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'editais'
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { editais, loading };
}

export function calcDaysLeft(dataProva: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const prova = new Date(dataProva + 'T00:00:00');
  const diff = prova.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
