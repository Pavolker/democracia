import type { Adaptador } from './adaptadores.mts';
import { adaptadorNaoImplementado } from './adaptadores.mts';
import type { SituacaoCasa } from '../../../shared/coleta.ts';
import { ADAPTADORES } from './casas.mts';

/**
 * Registro das casas legislativas subnacionais.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTE ARQUIVO É A FONTE DA VERDADE SOBRE O QUE O APP COLETA.
 *
 * Cada entrada declara explicitamente o seu estado. `adaptadorNaoImplementado`
 * existe para que seja impossível uma casa aparecer como operacional sem ter um
 * parser testado contra o portal real: só `adaptadorDeTabela` (ou outro
 * adaptador com `situacao: 'verificado'`) executa de fato, e a função reporta o
 * estado declarado de cada uma para a interface.
 *
 * Histórico: a versão anterior deste produto exibia 27 assembleias como
 * "sucesso" no painel de fontes sem nunca ter feito uma requisição a nenhuma
 * delas. Aquele comportamento não pode voltar, e a barreira agora é de tipo.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** As 27 casas subnacionais, na ordem usada pelo app. */
const CASAS: Array<{ uf: string; sigla: string; nome: string }> = [
  { uf: 'AC', sigla: 'ALEAC', nome: 'Assembleia Legislativa do Acre' },
  { uf: 'AL', sigla: 'ALEAL', nome: 'Assembleia Legislativa de Alagoas' },
  { uf: 'AM', sigla: 'ALEAM', nome: 'Assembleia Legislativa do Amazonas' },
  { uf: 'AP', sigla: 'ALEAP', nome: 'Assembleia Legislativa do Amapá' },
  { uf: 'BA', sigla: 'ALBA', nome: 'Assembleia Legislativa da Bahia' },
  { uf: 'CE', sigla: 'ALECE', nome: 'Assembleia Legislativa do Ceará' },
  { uf: 'DF', sigla: 'CLDF', nome: 'Câmara Legislativa do Distrito Federal' },
  { uf: 'ES', sigla: 'ALES', nome: 'Assembleia Legislativa do Espírito Santo' },
  { uf: 'GO', sigla: 'ALEGO', nome: 'Assembleia Legislativa de Goiás' },
  { uf: 'MA', sigla: 'ALEMA', nome: 'Assembleia Legislativa do Maranhão' },
  { uf: 'MG', sigla: 'ALMG', nome: 'Assembleia Legislativa de Minas Gerais' },
  { uf: 'MS', sigla: 'ALEMS', nome: 'Assembleia Legislativa de Mato Grosso do Sul' },
  { uf: 'MT', sigla: 'ALMT', nome: 'Assembleia Legislativa de Mato Grosso' },
  { uf: 'PA', sigla: 'ALEPA', nome: 'Assembleia Legislativa do Pará' },
  { uf: 'PB', sigla: 'ALPB', nome: 'Assembleia Legislativa da Paraíba' },
  { uf: 'PE', sigla: 'ALEPE', nome: 'Assembleia Legislativa de Pernambuco' },
  { uf: 'PI', sigla: 'ALEPI', nome: 'Assembleia Legislativa do Piauí' },
  { uf: 'PR', sigla: 'ALEP', nome: 'Assembleia Legislativa do Paraná' },
  { uf: 'RJ', sigla: 'ALERJ', nome: 'Assembleia Legislativa do Rio de Janeiro' },
  { uf: 'RN', sigla: 'ALRN', nome: 'Assembleia Legislativa do Rio Grande do Norte' },
  { uf: 'RO', sigla: 'ALERO', nome: 'Assembleia Legislativa de Rondônia' },
  { uf: 'RR', sigla: 'ALERR', nome: 'Assembleia Legislativa de Roraima' },
  { uf: 'RS', sigla: 'ALRS', nome: 'Assembleia Legislativa do Rio Grande do Sul' },
  { uf: 'SC', sigla: 'ALESC', nome: 'Assembleia Legislativa de Santa Catarina' },
  { uf: 'SE', sigla: 'ALESE', nome: 'Assembleia Legislativa de Sergipe' },
  { uf: 'SP', sigla: 'ALESP', nome: 'Assembleia Legislativa de São Paulo' },
  { uf: 'TO', sigla: 'ALETO', nome: 'Assembleia Legislativa do Tocantins' }
];

