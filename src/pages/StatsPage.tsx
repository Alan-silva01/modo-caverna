import { useEstatisticas } from '../hooks/useEstatisticas';
import { BarChart3 } from 'lucide-react';

export default function StatsPage() {
  const {
    statsDisciplina,
    statsTema,
    totalQuestoes,
    totalAcertos,
    percentualGeral,
    loading,
  } = useEstatisticas();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="loading-spinner" />
        <p className="loading-text">Carregando estatísticas...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Estatísticas</h1>
        <p className="page-subtitle">Desempenho Detalhado</p>
      </div>

      {/* Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card">
          <div className="card-title">Total Respondidas</div>
          <div className="card-value">{totalQuestoes}</div>
          <div className="card-label">Assertivas julgadas</div>
        </div>

        <div className="card">
          <div className="card-title">Acertos</div>
          <div className="card-value text-success">{totalAcertos}</div>
          <div className="card-label">Respostas corretas</div>
        </div>

        <div className="card">
          <div className="card-title">Aproveitamento</div>
          <div className="card-value">{percentualGeral}%</div>
          <div className="card-label">Aproveitamento médio</div>
        </div>
      </div>

      {/* By Disciplina */}
      {statsDisciplina.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            Desempenho por Disciplina
          </div>
          <div className="stats-bar-chart">
            {statsDisciplina.map(stat => (
              <div key={stat.disciplina_id} className="stats-bar-row">
                <span className="stats-bar-label">{stat.disciplina_nome}</span>
                <div className="stats-bar-track">
                  <div
                    className={`stats-bar-fill ${
                      stat.percentual >= 70 ? 'high' :
                      stat.percentual >= 40 ? 'medium' : 'low'
                    }`}
                    style={{ width: `${Math.max(stat.percentual, 8)}%` }}
                  >
                    <span className="stats-bar-value">{stat.percentual}%</span>
                  </div>
                </div>
                <span className="stats-bar-count">{stat.acertos}/{stat.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Tema */}
      {statsTema.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            Desempenho por Tema
          </div>
          <div className="stats-bar-chart">
            {statsTema.map(stat => (
              <div key={stat.tema_id} className="stats-bar-row">
                <span className="stats-bar-label">{stat.tema_nome}</span>
                <div className="stats-bar-track">
                  <div
                    className={`stats-bar-fill ${
                      stat.percentual >= 70 ? 'high' :
                      stat.percentual >= 40 ? 'medium' : 'low'
                    }`}
                    style={{ width: `${Math.max(stat.percentual, 8)}%` }}
                  >
                    <span className="stats-bar-value">{stat.percentual}%</span>
                  </div>
                </div>
                <span className="stats-bar-count">{stat.acertos}/{stat.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalQuestoes === 0 && (
        <div className="empty-state" style={{ marginTop: 'var(--space-md)' }}>
          <div className="empty-state-icon">
            <BarChart3 size={24} strokeWidth={1.5} />
          </div>
          <h3 className="empty-state-title">Sem estatísticas disponíveis</h3>
          <p className="empty-state-text">
            Suas métricas de acertos por disciplina e tema serão exibidas aqui assim que concluir treinos.
          </p>
        </div>
      )}
    </div>
  );
}
