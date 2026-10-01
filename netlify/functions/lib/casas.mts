import { interpretarDataBR, somaDiasISO } from '../../../shared/datas.ts';
import { limparTexto } from '../../../shared/texto.ts';
import type { EventoBruto } from '../../../shared/coleta.ts';
import {
  adaptadorDeJson,
  montarEventoBruto,
  type Adaptador,
  type CandidatoEvento,
  type ContextoExecucao
} from './adaptadores.mts';
import { elementosPorTag, texto, valorDaTag } from './html.mts';

/**
 * Adaptadores concretos por casa legislativa.
 *
 * Cada adaptador abaixo foi escrito a partir de reconhecimento HTTP real contra
 * o portal — endereço, formato, charset e discriminador de mecanismo foram
 * verificados na fonte, e nenhum deles é o endereço que estava no catálogo
 * original do projeto (todos aqueles devolviam 404 ou uma página sem agenda).
 *
 * REGRA: um adaptador só existe para uma fonte cujo comportamento foi
 * observado. Onde o portal não publica audiências, o estado registrado diz isso
 * explicitamente em vez de o app tentar extrair algo que não existe.
 */

// ─────────────────────────────────────────────── SAPL (Interlegis/DRF)

/**
 * Muitas assembleias usam o SAPL do Interlegis, que publica API REST JSON.
 * É o melhor tipo de fonte: o mecanismo vem de um campo tipado, não de
 * inferência sobre texto.
 *
 * Duas coleções são usadas por casas diferentes:
 *  - `audiencia`: a coleção própria de audiências públicas;
 *  - `reuniao`: reuniões de comissão, onde a audiência é identificada pelo
 *    campo `nome` (ex.: "2ª Reunião de Audiência Pública").
 *
 * Atenção medida na fonte: `?ordering=-data` é IGNORADO silenciosamente pelo
 * SAPL — ordenar no cliente é obrigatório, senão a consulta "mais recente"
 * devolve dados de anos atrás.
 */
