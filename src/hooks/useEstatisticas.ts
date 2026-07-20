import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { EstatisticaDisciplina, EstatisticaTema } from '../types';

export function useEstatisticas() {
  const [statsDisciplina, setStatsDisciplina] = useState<EstatisticaDisciplina[]>([]);
  const [statsTema, setStatsTema] = useState<EstatisticaTema[]>([]);
  const [totalQuestoes, setTotalQuestoes] = useState(0);
  const [totalAcertos, setTotalAcertos] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get all answers with question data
    const { data: respostas } = await supabase
      .from('respostas_usuario')
      .select(`
        acertou,
        questao_id,
        questoes (
          disciplina_id,
          tema_id
        )
      `)
      .eq('user_id', user.id);

    if (!respostas) { setLoading(false); return; }

    // Get disciplinas and temas names
    const { data: disciplinas } = await supabase.from('disciplinas').select('id, nome');
    const { data: temas } = await supabase.from('temas').select('id, nome');

    const discMap = new Map((disciplinas || []).map(d => [d.id, d.nome]));
    const temaMap = new Map((temas || []).map(t => [t.id, t.nome]));

    // Calculate overall stats
    const total = respostas.length;
    const acertos = respostas.filter(r => r.acertou).length;
    setTotalQuestoes(total);
    setTotalAcertos(acertos);

    // Stats by disciplina
    const discStats = new Map<string, { total: number; acertos: number }>();
    // Stats by tema
    const temaStats = new Map<string, { total: number; acertos: number }>();

    for (const r of respostas) {
      const q = r.questoes as unknown as { disciplina_id: string; tema_id: string };
      if (!q) continue;

      // By disciplina
      const ds = discStats.get(q.disciplina_id) || { total: 0, acertos: 0 };
      ds.total++;
      if (r.acertou) ds.acertos++;
      discStats.set(q.disciplina_id, ds);

      // By tema
      const ts = temaStats.get(q.tema_id) || { total: 0, acertos: 0 };
      ts.total++;
      if (r.acertou) ts.acertos++;
      temaStats.set(q.tema_id, ts);
    }

    const discArray: EstatisticaDisciplina[] = Array.from(discStats.entries())
      .map(([id, stats]) => ({
        disciplina_id: id,
        disciplina_nome: discMap.get(id) || 'Desconhecida',
        total: stats.total,
        acertos: stats.acertos,
        percentual: stats.total > 0 ? Math.round((stats.acertos / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.disciplina_nome.localeCompare(b.disciplina_nome));

    const temaArray: EstatisticaTema[] = Array.from(temaStats.entries())
      .map(([id, stats]) => ({
        tema_id: id,
        tema_nome: temaMap.get(id) || 'Desconhecido',
        total: stats.total,
        acertos: stats.acertos,
        percentual: stats.total > 0 ? Math.round((stats.acertos / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.tema_nome.localeCompare(b.tema_nome));

    setStatsDisciplina(discArray);
    setStatsTema(temaArray);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const percentualGeral = totalQuestoes > 0
    ? Math.round((totalAcertos / totalQuestoes) * 100)
    : 0;

  return {
    statsDisciplina,
    statsTema,
    totalQuestoes,
    totalAcertos,
    percentualGeral,
    loading,
    refetch: fetchStats,
  };
}
