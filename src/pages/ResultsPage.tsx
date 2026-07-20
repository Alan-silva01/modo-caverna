import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Questao } from '../types';
import {
  PlusCircle,
  LayoutDashboard,
  CheckCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const total = parseInt(searchParams.get('total') || '0', 10);
  const acertos = parseInt(searchParams.get('acertos') || '0', 10);
  const erros = total - acertos;
  const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;

  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [respostas, setRespostas] = useState<Map<string, { resposta_dada: string; acertou: boolean }>>(new Map());

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (!ids) return;

    const loadData = async () => {
      const idList = ids.split(',');

      const { data: qData } = await supabase
        .from('questoes')
        .select('*')
        .in('id', idList);

      if (qData) {
        const sorted = idList
          .map(id => qData.find(q => q.id === id))
          .filter(Boolean) as Questao[];
        setQuestoes(sorted);
      }

      // Load respostas
      const { data: rData } = await supabase
        .from('respostas_usuario')
        .select('questao_id, resposta_dada, acertou')
        .in('questao_id', idList);

      if (rData) {
        const map = new Map<string, { resposta_dada: string; acertou: boolean }>();
        rData.forEach(r => map.set(r.questao_id, { resposta_dada: r.resposta_dada, acertou: r.acertou }));
        setRespostas(map);
      }
    };

    loadData();
  }, [searchParams]);

  const getPercentualClass = () => {
    if (percentual >= 80) return 'high';
    if (percentual >= 60) return 'medium';
    return 'low';
  };

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="results-hero">
        <div className={`results-percentage ${getPercentualClass()}`}>
          {percentual}%
        </div>
        <p className="results-summary">
          {percentual >= 70
            ? 'Aproveitamento Excelente'
            : percentual >= 50
            ? 'Aproveitamento Regular'
            : 'Aproveitamento Insuficiente'}
        </p>

        <div className="results-details">
          <div className="results-detail-item">
            <div className="results-detail-value correct">{acertos}</div>
            <div className="results-detail-label">Acertos</div>
          </div>
          <div className="results-detail-item">
            <div className="results-detail-value incorrect">{erros}</div>
            <div className="results-detail-label">Erros</div>
          </div>
          <div className="results-detail-item">
            <div className="results-detail-value" style={{ color: 'var(--foreground)' }}>
              {total}
            </div>
            <div className="results-detail-label">Total</div>
          </div>
        </div>
      </div>

      {/* Question List */}
      {questoes.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="card-title">Revisão das Assertivas</div>
          <div className="results-questions">
            {questoes.map((q, idx) => {
              const resp = respostas.get(q.id);
              const acertou = resp?.acertou ?? false;

              return (
                <div key={q.id} className="results-question-item">
                  <div className={`results-question-status ${acertou ? 'correct' : 'incorrect'}`}>
                    {acertou ? <CheckCircle size={16} strokeWidth={1.5} /> : <XCircle size={16} strokeWidth={1.5} />}
                  </div>
                  <div className="results-question-text">
                    <span style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Assertiva {idx + 1}
                    </span>
                    <p style={{ marginTop: '2px', fontSize: '13px', lineHeight: '1.6' }}>{q.enunciado}</p>
                    {!acertou && (
                      <div style={{
                        marginTop: 'var(--space-sm)',
                        padding: 'var(--space-sm)',
                        background: 'var(--background)',
                        borderLeft: '2px solid var(--error)',
                        fontSize: '11px',
                        color: 'var(--muted-foreground)'
                      }}>
                        <strong>Gabarito:</strong>{' '}
                        {q.tipo === 'certo_errado'
                          ? (q.gabarito === 'C' ? 'CERTO' : 'ERRADO')
                          : `Alternativa ${q.gabarito}`}
                        {' · '}
                        {q.justificativa}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="results-actions">
        <button
          className="btn btn-primary"
          onClick={() => navigate('/gerar')}
        >
          <PlusCircle size={14} />
          Gerar Novo Treino
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/')}
        >
          <LayoutDashboard size={14} />
          Painel Principal
        </button>
        {erros > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              const erradas = questoes
                .filter(q => {
                  const r = respostas.get(q.id);
                  return r && !r.acertou;
                })
                .map(q => q.id)
                .join(',');
              navigate(`/resolver?ids=${erradas}`);
            }}
          >
            <RotateCcw size={14} />
            Refazer Erradas
          </button>
        )}
      </div>
    </div>
  );
}
