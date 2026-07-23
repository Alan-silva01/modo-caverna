import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { EstatisticaDisciplina, EstatisticaTema, EstatisticaDificuldade, EstatisticaTipo } from '../types';

export function useEstatisticas() {
  const [statsDisciplina, setStatsDisciplina] = useState<EstatisticaDisciplina[]>([]);
  const [statsTema, setStatsTema] = useState<EstatisticaTema[]>([]);
  const [statsDificuldade, setStatsDificuldade] = useState<EstatisticaDificuldade[]>([]);
  const [statsTipo, setStatsTipo] = useState<EstatisticaTipo[]>([]);
  const [totalQuestoes, setTotalQuestoes] = useState(0);
  const [totalAcertos, setTotalAcertos] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Fetch answers, disciplinas and temas in parallel for maximum speed
    const [respostasRes, disciplinasRes, temasRes] = await Promise.all([
      supabase
        .from('respostas_usuario')
        .select(`
          acertou,
          questao_id,
          questoes (
            disciplina_id,
            tema_id,
            tipo,
            dificuldade
          )
        `)
        .eq('user_id', user.id),
      supabase
        .from('disciplinas')
        .select('id, nome, editais(sigla)'),
      supabase
        .from('temas')
        .select('id, nome')
    ]);

    const respostas = respostasRes.data;
    const disciplinas = disciplinasRes.data;
    const temas = temasRes.data;

    if (!respostas || respostas.length === 0) {
      setStatsDisciplina([]);
      setStatsTema([]);
      setStatsDificuldade([]);
      setStatsTipo([]);
      setTotalQuestoes(0);
      setTotalAcertos(0);
      setLoading(false);
      return;
    }

    const discMap = new Map((disciplinas || []).map(d => {
      const sigla = (d.editais as any)?.sigla;
      const nomeExibicao = sigla ? `${d.nome} (${sigla})` : d.nome;
      return [d.id, nomeExibicao];
    }));
    const temaMap = new Map((temas || []).map(t => [t.id, t.nome]));

    // Calculate overall stats
    const total = respostas.length;
    const acertos = respostas.filter(r => r.acertou).length;
    setTotalQuestoes(total);
    setTotalAcertos(acertos);

    // Stats maps
    const discStats = new Map<string, { total: number; acertos: number }>();
    const temaStats = new Map<string, { total: number; acertos: number }>();
    
    const diffStats = new Map<string, { total: number; acertos: number }>();
    diffStats.set('extremo', { total: 0, acertos: 0 });
    diffStats.set('dificil', { total: 0, acertos: 0 });
    diffStats.set('medio', { total: 0, acertos: 0 });

    const tipoStats = new Map<string, { total: number; acertos: number }>();
    tipoStats.set('certo_errado', { total: 0, acertos: 0 });
    tipoStats.set('multipla_escolha', { total: 0, acertos: 0 });

    for (const r of respostas) {
      const q = r.questoes as unknown as {
        disciplina_id: string;
        tema_id: string;
        tipo?: string;
        dificuldade?: string;
      };
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

      // By dificuldade
      const rawDif = q.dificuldade || 'medio';
      const difKey = ['extremo', 'dificil', 'medio'].includes(rawDif) ? rawDif : 'medio';
      const dif = diffStats.get(difKey)!;
      dif.total++;
      if (r.acertou) dif.acertos++;
      diffStats.set(difKey, dif);

      // By tipo
      const tipoKey = q.tipo === 'multipla_escolha' ? 'multipla_escolha' : 'certo_errado';
      const tp = tipoStats.get(tipoKey)!;
      tp.total++;
      if (r.acertou) tp.acertos++;
      tipoStats.set(tipoKey, tp);
    }

    const discArray: EstatisticaDisciplina[] = Array.from(discStats.entries())
      .map(([id, stats]) => ({
        disciplina_id: id,
        disciplina_nome: discMap.get(id) || 'Desconhecida',
        total: stats.total,
        acertos: stats.acertos,
        percentual: stats.total > 0 ? Number(((stats.acertos / stats.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.disciplina_nome.localeCompare(b.disciplina_nome));

    const temaArray: EstatisticaTema[] = Array.from(temaStats.entries())
      .map(([id, stats]) => ({
        tema_id: id,
        tema_nome: temaMap.get(id) || 'Desconhecido',
        total: stats.total,
        acertos: stats.acertos,
        percentual: stats.total > 0 ? Number(((stats.acertos / stats.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.tema_nome.localeCompare(b.tema_nome));

    const difLabels: Record<string, string> = {
      extremo: 'Nível Extremo',
      dificil: 'Nível Difícil',
      medio: 'Nível Médio',
    };

    const difArray: EstatisticaDificuldade[] = ['extremo', 'dificil', 'medio']
      .map(key => {
        const s = diffStats.get(key) || { total: 0, acertos: 0 };
        return {
          dificuldade: key as any,
          label: difLabels[key],
          total: s.total,
          acertos: s.acertos,
          percentual: s.total > 0 ? Number(((s.acertos / s.total) * 100).toFixed(1)) : 0,
        };
      })
      .filter(d => d.total > 0);

    const tipoLabels: Record<string, string> = {
      certo_errado: 'Certo / Errado (Cebraspe)',
      multipla_escolha: 'Múltipla Escolha (A a E)',
    };

    const tipoArray: EstatisticaTipo[] = ['certo_errado', 'multipla_escolha']
      .map(key => {
        const s = tipoStats.get(key) || { total: 0, acertos: 0 };
        return {
          tipo: key as any,
          label: tipoLabels[key],
          total: s.total,
          acertos: s.acertos,
          percentual: s.total > 0 ? Number(((s.acertos / s.total) * 100).toFixed(1)) : 0,
        };
      })
      .filter(t => t.total > 0);

    setStatsDisciplina(discArray);
    setStatsTema(temaArray);
    setStatsDificuldade(difArray);
    setStatsTipo(tipoArray);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();

    // Inscrição em tempo real para atualizações nas respostas do usuário
    const channel = supabase
      .channel('realtime-estatisticas')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'respostas_usuario'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  const percentualGeral = totalQuestoes > 0
    ? Number(((totalAcertos / totalQuestoes) * 100).toFixed(1))
    : 0;

  return {
    statsDisciplina,
    statsTema,
    statsDificuldade,
    statsTipo,
    totalQuestoes,
    totalAcertos,
    percentualGeral,
    loading,
    refetch: fetchStats,
  };
}
