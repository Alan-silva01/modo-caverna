import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisciplinas } from '../hooks/useDisciplinas';
import { useTemas } from '../hooks/useTemas';
import { useQuestoes } from '../hooks/useQuestoes';
import { useConcurso } from '../contexts/ConcursoContext';
import { supabase } from '../lib/supabase';
import type { TipoQuestao } from '../types';
import {
  Zap,
  Plus,
  X,
  CheckSquare,
  List,
  Loader,
  Database,
} from 'lucide-react';

export default function GeneratePage() {
  const navigate = useNavigate();
  const { concursoAlvo } = useConcurso();
  const { disciplinas, loading: loadingDisc, createDisciplina } = useDisciplinas(concursoAlvo?.id ?? null);
  const [selectedDiscId, setSelectedDiscId] = useState('');
  const { temas, loading: loadingTemas, createTema } = useTemas(selectedDiscId || null);
  const [selectedTemaId, setSelectedTemaId] = useState('');
  const [quantidade, setQuantidade] = useState(10);
  const [tipo, setTipo] = useState<TipoQuestao>('certo_errado');
  const [dificuldade, setDificuldade] = useState<'medio' | 'dificil' | 'extremo'>('extremo');
  const { generateQuestoes, loading: generating, error } = useQuestoes();

  // Database study states
  const [source, setSource] = useState<'ia' | 'banco'>('ia');
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [totalGlobalCount, setTotalGlobalCount] = useState<number | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Fetch total global questions count in database
  useEffect(() => {
    const fetchGlobalCount = async () => {
      try {
        const { count } = await supabase
          .from('questoes')
          .select('*', { count: 'exact', head: true });
        setTotalGlobalCount(count);
      } catch (err) {
        console.error('Erro ao buscar total de questões:', err);
      }
    };
    fetchGlobalCount();
  }, []);

  // Modal states
  const [showNewDisc, setShowNewDisc] = useState(false);
  const [showNewTema, setShowNewTema] = useState(false);
  const [newName, setNewName] = useState('');

  const selectedDisc = disciplinas.find(d => d.id === selectedDiscId);
  const selectedTema = temas.find(t => t.id === selectedTemaId);

  // Live database question count
  useEffect(() => {
    if (source !== 'banco' || !selectedDiscId) {
      setDbCount(null);
      return;
    }

    const fetchCount = async () => {
      try {
        const { data: discs } = await supabase
          .from('disciplinas')
          .select('id')
          .eq('nome', selectedDisc?.nome || '');
        const discIds = discs?.map(d => d.id) || [selectedDiscId];

        let countQuery = supabase
          .from('questoes')
          .select('*', { count: 'exact', head: true })
          .in('disciplina_id', discIds)
          .eq('tipo', tipo);

        if (selectedTemaId && selectedTema) {
          const { data: siblingTemas } = await supabase
            .from('temas')
            .select('id')
            .eq('nome', selectedTema.nome);
          const temaIds = siblingTemas?.map(t => t.id) || [selectedTemaId];
          countQuery = countQuery.in('tema_id', temaIds);
        }

        const { count, error } = await countQuery;
        if (!error && count !== null) {
          setDbCount(count);
        } else {
          setDbCount(0);
        }
      } catch {
        setDbCount(0);
      }
    };

    fetchCount();
  }, [source, selectedDiscId, selectedTemaId, selectedDisc?.nome, selectedTema?.nome, tipo]);

  const handleDiscChange = (id: string) => {
    if (id === '__new__') {
      setShowNewDisc(true);
      return;
    }
    setSelectedDiscId(id);
    setSelectedTemaId('');
    setDbError(null);
  };

  const handleTemaChange = (id: string) => {
    if (id === '__new__') {
      setShowNewTema(true);
      return;
    }
    setSelectedTemaId(id);
    setDbError(null);
  };

  const handleCreateDisc = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const disc = await createDisciplina(newName.trim());
    if (disc) {
      setSelectedDiscId(disc.id);
      setSelectedTemaId('');
    }
    setNewName('');
    setShowNewDisc(false);
  };

  const handleCreateTema = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const tema = await createTema(newName.trim());
    if (tema) {
      setSelectedTemaId(tema.id);
    }
    setNewName('');
    setShowNewTema(false);
  };

  const handleGenerate = async () => {
    if (!selectedDisc) return;
    setDbError(null);

    if (source === 'ia') {
      if (!selectedTema) return;
      const questoes = await generateQuestoes(
        selectedDisc.nome,
        selectedTema.nome,
        selectedDisc.id,
        selectedTema.id,
        quantidade,
        tipo,
        dificuldade
      );

      if (questoes && questoes.length > 0) {
        const ids = questoes.map(q => q.id).join(',');
        navigate(`/resolver?ids=${ids}`);
      }
    } else {
      // Banco de questões
      setDbLoading(true);
      try {
        const { data: discs } = await supabase
          .from('disciplinas')
          .select('id')
          .eq('nome', selectedDisc.nome);
        const discIds = discs?.map(d => d.id) || [selectedDisc.id];

        let qQuery = supabase
          .from('questoes')
          .select('id')
          .in('disciplina_id', discIds)
          .eq('tipo', tipo);

        if (selectedTemaId && selectedTema) {
          const { data: siblingTemas } = await supabase
            .from('temas')
            .select('id')
            .eq('nome', selectedTema.nome);
          const temaIds = siblingTemas?.map(t => t.id) || [selectedTemaId];
          qQuery = qQuery.in('tema_id', temaIds);
        }

        // Busca TODAS as questões correspondentes no banco (sem .limit) para sortear de forma 100% aleatória
        const { data: qs, error: qErr } = await qQuery;

        if (qErr) throw qErr;

        if (!qs || qs.length === 0) {
          setDbError(`Nenhuma questão correspondente encontrada no banco.`);
        } else {
          // Embaralha TODAS as questões correspondentes encontradas e pega 'quantidade' aleatórias
          const shuffled = [...qs].sort(() => 0.5 - Math.random()).slice(0, quantidade);
          const ids = shuffled.map(q => q.id).join(',');
          navigate(`/resolver?ids=${ids}`);
        }
      } catch (err: any) {
        console.error(err);
        setDbError(err.message || 'Erro ao buscar questões no banco.');
      } finally {
        setDbLoading(false);
      }
    }
  };

  const canGenerate = selectedDiscId && (source === 'banco' || selectedTemaId) && !generating && !dbLoading;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Gerar Questões</h1>
        <p className="page-subtitle">
          IA CESPE/Cebraspe {totalGlobalCount !== null ? `· ${totalGlobalCount} questões no banco` : ''}
        </p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        {/* Origem das Questões Toggle */}
        <div className="form-group">
          <label className="form-label">Origem das Questões</label>
          <div className="type-toggle" style={{ marginBottom: 'var(--space-sm)' }}>
            <button
              className={`type-toggle-btn ${source === 'ia' ? 'active' : ''}`}
              onClick={() => { setSource('ia'); setDbError(null); }}
              type="button"
              style={{ flex: 1 }}
            >
              <Zap size={16} strokeWidth={1.5} />
              <span className="type-toggle-label">Gerar com IA</span>
              <span className="type-toggle-desc">Elabora novas questões exclusivas</span>
            </button>
            <button
              className={`type-toggle-btn ${source === 'banco' ? 'active' : ''}`}
              onClick={() => { setSource('banco'); setDbError(null); }}
              type="button"
              style={{ flex: 1 }}
            >
              <Database size={16} strokeWidth={1.5} />
              <span className="type-toggle-label">Banco de Questões</span>
              <span className="type-toggle-desc">
                {totalGlobalCount !== null ? `${totalGlobalCount} salvas no acervo` : 'Usa simulados e questões salvas'}
              </span>
            </button>
          </div>
        </div>

        {/* Disciplina */}
        <div className="form-group">
          <label className="form-label">
            Disciplina
          </label>
          <select
            className="form-select"
            value={selectedDiscId}
            onChange={(e) => handleDiscChange(e.target.value)}
            disabled={loadingDisc}
          >
            <option value="">Selecione uma disciplina</option>
            {disciplinas.map(d => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
            <option value="__new__">➕ Criar nova disciplina</option>
          </select>
        </div>

        {/* Tema */}
        <div className="form-group">
          <label className="form-label">
            Tema {source === 'banco' && <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>(OPCIONAL NO BANCO)</span>}
          </label>
          <select
            className="form-select"
            value={selectedTemaId}
            onChange={(e) => handleTemaChange(e.target.value)}
            disabled={!selectedDiscId || loadingTemas}
          >
            <option value="">
              {source === 'banco' && selectedDiscId 
                ? 'Todos os temas' 
                : !selectedDiscId
                ? 'Selecione uma disciplina primeiro'
                : loadingTemas
                ? 'Carregando temas...'
                : 'Selecione um tema'}
            </option>
            {temas.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
            {selectedDiscId && (
              <option value="__new__">➕ Criar novo tema</option>
            )}
          </select>
        </div>

        {/* Quantidade */}
        <div className="form-group">
          <label className="form-label">Quantidade de questões</label>
          <div className="quantity-selector">
            {[5, 10, 15, 20].map(n => (
              <button
                key={n}
                className={`quantity-btn ${quantidade === n ? 'active' : ''}`}
                onClick={() => setQuantidade(n)}
                type="button"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo */}
        <div className="form-group">
          <label className="form-label">Tipo de questão</label>
          <div className="type-toggle">
            <button
              className={`type-toggle-btn ${tipo === 'certo_errado' ? 'active' : ''}`}
              onClick={() => setTipo('certo_errado')}
              type="button"
            >
              <CheckSquare size={16} strokeWidth={1.5} />
              <span className="type-toggle-label">Certo / Errado</span>
              <span className="type-toggle-desc">Assertivas únicas</span>
            </button>
            <button
              className={`type-toggle-btn ${tipo === 'multipla_escolha' ? 'active' : ''}`}
              onClick={() => setTipo('multipla_escolha')}
              type="button"
            >
              <List size={16} strokeWidth={1.5} />
              <span className="type-toggle-label">Múltipla Escolha</span>
              <span className="type-toggle-desc">Alternativas A a E</span>
            </button>
          </div>
        </div>

        {/* Nível de Dificuldade (Apenas para IA) */}
        {source === 'ia' && (
          <div className="form-group">
            <label className="form-label">Nível de Dificuldade</label>
            <div className="type-toggle">
              <button
                className={`type-toggle-btn ${dificuldade === 'medio' ? 'active' : ''}`}
                onClick={() => setDificuldade('medio')}
                type="button"
                style={{ flex: 1 }}
              >
                <span className="type-toggle-label">Médio</span>
                <span className="type-toggle-desc">Concursos gerais</span>
              </button>
              <button
                className={`type-toggle-btn ${dificuldade === 'dificil' ? 'active' : ''}`}
                onClick={() => setDificuldade('dificil')}
                type="button"
                style={{ flex: 1 }}
              >
                <span className="type-toggle-label">Difícil</span>
                <span className="type-toggle-desc">Carreiras superiores</span>
              </button>
              <button
                className={`type-toggle-btn ${dificuldade === 'extremo' ? 'active' : ''}`}
                onClick={() => setDificuldade('extremo')}
                type="button"
                style={{ flex: 1 }}
              >
                <span className="type-toggle-label">Extremo 🔥</span>
                <span className="type-toggle-desc">Perito & Delegado</span>
              </button>
            </div>
          </div>
        )}

        {/* Live database count badge */}
        {source === 'banco' && dbCount !== null && (
          <p className="text-center" style={{
            fontSize: '11px',
            marginBottom: 'var(--space-md)',
            fontFamily: 'Rajdhani',
            fontWeight: 700,
            color: dbCount > 0 ? 'var(--success)' : 'var(--error)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {dbCount > 0 
              ? `✓ ENCONTRADAS ${dbCount} QUESTÕES ${totalGlobalCount !== null ? `(DE ${totalGlobalCount} NO BANCO TOTAL)` : ''}` 
              : `⚠️ NENHUMA QUESTÃO ENCONTRADA COM ESTE PERFIL NO BANCO`
            }
          </p>
        )}

        {error && (
          <div className="form-error" style={{ marginBottom: 'var(--space-md)' }}>
            ⚠️ {error}
          </div>
        )}

        {dbError && (
          <div className="form-error" style={{ marginBottom: 'var(--space-md)' }}>
            ⚠️ {dbError}
          </div>
        )}

        {/* Generate / Start Button */}
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={handleGenerate}
          disabled={!canGenerate || (source === 'banco' && dbCount === 0)}
          style={{ height: '40px', fontSize: '13px' }}
        >
          {generating || dbLoading ? (
            <>
              <Loader size={16} className="loading-spinner" style={{ width: 16, height: 16, border: 'none', borderTop: 'none' }} />
              <span>{generating ? 'Gerando questões com IA...' : 'Buscando no banco...'}</span>
            </>
          ) : (
            <>
              {source === 'ia' ? <Zap size={16} /> : <Database size={16} />}
              <span>{source === 'ia' ? `Gerar ${quantidade} Questões` : `Iniciar Simulado (${quantidade} Questões)`}</span>
            </>
          )}
        </button>

        {generating && (
          <p className="text-muted text-center" style={{ fontSize: '10px', marginTop: 'var(--space-md)', textTransform: 'uppercase' }}>
            A IA está elaborando as questões. Tempo estimado: 15-20s.
          </p>
        )}
      </div>

      {/* Modal: Nova Disciplina */}
      {showNewDisc && (
        <div className="modal-overlay" onClick={() => setShowNewDisc(false)}>
          <div className="modal-content-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-border">
              <span className="modal-title-text">Nova Disciplina</span>
              <button className="btn btn-ghost" style={{ padding: 0, width: 24, height: 24 }} onClick={() => setShowNewDisc(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateDisc}>
              <div className="modal-body-scroll">
                <div className="form-group">
                  <label className="form-label">Nome da disciplina</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Direito Administrativo"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer-border">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewDisc(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
                  <Plus size={12} />
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Tema */}
      {showNewTema && (
        <div className="modal-overlay" onClick={() => setShowNewTema(false)}>
          <div className="modal-content-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-border">
              <span className="modal-title-text">Novo Tema</span>
              <button className="btn btn-ghost" style={{ padding: 0, width: 24, height: 24 }} onClick={() => setShowNewTema(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTema}>
              <div className="modal-body-scroll">
                <div className="form-group">
                  <label className="form-label">Nome do tema</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Atos Administrativos"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                  <p className="form-help">
                    Inserir sob a disciplina: {selectedDisc?.nome}
                  </p>
                </div>
              </div>
              <div className="modal-footer-border">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewTema(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
                  <Plus size={12} />
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
