// Extensão explícita: este módulo é carregado pelo Vite, pelo esbuild da Netlify
// E pelo Node puro (nos testes). O Node não resolve import sem extensão.
import { normalizar } from './texto.ts';

/**
 * Mecanismos de participação — a definição canônica, compartilhada entre o
 * front-end e a função serverless.
 *
 * `classificarMecanismo` é deliberadamente CONSERVADORA: devolve `null` para
 * qualquer registro que não seja comprovadamente um dos cinco mecanismos. A
 * versão anterior usava `audiencia_publica` como padrão, o que fazia
 * "Sorteio de vagas para o Estágio-Visita" virar audiência pública. Na dúvida,
 * é melhor não exibir do que exibir errado — e quem chama conta os descartes.
 */

export type MecanismoParticipacao =
  | 'audiencia_publica'
  | 'consulta_publica'
  | 'sugestao_legislativa'
  | 'dialogo_social_plenaria'
  | 'ordem_dia_tribuna_livre';

export const MECANISMOS: readonly MecanismoParticipacao[] = [
  'audiencia_publica',
  'consulta_publica',
  'sugestao_legislativa',
  'dialogo_social_plenaria',
  'ordem_dia_tribuna_livre'
] as const;

/**
 * Regras de classificação, em ordem de prioridade.
 *
 * Nota sobre "Ordem do Dia": a expressão solta NÃO classifica. Toda reunião
 * deliberativa a traz na pauta, então aceitá-la rotulava sessão deliberativa
 * comum como espaço de fala cidadã. O mecanismo exige os marcadores de fala da
 * comunidade (tribuna, pequeno expediente, inscrição de oradores).
 */
export function classificarMecanismo(texto: string | null | undefined): MecanismoParticipacao | null {
  // `_` vira espaço porque APIs publicam o mecanismo como valor de enum
  // ("audiencia_publica"). Sem isso, o campo tipado da fonte — que é a
  // melhor evidência possível — não casaria com nenhuma regra.
  const t = normalizar(texto).replace(/_/g, ' ');
  if (!t) return null;

  // Só marcadores de fala DA COMUNIDADE classificam aqui.
  // `pequeno expediente` e `inscrição de oradores` foram REMOVIDOS: nas
  // assembleias estaduais ambos são espaço de fala de DEPUTADOS, não de
  // cidadãos, e mantê-los rotulava sessão plenária comum como tribuna livre.
  if (/tribuna livre|tribuna popular|tribuna cidada/.test(t)) {
    return 'ordem_dia_tribuna_livre';
  }
  if (/sugestao legislativa|ideia legislativa|iniciativa popular|sugestoes populares|sugestao popular/.test(t)) {
    return 'sugestao_legislativa';
  }
  // `publi` em vez de `publica`: portais oficiais publicam títulos com erro de
  // digitação (a ALESP tem "AUDIÊNCIA PÚBLIA"), e exigir a palavra inteira
  // descartaria audiências reais.
  if (/consulta publi|tomada de subsidios|contribuicoes a minuta/.test(t)) {
    return 'consulta_publica';
  }
  // `dialogo` sozinho é aceito de propósito: o mecanismo se chama "Diálogo
  // Social" e algumas casas dão nome próprio aos seus encontros (a ALECE tem o
  // programa "Alece Diálogo"). Exigir "diálogo social" literal perderia esses
  // eventos, que são exatamente o mecanismo em questão.
  if (/comissao geral|dialogo|plenaria popular|plenaria social|plenaria nacional|plenaria tematica/.test(t)) {
    return 'dialogo_social_plenaria';
  }
  if (/audiencia publi/.test(t)) {
    return 'audiencia_publica';
  }
  return null;
}

/**
 * Descarta registros de teste publicados pelas próprias casas.
 * A API da Câmara contém itens como "AUDIENCIA TESTE / AUDIENCIA PUBLICA TESTE";
 * exibi-los como oportunidade de participação seria enganoso.
 */
export function pareceRegistroDeTeste(...campos: (string | undefined | null)[]): boolean {
  return campos.some((c) => /\bteste\b|\btestes\b|homologacao|exemplo de pauta|simulacao de audiencia|audiencia simulada/i.test(normalizar(c || '')));
}
