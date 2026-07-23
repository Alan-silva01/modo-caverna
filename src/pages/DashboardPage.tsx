import { useNavigate } from 'react-router-dom';
import { useEstatisticas } from '../hooks/useEstatisticas';
import { useEditais, calcDaysLeft } from '../hooks/useEditais';
import { useConcurso } from '../contexts/ConcursoContext';
import { PlusCircle, Target, Zap, Check, Shield } from 'lucide-react';

const brasaoMap: Record<string, string> = {
  PMMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784558946/1_mbyxqy.png',
  CBMMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784558946/2_yx2mov.png',
  PCMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784558946/3_wdnui1.png',
  POCMA: 'https://res.cloudinary.com/ddhlqymvf/image/upload/v1784559889/pericia_oficial_htcpha.png'
};

const FRASES_MOTIVACIONAIS = [
  'Sua mente deve estar alinhada com seu propósito.',
  'Não pare até pertencer.',
  'Seja policial — disciplina não se negocia.',
  'Estudo não é sobre talento, é sobre repetição. Faça até aprender.',
  'Quem vive de desculpas já fez um acordo com a derrota.',
  'É você contra você mesmo, sempre foi.',
  'Todos os dias, faça um pouco mais do que você acha que consegue.',
  'A aprovação não espera. Você vai esperar por ela?',
  'O concorrente que vai te eliminar está estudando agora.',
  'Gabarito não mente. A preparação revela o que você é.',
  'Fardamento não se conquista com desejo, se conquista com suor.',
  'Cada questão errada é uma lição que a banca te deu de graça.',
  'Sonhar com a posse é fácil. Merecer a vaga é o desafio.',
  'Um dia a mais de estudo é uma questão a menos de erro na prova.',
  'A dor do treino é temporária. A glória da aprovação é permanente.',
  'Ninguém acorda um dia pronto. Você se constrói todos os dias.',
  'Foco, fé e frieza — o tripé de quem é aprovado.',
  'O candidato mediano estuda quando tem vontade. O aprovado estuda sempre.',
  'Sua história começa no momento em que você decide não desistir.',
  'Leitura, revisão, simulado — repita até o dia da prova.',
];

function getHourlyPhrase(): string {
  const hourIndex = Math.floor(Date.now() / 3_600_000);
  return FRASES_MOTIVACIONAIS[hourIndex % FRASES_MOTIVACIONAIS.length];
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Skeleton: concurso cards ──
function ConcursoSkeleton() {
  return (
    <div className="concurso-grid">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-concurso-card">
          <div className="skeleton skeleton-img" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <div className="skeleton skeleton-text lg" style={{ width: '60%' }} />
            <div className="skeleton skeleton-text sm" style={{ width: '80%' }} />
          </div>
          <div className="skeleton skeleton-text" style={{ width: '40%', marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

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
function BarChartSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="skeleton skeleton-text" style={{ width: 180, marginBottom: 'var(--space-md)' }} />
      <div className="stats-bar-chart">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-bar-row">
            <div className="skeleton skeleton-bar-label" style={{ width: `${120 + (i % 3) * 40}px` }} />
            <div className="skeleton skeleton-bar-track" />
            <div className="skeleton skeleton-bar-count" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { totalQuestoes, totalAcertos, percentualGeral, statsDisciplina, loading } = useEstatisticas();
  const { editais, loading: loadingEditais } = useEditais();
  const { concursoAlvo, setConcursoAlvo } = useConcurso();

  const totalErros = totalQuestoes - totalAcertos;
  const fraseHora = getHourlyPhrase();

  const handleSelectConcurso = (edital: any) => {
    setConcursoAlvo(edital);
    setTimeout(() => {
      navigate('/gerar');
    }, 250);
  };

  return (
    <div className="page-container">
      {/* ── Header com frase no desktop ── */}
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">Modo Caverna</h1>
          <p className="page-subtitle">Painel de Operações</p>
        </div>
        {/* Desktop: frase estática à direita */}
        <p className="motivational-desktop-phrase">{fraseHora}</p>
      </div>

      {/* Mobile only: ticker scrollando */}
      <div className="motivational-ticker-wrap motivational-mobile-only">
        <div className="motivational-ticker-track">
          <span className="motivational-ticker-text">{fraseHora}</span>
          <span className="motivational-ticker-sep">◆</span>
          <span className="motivational-ticker-text">{fraseHora}</span>
          <span className="motivational-ticker-sep">◆</span>
          <span className="motivational-ticker-text" aria-hidden="true">{fraseHora}</span>
          <span className="motivational-ticker-sep" aria-hidden="true">◆</span>
          <span className="motivational-ticker-text" aria-hidden="true">{fraseHora}</span>
          <span className="motivational-ticker-sep" aria-hidden="true">◆</span>
        </div>
      </div>

      {/* ── Editais ── */}
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
          <ConcursoSkeleton />
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

                  {edital.image_url ? (
                    <img
                      src={edital.image_url}
                      alt={edital.nome}
                      className="concurso-card-img"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="concurso-card-img-placeholder">
                      <Shield size={20} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  )}

                  <div className="concurso-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      {brasaoMap[edital.sigla] && (
                        <img
                          src={brasaoMap[edital.sigla]}
                          alt=""
                          style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                          loading="lazy"
                          decoding="async"
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
      {loading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
          {[
            { label: 'Respondidas', value: totalQuestoes, sub: 'Total de assertivas' },
            { label: 'Acertos',     value: totalAcertos,   sub: 'Corretas',           cls: 'text-success' },
            { label: 'Erros',       value: totalErros,      sub: 'Incorretas',         cls: 'text-error' },
            { label: 'Aproveit.',   value: `${percentualGeral.toFixed(1)}%`, sub: 'Taxa geral' },
          ].map(s => (
            <div className="card" key={s.label}>
              <div className="card-title">{s.label}</div>
              <div className={`card-value${s.cls ? ' ' + s.cls : ''}`}>
                {s.value}
              </div>
              <div className="card-label">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Desempenho por Disciplina ── */}
      {loading ? (
        <BarChartSkeleton rows={5} />
      ) : statsDisciplina.length > 0 && (
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
                      stat.percentual >= 80 ? 'high' :
                      stat.percentual >= 60 ? 'medium' : 'low'
                    }`}
                    style={{ width: `${Math.max(stat.percentual, 8)}%` }}
                  >
                    <span className="stats-bar-value">{stat.percentual.toFixed(1)}%</span>
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
