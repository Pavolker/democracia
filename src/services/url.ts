import { FiltrosState, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO } from './config';

/**
 * Estado da interface na URL.
 *
 * MOTIVO: até então a aba e os filtros viviam só em `useState`, então não
 * existia forma de compartilhar um recorte — "as audiências de MG desta semana"
 * não era um link. Para uma ferramenta cívica, o link é o principal vetor de
 * circulação. Usamos o fragmento (`#`) porque o app é estático e não tem
 * servidor para tratar rotas.
 */

const SEPARADOR_LISTA = ',';

const PERIODOS_VALIDOS = ['todos', 'hoje', 'amanha', 'semana', 'mes', 'personalizado'] as const;
const SITUACOES_VALIDAS = ['proximos', 'todos'] as const;

const ABAS_VALIDAS = ['eventos', 'mapa', 'calendario', 'favoritos', 'alertas', 'comparador', 'fontes'] as const;
export type AbaURL = (typeof ABAS_VALIDAS)[number];

export function ehAbaValida(valor: string): valor is AbaURL {
  return (ABAS_VALIDAS as readonly string[]).includes(valor);
}

/** Lê o fragmento da URL e devolve o que for válido. */
export function lerEstadoURL(hash: string): { aba?: AbaURL; filtros: Partial<FiltrosState> } {
  const limpo = (hash || '').replace(/^#/, '');
  if (!limpo) return { filtros: {} };

  const params = new URLSearchParams(limpo);
  const filtros: Partial<FiltrosState> = {};

  const aba = params.get('aba');
  const uf = params.get('uf');
  const periodo = params.get('periodo');
  const busca = params.get('q');
  const casa = params.get('casa');
  const nivel = params.get('nivel');
  const situacao = params.get('sit');
  const inicio = params.get('de');
  const fim = params.get('ate');

  if (uf) filtros.uf = uf.toUpperCase();
  if (periodo && (PERIODOS_VALIDOS as readonly string[]).includes(periodo)) {
    filtros.periodo = periodo as FiltrosState['periodo'];
  }
  if (busca) filtros.busca = busca;
  if (casa) filtros.casa = casa;
  if (nivel) filtros.nivel = nivel;
  if (situacao && (SITUACOES_VALIDAS as readonly string[]).includes(situacao)) {
    filtros.situacao = situacao as FiltrosState['situacao'];
  }
  if (inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio)) filtros.dataInicio = inicio;
  if (fim && /^\d{4}-\d{2}-\d{2}$/.test(fim)) filtros.dataFim = fim;

  const mecanismos = params.get('mec');
  if (mecanismos !== null) {
    const validos = mecanismos
      .split(SEPARADOR_LISTA)
      .filter((m): m is MecanismoParticipacao => m in MECANISMOS_INFO);
    // `mec=` vazio significa "nenhum mecanismo marcado" — respeitamos isso em
    // vez de silenciosamente voltar para "todos".
    filtros.mecanismos = validos;
  }

  return { aba: aba && ehAbaValida(aba) ? aba : undefined, filtros };
}

/** Serializa o estado atual, omitindo o que já é padrão para manter o link curto. */
export function escreverEstadoURL(aba: string, filtros: FiltrosState): string {
  const params = new URLSearchParams();
  params.set('aba', aba);

  if (filtros.uf && filtros.uf !== 'TODAS') params.set('uf', filtros.uf);
  if (filtros.periodo !== 'todos') params.set('periodo', filtros.periodo);
  if (filtros.dataInicio) params.set('de', filtros.dataInicio);
  if (filtros.dataFim) params.set('ate', filtros.dataFim);
  if (filtros.busca.trim()) params.set('q', filtros.busca.trim());
  if (filtros.casa) params.set('casa', filtros.casa);
  if (filtros.nivel) params.set('nivel', filtros.nivel);
  if (filtros.situacao === 'todos') params.set('sit', 'todos');

  const todosMecanismos = Object.keys(MECANISMOS_INFO);
  if (filtros.mecanismos.length !== todosMecanismos.length) {
    params.set('mec', filtros.mecanismos.join(SEPARADOR_LISTA));
  }

  return params.toString();
}
