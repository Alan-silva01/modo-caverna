export interface Disciplina {
  id: string;
  nome: string;
  user_id: string | null;
  created_at: string;
}

export interface Tema {
  id: string;
  disciplina_id: string;
  nome: string;
  user_id: string | null;
  created_at: string;
}

export type TipoQuestao = 'certo_errado' | 'multipla_escolha';

export interface Questao {
  id: string;
  user_id: string;
  disciplina_id: string;
  tema_id: string;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: string[] | null;
  gabarito: string;
  justificativa: string;
  banca_estilo: string;
  created_at: string;
}

export interface RespostaUsuario {
  id: string;
  user_id: string;
  questao_id: string;
  resposta_dada: string;
  acertou: boolean;
  respondido_em: string;
}

export interface GenerateRequest {
  disciplina: string;
  tema: string;
  disciplina_id: string;
  tema_id: string;
  quantidade: number;
  tipo: TipoQuestao;
}

export interface QuestaoGerada {
  enunciado: string;
  tipo: TipoQuestao;
  alternativas: string[] | null;
  gabarito: string;
  justificativa: string;
}

export interface EstatisticaDisciplina {
  disciplina_id: string;
  disciplina_nome: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface EstatisticaTema {
  tema_id: string;
  tema_nome: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface EstatisticaDificuldade {
  dificuldade: 'extremo' | 'dificil' | 'medio';
  label: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface EstatisticaTipo {
  tipo: TipoQuestao;
  label: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface SessaoHistorico {
  data: string;
  disciplina_nome: string;
  tema_nome: string;
  tipo: TipoQuestao;
  total: number;
  acertos: number;
  percentual: number;
}
