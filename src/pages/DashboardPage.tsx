import { useNavigate } from 'react-router-dom';
import { useEstatisticas } from '../hooks/useEstatisticas';
import { useEditais, calcDaysLeft } from '../hooks/useEditais';
import { useConcurso } from '../contexts/ConcursoContext';
import { PlusCircle, Target, Zap, Check } from 'lucide-react';

const brasaoMap: Record<string, string> = {
  PMMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784558946/1_mbyxqy.png',
  CBMMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784558946/2_yx2mov.png',
  PCMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784558946/3_wdnui1.png',
  POCMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784559889/pericia_oficial_htcpha.png'
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { totalQuestoes, totalAcertos, percentualGeral, statsDisciplina, loading } = useEstatisticas();
  const { editais, loading: loadingEditais } = useEditais();
  const { concursoAlvo, setConcursoAlvo } = useConcurso();

  const totalErros = totalQuestoes - totalAcertos;

  const handleSelectConcurso = (edital: any) => {
    setConcursoAlvo(edital);
    setTimeout(() => {
      navigate('/gerar');
    }, 250);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Modo Caverna</h1>
        <p className="page-subtitle">Painel de Operações</p>
      </div>

      {/* ── Concursos Abertos ── */}
      <section style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-md)',
        }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Editais Abertos</div>
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: 2 }}>
              Clique para selecionar seu concurso alvo
            </p>
          </div>
          {concursoAlvo && (
            <span style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--brand)',
              border: '1px solid var(--brand)',
              padding: '2px 8px',
              textTransform: 'uppercase',
            }}>
              ALVO: {concursoAlvo.sigla}
            </span>
          )}
        </div>

        {loadingEditais ? (
          <div className="loading-container" style={{ minHeight: 120 }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="concurso-grid">
            {editais.map(edital => {
              const days = calcDaysLeft(edital.data_prova);
              const isSelected = concursoAlvo?.id === edital.id;

              return (
                <div
                  key={edital.id}
                  className={`concurso-card${isSelected ? ' selected' : ''}`}
                  onClick={() => handleSelectConcurso(edital)}
                >
                  {isSelected && (
                    <div className="concurso-selected-badge">
                      <Check size={8} style={{ display: 'inline', marginRight: 2 }} />
                      SELECIONADO
                    </div>
                  )}

                  {/* Edital image or placeholder */}
                  {edital.image_url ? (
                    <img
                      src={edital.image_url}
                      alt={edital.nome}
                      className="concurso-card-img"
                    />
                  ) : (
                    <div className="concurso-card-img-placeholder">
                      {edital.tipo === 'militar' ? '🪖' : edital.tipo === 'civil' ? '🔵' : '🏛️'}
                    </div>
                  )}

                  <div className="concurso-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      {brasaoMap[edital.sigla] && (
                        <img
                          src={brasaoMap[edital.sigla]}
                          alt=""
                          style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                        />
                      )}
                      <div className="concurso-card-sigla">{edital.sigla}</div>
                    </div>
                    <div className="concurso-card-nome">{edital.nome}</div>
                    <div className="concurso-card-tipo">
                      <span>{edital.tipo === 'militar' ? 'MILITAR' : edital.tipo === 'civil' ? 'CIVIL' : 'FEDERAL'}</span>
                    </div>

                    <div className="concurso-countdown">
                      <div className="concurso-countdown-days">
                        {days > 0 ? days : 0}
                      </div>
                      <div className="concurso-countdown-label">
                        {days === 1 ? 'dia' : 'dias'}
                      </div>
                      <div className="concurso-countdown-date">
                        {formatDate(edital.data_prova)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Quick Action ── */}
      <div
        className="card card-clickable"
        onClick={() => navigate('/gerar')}
        style={{ marginBottom: 'var(--space-md)', borderColor: 'var(--brand)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <Zap size={18} strokeWidth={1.5} style={{ color: 'var(--brand)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--foreground)' }}>
              Gerar Questões
            </h3>
            <p className="text-muted text-xs" style={{ marginTop: '2px' }}>
              IA estilo CESPE/Cebraspe · escolha disciplina, tema e tipo
            </p>
          </div>
          <PlusCircle size={15} style={{ color: 'var(--brand)', flexShrink: 0 }} />
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        {[
          { label: 'Respondidas', value: totalQuestoes, sub: 'Total de assertivas' },
          { label: 'Acertos',     value: totalAcertos,   sub: 'Corretas',           cls: 'text-success' },
          { label: 'Erros',       value: totalErros,      sub: 'Incorretas',         cls: 'text-error' },
          { label: 'Aproveit.',   value: `${percentualGeral}%`, sub: 'Taxa geral' },
        ].map(s => (
          <div className="card" key={s.label}>
            <div className="card-title">{s.label}</div>
            <div className={`card-value${s.cls ? ' ' + s.cls : ''}`}>
              {loading ? '—' : s.value}
            </div>
            <div className="card-label">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Desempenho por Disciplina ── */}
      {statsDisciplina.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            Aproveitamento por Disciplina
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

      {/* ── Empty State ── */}
      {totalQuestoes === 0 && !loading && (
        <div className="empty-state" style={{ marginTop: 'var(--space-md)' }}>
          <div className="empty-state-icon">
            <Target size={24} strokeWidth={1.5} />
          </div>
          <h3 className="empty-state-title">Sem histórico de treinos</h3>
          <p className="empty-state-text">
            Gere questões para iniciar e acompanhar seu desempenho aqui.
          </p>
          <button
            className="btn btn-primary mt-md"
            onClick={() => navigate('/gerar')}
          >
            <PlusCircle size={12} />
            Começar
          </button>
        </div>
      )}
    </div>
  );
}