/**
 * Casas cujo estado foi VERIFICADO contra o portal, mas que não entram na
 * coleta — porque o portal simplesmente não publica audiências públicas.
 *
 * Registrar isso é tão importante quanto implementar um adaptador: sem estas
 * entradas, essas casas apareceriam como "ainda não mapeadas", sugerindo que
 * basta alguém escrever o parser. Não basta — foi verificado que não há o que
 * coletar. Cada observação abaixo tem evidência HTTP por trás.
 */
const VERIFICADAS_SEM_FONTE: Record<string, { situacao: SituacaoCasa; observacao: string }> = {
  PA: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: o portal não publica agenda de audiências. Não há rota de agenda (404) nem ocorrência da palavra "audiência" na página inicial; o único material disponível é a pauta do plenário e PDFs de convocação de comissão.'
  },
  RN: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: não foi encontrada agenda no portal. A página "audiência pública" existe mas é texto explicativo sem nenhuma data, e não há rota de agenda, calendário, evento ou pauta.'
  },
  SC: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: o portal publica agenda de eventos e de comissões, mas NENHUMA audiência pública — a busca do próprio portal devolve zero resultados para "audiência" enquanto devolve 22 para "reunião".'
  },
  SE: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: a agenda está indisponível por restrição legal de período eleitoral (o portal serve uma página de conteúdo suspenso com HTTP 200) e o calendário de eventos está vazio desde 2023.'
  },
  AC: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: a casa mantém uma instância SAPL, mas a coleção de audiências tem um único registro (fev/2025) e a de reuniões de comissão está vazia. Não há agenda corrente.'
  },
  AL: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: o calendário de eventos do portal está parado — o último registro é de fevereiro de 2016 e a consulta por eventos futuros devolve vazio. A instância SAPL da casa tem zero audiências e zero reuniões.'
  },
  AM: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: a instância SAPL da casa tem 74 reuniões de comissão recentes, mas ZERO audiências públicas, e a agenda do portal não oferece categoria de audiência.'
  },
  AP: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: o portal publica apenas pautas de sessões plenárias. Nenhuma audiência pública foi encontrada no site nem no sistema legislativo da casa.'
  },
  BA: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: o filtro "Audiência Pública" existe no sistema de sessões da casa, mas devolve zero registros — o mesmo filtro, testado com "Ordinária", devolve 217 páginas, ou seja, o filtro funciona e a ausência é real. As informações institucionais do portal estão legalmente suspensas por período eleitoral até 25/10/2026.'
  },
  ES: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: a casa publica um registro de eventos de 2017 até HOJE, sem nenhum evento futuro — ou seja, é histórico, não agenda. Não serve para acompanhar o que vai acontecer.'
  },
  MA: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: não existe audiência pública em nenhum endpoint do portal. A página dedicada a audiências é um bloco vazio e o sistema legislativo não tem cadastro desse tipo de evento. O que existe é a Ordem do Dia das sessões, que não é um dos cinco mecanismos.'
  },
  TO: {
    situacao: 'sem_agenda',
    observacao:
      'Verificado: a API de audiências existe e responde, porém com zero registros desde sempre — a tabela de tipos está preenchida, mas nenhuma audiência foi cadastrada.'
  }
};

/** Monta a lista final: adaptadores implementados + casas sem fonte + a catalogar. */
export function montarRegistro(): Adaptador[] {
  const implementados = new Map(ADAPTADORES.map((a) => [a.uf, a]));

  return CASAS.map((casa) => {
    const implementado = implementados.get(casa.uf);
    if (implementado) return implementado;

    const semFonte = VERIFICADAS_SEM_FONTE[casa.uf];
    if (semFonte) {
      return adaptadorNaoImplementado(casa.uf, casa.sigla, casa.nome, semFonte.observacao, semFonte.situacao);
    }

    return adaptadorNaoImplementado(casa.uf, casa.sigla, casa.nome, OBSERVACAO_PADRAO);
  });
}

export function ufsDisponiveis(): string[] {
  return CASAS.map((c) => c.uf);
}

export { CASAS };

/** Observação padrão de casa catalogada cujo portal ainda não foi mapeado. */
const OBSERVACAO_PADRAO =
  'Casa catalogada. A agenda deste portal ainda não foi mapeada, então nenhuma requisição é feita a ele.';
