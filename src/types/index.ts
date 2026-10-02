/**
 * O tipo do mecanismo é definido em `shared/mecanismos.ts` porque a função
 * serverless precisa da MESMA definição: um adaptador que devolvesse um valor
 * fora desta união tem que falhar na compilação, não em produção.
 */
import type { MecanismoParticipacao } from '../../shared/mecanismos';
export type { MecanismoParticipacao };

/**
 * Níveis de casa legislativa.
 * `distrital` cobre a CLDF (Câmara Legislativa do Distrito Federal), que não é
 * nem estadual nem municipal.
 */
export type NivelLegislativo = 'federal' | 'estadual' | 'distrital' | 'municipal';

export type TipoReuniao = 'presencial' | 'virtual' | 'hibrida';

export type StatusEvento = 'confirmado' | 'cancelado' | 'adiado' | 'encerrado';

/**
 * Procedência do registro:
 * - `ao_vivo`: obtido exclusivamente de fonte oficial em tempo de execução.
 */
export type OrigemEvento = 'ao_vivo';

export interface Evento {
  id: string;
  mecanismo: MecanismoParticipacao;
  uf: string;
  casa: string;
  casa_nome: string;
  nivel: NivelLegislativo;
  local: string;
  data: string; // YYYY-MM-DD (horário local de Brasília)
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
  origem: OrigemEvento;
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
  /** 'proximos' esconde eventos já encerrados; 'todos' inclui o histórico. */
  situacao?: 'proximos' | 'todos';
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
  /**
   * `integrada`: o app realmente consulta esta fonte.
   * `pendente`: fonte catalogada, mas a coleta ainda não foi implementada.
   * Nunca marcar como integrada uma fonte que não é consultada.
   */
  integracao: 'integrada' | 'pendente';
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
