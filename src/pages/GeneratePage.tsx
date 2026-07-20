import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisciplinas } from '../hooks/useDisciplinas';
import { useTemas } from '../hooks/useTemas';
import { useQuestoes } from '../hooks/useQuestoes';
import type { TipoQuestao } from '../types';
import {
  Zap,
  Plus,
  X,
  CheckSquare,
  List,
  Loader,
} from 'lucide-react';

export default function GeneratePage() {
  const navigate = useNavigate();
  const { disciplinas, loading: loadingDisc, createDisciplina } = useDisciplinas();
  const [selectedDiscId, setSelectedDiscId] = useState('');
  const { temas, loading: loadingTemas, createTema } = useTemas(selectedDiscId || null);
  const [selectedTemaId, setSelectedTemaId] = useState('');
  const [quantidade, setQuantidade] = useState(10);
  const [tipo, setTipo] = useState<TipoQuestao>('certo_errado');
  const { generateQuestoes, loading: generating, error } = useQuestoes();

  // Modal states
  const [showNewDisc, setShowNewDisc] = useState(false);
  const [showNewTema, setShowNewTema] = useState(false);
  const [newName, setNewName] = useState('');

  const selectedDisc = disciplinas.find(d => d.id === selectedDiscId);
  const selectedTema = temas.find(t => t.id === selectedTemaId);

  const handleDiscChange = (id: string) => {
    if (id === '__new__') {
      setShowNewDisc(true);
      return;
    }
    setSelectedDiscId(id);
    setSelectedTemaId('');
  };

  const handleTemaChange = (id: string) => {
    if (id === '__new__') {
      setShowNewTema(true);
      return;
    }
    setSelectedTemaId(id);
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
    if (!selectedDisc || !selectedTema) return;

    const questoes = await generateQuestoes(
      selectedDisc.nome,
      selectedTema.nome,
      selectedDisc.id,
      selectedTema.id,
      quantidade,
      tipo
    );

    if (questoes && questoes.length > 0) {
      const ids = questoes.map(q => q.id).join(',');
      navigate(`/resolver?ids=${ids}`);
    }
  };

  const canGenerate = selectedDiscId && selectedTemaId && !generating;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Gerar Questões</h1>
        <p className="page-subtitle">IA CESPE/Cebraspe</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
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
            Tema
          </label>
          <select
            className="form-select"
            value={selectedTemaId}
            onChange={(e) => handleTemaChange(e.target.value)}
            disabled={!selectedDiscId || loadingTemas}
          >
            <option value="">
              {!selectedDiscId
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

        {error && (
          <div className="form-error" style={{ marginBottom: 'var(--space-md)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{ height: '40px', fontSize: '13px' }}
        >
          {generating ? (
            <>
              <Loader size={16} className="loading-spinner" style={{ width: 16, height: 16, border: 'none', borderTop: 'none' }} />
              <span>Gerando questões com IA...</span>
            </>
          ) : (
            <>
              <Zap size={16} />
              Gerar {quantidade} Questões
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
