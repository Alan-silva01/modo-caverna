import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { simuladoPmmaHtml, simuladoPmmaGabaritoHtml } from '../data/simuladoPmmaBody';
import { simuladoPmmaCss } from '../data/simuladoPmmaCss';
import gabaritoDataRaw from '../data/gabaritoPMMA.json';
import {
  Clock,
  Send,
  RotateCcw,
  AlertTriangle,
  Award,
  Printer,
  ShieldCheck,
  ListOrdered
} from 'lucide-react';

const TOTAL_TIME_SECONDS = 3.5 * 60 * 60; // 3 hours 30 minutes = 12600 seconds
const GABARITO_MAP: Record<number, 'C' | 'E'> = gabaritoDataRaw as Record<number, 'C' | 'E'>;

const STORAGE_KEY_ANSWERS = 'simulado_pmma_answers_v1';
const STORAGE_KEY_START_TIME = 'simulado_pmma_start_time_v1';
const STORAGE_KEY_STATUS = 'simulado_pmma_status_v1';
const STORAGE_KEY_RESULTS = 'simulado_pmma_results_v1';

export default function SimuladoPmmaPage() {
  const { user } = useAuth();

  // Answers map: { [questionNum]: 'C' | 'E' }
  const [answers, setAnswers] = useState<Record<number, 'C' | 'E'>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ANSWERS);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Start time in unix ms
  const [startTime, setStartTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_START_TIME);
      if (saved) return parseInt(saved, 10);
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY_START_TIME, String(now));
      return now;
    } catch {
      return Date.now();
    }
  });

  // Time left in seconds
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return Math.max(0, TOTAL_TIME_SECONDS - elapsed);
  });

  // Status: 'in_progress' | 'submitted'
  const [status, setStatus] = useState<'in_progress' | 'submitted'>(() => {
    return (localStorage.getItem(STORAGE_KEY_STATUS) as any) || 'in_progress';
  });

  // Submitted results
  const [results, setResults] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESULTS);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCartaoModal, setShowCartaoModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync answers to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(answers));
  }, [answers]);

  // Sync status to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STATUS, status);
  }, [status]);

  // Compute stats
  const stats = useMemo(() => {
    let acertos = 0;
    let erros = 0;
    let emBranco = 0;

    let acertosGerais = 0;
    let errosGerais = 0;
    let acertosEsp = 0;
    let errosEsp = 0;

    for (let i = 1; i <= 120; i++) {
      const resp = answers[i];
      const gab = GABARITO_MAP[i];

      if (!resp) {
        emBranco++;
      } else if (resp === gab) {
        acertos++;
        if (i <= 50) acertosGerais++;
        else acertosEsp++;
      } else {
        erros++;
        if (i <= 50) errosGerais++;
        else errosEsp++;
      }
    }

    const respondidas = acertos + erros;
    // Padrão Cebraspe Real: Uma errada anula uma certa (permite pontuação líquida negativa!)
    const notaLiquida = acertos - erros;
    const notaLiquidaGerais = acertosGerais - errosGerais;
    const notaLiquidaEsp = acertosEsp - errosEsp;
    const percentualAcertos = respondidas > 0 ? Number(((acertos / respondidas) * 100).toFixed(1)) : 0;
    const aproveitamentoTotal = Number(((notaLiquida / 120) * 100).toFixed(1));

    return {
      acertos,
      erros,
      emBranco,
      respondidas,
      notaLiquida,
      notaLiquidaGerais,
      notaLiquidaEsp,
      percentualAcertos,
      aproveitamentoTotal,
    };
  }, [answers]);

  // Finalizar e entregar a prova
  const handleFinalizarSimulado = useCallback(async (isAuto = false) => {
    setShowConfirmModal(false);
    setIsSaving(true);

    const tempoGastoSegundos = TOTAL_TIME_SECONDS - timeLeft;

    const calculatedResults = {
      ...stats,
      tempoGastoSegundos,
      finalizadoEm: new Date().toISOString(),
      isAutoSubmission: isAuto,
    };

    setResults(calculatedResults);
    localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(calculatedResults));
    setStatus('submitted');

    // Grava tentativa no histórico local persistente
    try {
      const historicoGeral = JSON.parse(localStorage.getItem('simulados_pmma_history') || '[]');
      historicoGeral.unshift({
        id: 'pmma_' + Date.now(),
        user_id: user?.id || null,
        ...calculatedResults,
        answersCount: Object.keys(answers).length
      });
      localStorage.setItem('simulados_pmma_history', JSON.stringify(historicoGeral.slice(0, 30)));
    } catch (err: any) {
      console.warn('Erro ao salvar histórico do simulado:', err);
    } finally {
      setIsSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [timeLeft, stats, user, answers]);

  // Timer countdown
  useEffect(() => {
    if (status === 'submitted') return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, TOTAL_TIME_SECONDS - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        handleFinalizarSimulado(true); // Auto submit when time runs out
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, status, handleFinalizarSimulado]);

  // Gera regras CSS dinâmicas baseadas no estado de respostas e submissão.
  // Isso garante 100% de estabilidade: o navegador renderiza as bolinhas marcadas
  // instantaneamente sem depender de mutações manuais de DOM ou re-renderizações frágeis.
  const dynamicBubbleStyles = useMemo(() => {
    const rules: string[] = [];

    if (status === 'in_progress') {
      Object.entries(answers).forEach(([itemNum, val]) => {
        if (val === 'C' || val === 'E') {
          const lower = val.toLowerCase();
          rules.push(
            `#item-block-${itemNum} button.bubble-${lower} {
              background: #000000 !important;
              color: #ffffff !important;
              border-color: #000000 !important;
              font-weight: 900 !important;
              box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45) !important;
            }`
          );
        }
      });
    } else {
      // Prova submetida: destacar acertos, erros e gabarito oficial
      for (let i = 1; i <= 120; i++) {
        const userVal = answers[i];
        const correctVal = GABARITO_MAP[i];

        if (userVal) {
          const lowerUser = userVal.toLowerCase();
          const isCorrect = userVal === correctVal;
          const bg = isCorrect ? '#3A6B2A' : '#840308';
          rules.push(
            `#item-block-${i} button.bubble-${lowerUser} {
              background: ${bg} !important;
              color: #ffffff !important;
              border-color: ${bg} !important;
              font-weight: 900 !important;
              box-shadow: 0 0 0 2px ${bg}66 !important;
            }`
          );
        }

        // Se o usuário errou ou deixou em branco, destaca a alternativa correta
        if (correctVal && userVal !== correctVal) {
          const lowerCorrect = correctVal.toLowerCase();
          rules.push(
            `#item-block-${i} button.bubble-${lowerCorrect} {
              border: 2px solid #3A6B2A !important;
              background: #eaf3e6 !important;
              color: #2b521e !important;
              font-weight: 900 !important;
            }`
          );
        }
      }
    }

    return rules.join('\n');
  }, [answers, status]);


  // Handle bubble clicks directly via event delegation on container
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest('button.bubble');
      if (!target) return;

      const itemNumStr = target.getAttribute('data-item');
      const val = target.getAttribute('data-val') as 'C' | 'E';
      if (!itemNumStr || !val) return;

      const itemNum = parseInt(itemNumStr, 10);

      // Se já estava submetido e o usuário clica para refazer ou marcar, desbloqueia e volta para in_progress
      if (status === 'submitted') {
        setStatus('in_progress');
        setResults(null);
        localStorage.setItem(STORAGE_KEY_STATUS, 'in_progress');
        localStorage.removeItem(STORAGE_KEY_RESULTS);
      }

      setAnswers(prev => {
        const next = { ...prev };
        if (next[itemNum] === val) {
          delete next[itemNum]; // desmarcar ao clicar novamente
        } else {
          next[itemNum] = val;
        }
        return next;
      });
    },
    [status]
  );

  // Format seconds to HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Reiniciar simulado
  const handleReiniciarSimulado = () => {
    if (window.confirm('Tem certeza que deseja reiniciar o Simulado PMMA? Todo o progresso atual e respostas marcadas serão zerados para uma nova tentativa de 3h30.')) {
      localStorage.removeItem(STORAGE_KEY_ANSWERS);
      localStorage.removeItem(STORAGE_KEY_START_TIME);
      localStorage.removeItem(STORAGE_KEY_STATUS);
      localStorage.removeItem(STORAGE_KEY_RESULTS);
      setAnswers({});
      const now = Date.now();
      setStartTime(now);
      setTimeLeft(TOTAL_TIME_SECONDS);
      setStatus('in_progress');
      setResults(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Rolar até questão específica
  const scrollToQuestion = (num: number) => {
    setShowCartaoModal(false);
    const el = document.getElementById(`item-block-${num}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 1800);
    }
  };

  return (
    <div className="simulado-pmma-root">
      {/* Injeta os estilos originais da prova do Cebraspe */}
      <style>{simuladoPmmaCss}</style>
      {/* Regras CSS dinâmicas de preenchimento das bolinhas - 100% à prova de falhas */}
      <style>{dynamicBubbleStyles}</style>
      <style>{`
        .simulado-pmma-root {
          background-color: var(--background);
          min-height: 100vh;
          padding-bottom: 80px;
          color: var(--foreground);
          overflow-x: hidden;
          font-family: 'Inter', sans-serif;
        }

        /* Garantir que as folhas A4 fiquem contidas perfeitamente sem quebrar o layout */
        .page-sheet, .gabarito-oficial-page {
          max-width: 100% !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          color: #000000 !important;
          border: 1px solid var(--border);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12) !important;
        }

        .highlight-pulse {
          animation: itemPulse 1.8s ease;
        }

        @keyframes itemPulse {
          0% { background: var(--brand-glow); outline: 2px solid var(--brand); }
          100% { background: transparent; outline: none; }
        }

        .sticky-simulado-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          background-color: var(--card);
          color: var(--card-foreground);
          border-bottom: 1px solid var(--border);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 8px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Rajdhani', sans-serif;
        }

        .timer-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: var(--secondary);
          color: var(--foreground);
          border: 1px solid var(--border);
          padding: 6px 14px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-family: 'Rajdhani', sans-serif;
        }

        .timer-badge.warning {
          background-color: var(--error);
          color: var(--error-foreground);
          border-color: var(--error);
          animation: timerPulse 1s infinite;
        }

        @keyframes timerPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        .btn-entregar {
          background-color: var(--brand);
          color: var(--brand-foreground);
          border: 1px solid var(--brand);
          padding: 8px 18px;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 150ms ease;
        }

        .btn-entregar:hover {
          background-color: var(--brand-hover);
        }

        .btn-cartao {
          background-color: var(--secondary);
          color: var(--foreground);
          border: 1px solid var(--border);
          padding: 8px 14px;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 150ms ease;
        }

        .btn-cartao:hover {
          border-color: var(--brand);
          color: var(--brand);
        }

        /* Bolinhas C / E com feedback tátil e visual imediato */
        .bubble {
          transition: transform 120ms ease, box-shadow 120ms ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          outline: none !important;
          border: 1.5px solid #000;
          background: #ffffff;
          color: #000000;
          cursor: pointer;
        }

        .bubble:hover {
          transform: scale(1.18);
          border-color: #000000;
        }

        .bubble.selected-c,
        .bubble.selected-e {
          background: #000000 !important;
          color: #ffffff !important;
          border-color: #000000 !important;
          font-weight: 900 !important;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45) !important;
        }

        .bubble.bubble-correct {
          background: #3A6B2A !important;
          color: #ffffff !important;
          border-color: #3A6B2A !important;
          font-weight: 900 !important;
        }

        .bubble.bubble-wrong {
          background: #840308 !important;
          color: #ffffff !important;
          border-color: #840308 !important;
          font-weight: 900 !important;
        }

        .bubble.bubble-should-be {
          border: 2px solid #3A6B2A !important;
          background: #eaf3e6 !important;
          color: #2b521e !important;
          font-weight: 900 !important;
        }

        /* Hero de Resultados estilizado no Modo Caverna */
        .results-banner {
          max-width: 210mm;
          margin: 20px auto;
          background-color: var(--card);
          border: 1px solid var(--border);
          padding: var(--space-xl);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 8px;
          margin-top: var(--space-md);
        }

        .result-stat-card {
          background-color: var(--background);
          border: 1px solid var(--border);
          padding: 14px 10px;
          text-align: center;
        }

        .result-stat-card .val {
          font-family: 'Rajdhani', sans-serif;
          font-size: 26px;
          font-weight: 700;
          line-height: 1.1;
        }

        .result-stat-card .lbl {
          font-family: 'Rajdhani', sans-serif;
          font-size: 10px;
          color: var(--muted-foreground);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.08em;
          margin-top: 4px;
        }

        /* Cartão de Resposta Flutuante / Modal */
        .cartao-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .cartao-modal-content {
          background-color: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }

        .cartao-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
          gap: 6px;
          padding: 16px;
          overflow-y: auto;
        }

        .cartao-item-btn {
          padding: 6px 4px;
          border: 1px solid var(--border);
          background-color: var(--background);
          color: var(--foreground);
          cursor: pointer;
          text-align: center;
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          transition: all 120ms ease;
        }

        .cartao-item-btn.answered {
          background-color: var(--brand-glow);
          border-color: var(--brand);
          font-weight: 700;
          color: var(--brand);
        }

        .cartao-item-btn.correct {
          background-color: var(--success-bg);
          border-color: var(--success);
          color: var(--success);
          font-weight: 700;
        }

        .cartao-item-btn.wrong {
          background-color: var(--error-bg);
          border-color: var(--error);
          color: var(--error);
          font-weight: 700;
        }
      `}</style>

      {/* ── BARRA SUPERIOR FIXA COM CRONÔMETRO DE 3H30 E CONTROLES ── */}
      <div className="sticky-simulado-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SIMULADO PMMA 2026
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Inter' }}>
            <ShieldCheck size={14} color="var(--brand)" /> Soldado QP · Cebraspe
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Cronômetro */}
          <div className={`timer-badge ${timeLeft <= 600 && status === 'in_progress' ? 'warning' : ''}`}>
            <Clock size={16} />
            <span>{status === 'submitted' ? 'TEMPO FINALIZADO' : formatTime(timeLeft)}</span>
          </div>

          {/* Cartão de Respostas Rápido */}
          <button
            type="button"
            className="btn-cartao"
            onClick={() => setShowCartaoModal(true)}
            title="Abrir folha de respostas"
          >
            <ListOrdered size={15} />
            <span>Gabarito ({stats.respondidas}/120)</span>
          </button>

          {/* Botão Entregar Prova ou Reiniciar */}
          {status === 'in_progress' ? (
            <button
              type="button"
              className="btn-entregar"
              onClick={() => setShowConfirmModal(true)}
            >
              <Send size={15} />
              <span>Entregar Prova</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-entregar"
              onClick={handleReiniciarSimulado}
            >
              <RotateCcw size={15} />
              <span>Fazer Novo Teste</span>
            </button>
          )}
        </div>
      </div>

      {/* ── PAINEL DE RESULTADO QUANDO FINALIZADO ── */}
      {status === 'submitted' && results && (
        <div className="results-banner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={24} color="var(--brand)" />
                <h2 style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: 700,
                  fontFamily: 'Rajdhani',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--foreground)'
                }}>
                  Resultado Oficial da Prova PMMA
                </h2>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted-foreground)' }}>
                Correção estritamente realizada de acordo com o gabarito oficial da banca Cebraspe (1 errada anula 1 certa).
              </p>
            </div>

            <button
              type="button"
              className="btn-cartao"
              onClick={() => window.print()}
            >
              <Printer size={15} />
              <span>Imprimir Relatório</span>
            </button>
          </div>

          <div className="results-grid">
            <div
              className="result-stat-card"
              style={{
                borderColor: results.notaLiquida < 0 ? 'var(--error)' : 'var(--brand)',
                backgroundColor: results.notaLiquida < 0 ? 'var(--error-bg)' : 'var(--brand-glow)'
              }}
            >
              <div
                className="val"
                style={{ color: results.notaLiquida < 0 ? 'var(--error)' : 'var(--brand)' }}
              >
                {results.notaLiquida > 0 ? `+${results.notaLiquida}` : results.notaLiquida} pts
              </div>
              <div className="lbl">Nota Líquida Cebraspe</div>
            </div>

            <div className="result-stat-card" style={{ borderColor: 'var(--success)', backgroundColor: 'var(--success-bg)' }}>
              <div className="val" style={{ color: 'var(--success)' }}>+{results.acertos}</div>
              <div className="lbl">Acertos (+1 cada)</div>
            </div>

            <div className="result-stat-card" style={{ borderColor: 'var(--error)', backgroundColor: 'var(--error-bg)' }}>
              <div className="val" style={{ color: 'var(--error)' }}>-{results.erros}</div>
              <div className="lbl">Erros (-1 cada)</div>
            </div>

            <div className="result-stat-card">
              <div className="val" style={{ color: 'var(--muted-foreground)' }}>{results.emBranco}</div>
              <div className="lbl">Em Branco (0 pts)</div>
            </div>

            <div className="result-stat-card">
              <div className="val" style={{ color: 'var(--foreground)' }}>{results.aproveitamentoTotal}%</div>
              <div className="lbl">Aproveitamento Total</div>
            </div>

            <div className="result-stat-card">
              <div className="val" style={{ color: 'var(--foreground)' }}>{formatTime(results.tempoGastoSegundos)}</div>
              <div className="lbl">Tempo Utilizado</div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'var(--background)',
            border: '1px solid var(--border)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontFamily: 'Inter',
            color: 'var(--foreground)'
          }}>
            <div>
              <strong>Conhecimentos Gerais (1 a 50):</strong> {results.notaLiquidaGerais > 0 ? `+${results.notaLiquidaGerais}` : results.notaLiquidaGerais} pontos líquidos
            </div>
            <div>
              <strong>Conhecimentos Específicos (51 a 120):</strong> {results.notaLiquidaEsp > 0 ? `+${results.notaLiquidaEsp}` : results.notaLiquidaEsp} pontos líquidos
            </div>
            <button
              type="button"
              className="btn-entregar"
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={() => {
                const el = document.getElementById('gabarito-oficial');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Ver Tabela de Gabarito Oficial
            </button>
          </div>
        </div>
      )}

      {/* ── CORPO PRINCIPAL COM O DESIGN ORIGINAL IDÊNTICO DO CEBRASPE ── */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        dangerouslySetInnerHTML={{ __html: simuladoPmmaHtml }}
      />

      {/* ── BOTÃO DE ENTREGA AO FINAL DA PROVA (NA ÚLTIMA PÁGINA) ── */}
      {status === 'in_progress' && (
        <div style={{
          maxWidth: '210mm',
          margin: '20px auto 40px auto',
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          padding: '28px',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
        }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'Rajdhani',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--foreground)'
          }}>
            Fim do Caderno de Questões
          </h3>
          <p style={{ margin: '0 0 16px 0', color: 'var(--muted-foreground)', fontSize: '14px', fontFamily: 'Inter' }}>
            Você respondeu <strong style={{ color: 'var(--foreground)' }}>{stats.respondidas} de 120</strong> questões ({stats.emBranco} em branco).
          </p>
          <button
            type="button"
            className="btn-entregar"
            style={{
              margin: '0 auto',
              padding: '12px 28px',
              fontSize: '15px'
            }}
            onClick={() => setShowConfirmModal(true)}
          >
            <Send size={18} />
            <span>Entregar a Prova para Correção</span>
          </button>
        </div>
      )}

      {/* ── TABELA DO GABARITO OFICIAL CEBRASPE: APENAS APÓS ENTREGA ── */}
      {status === 'submitted' && (
        <div style={{ marginTop: '20px' }} dangerouslySetInnerHTML={{ __html: simuladoPmmaGabaritoHtml }} />
      )}

      {/* ── MODAL DE CONFIRMAÇÃO DE ENTREGA ── */}
      {showConfirmModal && (
        <div className="cartao-modal-overlay">
          <div className="cartao-modal-content" style={{ maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={28} color="var(--warning)" />
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                fontFamily: 'Rajdhani',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--foreground)'
              }}>
                Entregar Simulado PMMA para Correção?
              </h3>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--muted-foreground)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Você respondeu <strong style={{ color: 'var(--foreground)' }}>{stats.respondidas} de 120</strong> questões.
              {stats.emBranco > 0 && (
                <span style={{ color: 'var(--warning)', display: 'block', marginTop: '6px' }}>
                  Atenção: <strong>{stats.emBranco} itens</strong> ficaram em branco e não somarão nem subtrairão pontos.
                </span>
              )}
            </p>

            <div style={{
              background: 'var(--background)',
              padding: '12px',
              border: '1px solid var(--border)',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--foreground)'
            }}>
              <div><strong>Tempo restante:</strong> {formatTime(timeLeft)}</div>
              <div><strong>Critério Cebraspe:</strong> 1 item errado anula 1 item certo (pontuação líquida).</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-cartao"
                onClick={() => setShowConfirmModal(false)}
              >
                Continuar Prova
              </button>
              <button
                type="button"
                className="btn-entregar"
                disabled={isSaving}
                onClick={() => handleFinalizarSimulado(false)}
              >
                {isSaving ? 'Corrigindo...' : 'Confirmar e Corrigir Agora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CARTÃO DE RESPOSTAS ── */}
      {showCartaoModal && (
        <div className="cartao-modal-overlay" onClick={() => setShowCartaoModal(false)}>
          <div className="cartao-modal-content" onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  fontFamily: 'Rajdhani',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--foreground)'
                }}>
                  Cartão de Respostas do Simulado
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                  Clique em qualquer item para navegar direto até a questão na folha de prova.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCartaoModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)'
                }}
              >
                ✕
              </button>
            </div>

            <div className="cartao-grid">
              {Array.from({ length: 120 }, (_, i) => i + 1).map(num => {
                const resp = answers[num];
                const gab = GABARITO_MAP[num];
                const isAnswered = !!resp;
                const isCorrect = status === 'submitted' && resp === gab;
                const isWrong = status === 'submitted' && isAnswered && resp !== gab;

                let cls = 'cartao-item-btn';
                if (status === 'submitted') {
                  if (isCorrect) cls += ' correct';
                  else if (isWrong) cls += ' wrong';
                } else if (isAnswered) {
                  cls += ' answered';
                }

                return (
                  <button
                    key={num}
                    type="button"
                    className={cls}
                    onClick={() => scrollToQuestion(num)}
                  >
                    <span style={{ fontWeight: 600, fontSize: '11px', color: '#64748b' }}>#{num}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>
                      {resp || '-'}
                    </span>
                    {status === 'submitted' && (
                      <span style={{ fontSize: '9px', color: '#0f172a' }}>Gab: {gab}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              background: '#f8fafc'
            }}>
              <div>
                Respondidas: <strong>{stats.respondidas}</strong> / 120
              </div>
              {status === 'in_progress' && (
                <button
                  type="button"
                  className="btn-entregar"
                  onClick={() => {
                    setShowCartaoModal(false);
                    setShowConfirmModal(true);
                  }}
                >
                  <Send size={14} />
                  <span>Entregar Prova</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
