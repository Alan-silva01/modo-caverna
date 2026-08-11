import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useQuestoes } from '../hooks/useQuestoes';
import type { Questao } from '../types';
import { CheckCircle, XCircle, ChevronRight, Trophy } from 'lucide-react';

export default function SolvePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { saveResposta } = useQuestoes();

  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ questaoId: string; acertou: boolean }[]>([]);
  const resultsRef = useRef<{ questaoId: string; acertou: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  // Load questions
  useEffect(() => {
    const ids = searchParams.get('ids');
    if (!ids) {
      navigate('/gerar');
      return;
    }

    const idList = ids.split(',');
    const loadQuestoes = async () => {
      const { data } = await supabase
        .from('questoes')
        .select('*')
        .in('id', idList);

      if (data && data.length > 0) {
        const sorted = idList
          .map(id => data.find(q => q.id === id))
          .filter(Boolean) as Questao[];

        // Filtra questões corrompidas (certo_errado com gabarito inválido)
        const valid = sorted.filter(q => {
          if (q.tipo === 'certo_errado') return q.gabarito === 'C' || q.gabarito === 'E';
          if (q.tipo === 'multipla_escolha') return ['A','B','C','D','E'].includes(q.gabarito);
          return true;
        });

        setQuestoes(valid);
      } else {
        setQuestoes([]);
      }
      setLoading(false);
    };

    loadQuestoes();
  }, [searchParams, navigate]);

  const currentQuestion = questoes[currentIndex];
  const progress = questoes.length > 0 ? ((currentIndex + 1) / questoes.length) * 100 : 0;

  const handleSelectAnswer = (answer: string) => {
    if (answered) return;
    setSelectedAnswer(answer);
  };

  const handleConfirm = useCallback(async () => {
    if (!selectedAnswer || !currentQuestion) return;

    // Normaliza o gabarito para garantir comparação segura
    const gabNorm = String(currentQuestion.gabarito).trim().toUpperCase();
    const selNorm = String(selectedAnswer).trim().toUpperCase();
    const acertou = selNorm === gabNorm;
    setAnswered(true);

    await saveResposta(currentQuestion.id, selectedAnswer, acertou);
    const newEntry = { questaoId: currentQuestion.id, acertou };
    resultsRef.current = [...resultsRef.current, newEntry];
    setResults(resultsRef.current);
  }, [selectedAnswer, currentQuestion, saveResposta]);

  const handleNext = () => {
    if (currentIndex < questoes.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      // Usa o ref para garantir que a última resposta está incluída no cálculo
      const totalAcertos = resultsRef.current.filter(r => r.acertou).length;
      navigate(`/resultados?total=${questoes.length}&acertos=${totalAcertos}&ids=${searchParams.get('ids')}`);
    }
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '60vh' }}>
        <div className="loading-spinner" />
        <p className="loading-text">Carregando questões...</p>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center', padding: 'var(--space-xl)' }}>
        <XCircle size={48} style={{ margin: '0 auto var(--space-md)', display: 'block', color: 'var(--brand)' }} />
        <h2 className="card-title" style={{ fontSize: '18px', marginBottom: 'var(--space-xs)' }}>Nenhuma questão encontrada</h2>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>
          Não foi possível encontrar questões válidas para o simulado selecionado no momento.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/gerar')}>
          Voltar para Gerar Questões
        </button>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.gabarito;

  return (
    <div className="question-container">
      {/* Progress */}
      <div className="question-progress">
        <span className="question-progress-text">
          Questão {currentIndex + 1} de {questoes.length}
        </span>
        <div className="question-progress-bar">
          <div
            className="question-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="question-card">
        <div className="question-badge">
          {currentQuestion.tipo === 'certo_errado' ? 'Certo ou Errado' : 'Múltipla Escolha'}
          {' · '}CESPE
        </div>

        <p className="question-enunciado">{currentQuestion.enunciado}</p>

        {/* Answer Options */}
        {currentQuestion.tipo === 'certo_errado' ? (
          <div className="ce-buttons">
            <button
              className={`ce-btn certo ${
                selectedAnswer === 'C' && !answered ? 'selected' : ''
              } ${
                answered && currentQuestion.gabarito === 'C' ? 'correct' : ''
              } ${
                answered && selectedAnswer === 'C' && currentQuestion.gabarito !== 'C' ? 'incorrect' : ''
              } ${answered ? 'disabled' : ''}`}
              onClick={() => handleSelectAnswer('C')}
              disabled={answered}
            >
              <CheckCircle size={16} strokeWidth={1.5} />
              CERTO
            </button>
            <button
              className={`ce-btn errado ${
                selectedAnswer === 'E' && !answered ? 'selected' : ''
              } ${
                answered && currentQuestion.gabarito === 'E' ? 'correct' : ''
              } ${
                answered && selectedAnswer === 'E' && currentQuestion.gabarito !== 'E' ? 'incorrect' : ''
              } ${answered ? 'disabled' : ''}`}
              onClick={() => handleSelectAnswer('E')}
              disabled={answered}
            >
              <XCircle size={16} strokeWidth={1.5} />
              ERRADO
            </button>
          </div>
        ) : (
          <div className="answer-options">
            {(currentQuestion.alternativas || []).map((alt, idx) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D, E
              const optionText = alt.replace(/^[A-E]\)\s*/, '');
              const isSelected = selectedAnswer === letter;
              const isGabarito = currentQuestion.gabarito === letter;

              let className = 'answer-option';
              if (answered) {
                className += ' disabled';
                if (isGabarito) className += ' correct';
                else if (isSelected && !isGabarito) className += ' incorrect';
              } else if (isSelected) {
                className += ' selected';
              }

              return (
                <button
                  key={letter}
                  className={className}
                  onClick={() => handleSelectAnswer(letter)}
                  disabled={answered}
                >
                  <span className="answer-option-letter">{letter}</span>
                  <span className="answer-option-text">{optionText}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Confirm Button (before answering) */}
        {selectedAnswer && !answered && (
          <button
            className="btn btn-primary btn-lg btn-block mt-lg"
            onClick={handleConfirm}
            style={{ height: '40px', fontSize: '13px' }}
          >
            Confirmar Resposta
          </button>
        )}

        {/* Feedback Panel */}
        {answered && (
          <div className={`feedback-panel ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="feedback-header">
              <div className="feedback-icon">
                {isCorrect ? <CheckCircle size={16} strokeWidth={1.5} /> : <XCircle size={16} strokeWidth={1.5} />}
              </div>
              <span className="feedback-title">
                {isCorrect ? 'RESPOSTA CORRETA' : 'RESPOSTA INCORRETA'}
              </span>
            </div>

            <p className="feedback-gabarito">
              Gabarito: <strong>
                {currentQuestion.tipo === 'certo_errado'
                  ? (currentQuestion.gabarito === 'C' ? 'CERTO' : 'ERRADO')
                  : `Alternativa ${currentQuestion.gabarito}`}
              </strong>
            </p>

            <div className="feedback-justificativa">
              {currentQuestion.justificativa}
            </div>
          </div>
        )}

        {/* Next Button */}
        {answered && (
          <button
            className="btn btn-primary btn-lg btn-block mt-lg"
            onClick={handleNext}
            style={{ height: '40px', fontSize: '13px' }}
          >
            {currentIndex < questoes.length - 1 ? (
              <>
                Próxima Assertiva
                <ChevronRight size={16} strokeWidth={1.5} />
              </>
            ) : (
              <>
                <Trophy size={16} strokeWidth={1.5} />
                Finalizar Simulado
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
