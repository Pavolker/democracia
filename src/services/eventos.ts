import { Evento, FiltrosState, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO } from './config';
import { eventoCorrespondeBusca, normalizar } from './texto';
import { estaEncerrado, hojeISO, mesAtualISO, somaDiasISO } from './datas';

/**
 * Regras de domínio dos eventos, extraídas de App.tsx.
 *
 * Motivo: o app misturava três coisas diferentes no mesmo componente
 * (procedência do dado, filtragem e agregação), o que tornava impossível
 * garantir que uma exportação não levasse dados de demonstração junto.
 * Aqui tudo é função pura e testável.
 */

/** Todo evento de demonstração carrega a marca `origem: 'demonstracao'`. */
export function ehDemonstracao(evento: Evento): boolean {
  return evento.origem === 'demonstracao';
}

/** Eventos exibidos: os reais, mais os de demonstração apenas quando ligados. */
export function separarPorOrigem(eventos: Evento[]): {
  reais: Evento[];
  demonstracao: Evento[];
} {
  const reais: Evento[] = [];
  const demonstracao: Evento[] = [];
  for (const e of eventos) {
    (ehDemonstracao(e) ? demonstracao : reais).push(e);
  }
  return { reais, demonstracao };
}

/**
 * Dados liberados para exportação (CSV/JSON/ICS).
 * Amostras de demonstração NUNCA saem daqui: uma planilha baixada não tem
 * como carregar o selo "Exemplo" que a tela carrega.
 */
export function filtrarParaExportacao(eventos: Evento[]): Evento[] {
  return eventos.filter((e) => !ehDemonstracao(e));
}

/** Chave de agregação por localidade: o Congresso não é o Distrito Federal. */
export function chaveUF(evento: Evento): string {
  return evento.nivel === 'federal' ? 'FEDERAL' : evento.uf;
}

export function contarPorUF(eventos: Evento[]): Record<string, number> {
  return eventos.reduce((acc, ev) => {
    const chave = chaveUF(ev);
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export function casasDisponiveis(eventos: Evento[]): string[] {
  return Array.from(new Set(eventos.map((e) => e.casa).filter(Boolean))).sort();
}

/**
 * Pipeline de filtragem da agenda.
 * `agora` é injetável para permitir teste determinístico.
 */
export function filtrarEventos(
  eventos: Evento[],
  filtros: FiltrosState,
  agora: Date = new Date()
): Evento[] {
  const hoje = hojeISO();
  const amanha = somaDiasISO(1, agora);
  const em7Dias = somaDiasISO(7, agora);
  const mesAtual = mesAtualISO();
  const incluirHistorico = filtros.situacao === 'todos';

  return eventos.filter((ev) => {
    // 0. Por padrão escondemos o que já aconteceu: a tela promete
    //    "oportunidades de participação", não um arquivo morto.
    if (!incluirHistorico && estaEncerrado(ev, agora)) return false;

    // 1. Localidade. 'FEDERAL' é escopo nacional; 'DF' é a CLDF.
    if (filtros.uf && filtros.uf !== 'TODAS') {
      if (filtros.uf === 'FEDERAL') {
        if (ev.nivel !== 'federal') return false;
      } else if (ev.nivel === 'federal' || ev.uf !== filtros.uf) {
        return false;
      }
    }

    // 2. Mecanismo
    if (!filtros.mecanismos.includes(ev.mecanismo)) return false;

    // 3. Período
    switch (filtros.periodo) {
      case 'hoje':
        if (ev.data !== hoje) return false;
        break;
      case 'amanha':
        if (ev.data !== amanha) return false;
        break;
      case 'semana':
        if (ev.data < hoje || ev.data > em7Dias) return false;
        break;
      case 'mes':
        if (!ev.data.startsWith(mesAtual)) return false;
        break;
      case 'personalizado':
        if (filtros.dataInicio && ev.data < filtros.dataInicio) return false;
        if (filtros.dataFim && ev.data > filtros.dataFim) return false;
        break;
      default:
        break;
    }

    // 4. Casa
    if (filtros.casa && ev.casa !== filtros.casa) return false;

    // 5. Nível
    if (filtros.nivel && ev.nivel !== filtros.nivel) return false;

    // 6. Busca textual (sem acento)
    if (!eventoCorrespondeBusca(ev, filtros.busca)) return false;

    return true;
  });
}

/** Estado inicial de filtros: todos os mecanismos, sem recorte. */
export function filtrosIniciais(): FiltrosState {
  return {
    uf: 'TODAS',
    mecanismos: Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[],
    periodo: 'todos',
    busca: '',
    casa: '',
    nivel: '',
    situacao: 'proximos'
  };
}

/**
 * Correspondência de um alerta cidadão com um evento.
 * Antes a busca era `tema.includes(termo)` puro, o que fazia alertas de várias
 * palavras quase nunca casarem. Agora usa o mesmo normalizador da busca.
 */
export function eventoCorrespondeAlerta(evento: Evento, alertaTema: string, alertaUF: string): boolean {
  if (!eventoCorrespondeBusca(evento, alertaTema)) return false;
  if (alertaUF && alertaUF !== 'TODAS') {
    const chave = chaveUF(evento);
    if (chave !== alertaUF) return false;
  }
  return true;
}

/** Contagem por mecanismo, para o painel de estatísticas. */
export function contarPorMecanismo(eventos: Evento[]): Record<MecanismoParticipacao, number> {
  const base = Object.keys(MECANISMOS_INFO).reduce((acc, k) => {
    acc[k as MecanismoParticipacao] = 0;
    return acc;
  }, {} as Record<MecanismoParticipacao, number>);
  for (const ev of eventos) {
    if (base[ev.mecanismo] !== undefined) base[ev.mecanismo] += 1;
  }
  return base;
}

export { normalizar };
