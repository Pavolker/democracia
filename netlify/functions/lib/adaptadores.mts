import { classificarMecanismo, pareceRegistroDeTeste } from '../../../shared/mecanismos.ts';
import { interpretarDataBR, inferirAno } from '../../../shared/datas.ts';
import { limparTexto } from '../../../shared/texto.ts';
import type { EventoBruto, SituacaoCasa } from '../../../shared/coleta.ts';
import { buscarTexto, type OpcoesRequisicao } from './http.mts';
import { linhasDeTabela, primeiroLink, urlAbsoluta } from './html.mts';

/**
 * Framework dos adaptadores por casa legislativa.
 *
 * REGRA CENTRAL DESTE ARQUIVO: um adaptador só produz um evento quando tem, no
 * mínimo, uma data interpretável e um tema, e quando a classificação reconhece
 * um dos cinco mecanismos. Faltando qualquer um desses, o registro é contado
 * como descartado — nunca se completa lacuna com valor plausível. Foi
 * exatamente esse preenchimento automático que, na versão anterior, transformou
 * "Sorteio de vagas para o Estágio-Visita" em audiência pública.
 */

export interface ContextoExecucao {
  buscarTexto: typeof buscarTexto;
}

export interface Adaptador {
  uf: string;
  sigla: string;
  nome: string;
  /**
   * Estado declarado da coleta. Só um adaptador `verificado` executa: assim é
   * impossível "ligar" uma casa sem ter testado o parser contra o portal real.
   */
  situacao: SituacaoCasa;
  /** Por que está nesse estado — exibido no app. */
  observacao: string;
  /**
   * Teto de tempo específico desta casa, quando o portal é notoriamente lento.
   * Ex.: a CLDF responde em ~2 s do lado da aplicação, mas a conexão pode levar
   * dezenas de segundos. O teto padrão do orquestrador é menor que isso.
   */
  tetoMs?: number;
  /** Presente apenas quando `situacao === 'verificado'`. */
  executar?: (ctx: ContextoExecucao) => Promise<EventoBruto[]>;
}

export interface CandidatoEvento {
  /** Data no formato que o portal publica. Interpretada por `interpretarDataBR`. */
  dataBruta?: string;
  /** Hora, quando a página a informa em campo separado. */
  horaBruta?: string;
  tema?: string;
  comissao?: string;
  local?: string;
  link?: string | null;
  inscricao?: string | null;
  proposicoes?: string[];
  /** Texto adicional usado só na classificação (tipo da reunião, coluna "espécie"). */
  contextoMecanismo?: string;
}

/**
 * Valida e normaliza um candidato. Devolve `null` quando o registro não pode ser
 * publicado com honestidade.
 */
export function montarEventoBruto(candidato: CandidatoEvento): EventoBruto | null {
  const tema = limparTexto(candidato.tema, 400);
  if (tema.length < 5) return null;

  const dataLimpa = limparTexto(candidato.dataBruta, 60);
  const interpretada = interpretarDataBR(dataLimpa);
  if (!interpretada) return null;

  // Registros de teste publicados pelas próprias casas são descartados.
  if (pareceRegistroDeTeste(tema, candidato.comissao)) return null;

  const mecanismo = classificarMecanismo(
    [candidato.contextoMecanismo, tema, candidato.comissao].filter(Boolean).join(' ')
  );
  if (!mecanismo) return null;

  // A hora pode vir no campo separado ou embutida na data ("05/10/2026 14h30").
  let hora = interpretada.hora;
  if (!hora && candidato.horaBruta) {
    const doCampo = interpretarDataBR(`01/01/2000 ${limparTexto(candidato.horaBruta, 20)}`);
    hora = doCampo?.hora;
  }
  // 00:00 é usado por várias casas como "sem horário definido" (a ALESP publica
  // 00:00 em todo evento sem hora). Audiência legislativa à meia-noite não
  // existe: tratar como ausência é mais honesto do que exibir 00:00.
  if (hora === '00:00') hora = undefined;

  return {
    data: interpretada.data,
    hora,
    tema,
    local: limparTexto(candidato.local, 250) || undefined,
    comissao: limparTexto(candidato.comissao, 200) || undefined,
    mecanismo,
    link: candidato.link || undefined,
    inscricao: candidato.inscricao || undefined,
    proposicoes: candidato.proposicoes?.length ? candidato.proposicoes : undefined
  };
}

