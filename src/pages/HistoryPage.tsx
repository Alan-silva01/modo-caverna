import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { History, Eye, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface HistoricoItem {
  id: string;
  created_at: string;
  disciplina_nome: string;
  tema_nome: string;
  tipo: string;
  total: number;
  acertos: number;
  questao_ids: string[];
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorico = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get all questions with their respostas, grouped by session (created_at batch)
      const { data: questoes } = await supabase
        .from('questoes')
        .select(`
          id, created_at, tipo,
          disciplinas ( nome ),
          temas ( nome )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!questoes || questoes.length === 0) {
        setLoading(false);
        return;
      }

      // Get all respostas
      const questaoIds = questoes.map(q => q.id);
      const { data: respostas } = await supabase
        .from('respostas_usuario')
        .select('questao_id, acertou')
        .in('questao_id', questaoIds);

      const respostaMap = new Map<string, boolean>();
      (respostas || []).forEach(r => respostaMap.set(r.questao_id, r.acertou));

      // Group questions by batch (same created_at minute + disciplina + tema)
      const groups = new Map<string, HistoricoItem>();

      for (const q of questoes) {
        const disc = (q.disciplinas as unknown as { nome: string })?.nome || 'Desconhecida';
        const tema = (q.temas as unknown as { nome: string })?.nome || 'Desconhecido';
        const date = new Date(q.created_at);
        // Group by minute + disciplina + tema
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${disc}-${tema}`;

        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            created_at: q.created_at,
            disciplina_nome: disc,
            tema_nome: tema,
            tipo: q.tipo,
            total: 0,
            acertos: 0,
            questao_ids: [],
          });
        }

        const group = groups.get(key)!;
        group.total++;
        group.questao_ids.push(q.id);
        if (respostaMap.has(q.id) && respostaMap.get(q.id)) {
          group.acertos++;
        }
      }

      setHistorico(Array.from(groups.values()));
      setLoading(false);
    };

    fetchHistorico();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="loading-spinner" />
        <p className="loading-text">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Histórico</h1>
        <p className="page-subtitle">Suas sessões de estudo anteriores</p>
      </div>

      {historico.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <History size={32} />
          </div>
          <h3 className="empty-state-title">Nenhuma sessão registrada</h3>
          <p className="empty-state-text">
            Quando você gerar e responder questões, elas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {historico.map(item => {
            const erros = item.total - item.acertos;
            const percentual = item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0;

            return (
              <div key={item.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/resolver?ids=${item.questao_ids.join(',')}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                      <span className="badge badge-primary">
                        {item.tipo === 'certo_errado' ? 'C/E' : 'ME'}
                      </span>
                      <span style={{ fontWeight: 600 }}>{item.disciplina_nome}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted text-sm">{item.tema_nome}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                      <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} />
                        {formatDate(item.created_at)}
                      </span>
                      <span className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-success)' }}>
                        <CheckCircle size={12} />
                        {item.acertos}
                      </span>
                      <span className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-error)' }}>
                        <XCircle size={12} />
                        {erros}
                      </span>
                      <span className={`text-xs font-bold ${percentual >= 70 ? 'text-success' : percentual >= 40 ? 'text-warning' : 'text-error'}`}>
                        {percentual}%
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon">
                    <Eye size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
