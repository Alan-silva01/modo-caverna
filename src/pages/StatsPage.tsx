import { useEstatisticas } from '../hooks/useEstatisticas';
import { BarChart3 } from 'lucide-react';

// ── Skeleton: stat cards ──
function StatCardsSkeleton() {
  return (
    <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card">
          <div className="skeleton skeleton-text sm" style={{ width: '60%', marginBottom: 8 }} />
          <div className="skeleton skeleton-text lg" style={{ width: '50%', marginBottom: 6 }} />
          <div className="skeleton skeleton-text sm" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

// ── Skeleton: progress bar rows ──
function BarChartSkeleton({ rows = 6, title }: { rows?: number; title: string }) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
      <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>{title}</div>
      <div className="stats-bar-chart">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-bar-row">
            <div className="skeleton skeleton-bar-label" style={{ width: `${100 + (i % 4) * 35}px` }} />
            <div className="skeleton skeleton-bar-track" />
            <div className="skeleton skeleton-bar-count" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const {
    statsDisciplina,
    statsTema,
    statsDificuldade,
    statsTipo,
    totalQuestoes,
    totalAcertos,
    percentualGeral,
    loading,
  } = useEstatisticas();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Estatísticas</h1>
        <p className="page-subtitle">Desempenho Detalhado</p>
      </div>

      {/* Overview Cards */}
      {loading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card">
            <div className="card-title">Total Respondidas</div>
            <div className="card-value">{totalQuestoes}</div>
            <div className="card-label">Assertivas julgadas</div>
          </div>

          <div className="card">
            <div className="card-title">Aproveitamento</div>
            <div className="card-value">{percentualGeral}%</div>
            <div className="card-label">Aproveitamento médio</div>
          </div>

          <div className="card">
            <div className="card-title">Acertos</div>
            <div className="card-value text-success">{totalAcertos}</div>
            <div className="card-label">Respostas corretas</div>
          </div>

          <div className="card">
            <div className="card-title">Erros</div>
            <div className="card-value text-error">{totalQuestoes - totalAcertos}</div>
            <div className="card-label">Respostas incorretas</div>
          </div>
        </div>
      )}

      {/* By Nível de Dificuldade */}
      {loading ? (
        <BarChartSkeleton rows={3} title="Desempenho por Nível de Dificuldade" />
      ) : statsDificuldade.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            Desempenho por Nível de Dificuldade
          </div>
          <div className="stats-bar-chart">
            {statsDificuldade.map(stat => (
              <div key={stat.dificuldade} className="stats-bar-row">
                <span className="stats-bar-label">{stat.label}</span>
                <div className="stats-bar-track">
                  <div
                    className={`stats-bar-fill ${
                      stat.percentual >= 80 ? 'high' :
                      stat.percentual >= 60 ? 'medium' : 'low'
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

      {/* By Formato de Questão */}
      {loading ? (
        <BarChartSkeleton rows={2} title="Desempenho por Formato de Questão" />
      ) : statsTipo.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            Desempenho por Formato de Questão
          </div>
          <div className="stats-bar-chart">
            {statsTipo.map(stat => (
              <div key={stat.tipo} className="stats-bar-row">
                <span className="stats-bar-label">{stat.label}</span>
                <div className="stats-bar-track">
                  <div
                    className={`stats-bar-fill ${
                      stat.percentual >= 80 ? 'high' :
                      stat.percentual >= 60 ? 'medium' : 'low'
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

      {/* By Disciplina */}
      {loading ? (
        <BarChartSkeleton rows={6} title="Desempenho por Disciplina" />
      ) : statsDisciplina.length > 0 && (
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
                      stat.percentual >= 80 ? 'high' :
                      stat.percentual >= 60 ? 'medium' : 'low'
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
      {loading ? (
        <BarChartSkeleton rows={8} title="Desempenho por Tema" />
      ) : statsTema.length > 0 && (
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
                      stat.percentual >= 80 ? 'high' :
                      stat.percentual >= 60 ? 'medium' : 'low'
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

      {totalQuestoes === 0 && !loading && (
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
