import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import temasData from '../data/temasRedacao.json';
import {
  BookOpen,
  Sparkles,
  Send,
  Loader,
  AlertTriangle,
  Award,
  XCircle,
  MonitorOff,
  History,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Check
} from 'lucide-react';

export interface Esqueleto {
  titulo_sugerido: string;
  introducao: string;
  desenvolvimento1: string;
  desenvolvimento2: string;
  conclusao: string;
}

export interface TemaRedacao {
  id: string;
  tema: string;
  categoria: string;
  textos_motivadores: string[];
  esqueleto: Esqueleto;
}

export interface ResultadoCorrecao {
  criterio1: number;
  criterio2: number;
  criterio3: number;
  criterio4: number;
  criterio5: number;
  notaBruta10: number;
  notaFinal100: number;
  zerou: boolean;
  motivoZero: string | null;
  eliminado: boolean;
  pontosFortes: string[];
  pontosFracos: string[];
  sugestoesDeMelhoria: string[];
}

export interface RedacaoSalva {
  id: string;
  tema_id: string;
  tema_titulo: string;
  modo: 'zero' | 'esqueleto';
  texto_enviado: string;
  nota_final_100: number;
  criterios: any;
  zerou: boolean;
  motivo_zero?: string;
  eliminado: boolean;
  pontos_fortes: string[];
  pontos_fracos: string[];
  sugestoes: string[];
  created_at: string;
}

// Estimate lines count based on text length and line breaks (~65 chars per line)
function countLines(text: string): number {
  if (!text.trim()) return 0;
  const paragraphs = text.split('\n');
  let totalLines = 0;
  for (const p of paragraphs) {
    if (p.trim().length === 0) {
      totalLines += 1;
    } else {
      totalLines += Math.max(1, Math.ceil(p.length / 65));
    }
  }
  return totalLines;
}