function adaptadorSapl(config: {
  uf: string;
  sigla: string;
  nome: string;
  host: string;
  colecao: 'audiencia' | 'reuniao';
  observacao: string;
  /** Quantos anos para trás coletar, além do ano corrente. */
  anosPassados?: number;
  maxPaginas?: number;
}): Adaptador {
  const anosPassados = config.anosPassados ?? 1;
  const maxPaginas = config.maxPaginas ?? 3;

  const urlDe = (ano: number, pagina: number): string => {
    const base =
      config.colecao === 'audiencia'
        ? `${config.host}/api/audiencia/audienciapublica/`
        : `${config.host}/api/comissoes/reuniao/`;
    const filtro = config.colecao === 'audiencia' ? `ano=${ano}` : `data__year=${ano}`;
    return `${base}?format=json&page_size=100&${filtro}&page=${pagina}`;
  };

  const mapear = (registro: any, base: string): CandidatoEvento | null => {
    const nome = limparTexto(registro?.nome, 250);
    const tema = limparTexto(registro?.tema, 250);
    // Na coleção de reuniões, `tema` é vazio nas audiências — o tipo está no
    // `nome`. Por isso o texto do nome entra como contexto de classificação.
    const descricao = [nome, tema].filter(Boolean).join(' — ');
    if (!descricao) return null;

    // `observacao` costuma ser o único lugar com o assunto real e o local.
    const observacao = limparTexto(registro?.observacao, 300);
    const cancelada = registro?.audiencia_cancelada === true;
    const id = registro?.id;

    return {
      dataBruta: registro?.data,
      horaBruta: registro?.hora_inicio,
      tema: observacao.length > 20 && tema.length < 40 ? observacao : descricao,
      local: limparTexto(registro?.local_reuniao, 200) || undefined,
      contextoMecanismo: `${nome} ${tema}`,
      link: id ? `${base}/audiencia/${id}` : undefined,
      proposicoes: cancelada ? undefined : undefined
    };
  };

  return {
    uf: config.uf,
    sigla: config.sigla,
    nome: config.nome,
    situacao: 'verificado',
    observacao: config.observacao,
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const anoAtual = new Date().getFullYear();
      const anos: number[] = [];
      for (let i = anosPassados; i >= 0; i--) anos.push(anoAtual - i);
      // O ano seguinte pode já ter audiências agendadas (ex.: ALESP publica em
      // novembro as audiências de orçamento do ano seguinte).
      anos.push(anoAtual + 1);

      const vistos = new Set<string>();
      const eventos: EventoBruto[] = [];

      for (const ano of anos) {
        for (let pagina = 1; pagina <= maxPaginas; pagina++) {
          let dados: any;
          try {
            const resposta = await buscar(urlDe(ano, pagina), { tentativas: 3, timeoutMs: 25_000 });
            dados = JSON.parse(resposta.corpo);
          } catch {
            break; // ano/página indisponível não invalida os demais
          }

          const lista: any[] = Array.isArray(dados?.results) ? dados.results : [];
          if (lista.length === 0) break;

          for (const registro of lista) {
            const chave = String(registro?.id ?? `${registro?.data}-${registro?.nome}`);
            if (vistos.has(chave)) continue;
            vistos.add(chave);

            const candidato = mapear(registro, config.host);
            if (!candidato) continue;
            const evento = montarEventoBruto(candidato);
            if (evento) eventos.push(evento);
          }

          const totalPaginas = Number(dados?.pagination?.total_pages ?? 1);
          if (pagina >= totalPaginas) break;
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Paraná (JSON)

/** ALEP publica uma API JSON própria, com filtro de tipo no servidor. */
function adaptadorParana(): Adaptador {
  const base = 'https://www.assembleia.pr.leg.br';
  const inicio = `${somaDiasISO(-30)}T00:00:00-03:00`;
  const fim = `${somaDiasISO(120)}T00:00:00-03:00`;

  return adaptadorDeJson({
    uf: 'PR',
    sigla: 'ALEP',
    nome: 'Assembleia Legislativa do Paraná',
    url: `${base}/atividade-parlamentar/agenda_api?start=${encodeURIComponent(inicio)}&end=${encodeURIComponent(fim)}&tipo=audiencia_publica`,
    base,
    caminhoDaLista: '',
    observacao:
      'API JSON própria da casa, com filtro de tipo no servidor. Endereço descoberto no script da página de agenda; não é documentado, então pode mudar sem aviso.',
    mapear: (registro: any, baseUrl: string) => {
      const props = registro?.extendedProps ?? {};
      const inicioIso: string = registro?.start || '';
      return {
        dataBruta: inicioIso.slice(0, 10),
        horaBruta: inicioIso.slice(11, 16),
        tema: registro?.title,
        local: props.local,
        contextoMecanismo: props.tipo || (Array.isArray(registro?.className) ? registro.className[0] : ''),
        link: `${baseUrl}/atividade-parlamentar/audiencias-publicas`
      };
    }
  });
}

// ─────────────────────────────────────────────── São Paulo (XML aberto)

/**
 * A ALESP mantém um repositório de dados abertos com a agenda completa do ano
 * em XML — a melhor fonte encontrada no país: sem raspagem de HTML, sem
 * autenticação e com `Last-Modified` do mesmo dia.
 *
 * Limitação honesta: o XML NÃO tem coluna de tipo. A audiência só é
 * identificável pelo título, então a classificação usa o texto — e por isso o
 * classificador aceita variações ("audiência publia", "2ª audiência pública").
 */
function adaptadorSaoPaulo(): Adaptador {
  return {
    uf: 'SP',
    sigla: 'ALESP',
    nome: 'Assembleia Legislativa de São Paulo',
    situacao: 'verificado',
    observacao:
      'Arquivo XML de dados abertos mantido pela própria casa (um por ano). Sem coluna de tipo: a audiência é identificada pelo título.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const anoAtual = new Date().getFullYear();
      const eventos: EventoBruto[] = [];
      const vistos = new Set<string>();

      for (const ano of [anoAtual, anoAtual + 1]) {
        const url = `https://www.al.sp.gov.br/repositorioDados/agenda/agenda_eventos_${ano}.xml`;
        let corpo: string;
        try {
          const resposta = await buscar(url, { limiteBytes: 6 * 1024 * 1024, timeoutMs: 25_000 });
          corpo = resposta.corpo;
        } catch {
          continue; // o arquivo do ano seguinte ainda pode não existir
        }

        for (const bloco of elementosPorTag(corpo, 'Evento')) {
          const id = valorDaTag(bloco, 'IdEvento');
          if (!id || vistos.has(id)) continue;
          vistos.add(id);

          // `FlagCancelado` é explícito: evento cancelado não entra.
          if (valorDaTag(bloco, 'FlagCancelado') === '1') continue;

          const evento = montarEventoBruto({
            dataBruta: valorDaTag(bloco, 'Data') ?? undefined,
            horaBruta: valorDaTag(bloco, 'HoraIni') ?? undefined,
            tema: valorDaTag(bloco, 'Titulo') ?? undefined,
            local: valorDaTag(bloco, 'Local') ?? undefined,
            link: 'https://www.al.sp.gov.br/alesp/agenda'
          });
          if (evento) eventos.push(evento);
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Mato Grosso (HTML por dia)

/**
 * A ALMT publica a agenda em páginas diárias, com o tipo do evento entre
 * parênteses no próprio título — o que permite distinguir audiência de reunião
 * comum. Existe também um índice JSON de dias com evento, usado para descobrir
 * quais páginas valem uma requisição.
 */
function adaptadorMatoGrosso(): Adaptador {
  const raiz = 'https://www.al.mt.gov.br';
  const MAX_DIAS = 18;

  return {
    uf: 'MT',
    sigla: 'ALMT',
    nome: 'Assembleia Legislativa de Mato Grosso',
    situacao: 'verificado',
    observacao:
      'Páginas diárias de agenda, descobertas por um índice JSON de dias com evento. O tipo (ex.: "Audiência Pública") vem no próprio título.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const indice = await buscar(`${raiz}/parlamento/agenda/dias-com-evento`, {
        timeoutMs: 20_000
      });

      let dias: string[] = [];
      try {
        const json = JSON.parse(indice.corpo);
        if (Array.isArray(json)) dias = json.filter((d) => typeof d === 'string');
      } catch {
        return [];
      }

      // Só os dias relevantes: de uma semana atrás em diante, com teto de
      // requisições para não sobrecarregar o portal.
      const limiteInferior = somaDiasISO(-7);
      const diasAlvo = dias
        .filter((d) => d >= limiteInferior)
        .sort()
        .slice(0, MAX_DIAS);

      const eventos: EventoBruto[] = [];

      for (const dia of diasAlvo) {
        const [ano, mes, d] = dia.split('-');
        const url = `${raiz}/parlamento/agenda/assembleia/${ano}/${mes}/${d}`;
        let corpo: string;
        try {
          const resposta = await buscar(url, { timeoutMs: 20_000, tentativas: 1 });
          corpo = resposta.corpo;
        } catch {
          continue;
        }

        // Cada linha é um link que abre um painel `#collapse-{id}`.
        const reLinha =
          /<a class="text-dark fs-16"[^>]*href="#collapse-(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;

        while ((m = reLinha.exec(corpo))) {
          const id = m[1];
          const bruto = m[2];

          const dataHora = bruto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
          if (!dataHora) continue;

          const semBadge = bruto.replace(/<span class="badge[\s\S]*?<\/span>/gi, ' ');
          const textoSemTags = texto(semBadge);

          // O tipo é o último parêntese: "... Tema - (Audiência Pública)".
          const tipo = textoSemTags.match(/-\s*\(([^)]+)\)\s*$/)?.[1] ?? '';
          const tema = textoSemTags
            .replace(/^\s*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s*h?\s*-?\s*/, '')
            .replace(/-\s*\([^)]+\)\s*$/, '')
            .trim();

          // Local fica no painel de detalhe, em texto com tags e `&nbsp;`.
          let local: string | undefined;
          const rePainel = new RegExp(`id="collapse-${id}"[\\s\\S]{0,6000}?LOCAL:([\\s\\S]{0,400}?)(?:INFORMA|Motivo|Cidade|UF:|<\\/div>)`, 'i');
          const painel = corpo.match(rePainel);
          if (painel) {
            const limpoLocal = texto(painel[1].replace(/\u00a0/g, ' ')).replace(/^[:\s-]+/, '');
            if (limpoLocal.length > 3) local = limpoLocal;
          }

          const evento = montarEventoBruto({
            dataBruta: `${dataHora[1]}/${dataHora[2]}/${dataHora[3]}`,
            horaBruta: dataHora[4],
            tema,
            local,
            contextoMecanismo: tipo,
            link: url
          });
          if (evento) eventos.push(evento);
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Pernambuco (POST de formulário)

/**
 * A agenda da ALEPE não existe em GET: a listagem é entregue por POST de
 * formulário (`operacao=lerAgendaMensal`). O tipo do evento é um rótulo
 * explícito ("Audiência Pública"), e o assunto real vem no texto corrido
 * depois do rótulo.
 */
function adaptadorPernambuco(): Adaptador {
  const url = 'https://www.alepe.pe.gov.br/agenda';

  return {
    uf: 'PE',
    sigla: 'ALEPE',
    nome: 'Assembleia Legislativa de Pernambuco',
    situacao: 'verificado',
    observacao:
      'Agenda entregue por POST de formulário (não existe em GET), com rótulo de tipo explícito. A listagem não é cacheável nem linkável por GET.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const hoje = new Date();
      const eventos: EventoBruto[] = [];
      const vistos = new Set<string>();

      // Mês corrente e os dois seguintes.
      for (let avanco = 0; avanco <= 2; avanco++) {
        const referencia = new Date(hoje.getFullYear(), hoje.getMonth() + avanco, 1);
        const mes = referencia.getMonth() + 1;
        const ano = referencia.getFullYear();

        let corpo: string;
        try {
          const resposta = await buscar(url, {
            metodo: 'POST',
            corpo: {
              operacao: 'lerAgendaMensal',
              'field-filter-mes': String(mes),
              'field-filter-ano': String(ano)
            },
            timeoutMs: 25_000
          });
          corpo = resposta.corpo;
        } catch {
          continue;
        }

        // A marcação é malformada (um `<ul>` aberto por `<li>`, nunca fechado),
        // então a divisão é feita pelo cabeçalho de data, não pela lista.
        const partes = corpo.split(/<h3 class="title-date"[^>]*>([\s\S]*?)<\/h3>/i);

        for (let i = 1; i < partes.length; i += 2) {
          const diaBruto = texto(partes[i]);
          const data = interpretarDataBR(diaBruto);
          const corpoDoDia = partes[i + 1] || '';
          if (!data) continue;

          const reItem = /<li>([\s\S]*?)<\/li>/gi;
          let item: RegExpExecArray | null;
          while ((item = reItem.exec(corpoDoDia))) {
            const bloco = item[1];
            const tipo = texto(bloco.match(/<strong class="title">([\s\S]*?)<\/strong>/i)?.[1] ?? '');
            const hora = texto(bloco.match(/<strong>\s*Hora:\s*<\/strong>\s*([^<]*)/i)?.[1] ?? '');
            const local = texto(bloco.match(/<strong>\s*Local:\s*<\/strong>\s*([^<]*)/i)?.[1] ?? '');

            // O assunto é o texto depois do último </strong> — o rótulo do tipo
            // sozinho ("Audiência Pública") não diz sobre o que é a audiência.
            const ultimoFechamento = bloco.lastIndexOf('</strong>');
            const assunto = texto(ultimoFechamento >= 0 ? bloco.slice(ultimoFechamento + 9) : '');

            const chave = `${data.data}-${hora}-${tipo}-${assunto.slice(0, 40)}`;
            if (vistos.has(chave)) continue;
            vistos.add(chave);

            const evento = montarEventoBruto({
              dataBruta: data.data,
              horaBruta: hora,
              tema: assunto.length > 12 ? `${tipo}: ${assunto}` : tipo,
              local,
              contextoMecanismo: tipo,
              link: `${url}/?mes=${String(mes).padStart(2, '0')}&ano=${ano}`
            });
            if (evento) eventos.push(evento);
          }
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Rio Grande do Sul (JSON na porta 5000)

/**
 * A ALRS expõe uma API JSON não documentada em uma porta não padrão, descoberta
 * no próprio JavaScript do tema. O tipo do evento (`descTipoEvento`) distingue
 * audiência de reunião, visita, sarau e filmagem — filtrar é obrigatório, senão
 * a agenda vira uma lista de eventos culturais.
 *
 * A resposta é limitada a 100 itens por chamada, então a janela é fatiada.
 */
function adaptadorRioGrandeDoSul(): Adaptador {
  const url = 'https://ww4.al.rs.gov.br:5000/listarDadosAgendaEventos';

  return {
    uf: 'RS',
    sigla: 'ALRS',
    nome: 'Assembleia Legislativa do Rio Grande do Sul',
    situacao: 'verificado',
    observacao:
      'API JSON sem documentação, em porta não padrão, descoberta no JavaScript do portal. O campo `descTipoEvento` identifica a audiência e evita ingerir eventos culturais e visitas.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const eventos: EventoBruto[] = [];
      const vistos = new Set<string>();

      // Fatias de 60 dias: a API limita a resposta a 100 itens.
      for (let deslocamento = -30; deslocamento <= 90; deslocamento += 60) {
        const inicio = somaDiasISO(deslocamento);
        const fim = somaDiasISO(deslocamento + 59);
        const paraBr = (iso: string) => iso.split('-').reverse().join('/');

        let dados: any;
        try {
          const resposta = await buscar(url, {
            metodo: 'POST',
            headers: { 'Content-Type': 'application/json' },
            corpo: JSON.stringify({
              dataAgenda: paraBr(inicio),
              dataFinalAgenda: paraBr(fim),
              idLocal: '',
              idLocalSolicitante: '',
              ignorarIdLocalSolicitante: '0'
            }),
            timeoutMs: 25_000
          });
          dados = JSON.parse(resposta.corpo);
        } catch {
          continue;
        }

        const lista: any[] = Array.isArray(dados?.lista) ? dados.lista : [];
        for (const registro of lista) {
          const tipo = limparTexto(registro?.descTipoEvento, 120);
          // A casa publica alguns títulos com um travessão inicial.
          const nome = limparTexto(registro?.nomeEvento, 300).replace(/^\s*[-–—]\s*/, '');
          const chave = String(registro?.idEvento ?? `${nome}-${registro?.dataHoraInicio}`);
          if (vistos.has(chave)) continue;
          vistos.add(chave);

          // Cancelamento vem embutido no título, não em campo booleano.
          const cancelado = /cancelad/i.test(nome);
          if (cancelado) continue;

          const evento = montarEventoBruto({
            dataBruta: registro?.dataHoraInicio,
            horaBruta: registro?.horaInicio,
            tema: nome,
            local: registro?.nomeLocal ?? registro?.nomePredio,
            contextoMecanismo: tipo,
            // Sem link: o payload não traz URL de evento.
            link: undefined
          });
          if (evento) eventos.push(evento);
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Rio de Janeiro (Lotus Notes)

/**
 * A ALERJ publica os editais de comissão em um sistema Lotus Notes legado, cuja
 * tabela é servida pronta pelo servidor. A coluna "Editais" traz o tipo do ato
 * ("Audiência Pública"), o que permite filtrar com precisão.
 *
 * Duas armadilhas medidas na fonte: a listagem é servida por HTTP (não HTTPS) e
 * a página de detalhe está em ISO-8859-1, enquanto a listagem é UTF-8.
 */
function adaptadorRioDeJaneiro(): Adaptador {
  const listagem = 'http://www3.alerj.rj.gov.br/lotus_notes/default.asp?id=66';
  const baseDetalhe = 'http://alerjln1.alerj.rj.gov.br';

  return {
    uf: 'RJ',
    sigla: 'ALERJ',
    nome: 'Assembleia Legislativa do Rio de Janeiro',
    situacao: 'verificado',
    observacao:
      'Tabela de editais de comissão servida pronta por um sistema Lotus Notes legado (HTTP). A visão é recolhida por comissão, então a cobertura pode ser parcial.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const resposta = await buscar(listagem, { timeoutMs: 25_000 });
      const corpo = resposta.corpo;
      const eventos: EventoBruto[] = [];

      const reLinha =
        /<tr>\s*<td><\/td><td><\/td>\s*<td>[\s\S]*?data-role="([^"]+)"[^>]*>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/a>[\s\S]*?<\/td>\s*<td><font[^>]*>([\s\S]*?)<\/font><\/td>\s*<td><font[^>]*>([\s\S]*?)<\/font><\/td>/gi;

      let m: RegExpExecArray | null;
      while ((m = reLinha.exec(corpo))) {
        const caminho = m[1];
        const data = m[2];
        const tipo = texto(m[3]);
        const comissao = texto(m[4]);

        const evento = montarEventoBruto({
          dataBruta: data,
          tema: comissao ? `${tipo} — ${comissao}` : tipo,
          comissao,
          contextoMecanismo: tipo,
          link: `${baseDetalhe}${caminho}`
        });
        if (evento) eventos.push(evento);
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Ceará (agenda de espaços)

/**
 * A ALECE publica uma agenda única de espaços, com janela de datas obrigatória
 * na própria URL. É uma agenda PREDIAL: mistura audiências com aulas, fóruns e
 * atividades administrativas, então a filtragem por mecanismo é o que separa o
 * que interessa — o portal não tem coluna de tipo.
 *
 * O classificador reconhece as audiências pelo texto do título e captura o
 * programa "Alece Diálogo" como diálogo social.
 */
function adaptadorCeara(): Adaptador {
  const base = 'https://www.al.ce.gov.br';
  // A casa exige o formato DD/MM/AA, com ano de dois dígitos.
  const curto = (iso: string): string => {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano.slice(2)}`;
  };
  const inicio = somaDiasISO(-15);
  const fim = somaDiasISO(75);
  const url = `${base}/agenda?datetimes=${encodeURIComponent(`${curto(inicio)} - ${curto(fim)}`)}`;

  return {
    uf: 'CE',
    sigla: 'ALECE',
    nome: 'Assembleia Legislativa do Ceará',
    situacao: 'verificado',
    observacao:
      'Agenda de espaços da casa, com janela de datas obrigatória na URL. Não há coluna de tipo: a audiência é reconhecida pelo título, e o programa "Alece Diálogo" entra como diálogo social.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const resposta = await buscar(url, { timeoutMs: 25_000 });
      const corpo = resposta.corpo;
      const eventos: EventoBruto[] = [];

      const blocos = corpo.split(/<div class="page_agenda--item"/i).slice(1);

      for (const bloco of blocos) {
        const horario = texto(bloco.match(/class="page_agenda--hora[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
        const data = interpretarDataBR(horario);
        if (!data) continue;

        const tema = texto(bloco.match(/class="page_agenda--title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '');
        if (!tema) continue;

        const local = texto(bloco.match(/<b>\s*Local:\s*<\/b>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
        const solicitante = texto(bloco.match(/<b>\s*Solicitante:\s*<\/b>([\s\S]*?)<\/h3>/i)?.[1] ?? '');

        const evento = montarEventoBruto({
          dataBruta: data.data,
          horaBruta: data.hora,
          tema,
          local: local || undefined,
          comissao: solicitante || undefined,
          // A classificação depende do título, que é a única evidência disponível.
          contextoMecanismo: tema,
          link: url
        });
        if (evento) eventos.push(evento);
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Distrito Federal (CSV da CLDF)

/** Divide uma linha de CSV respeitando aspas duplas. */
function linhaCsv(linha: string, separador = ';'): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === separador && !dentroDeAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/**
 * A CLDF entrega a agenda como exportação CSV do próprio portal (Liferay),
 * acessível sem cookie e sem autenticação, com uma coluna `Tipo` oficial —
 * é a fonte mais rica de audiências entre as casas subnacionais.
 *
 * Duas armadilhas medidas na fonte:
 *  1. o filtro `tipoSearch` da URL é APROXIMADO: pedir "Audiência Pública"
 *     também devolve "Audiência Pública Remota". A filtragem por tipo é
 *     refeita aqui, por igualdade;
 *  2. resultado vazio vem como HTTP 200 com corpo de 0 byte — não é erro.
 *
 * A casa é lenta na conexão (chegou a 50 s na medição), então este adaptador
 * pede um teto de tempo maior que o padrão do orquestrador.
 */
function adaptadorDistritoFederal(): Adaptador {
  const paraBr = (iso: string) => iso.split('-').reverse().join('/');
  const TIPOS = ['Audiência Pública', 'Audiência Pública Remota'];

  const montarUrl = (inicio: string, fim: string): string => {
    const p = new URLSearchParams({
      p_p_id: 'br_com_seatecnologia_in_CalendarListPortlet',
      p_p_lifecycle: '2',
      p_p_state: 'normal',
      p_p_mode: 'view',
      p_p_resource_id: 'calendar/bookings/export_csv',
      p_p_cacheability: 'cacheLevelPage',
      _br_com_seatecnologia_in_CalendarListPortlet_tipoSearch: 'Audiência Pública',
      _br_com_seatecnologia_in_CalendarListPortlet_dataInicioSearch: paraBr(inicio),
      _br_com_seatecnologia_in_CalendarListPortlet_dataFimSearch: paraBr(fim),
      // Sem este parâmetro a casa responde 200 com corpo VAZIO.
      _br_com_seatecnologia_in_CalendarListPortlet_isSearch: 'true'
    });
    return `https://www.cl.df.gov.br/agenda?${p.toString()}`;
  };

  return {
    uf: 'DF',
    sigla: 'CLDF',
    nome: 'Câmara Legislativa do Distrito Federal',
    situacao: 'verificado',
    observacao:
      'Exportação CSV do próprio portal, com coluna oficial de tipo de evento. O filtro de tipo da URL é aproximado, então o tipo é conferido novamente aqui. A conexão com esta casa é lenta.',
    tetoMs: 35_000,
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const resposta = await buscar(montarUrl(somaDiasISO(-15), somaDiasISO(105)), {
        timeoutMs: 33_000,
        tentativas: 1,
        limiteBytes: 2 * 1024 * 1024
      });

      const bruto = resposta.corpo.replace(/^\uFEFF/, '');
      if (!bruto.trim()) return []; // corpo vazio = nenhum resultado, não erro

      const linhas = bruto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^sep=/i.test(l));
      if (linhas.length < 2) return [];

      const cabecalho = linhaCsv(linhas[0]);
      const col = (nome: string) => cabecalho.findIndex((c) => c.toLowerCase() === nome.toLowerCase());
      const iInicio = col('Data Início');
      const iTitulo = col('Título');
      const iLocal = col('Local');
      const iTipo = col('Tipo');
      const iAutor = col('Autor');
      if (iInicio < 0 || iTipo < 0) return [];

      const eventos: EventoBruto[] = [];
      for (const linha of linhas.slice(1)) {
        const campos = linhaCsv(linha);
        const tipo = campos[iTipo] ?? '';
        // Igualdade exata: o filtro da URL é aproximado.
        if (!TIPOS.includes(tipo)) continue;

        const titulo = campos[iTitulo] ?? '';
        const autor = campos[iAutor] ?? '';
        // Metade dos registros vem sem título. Em vez de descartar a audiência
        // (o cidadão perde o evento) ou inventar um assunto, o tema declara o
        // que se sabe com certeza: o tipo e quem convocou.
        const tema =
          titulo.length >= 5 ? titulo : `${tipo} convocada por ${autor || 'autoria não informada'}`;

        const evento = montarEventoBruto({
          dataBruta: campos[iInicio] ?? '',
          tema,
          local: campos[iLocal] ?? undefined,
          comissao: autor || undefined,
          contextoMecanismo: tipo
          // Sem link: o CSV não traz URL por evento.
        });
        if (evento) eventos.push(evento);
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Goiás (página por dia)

/**
 * A ALEGO só renderiza a agenda quando recebe a data na URL — sem o parâmetro, a
 * página é um casco de AngularJS sem nenhum evento. O título é a única evidência
 * de tipo, então o classificador decide pelo texto.
 */
function adaptadorGoias(): Adaptador {
  const raiz = 'https://portal.al.go.leg.br';
  const DIAS_FUTURO = 21;
  const DIAS_PASSADO = 7;

  return {
    uf: 'GO',
    sigla: 'ALEGO',
    nome: 'Assembleia Legislativa de Goiás',
    situacao: 'verificado',
    observacao:
      'Agenda renderizada pelo servidor somente quando a data vai na URL (sem o parâmetro, a página não traz evento nenhum). Não há coluna de tipo: a classificação é pelo título.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const dias: string[] = [];
      for (let d = -DIAS_PASSADO; d <= DIAS_FUTURO; d++) dias.push(somaDiasISO(d));

      const eventos: EventoBruto[] = [];
      const vistos = new Set<string>();

      // Lotes pequenos: 25 dias em série somariam dezenas de segundos.
      const LOTE = 5;
      for (let i = 0; i < dias.length; i += LOTE) {
        const fatia = dias.slice(i, i + LOTE);
        const respostas = await Promise.all(
          fatia.map(async (dia) => {
            const [ano, mes, d] = dia.split('-');
            const url = `${raiz}/agenda?data=${ano}/${mes}/${d}`;
            try {
              const corpo = (await buscar(url, { timeoutMs: 15_000, tentativas: 1 })).corpo;
              return { dia, url, corpo };
            } catch {
              return { dia, url, corpo: '' };
            }
          })
        );

        for (const { dia, url, corpo } of respostas) {
          if (!corpo) continue;
          // O bloco de "nenhum evento" também usa `<article class="evento">`.
          const util = corpo.split('<div id="agenda_vazia"')[0];
          if (!util.includes('class="evento"')) continue;

          const reEvento =
            /<article class="evento">\s*<h5 class="titulo">([\s\S]*?)<\/h5>([\s\S]*?)<\/article>/gi;
          let m: RegExpExecArray | null;
          while ((m = reEvento.exec(util))) {
            const titulo = texto(m[1]);
            const bloco = m[2];
            const campo = (rotulo: string) =>
              texto(
                bloco.match(
                  new RegExp(`<b class="label">\\s*${rotulo}:\\s*</b>\\s*<span>([\\s\\S]*?)</span>`, 'i')
                )?.[1] ?? ''
              );

            const hora = campo('Horário');
            const local = campo('Local');
            const emPauta = campo('Em pauta');
            const realizacao = campo('Realização');

            const chave = `${dia}-${hora}-${titulo}`;
            if (vistos.has(chave)) continue;
            vistos.add(chave);

            const evento = montarEventoBruto({
              dataBruta: dia,
              horaBruta: hora,
              // A classificação olha só o título: "Em pauta" costuma citar
              // "Ordem do Dia" e "Pequeno Expediente", que são pauta de sessão
              // e não mecanismo de participação cidadã.
              contextoMecanismo: titulo,
              tema: emPauta.length > 5 ? `${titulo}: ${emPauta}` : titulo,
              local: local || undefined,
              comissao: realizacao || undefined,
              link: url
            });
            if (evento) eventos.push(evento);
          }
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Minas Gerais (dados abertos)

/**
 * A ALMG publica uma API de dados abertos versionada e documentada — a melhor
 * fonte entre as casas subnacionais.
 *
 * Ponto crítico: a audiência NÃO aparece no título. Ela chega como
 * `titulo: "Reunião Ordinária"` com a comissão em `subtitulo`, e o que a
 * identifica é o campo `naturezaReuniao: "AUDIENCIA_PUBLICA"`. Classificar pelo
 * título perderia todas elas.
 */
function adaptadorMinasGerais(): Adaptador {
  const inicio = somaDiasISO(-20).replace(/-/g, '');
  const fim = somaDiasISO(100).replace(/-/g, '');

  return {
    uf: 'MG',
    sigla: 'ALMG',
    nome: 'Assembleia Legislativa de Minas Gerais',
    situacao: 'verificado',
    observacao:
      'API de dados abertos versionada e documentada pela própria casa. A audiência é identificada pelo campo naturezaReuniao, não pelo título — na ALMG a audiência se chama "Reunião Ordinária" e traz a comissão no subtítulo.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      // Uma requisição cobre a janela inteira. O padrão da API é XML, então o
      // Accept é obrigatório para receber JSON.
      const url = `https://dadosabertos.almg.gov.br/api/v2/agenda/diaria/agenda/pesquisa?ini=${inicio}&fim=${fim}`;
      const resposta = await buscar(url, {
        headers: { Accept: 'application/json' },
        timeoutMs: 25_000,
        limiteBytes: 8 * 1024 * 1024
      });

      let dados: any;
      try {
        dados = JSON.parse(resposta.corpo);
      } catch {
        throw new Error('a API de dados abertos não devolveu JSON');
      }

      const dias: any[] = dados?.agendaPeriodo?.dias ?? [];
      const eventos: EventoBruto[] = [];

      for (const dia of dias) {
        const itens: any[] = Array.isArray(dia?.itens) ? dia.itens : [];
        for (const item of itens) {
          // Só audiência pública entra. O campo é a evidência autoritativa.
          if (String(item?.naturezaReuniao || '').toUpperCase() !== 'AUDIENCIA_PUBLICA') continue;

          const titulo = limparTexto(item?.titulo, 200);
          const subtitulo = limparTexto(item?.subtitulo, 200);
          const descricao = limparTexto(item?.descricao, 300);

          const evento = montarEventoBruto({
            dataBruta: item?.diaInicial?.$ ?? dia?.dia?.$ ?? '',
            horaBruta: item?.horaInicial,
            // O título genérico ("Reunião Ordinária") só faz sentido junto da
            // comissão; sozinho não diz nada ao cidadão.
            tema: [titulo, subtitulo].filter(Boolean).join(' — ') || descricao,
            local: item?.local,
            comissao: subtitulo,
            contextoMecanismo: 'AUDIENCIA_PUBLICA',
            link: item?.urlDetalhe
              ? new URL(item.urlDetalhe, 'https://www.almg.gov.br').href
              : undefined
          });
          if (evento) eventos.push(evento);
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Mato Grosso do Sul (tabela)

/**
 * A ALEMS publica uma tabela com coluna própria `Tipo de Evento`, cujo valor é
 * literalmente "Audiência Pública" — evidência categórica, não inferência.
 *
 * A paginação é por mês, com 10 linhas por página. Atenção medida na fonte:
 * quando o parâmetro de busca textual é usado, a paginação é ignorada e a
 * resposta repete a primeira página; por isso a coleta é feita por mês.
 */
function adaptadorMatoGrossoDoSul(): Adaptador {
  const raiz = 'https://al.ms.gov.br';

  return {
    uf: 'MS',
    sigla: 'ALEMS',
    nome: 'Assembleia Legislativa de Mato Grosso do Sul',
    situacao: 'verificado',
    observacao:
      'Tabela com coluna própria de tipo de evento ("Audiência Pública"). Coleta por mês, com paginação de 10 linhas.',
    executar: async ({ buscarTexto: buscar }: ContextoExecucao) => {
      const hoje = new Date();
      const alvos: Array<{ mes: number; ano: number }> = [];
      for (let avanco = 0; avanco <= 2; avanco++) {
        const ref = new Date(hoje.getFullYear(), hoje.getMonth() + avanco, 1);
        alvos.push({ mes: ref.getMonth() + 1, ano: ref.getFullYear() });
      }

      const eventos: EventoBruto[] = [];
      const vistos = new Set<string>();

      const reLinha =
        /<tr>\s*<td>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/td>\s*<td[^>]*>\s*([^<]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;

      for (const { mes, ano } of alvos) {
        for (let pagina = 1; pagina <= 4; pagina++) {
          const url = `${raiz}/Calendars/List?sortOrder=Event&page=${pagina}&monthFilter=${mes}&yearFilter=${ano}`;
          let corpo: string;
          try {
            corpo = (await buscar(url, { timeoutMs: 20_000 })).corpo;
          } catch {
            break;
          }

          let encontrou = false;
          let m: RegExpExecArray | null;
          while ((m = reLinha.exec(corpo))) {
            encontrou = true;
            const data = m[1];
            const hora = texto(m[2]);
            const tipo = texto(m[3]);
            const titulo = texto(m[4]);
            const local = texto(m[5]);
            const proponente = texto(m[6]);

            const chave = `${data}-${titulo.slice(0, 50)}`;
            if (vistos.has(chave)) continue;
            vistos.add(chave);

            const evento = montarEventoBruto({
              dataBruta: data,
              // A hora vem como texto livre ("8h30 às 11h30").
              horaBruta: hora,
              tema: titulo,
              local,
              comissao: proponente || undefined,
              // Evidência categórica da própria tabela.
              contextoMecanismo: tipo
              // Sem link: a tabela não traz URL por evento.
            });
            if (evento) eventos.push(evento);
          }

          if (!encontrou) break; // acabaram as páginas deste mês
        }
      }

      return eventos;
    }
  };
}

// ─────────────────────────────────────────────── Registro

/**
 * Casas com coleta ativa nesta versão.
 * Todas foram verificadas contra o portal real; a lista de casas sem coleta
 * fica em `registro.mts`, cada uma com o motivo declarado.
 */
export const ADAPTADORES: Adaptador[] = [
  // A CLDF é a fonte mais lenta; entra primeiro para caber na primeira onda.
  adaptadorDistritoFederal(),
  adaptadorMinasGerais(),
  adaptadorSaoPaulo(),
  adaptadorCeara(),
  adaptadorParana(),
  adaptadorPernambuco(),
  adaptadorMatoGrosso(),
  adaptadorRioDeJaneiro(),
  adaptadorRioGrandeDoSul(),
  adaptadorGoias(),
  adaptadorMatoGrossoDoSul(),
  // SAPL: coleção própria de audiências públicas
  adaptadorSapl({
    uf: 'RO',
    sigla: 'ALERO',
    nome: 'Assembleia Legislativa de Rondônia',
    host: 'https://sapl.al.ro.leg.br',
    colecao: 'audiencia',
    anosPassados: 1,
    observacao: 'API REST SAPL com coleção própria de audiências públicas, documentada por spec OpenAPI da casa.'
  }),
  adaptadorSapl({
    uf: 'PI',
    sigla: 'ALEPI',
    nome: 'Assembleia Legislativa do Piauí',
    host: 'https://sapl.al.pi.leg.br',
    colecao: 'audiencia',
    // Um ano para trás, e não mais: o módulo de audiências desta casa está
    // abandonado desde 2023, então varrer anos antigos custaria dezenas de
    // segundos de latência para trazer registros que a agenda já esconde por
    // serem passados. A consulta aos anos recentes devolve vazio — e é isso
    // que o app reporta.
    anosPassados: 1,
    observacao:
      'API REST SAPL com coleção própria de audiências. O módulo não recebe registro novo desde 2023, então a consulta aos anos recentes retorna vazio.'
  }),
  adaptadorSapl({
    uf: 'RR',
    sigla: 'ALERR',
    nome: 'Assembleia Legislativa de Roraima',
    host: 'https://sapl.al.rr.leg.br',
    colecao: 'audiencia',
    anosPassados: 3,
    observacao:
      'API REST SAPL com coleção de audiências. O último registro é de 2024: funciona como arquivo, não como agenda corrente.'
  }),
  // SAPL: audiência identificada pelo nome, dentro das reuniões de comissão
  adaptadorSapl({
    uf: 'PB',
    sigla: 'ALPB',
    nome: 'Assembleia Legislativa da Paraíba',
    host: 'https://sapl.al.pb.leg.br',
    colecao: 'reuniao',
    anosPassados: 1,
    observacao:
      'API REST SAPL. A coleção própria de audiências está vazia nesta casa, então a audiência é identificada pelo nome da reunião de comissão.'
  })
];
