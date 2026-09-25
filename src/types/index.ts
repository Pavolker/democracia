export type MecanismoParticipacao = 
  | 'audiencia_publica'
  | 'consulta_publica'
  | 'sugestao_legislativa'
  | 'dialogo_social_plenaria'
  | 'ordem_dia_tribuna_livre';

export type NivelLegislativo = 'federal' | 'estadual' | 'municipal';

export type TipoReuniao = 'presencial' | 'virtual' | 'hibrida';

export type StatusEvento = 'confirmado' | 'cancelado' | 'adiado';

export interface Evento {
  id: string;
  mecanismo: MecanismoParticipacao;
  uf: string;
  casa: string;
  casa_nome: string;
  nivel: NivelLegislativo;
  local: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  hora_fim?: string;
  tema: string;
  comissao?: string;
  tipo_reuniao: TipoReuniao;
  link_oficial: string;
  link_transmissao?: string;
  inscricao?: string;
  prazo_contribuicao?: string;
  proposicoes_relacionadas?: string[];
  status: StatusEvento;
  data_extracao: string;
  fonte: string;
  isNew?: boolean;
}

export interface AlertaCidadao {
  id: string;
  tema: string;
  uf: string;
  mecanismo?: MecanismoParticipacao | 'todos';
  ativo: boolean;
  data_criacao: string;
}

export interface FiltrosState {
  uf: string; // 'TODAS' | 'FEDERAL' | 'SP' | etc.
  mecanismos: MecanismoParticipacao[];
  periodo: 'todos' | 'hoje' | 'amanha' | 'semana' | 'mes' | 'personalizado';
  dataInicio?: string;
  dataFim?: string;
  busca: string;
  casa?: string;
  nivel?: string;
}

export interface FonteConfig {
  uf: string;
  sigla: string;
  nome: string;
  urlBase: string;
  urlAgenda: string;
  tipo: 'api' | 'html' | 'rss';
  ativo: boolean;
  descricao?: string;
}

export interface ScraperStatus {
  fonteId: string;
  nome: string;
  uf: string;
  status: 'sucesso' | 'erro' | 'carregando' | 'pendente';
  totalEventos: number;
  mensagem?: string;
  tempoMs?: number;
  ultimaChecagem?: string;
}