/** Rótulos de coluna aceitos ao procurar a coluna de data por cabeçalho. */
const ROTULOS = {
  data: ['data', 'dia', 'datas'],
  hora: ['hora', 'horario', 'hr'],
  tema: ['tema', 'assunto', 'titulo', 'descricao', 'evento', 'pauta', 'materia', 'objeto', 'finalidade'],
  comissao: ['comissao', 'orgao', 'colegiado', 'promotor', 'responsavel'],
  local: ['local', 'sala', 'plenario', 'auditorio', 'endereco'],
  tipo: ['tipo', 'especie', 'natureza', 'modalidade', 'categoria', 'classe']
} as const;

type ChaveRotulo = keyof typeof ROTULOS;

/**
 * Descobre o índice das colunas a partir do texto dos cabeçalhos.
 * Preferir isto a índices fixos: portais mudam a ordem das colunas sem avisar.
 */
export function mapearColunas(cabecalhos: string[]): Partial<Record<ChaveRotulo, number>> {
  const mapa: Partial<Record<ChaveRotulo, number>> = {};
  cabecalhos.forEach((texto, indice) => {
    const chave = limparTexto(texto, 40)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (const [campo, rotulos] of Object.entries(ROTULOS) as Array<[ChaveRotulo, readonly string[]]>) {
      if (mapa[campo] !== undefined) continue;
      if (rotulos.some((rotulo) => chave.includes(rotulo))) {
        mapa[campo] = indice;
        return;
      }
    }
  });
  return mapa;
}

export interface ConfigAdaptadorTabela {
  uf: string;
  sigla: string;
  nome: string;
  url: string;
  /** Base para resolver links relativos. */
  base: string;
  /**
   * Um `<tr>` só vira candidato se alguma célula/cabeçalho casar com o filtro.
   * Ex.: `/audiencia publica/` para páginas que listam toda a agenda da casa.
   */
  filtroDeLinha?: RegExp;
  opcoesHttp?: OpcoesRequisicao;
  /** Mecanismo fixo, quando a própria página já é específica de um mecanismo. */
  mecanismoFixo?: string;
  observacao: string;
  /**
   * Sobrescreve a extração quando a tabela não segue o padrão
   * data | hora | tema | comissão. Recebe as células já em texto.
   */
  extrairLinha?: (linha: string[], htmlLinha: string, base: string) => CandidatoEvento | null;
}

/**
 * Fábrica para as listagens em tabela, que são a maioria dos portais.
 * Mapeia as colunas pelos cabeçalhos e delega a validação a `montarEventoBruto`.
 */
