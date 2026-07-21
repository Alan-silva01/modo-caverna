import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Questao, TipoQuestao } from '../types';

export function useQuestoes() {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuestoes = useCallback(async (
    disciplina: string,
    tema: string,
    disciplinaId: string,
    temaId: string,
    quantidade: number,
    tipo: TipoQuestao,
    dificuldade: 'medio' | 'dificil' | 'extremo' = 'extremo',
    concurso?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://wymlckdkrwdxyexrxxka.supabase.co'}/functions/v1/generate-questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            disciplina,
            tema,
            disciplina_id: disciplinaId,
            tema_id: temaId,
            quantidade,
            tipo,
            dificuldade,
            concurso,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao gerar questões (${response.status})`);
      }

      const data = await response.json();
      setQuestoes(data.questoes);
      return data.questoes as Questao[];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveResposta = useCallback(async (
    questaoId: string,
    respostaDada: string,
    acertou: boolean
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('respostas_usuario').insert({
      user_id: user.id,
      questao_id: questaoId,
      resposta_dada: respostaDada,
      acertou,
    });
  }, []);

  return { questoes, loading, error, generateQuestoes, saveResposta, setQuestoes };
}