export default function RedacaoPage() {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Theme selection states
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [currentTema, setCurrentTema] = useState<TemaRedacao>(temasData[0] as TemaRedacao);
  const [showMotivadores, setShowMotivadores] = useState<boolean>(true);

  // Editor states
  const [modo, setModo] = useState<'zero' | 'esqueleto'>('zero');
  const [texto, setTexto] = useState<string>('');
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [resultado, setResultado] = useState<ResultadoCorrecao | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Model Essay states
  const [generatingModel, setGeneratingModel] = useState<boolean>(false);
  const [modelEssay, setModelEssay] = useState<{ titulo: string; textoCompleto: string } | null>(null);
  const [showModelModal, setShowModelModal] = useState<boolean>(false);
  const [copiedModel, setCopiedModel] = useState<boolean>(false);

  // History states
  const [historico, setHistorico] = useState<RedacaoSalva[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'historico'>('editor');

  const categorias = useMemo(() => {
    const cats = new Set(temasData.map(t => t.categoria));
    return ['todas', ...Array.from(cats)];
  }, []);

  // Filter temas by category
  const filteredTemas = useMemo(() => {
    if (selectedCategoria === 'todas') return temasData as TemaRedacao[];
    return temasData.filter(t => t.categoria === selectedCategoria) as TemaRedacao[];
  }, [selectedCategoria]);

  // Sortear tema
  const handleSortearTema = () => {
    const pool = filteredTemas.length > 0 ? filteredTemas : (temasData as TemaRedacao[]);
    const randomIndex = Math.floor(Math.random() * pool.length);
    const newTema = pool[randomIndex];
    setCurrentTema(newTema);
    setResultado(null);
    setErrorMsg(null);

    if (modo === 'esqueleto') {
      applyEsqueleto(newTema);
    } else {
      setTexto('');
    }
  };

  const applyEsqueleto = (temaObj: TemaRedacao) => {
    const esq = temaObj.esqueleto;
    const templateText = `${esq.titulo_sugerido}\n\n${esq.introducao}\n\n${esq.desenvolvimento1}\n\n${esq.desenvolvimento2}\n\n${esq.conclusao}`;
    setTexto(templateText);
  };

  const handleSelectModo = (newModo: 'zero' | 'esqueleto') => {
    setModo(newModo);
    setResultado(null);
    setErrorMsg(null);
    if (newModo === 'esqueleto') {
      applyEsqueleto(currentTema);
    } else {
      setTexto('');
    }
  };

  const linhas = countLines(texto);

  // Load history from Supabase
  const loadHistorico = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('redacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setHistorico(data as RedacaoSalva[]);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de redações:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'historico') {
      loadHistorico();
    }
  }, [activeTab]);

  // Send for AI Evaluation
  const handleEnviarCorrecao = async () => {
    if (!texto.trim()) {
      setErrorMsg('Por favor, digite o texto da sua redação antes de enviar.');
      return;
    }

    setErrorMsg(null);
    setEvaluating(true);
    setResultado(null);

    // Client-side rule check: less than 15 lines -> zero direct
    if (linhas < 15) {
      const zeroResult: ResultadoCorrecao = {
        criterio1: 0,
        criterio2: 0,
        criterio3: 0,
        criterio4: 0,
        criterio5: 0,
        notaBruta10: 0,
        notaFinal100: 0,
        zerou: true,
        motivoZero: 'Menos de 15 linhas escritas (eliminação automática conforme o Edital UEMA).',
        eliminado: true,
        pontosFortes: [],
        pontosFracos: ['Texto muito curto (menos de 15 linhas).'],
        sugestoesDeMelhoria: ['Desenvolva a estrutura em pelo menos 15 linhas compostas por introdução, 2 parágrafos de desenvolvimento e conclusão.']
      };
      setResultado(zeroResult);
      setEvaluating(false);

      // Save to Supabase
      saveRedacaoToDb(zeroResult);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://wymlckdkrwdxyexrxxka.supabase.co'}/functions/v1/evaluate-essay`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tema: currentTema.tema,
            texto,
            linhasCount: linhas,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao avaliar redação (${response.status})`);
      }

      const resData: ResultadoCorrecao = await response.json();
      setResultado(resData);
      saveRedacaoToDb(resData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar ao servidor de correção.');
    } finally {
      setEvaluating(false);
    }
  };

  // Save redação attempt to Supabase
  const saveRedacaoToDb = async (res: ResultadoCorrecao) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('redacoes').insert({
        user_id: user.id,
        tema_id: currentTema.id,
        tema_titulo: currentTema.tema,
        modo,
        texto_enviado: texto,
        nota_final_100: res.notaFinal100,
        criterios: {
          c1: res.criterio1,
          c2: res.criterio2,
          c3: res.criterio3,
          c4: res.criterio4,
          c5: res.criterio5,
        },
        zerou: res.zerou,
        motivo_zero: res.motivoZero,
        eliminado: res.eliminado,
        pontos_fortes: res.pontosFortes,
        pontos_fracos: res.pontosFracos,
        sugestoes: res.sugestoesDeMelhoria,
      });
    } catch (err) {
      console.error('Erro ao salvar redação no banco:', err);
    }
  };

  // Generate Model Essay (Nota 100)
  const handleGerarRedacaoModelo = async () => {
    setGeneratingModel(true);
    setModelEssay(null);
    setShowModelModal(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://wymlckdkrwdxyexrxxka.supabase.co'}/functions/v1/generate-essay-model`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tema: currentTema.tema,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao gerar redação-modelo.');
      }

      const modelData = await response.json();
      setModelEssay(modelData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setGeneratingModel(false);
    }
  };

  const handleCopyModel = () => {
    if (!modelEssay) return;
    const fullText = `${modelEssay.titulo}\n\n${modelEssay.textoCompleto}`;
    navigator.clipboard.writeText(fullText);
    setCopiedModel(true);
    setTimeout(() => setCopiedModel(false), 2000);
  };

  // Guard Desktop Only view on mobile
  if (isMobile) {
    return (
      <div className="page-container" style={{ paddingTop: 'var(--space-xl)' }}>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: 'var(--space-xl)' }}>
          <MonitorOff size={48} strokeWidth={1.5} style={{ margin: '0 auto var(--space-md)', color: 'var(--brand)' }} />
          <h2 className="card-title" style={{ fontSize: '18px', marginBottom: 'var(--space-xs)' }}>
            Exclusivo para Telas Desktop
          </h2>
          <p className="text-muted" style={{ fontSize: '13px', lineHeight: 1.6, marginBottom: 'var(--space-lg)' }}>
            O Módulo de Produção Textual (Redação UEMA Edital 214/2026-GR) foi projetado para telas Desktop para proporcionar a melhor experiência de leitura de textos motivadores, preenchimento de lacunas e digitação contínua.
          </p>
          <span style={{ fontSize: '11px', fontFamily: 'Rajdhani', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase' }}>
            Acesse em um computador para iniciar seu treino
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* ── Page Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Produção Textual</h1>
          <p className="page-subtitle">Vestibular UEMA · Edital n.º 214/2026-GR/UEMA</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            className={`btn ${activeTab === 'editor' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('editor')}
            style={{ fontSize: '12px', height: '34px' }}
          >
            <BookOpen size={14} />
            <span>Treino & Editor</span>
          </button>
          <button
            className={`btn ${activeTab === 'historico' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('historico')}
            style={{ fontSize: '12px', height: '34px' }}
          >
            <History size={14} />
            <span>Histórico</span>
          </button>
        </div>
      </div>

      {activeTab === 'historico' ? (
        /* ── Aba 2: Histórico de Redações ── */
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            Suas Redações Anteriores
          </div>

          {loadingHistory ? (
            <div className="loading-container" style={{ padding: '40px 0' }}>
              <div className="loading-spinner" />
              <p className="loading-text">Carregando histórico...</p>
            </div>
          ) : historico.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--muted-foreground)' }} />
              <h3 className="empty-state-title" style={{ marginTop: 12 }}>Nenhuma redação realizada ainda</h3>
              <p className="empty-state-text">Sorteie um tema no editor e envie seu primeiro texto para receber avaliação detalhada.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {historico.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 'var(--space-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontFamily: 'Rajdhani', fontWeight: 700 }}>
                        {new Date(item.created_at).toLocaleDateString('pt-BR')} · Modo: {item.modo === 'esqueleto' ? 'Com Esqueleto' : 'Do Zero'}
                      </span>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', marginTop: 2 }}>
                        {item.tema_titulo}
                      </h4>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        fontFamily: 'Rajdhani',
                        color: item.zerou || item.eliminado ? 'var(--error)' : item.nota_final_100 >= 80 ? 'var(--success)' : 'var(--brand)'
                      }}>
                        {item.nota_final_100} / 100
                      </span>
                      {item.zerou && (
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--error)', fontWeight: 700 }}>ZEROU</span>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    "{item.texto_enviado}"
                  </p>

                  {/* Criteria badges */}
                  {item.criterios && (
                    <div style={{ display: 'flex', gap: '8px', fontSize: '10px', fontFamily: 'Rajdhani', color: 'var(--muted-foreground)', flexWrap: 'wrap', paddingTop: 4 }}>
                      <span>C1: {item.criterios.c1 ?? 0}/2</span>
                      <span>C2: {item.criterios.c2 ?? 0}/2</span>
                      <span>C3: {item.criterios.c3 ?? 0}/2</span>
                      <span>C4: {item.criterios.c4 ?? 0}/2</span>
                      <span>C5: {item.criterios.c5 ?? 0}/2</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Aba 1: Editor & Sorteio ── */
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--space-md)', alignItems: 'start' }}>
          
          {/* Coluna Esquerda: Sorteio & Textos Motivadores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            
            {/* Card: Sorteio de Tema */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 'var(--space-sm)' }}>
                Sorteador de Temas
              </div>

              {/* Filtro por Categoria */}
              <div className="form-group" style={{ marginBottom: 'var(--space-sm)' }}>
                <label className="form-label">Filtrar por Categoria</label>
                <select
                  className="form-select"
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  style={{ fontSize: '12px' }}
                >
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'todas' ? 'Todas as Categorias' : cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleSortearTema}
                style={{ height: '36px', fontSize: '12px' }}
              >
                <Sparkles size={14} />
                <span>Sortear Novo Tema</span>
              </button>
            </div>

            {/* Card: Tema Atual & Motivadores */}
            <div className="card">
              <span className="badge" style={{ marginBottom: 'var(--space-xs)', textTransform: 'uppercase', fontSize: '9px' }}>
                {currentTema.categoria}
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.4, color: 'var(--foreground)', marginBottom: 'var(--space-md)' }}>
                "{currentTema.tema}"
              </h3>

              {/* Textos Motivadores Collapsible */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-sm)' }}>
                <button
                  onClick={() => setShowMotivadores(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand)',
                    fontSize: '11px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: 0,
                    textTransform: 'uppercase'
                  }}
                >
                  <span>Textos Motivadores ({currentTema.textos_motivadores.length})</span>
                  {showMotivadores ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showMotivadores && (
                  <div style={{ marginTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentTema.textos_motivadores.map((textoMotivador, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted-foreground)',
                          lineHeight: 1.5,
                          padding: '8px',
                          background: 'var(--background)',
                          borderLeft: '2px solid var(--brand)',
                          fontStyle: 'italic'
                        }}
                      >
                        {textoMotivador}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card: Redação-Modelo Nota 100 */}
            <div className="card" style={{ borderColor: 'var(--brand)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Award size={18} style={{ color: 'var(--brand)' }} />
                <span className="card-title" style={{ margin: 0 }}>Redação-Modelo Nota 100</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: 1.4, marginBottom: 'var(--space-sm)' }}>
                Gere um texto de referência nota máxima com estrutura ideal e voz humana para este tema.
              </p>
              <button
                className="btn btn-secondary btn-block"
                onClick={handleGerarRedacaoModelo}
                style={{ height: '34px', fontSize: '12px' }}
              >
                <Sparkles size={13} />
                <span>Gerar Redação-Modelo (IA)</span>
              </button>
            </div>

          </div>

          {/* Coluna Direita: Editor & Resultado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            
            {/* Modos de Escrita (Do zero vs Esqueleto) */}
            <div className="card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <label className="form-label" style={{ margin: 0 }}>Modo de Produção</label>
                <div className="type-toggle" style={{ width: 'auto' }}>
                  <button
                    className={`type-toggle-btn ${modo === 'zero' ? 'active' : ''}`}
                    onClick={() => handleSelectModo('zero')}
                    type="button"
                    style={{ padding: '4px 12px', fontSize: '11px' }}
                  >
                    Do Zero
                  </button>
                  <button
                    className={`type-toggle-btn ${modo === 'esqueleto' ? 'active' : ''}`}
                    onClick={() => handleSelectModo('esqueleto')}
                    type="button"
                    style={{ padding: '4px 12px', fontSize: '11px' }}
                  >
                    Com Esqueleto
                  </button>
                </div>
              </div>

              {/* Textarea Editor */}
              <div style={{ position: 'relative' }}>
                <textarea
                  className="form-input"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={
                    modo === 'esqueleto'
                      ? 'Substitua os termos entre colchetes [ ... ] com suas ideias...'
                      : 'Escreva seu título e os parágrafos da sua redação aqui...'
                  }
                  rows={16}
                  style={{
                    width: '100%',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    padding: 'var(--space-md)',
                    resize: 'vertical',
                    minHeight: '340px'
                  }}
                />

                {/* Line Counter Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'var(--space-xs)',
                  fontSize: '11px',
                  fontFamily: 'Rajdhani',
                  fontWeight: 700
                }}>
                  <span style={{ color: linhas < 15 ? 'var(--error)' : 'var(--success)' }}>
                    LINHAS ESTIMADAS: {linhas} {linhas < 15 ? '(⚠️ MÍNIMO DE 15 LINHAS REQUERIDO)' : '✓ DENTRO DO LIMITE (15 A 30 LINHAS)'}
                  </span>
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {texto.length} CARACTERES
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="form-error" style={{ marginTop: 'var(--space-sm)' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Enviar para Correção Button */}
              <button
                className="btn btn-primary btn-block"
                onClick={handleEnviarCorrecao}
                disabled={evaluating || !texto.trim()}
                style={{ height: '42px', marginTop: 'var(--space-md)', fontSize: '13px' }}
              >
                {evaluating ? (
                  <>
                    <Loader size={16} className="loading-spinner" style={{ width: 16, height: 16, border: 'none', borderTop: 'none' }} />
                    <span>Avaliando redação com banca UEMA...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Enviar para Correção (Edital UEMA)</span>
                  </>
                )}
              </button>
            </div>

            {/* Resultado da Correção */}
            {resultado && (
              <div className="card" style={{ borderColor: resultado.zerou || resultado.eliminado ? 'var(--error)' : 'var(--success)' }}>
                
                {/* Header da Nota */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 'var(--space-md)',
                  marginBottom: 'var(--space-md)'
                }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', fontFamily: 'Rajdhani', fontWeight: 700 }}>
                      Resultado da Avaliação UEMA
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                      {resultado.zerou ? 'Redação Zerada' : resultado.eliminado ? 'Candidato Eliminado' : 'Desempenho Final'}
                    </h3>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: 900,
                      fontFamily: 'Rajdhani',
                      lineHeight: 1,
                      color: resultado.zerou || resultado.eliminado ? 'var(--error)' : resultado.notaFinal100 >= 80 ? 'var(--success)' : 'var(--brand)'
                    }}>
                      {resultado.notaFinal100} <span style={{ fontSize: '16px', color: 'var(--muted-foreground)' }}>/ 100</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontFamily: 'Rajdhani', fontWeight: 700 }}>
                      NOTA BRUTA: {resultado.notaBruta10.toFixed(2)} / 10.0
                    </span>
                  </div>
                </div>

                {/* Alertas de Zerou / Eliminado */}
                {resultado.zerou && (
                  <div className="form-error" style={{ marginBottom: 'var(--space-md)', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
                    <AlertTriangle size={16} />
                    <span><strong>NOTA ZERO:</strong> {resultado.motivoZero}</span>
                  </div>
                )}

                {!resultado.zerou && resultado.eliminado && (
                  <div className="form-error" style={{ marginBottom: 'var(--space-md)', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
                    <XCircle size={16} />
                    <span><strong>ELIMINADO:</strong> Nota bruta menor que 2.0/10.0 (item 12.3, IV do Edital UEMA).</span>
                  </div>
                )}

                {/* 5 Critérios UEMA */}
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <h4 style={{ fontSize: '12px', fontFamily: 'Rajdhani', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 'var(--space-xs)' }}>
                    Detalhamento dos 5 Critérios Oficiais (0,0 a 2,0 pts)
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { num: 1, name: 'Atendimento ao Tema Proposto', val: resultado.criterio1 },
                      { num: 2, name: 'Coesão entre as partes do texto', val: resultado.criterio2 },
                      { num: 3, name: 'Coerência dos Argumentos & Estrutura', val: resultado.criterio3 },
                      { num: 4, name: 'Atendimento à Tipologia Dissertativa', val: resultado.criterio4 },
                      { num: 5, name: 'Domínio do Padrão Culto da Língua', val: resultado.criterio5 },
                    ].map(c => (
                      <div key={c.num} style={{ fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span>C{c.num}. {c.name}</span>
                          <span style={{ fontWeight: 700, fontFamily: 'Rajdhani' }}>{c.val.toFixed(1)} / 2.0</span>
                        </div>
                        <div className="stats-bar-track" style={{ height: '6px' }}>
                          <div
                            className={`stats-bar-fill ${c.val >= 1.5 ? 'high' : c.val >= 1.0 ? 'medium' : 'low'}`}
                            style={{ width: `${(c.val / 2.0) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback List: Pontos Fortes, Fracos e Sugestões */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  
                  {/* Pontos Fortes */}
                  {resultado.pontosFortes.length > 0 && (
                    <div style={{ background: 'var(--background)', padding: 'var(--space-sm)', borderLeft: '3px solid var(--success)' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'Rajdhani', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>
                        ✓ Pontos Fortes
                      </span>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', color: 'var(--foreground)', lineHeight: 1.5 }}>
                        {resultado.pontosFortes.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pontos Fracos */}
                  {resultado.pontosFracos.length > 0 && (
                    <div style={{ background: 'var(--background)', padding: 'var(--space-sm)', borderLeft: '3px solid var(--error)' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'Rajdhani', fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase' }}>
                        ⚠ Pontos a Melhorar
                      </span>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', color: 'var(--foreground)', lineHeight: 1.5 }}>
                        {resultado.pontosFracos.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Sugestões de Melhoria */}
                {resultado.sugestoesDeMelhoria.length > 0 && (
                  <div style={{ background: 'var(--background)', padding: 'var(--space-sm)', borderLeft: '3px solid var(--brand)' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'Rajdhani', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase' }}>
                      💡 Sugestões Práticas de Evolução
                    </span>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '11px', color: 'var(--foreground)', lineHeight: 1.5 }}>
                      {resultado.sugestoesDeMelhoria.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Modal Redação-Modelo Nota 100 ── */}
      {showModelModal && (
        <div className="modal-overlay" onClick={() => setShowModelModal(false)}>
          <div className="modal-content-form" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modal-header-border">
              <span className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={16} style={{ color: 'var(--brand)' }} />
                Redação-Modelo Nota 100 (Referência)
              </span>
              <button className="btn btn-ghost" style={{ padding: 0, width: 24, height: 24 }} onClick={() => setShowModelModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body-scroll" style={{ maxHeight: '70vh' }}>
              {generatingModel ? (
                <div className="loading-container" style={{ padding: '40px 0' }}>
                  <div className="loading-spinner" />
                  <p className="loading-text">Elaborando texto de referência humanizado nota 100...</p>
                </div>
              ) : modelEssay ? (
                <div>
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#eab308',
                    fontSize: '11px',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    marginBottom: 'var(--space-md)',
                    textTransform: 'uppercase'
                  }}>
                    ℹ️ Texto de referência gerado por IA. Não é uma redação real de candidato. Use como modelo de estudo da estrutura ideal.
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 800, textAlign: 'center', marginBottom: 'var(--space-md)', color: 'var(--brand)' }}>
                    {modelEssay.titulo}
                  </h3>

                  <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
                    {modelEssay.textoCompleto}
                  </div>
                </div>
              ) : (
                <div className="form-error">Não foi possível gerar a redação-modelo no momento.</div>
              )}
            </div>

            <div className="modal-footer-border">
              <button className="btn btn-ghost" onClick={() => setShowModelModal(false)}>
                Fechar
              </button>
              {modelEssay && (
                <button className="btn btn-primary" onClick={handleCopyModel}>
                  {copiedModel ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedModel ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