export function adaptadorDeTabela(config: ConfigAdaptadorTabela): Adaptador {
  return {
    uf: config.uf,
    sigla: config.sigla,
    nome: config.nome,
    situacao: 'verificado',
    observacao: config.observacao,
    executar: async ({ buscarTexto: buscar }) => {
      const resposta = await buscar(config.url, config.opcoesHttp);
      const linhas = linhasDeTabela(resposta.corpo);
      if (linhas.length === 0) return [];

      const cabecalhos = linhas[0].celulas;
      const colunas = mapearColunas(cabecalhos);
      const eventos: EventoBruto[] = [];

      for (const linha of linhas) {
        if (linha.celulas.length < 2) continue;
        const brutoDaLinha = linha.celulas.join(' ');
        if (config.filtroDeLinha && !config.filtroDeLinha.test(brutoDaLinha)) continue;

        if (config.extrairLinha) {
          const candidato = config.extrairLinha(linha.celulas, linha.html, config.base);
          if (candidato) {
            const evento = montarEventoBruto(candidato);
            if (evento) eventos.push(evento);
          }
          continue;
        }

        const pegar = (campo: ChaveRotulo): string | undefined => {
          const indice = colunas[campo];
          return indice === undefined ? undefined : linha.celulas[indice];
        };

        // A coluna de data também pode estar isolada em uma célula com data.
        let dataBruta = pegar('data');
        if (!dataBruta) {
          dataBruta = linha.celulas.find((c) => interpretarDataBR(c) !== null);
        }

        const link = primeiroLink(linha.html);

        const evento = montarEventoBruto({
          dataBruta,
          horaBruta: pegar('hora'),
          tema: pegar('tema') ?? linha.celulas[linha.celulas.length - 1],
          comissao: pegar('comissao'),
          local: pegar('local'),
          contextoMecanismo: config.mecanismoFixo ?? pegar('tipo'),
          link: urlAbsoluta(config.base, link?.href),
          proposicoes: undefined
        });
        if (evento) eventos.push(evento);
      }

      return eventos;
    }
  };
}

export interface ConfigAdaptadorJson {
  uf: string;
  sigla: string;
  nome: string;
  url: string;
  base: string;
  observacao: string;
  opcoesHttp?: OpcoesRequisicao;
  /**
   * Caminho até a lista de registros dentro do JSON, separado por ponto
   * (ex.: `'results'`, `'AgendaReuniao.reunioes.reuniao'`). Um valor único é
   * tratado como lista de um item.
   */
  caminhoDaLista: string;
  /** Converte um registro em candidato. Devolve `null` para descartar. */
  mapear: (registro: any, base: string) => CandidatoEvento | null;
  /**
   * Filtro aplicado antes do mapeamento, para APIs que devolvem coleções
   * mistas (reuniões comuns + audiências) ou fora da janela desejada.
   */
  filtro?: (registro: any) => boolean;
}

/** Navega um caminho com pontos dentro de um objeto JSON. */
function descer(objeto: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((atual, chave) => {
    if (atual === null || atual === undefined) return undefined;
    if (Array.isArray(atual)) return undefined;
    return (atual as Record<string, unknown>)[chave];
  }, objeto);
}

/**
 * Fábrica para fontes que já publicam JSON estruturado.
 * É o caminho preferido: o tipo do dado vem da própria API, então não há
 * inferência de texto e o risco de rotular errado é muito menor.
 */
export function adaptadorDeJson(config: ConfigAdaptadorJson): Adaptador {
  return {
    uf: config.uf,
    sigla: config.sigla,
    nome: config.nome,
    situacao: 'verificado',
    observacao: config.observacao,
    executar: async ({ buscarTexto: buscar }) => {
      const resposta = await buscar(config.url, { tentativas: 3, ...config.opcoesHttp });
      let json: unknown;
      try {
        json = JSON.parse(resposta.corpo);
      } catch {
        throw new Error('a fonte respondeu algo que não é JSON válido');
      }

      // Caminho vazio significa que o próprio corpo já é a lista (caso da API
      // do Paraná, que devolve um array na raiz).
      const bruto = config.caminhoDaLista ? descer(json, config.caminhoDaLista) : json;
      const lista = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];

      const eventos: EventoBruto[] = [];
      for (const registro of lista) {
        if (config.filtro && !config.filtro(registro)) continue;
        const candidato = config.mapear(registro, config.base);
        if (!candidato) continue;
        const evento = montarEventoBruto(candidato);
        if (evento) eventos.push(evento);
      }
      return eventos;
    }
  };
}

/** Casa catalogada, mas sem parser escrito. Nunca é consultada. */
export function adaptadorNaoImplementado(
  uf: string,
  sigla: string,
  nome: string,
  observacao: string,
  situacao: SituacaoCasa = 'nao_implementado'
): Adaptador {
  return { uf, sigla, nome, situacao, observacao };
}

/** Ano inferido para páginas que publicam apenas dia e mês. */
export { inferirAno };
