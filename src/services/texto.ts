import { Evento } from '../types';
import { contemTodosOsTermos, limparTexto, normalizar } from '../../shared/texto';

/**
 * Busca textual do app.
 *
 * `normalizar` e `contemTodosOsTermos` vêm de `shared/texto.ts` — o MESMO módulo
 * usado pela função serverless. Assim a busca da tela e a classificação no
 * servidor nunca divergem. Reexportados aqui para preservar os caminhos de
 * import existentes.
 */
export { normalizar, contemTodosOsTermos, limparTexto };

/**
 * Campos de um evento considerados na busca textual.
 * Exportado para que qualquer realce de termo use exatamente a mesma definição.
 */
export function camposBuscaveis(evento: Evento): string {
  return [
    evento.tema,
    evento.comissao,
    evento.local,
    evento.casa_nome,
    evento.casa,
    evento.uf,
    (evento.proposicoes_relacionadas || []).join(' ')
  ]
    .filter(Boolean)
    .join(' ');
}

/** Busca textual de um evento, insensível a acentos e a caixa. */
export function eventoCorrespondeBusca(evento: Evento, termo: string): boolean {
  const termoNormalizado = normalizar(termo);
  if (!termoNormalizado) return true;
  return contemTodosOsTermos(camposBuscaveis(evento), termoNormalizado);
}

/** Gera um resumo curto e determinístico, para título de calendário. */
export function resumir(texto: string, limite = 80): string {
  return limparTexto(texto, limite);
}
