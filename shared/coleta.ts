/**
 * Tipos do contrato entre a função serverless e o front-end.
 *
 * Ficam em `shared/` para que os dois lados compilem contra a MESMA definição:
 * uma divergência aqui apareceria como evento sem data na tela.
 */

export type SituacaoCasa =
  /** Tem adaptador implementado e testado contra o portal. */
  | 'verificado'
  /** O portal responde, mas a coleta ainda não foi escrita. */
  | 'nao_implementado'
  /** O portal recusa clientes que não sejam navegador. */
  | 'bloqueado'
  /** A listagem só existe depois de executar JavaScript. */
  | 'somente_js'
  /** A agenda é publicada apenas como PDF. */
  | 'somente_pdf'
  /** Não foi encontrada uma listagem de agenda no portal. */
  | 'sem_agenda'
  /** URL desconhecida, domínio fora do ar ou erro persistente. */
  | 'indisponivel';

export type StatusColeta = 'sucesso' | 'vazio' | 'erro' | 'nao_implementado';

/** Um evento como sai de um adaptador, antes de virar `Evento` no front. */
export interface EventoBruto {
  /** YYYY-MM-DD, em horário local de Brasília. */
  data: string;
  /** HH:MM quando a fonte informa. */
  hora?: string;
  tema: string;
  local?: string;
  comissao?: string;
  /** Mecanismo atribuído pelo adaptador (nunca por padrão). */
  mecanismo: string;
  link?: string;
  /** Link de participação/inscrição, quando a fonte publica um específico. */
  inscricao?: string;
  proposicoes?: string[];
}

export interface ResultadoCasa {
  uf: string;
  sigla: string;
  nome: string;
  situacao: SituacaoCasa;
  status: StatusColeta;
  eventos: EventoBruto[];
  /** Registros lidos que não são nenhum dos 5 mecanismos. */
  ignorados: number;
  urlConsultada?: string;
  tempoMs: number;
  mensagem?: string;
}

export interface RespostaAgenda {
  gerado_em: string;
  fuso: string;
  /** De onde veio esta resposta, para o app poder exibir procedência. */
  fonte: string;
  /** Quantas casas têm coleta ativa nesta versão. */
  casasIntegradas: number;
  totalCasas: number;
  eventos: number;
  casas: ResultadoCasa[];
}
