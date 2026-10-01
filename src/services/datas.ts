import { Evento } from '../types';
import { instanteDoEventoLocal, paraISOLocal } from '../../shared/datas';

/**
 * Datas do app.
 *
 * As funções puras de data vivem em `shared/datas.ts`, usadas também pela função
 * serverless. Aqui ficam as que dependem do tipo `Evento`.
 * As compartilhadas são reexportadas para preservar os caminhos de import.
 */
export {
  FUSO_BRASIL,
  paraISOLocal,
  hojeISO,
  somaDiasISO,
  mesAtualISO,
  formatarDataBR,
  formatarDataCurta,
  interpretarDataBR,
  inferirAno,
  instanteDoEventoLocal
} from '../../shared/datas';

export type { DataHoraInterpretada } from '../../shared/datas';

/** Instante final do evento como Date local. */
export function instanteDoEvento(evento: Pick<Evento, 'data' | 'hora' | 'hora_fim'>): Date {
  return instanteDoEventoLocal(evento);
}

/**
 * Um evento está encerrado quando já passou do seu horário final.
 * Combinado com `status: 'encerrado'` vindo da fonte oficial.
 */
export function estaEncerrado(evento: Evento, agora: Date = new Date()): boolean {
  if (evento.status === 'encerrado') return true;
  const fim = instanteDoEvento(evento);
  if (Number.isNaN(fim.getTime())) return false;
  return fim.getTime() < agora.getTime();
}

/** Ordenação canônica da agenda: data/hora crescente, com desempate estável. */
export function compararPorDataHora(a: Evento, b: Evento): number {
  const porData = (a.data || '').localeCompare(b.data || '');
  if (porData !== 0) return porData;
  const porHora = (a.hora || '').localeCompare(b.hora || '');
  if (porHora !== 0) return porHora;
  return (a.id || '').localeCompare(b.id || '');
}

/** Rótulo legível do status, para uso direto na interface. */
export function rotuloStatus(
  evento: Evento,
  agora: Date = new Date()
): { texto: string; tom: 'positivo' | 'alerta' | 'neutro' } {
  if (evento.status === 'cancelado') return { texto: 'Cancelado', tom: 'alerta' };
  if (evento.status === 'adiado') return { texto: 'Adiado', tom: 'alerta' };
  if (estaEncerrado(evento, agora)) return { texto: 'Já realizado', tom: 'neutro' };
  return { texto: 'Confirmado', tom: 'positivo' };
}

/** true quando o prazo de contribuição ainda está aberto. */
export function prazoAberto(evento: Evento, agora: Date = new Date()): boolean {
  if (!evento.prazo_contribuicao) return false;
  return evento.prazo_contribuicao >= paraISOLocal(agora);
}
