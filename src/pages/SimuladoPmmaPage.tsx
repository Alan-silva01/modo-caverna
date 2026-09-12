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
    // Padrão Cebraspe: Uma errada anula uma certa
    const notaLiquida = Math.max(0, acertos - erros);
    const notaLiquidaGerais = Math.max(0, acertosGerais - errosGerais);
    const notaLiquidaEsp = Math.max(0, acertosEsp - errosEsp);
    const percentualAcertos = respondidas > 0 ? Number(((acertos / respondidas) * 100).toFixed(1)) : 0;
    const aproveitamentoTotal = Number(((acertos / 120) * 100).toFixed(1));

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

  // Update bubble classes in the rendered HTML when answers or status change
  useEffect(() => {
    if (!containerRef.current) return;

    for (let i = 1; i <= 120; i++) {
      const block = containerRef.current.querySelector(`#item-block-${i}`);
      if (!block) continue;

      const bubbleC = block.querySelector(`button.bubble-c`);
      const bubbleE = block.querySelector(`button.bubble-e`);

      const currentVal = answers[i];
      const correctVal = GABARITO_MAP[i];

      // Reset classes
      bubbleC?.classList.remove('selected-c', 'selected-e', 'bubble-correct', 'bubble-wrong', 'bubble-should-be');
      bubbleE?.classList.remove('selected-c', 'selected-e', 'bubble-correct', 'bubble-wrong', 'bubble-should-be');

      if (status === 'in_progress') {
        if (currentVal === 'C') bubbleC?.classList.add('selected-c');
        if (currentVal === 'E') bubbleE?.classList.add('selected-e');
      } else {
        // After submission, show official corrections
        if (currentVal === 'C') {
          bubbleC?.classList.add(currentVal === correctVal ? 'bubble-correct' : 'bubble-wrong');
        }
        if (currentVal === 'E') {
          bubbleE?.classList.add(currentVal === correctVal ? 'bubble-correct' : 'bubble-wrong');
        }
        // Highlight official answer if user missed or left blank
        if (correctVal === 'C' && currentVal !== 'C') {
          bubbleC?.classList.add('bubble-should-be');
        }
        if (correctVal === 'E' && currentVal !== 'E') {
          bubbleE?.classList.add('bubble-should-be');
        }
      }
    }
  }, [answers, status]);

  // Handle bubble clicks directly via event delegation on container
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (status === 'submitted') return;

      const target = (e.target as HTMLElement).closest('button.bubble');
      if (!target) return;

      const itemNumStr = target.getAttribute('data-item');
      const val = target.getAttribute('data-val') as 'C' | 'E';
      if (!itemNumStr || !val) return;

      const itemNum = parseInt(itemNumStr, 10);

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
      <style>{`
        .simulado-pmma-root {
          background: #cbd5e1;
          min-height: 100vh;
          padding-bottom: 80px;
          color: #000;
          overflow-x: hidden;
        }

        /* Garantir que as folhas A4 fiquem contidas perfeitamente sem quebrar o layout */
        .page-sheet, .gabarito-oficial-page {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .highlight-pulse {
          animation: itemPulse 1.8s ease;
        }

        @keyframes itemPulse {
          0% { background: rgba(37, 99, 235, 0.25); outline: 2px solid #2563eb; }
          100% { background: transparent; outline: none; }
        }

        .sticky-simulado-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #0f172a;
          color: #fff;
          border-bottom: 1px solid #1e293b;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          padding: 10px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .timer-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #1e293b;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .timer-badge.warning {
          background: #dc2626;
          color: #fff;
          animation: timerPulse 1s infinite;
        }

        @keyframes timerPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        .btn-entregar {
          background: #16a34a;
          color: #fff;
          border: none;
          padding: 8px 18px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 150ms ease;
        }

        .btn-entregar:hover {
          background: #15803d;
          transform: translateY(-1px);
        }

        .btn-cartao {
          background: #2563eb;
          color: #fff;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-cartao:hover {
          background: #1d4ed8;
        }

        /* Bolinhas C / E com feedback tátil e visual imediato */
        .bubble {
          transition: all 120ms ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .bubble:hover {
          transform: scale(1.15);
          border-color: #2563eb;
        }

        .bubble.selected-c,
        .bubble.selected-e {
          background: #0f172a !important;
          color: #ffffff !important;
          border-color: #0f172a !important;
          font-weight: 900 !important;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.3) !important;
        }

        .bubble.bubble-correct {
          background: #16a34a !important;
          color: #fff !important;
          border-color: #16a34a !important;
          font-weight: 900 !important;
        }

        .bubble.bubble-wrong {
          background: #dc2626 !important;
          color: #fff !important;
          border-color: #dc2626 !important;
          font-weight: 900 !important;
        }

        .bubble.bubble-should-be {
          border: 2px solid #16a34a !important;
          background: #dcfce7 !important;
          color: #166534 !important;
          font-weight: 900 !important;
        }

        .results-banner {
          max-width: 210mm;
          margin: 16px auto;
          background: #fff;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .result-stat-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 12px;
          border-radius: 6px;
          text-align: center;
        }

        .result-stat-card .val {
          font-size: 22px;
          font-weight: 800;
        }

        .result-stat-card .lbl {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
          margin-top: 4px;
        }

        /* Cartão de Resposta Flutuante / Modal */
        .cartao-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(3px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .cartao-modal-content {
          background: #fff;
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          background: #f8fafc;
          cursor: pointer;
          text-align: center;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .cartao-item-btn.answered {
          background: #e0f2fe;
          border-color: #38bdf8;
          font-weight: 700;
          color: #0369a1;
        }

        .cartao-item-btn.correct {
          background: #dcfce7;
          border-color: #22c55e;
          color: #15803d;
          font-weight: 700;
        }

        .cartao-item-btn.wrong {
          background: #fee2e2;
          border-color: #ef4444;
          color: #b91c1c;
          font-weight: 700;
        }
      `}</style>

      {/* ── BARRA SUPERIOR FIXA COM CRONÔMETRO DE 3H30 E CONTROLES ── */}
      <div className="sticky-simulado-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px' }}>
            SIMULADO PMMA 2026
          </div>
          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#38bdf8" /> Soldado QP · Cebraspe
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
              style={{ background: '#2563eb' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={26} color="#16a34a" />
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  Resultado Oficial da Prova PMMA
                </h2>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Correção estritamente realizada de acordo com o gabarito oficial da banca Cebraspe (1 errada anula 1 certa).
              </p>
            </div>

            <button
              type="button"
              className="btn-cartao"
              style={{ background: '#0f172a' }}
              onClick={() => window.print()}
            >
              <Printer size={15} />
              <span>Imprimir Relatório</span>
            </button>
          </div>

          <div className="results-grid">
            <div className="result-stat-card" style={{ borderColor: '#2563eb', background: '#eff6ff' }}>
              <div className="val" style={{ color: '#1d4ed8' }}>{results.notaLiquida} pts</div>
              <div className="lbl">Nota Líquida Cebraspe</div>
            </div>

            <div className="result-stat-card" style={{ borderColor: '#22c55e', background: '#f0fdf4' }}>
              <div className="val" style={{ color: '#16a34a' }}>{results.acertos}</div>
              <div className="lbl">Acertos (+{results.acertos})</div>
            </div>

            <div className="result-stat-card" style={{ borderColor: '#ef4444', background: '#fef2f2' }}>
              <div className="val" style={{ color: '#dc2626' }}>{results.erros}</div>
              <div className="lbl">Erros (-{results.erros})</div>
            </div>

            <div className="result-stat-card">
              <div className="val" style={{ color: '#64748b' }}>{results.emBranco}</div>
              <div className="lbl">Em Branco (0 pts)</div>
            </div>

            <div className="result-stat-card">
              <div className="val" style={{ color: '#0f172a' }}>{results.aproveitamentoTotal}%</div>
              <div className="lbl">Aproveitamento Total</div>
            </div>

            <div className="result-stat-card">
              <div className="val" style={{ color: '#0f172a' }}>{formatTime(results.tempoGastoSegundos)}</div>
              <div className="lbl">Tempo Utilizado</div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>Conhecimentos Gerais (1 a 50):</strong> {results.notaLiquidaGerais} pontos líquidos
            </div>
            <div>
              <strong>Conhecimentos Específicos (51 a 120):</strong> {results.notaLiquidaEsp} pontos líquidos
            </div>
            <button
              type="button"
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '4px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
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
          background: '#fff',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          border: '1px solid #cbd5e1'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            Fim do Caderno de Questões
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>
            Você respondeu <strong>{stats.respondidas} de 120</strong> questões ({stats.emBranco} em branco).
          </p>
          <button
            type="button"
            className="btn-entregar"
            style={{
              margin: '0 auto',
              padding: '12px 28px',
              fontSize: '16px',
              borderRadius: '8px'
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
              <AlertTriangle size={32} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Entregar Simulado PMMA para Correção?
              </h3>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Você respondeu <strong>{stats.respondidas} de 120</strong> questões.
              {stats.emBranco > 0 && (
                <span style={{ color: '#d97706', display: 'block', marginTop: '6px' }}>
                  Atenção: <strong>{stats.emBranco} itens</strong> ficaram em branco e não somarão nem subtrairão pontos.
                </span>
              )}
            </p>

            <div style={{
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              fontSize: '13px'
            }}>
              <div><strong>Tempo restante:</strong> {formatTime(timeLeft)}</div>
              <div><strong>Critério Cebraspe:</strong> 1 item errado anula 1 item certo.</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-action"
                style={{ background: '#e2e8f0', color: '#1e293b' }}
                onClick={() => setShowConfirmModal(false)}
              >
                Continuar Fazendo Prova
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
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Cartão de Respostas do Simulado
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
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
                  color: '#64748b'
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
