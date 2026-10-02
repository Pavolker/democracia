import { Evento, MecanismoParticipacao, ScraperStatus } from '../types';
import { FONTES_OFICIAIS } from './config';
import { compararPorDataHora, paraISOLocal, somaDiasISO } from './datas';
import { limparTexto, normalizar } from './texto';
import { classificarMecanismo, MECANISMOS, pareceRegistroDeTeste } from '../../shared/mecanismos';
import type { EventoBruto, RespostaAgenda, ResultadoCasa } from '../../shared/coleta';

/**
 * Coleta de dados oficiais.
 *
 * HISTÓRICO DE CORREÇÕES nesta camada:
 *  - os dois proxies CORS públicos usados antes (`api.allorigins.win`,
 *    `corsproxy.io`) estão mortos: o primeiro responde 522 e o segundo 403.
 *    Foram removidos. Verificou-se por HTTP que tanto a API da Câmara quanto a
 *    agenda de comissões do Senado enviam `access-control-allow-origin: *`,
 *    portanto NENHUM proxy é necessário — o navegador acessa as duas direto.
 *  - o endpoint do Senado usado antes (`/dadosabertos/materia/audiencias`)
 *    devolve 404: ele não existe. O spec OpenAPI do Senado
 *    (`/dadosabertos/v3/api-docs`, 157 rotas) não tem nenhuma rota de
 *    audiência; a fonte correta é a agenda de comissões por intervalo de datas.
 *  - a coleta agora reporta quantos registros foram DESCARTADOS por não
 *    corresponderem a nenhum dos 5 mecanismos, em vez de rotular tudo como
 *    "Audiência Pública" por padrão.
 */

const TIMEOUT_PADRAO_MS = 12000;
/** O Senado monta a resposta com os documentos relacionados; damos mais folga. */
const TIMEOUT_SENADO_MS = 20000;

/** Janela da Câmara: 30 dias para trás (histórico recente) e 90 para frente. */
const DIAS_PASSADO = 30;
const DIAS_FUTURO = 90;
/** Janela do Senado: menor porque a resposta é truncada em janelas largas. */
const DIAS_FUTURO_SENADO = 45;
/** Tamanho de cada fatia da agenda do Senado, em dias (ver `fatiasDeDatas`). */
const TAMANHO_FATIA_SENADO = 12;

/** Requisição de texto com timeout e mensagem de erro legível. */
async function buscarTexto(
  url: string,
  timeoutMs = TIMEOUT_PADRAO_MS,
  accept = 'application/json, application/xml, text/xml, */*'
): Promise<{ texto: string; status: number; urlFinal: string }> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const resposta = await fetch(url, {
      signal: controlador.signal,
      // `omit` é obrigatório para o Senado: ele envia
      // `access-control-allow-credentials: true` junto com `allow-origin: *`,
      // combinação inválida que faz o navegador descartar a resposta caso
      // credenciais sejam solicitadas.
      credentials: 'omit',
      headers: { Accept: accept }
    });
    const texto = await resposta.text();
    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status} em ${url}`);
    }
    return { texto, status: resposta.status, urlFinal: resposta.url || url };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classificação de mecanismo e detecção de registro de teste vêm de
 * `shared/mecanismos.ts` — o MESMO módulo que a função serverless usa para as
 * assembleias estaduais. Reexportados aqui para preservar os imports existentes.
 */
export { classificarMecanismo, pareceRegistroDeTeste };

/** Resultado bruto de uma fonte. */
interface Extracao {
  eventos: Evento[];
  /** Registros lidos que não correspondem a nenhum dos 5 mecanismos. */
  ignorados: number;
  urlConsultada: string;
  observacao?: string;
}

// 1. Câmara dos Deputados — API de Dados Abertos (CORS liberado, sem proxy)
export async function extrairCamara(): Promise<Extracao> {
  const dataInicio = somaDiasISO(-DIAS_PASSADO);
  const dataFim = somaDiasISO(DIAS_FUTURO);
  const base = 'https://dadosabertos.camara.leg.br/api/v2/eventos';
  const urlConsultada = `${base}?dataInicio=${dataInicio}&dataFim=${dataFim}`;

  const coletados: any[] = [];
  let pagina = 1;
  const maxPaginas = 3;

  while (pagina <= maxPaginas) {
    const url =
      `${base}?dataInicio=${dataInicio}&dataFim=${dataFim}` +
      `&ordem=ASC&ordenarPor=dataHoraInicio&itens=100&pagina=${pagina}`;
    const { texto } = await buscarTexto(url, TIMEOUT_PADRAO_MS, 'application/json');
    const json = JSON.parse(texto);
    const lote: any[] = Array.isArray(json?.dados) ? json.dados : [];
    coletados.push(...lote);
    if (lote.length < 100) break;
    pagina += 1;
  }

  const eventos: Evento[] = [];
  let ignorados = 0;

  for (const item of coletados) {
    const tipo = item.descricaoTipo || '';
    const descricao = (item.descricao || '').replace(/\s+/g, ' ').trim();

    // `descricaoTipo` é o campo autoritativo da API; a descrição entra como
    // apoio. Se nenhum dos dois indicar um mecanismo, o registro é descartado.
    const mecanismo = classificarMecanismo(`${tipo} ${descricao}`);
    if (!mecanismo || pareceRegistroDeTeste(tipo, descricao)) {
      ignorados += 1;
      continue;
    }

    // A API expõe `localCamara`/`localExterno` — o código anterior lia
    // `item.locais[0]`, que não existe neste payload, e por isso gravava um
    // endereço fixo ("Anexo II, Plenário das Comissões") em TODOS os eventos.
    const local =
      item.localCamara?.nome ||
      item.localExterno ||
      'Local não informado pela Câmara dos Deputados';

    const inicio: string = item.dataHoraInicio || '';
    const situacao = normalizar(item.situacao || '');
    const status: Evento['status'] = situacao.includes('cancel')
      ? 'cancelado'
      : situacao.includes('encerrad')
        ? 'encerrado'
        : 'confirmado';

    eventos.push({
      id: `camara-${item.id}`,
      mecanismo,
      uf: 'DF',
      casa: 'Câmara',
      casa_nome: 'Câmara dos Deputados',
      nivel: 'federal',
      local,
      data: inicio.slice(0, 10) || somaDiasISO(0),
      hora: inicio.slice(11, 16) || '00:00',
      hora_fim: item.dataHoraFim ? String(item.dataHoraFim).slice(11, 16) : undefined,
      tema: limparTexto(descricao || tipo || 'Evento sem descrição na API'),
      comissao: item.orgaos?.[0]?.nome || tipo || 'Órgão não informado',
      tipo_reuniao: 'presencial',
      link_oficial: `https://www.camara.leg.br/evento-legislativo/${item.id}`,
      link_transmissao: item.urlRegistro || undefined,
      status,
      data_extracao: new Date().toISOString(),
      fonte: 'https://dadosabertos.camara.leg.br',
      origem: 'ao_vivo'
    });
  }

  return {
    eventos,
    ignorados,
    urlConsultada,
    observacao: `${coletados.length} eventos no período; ${ignorados} sem mecanismo de participação`
  };
}

/**
 * Divide uma janela de datas em blocos curtos.
 *
 * POR QUE ISTO EXISTE: a agenda de comissões do Senado TRUNCA respostas
 * grandes. Medido em 30/09/2026:
 *   - janela de 7 dias para trás e 30 para frente  ->  45 KB, inclui 05/10;
 *   - janela de 30 para trás e 45 para frente      -> 2,2 MB, e a resposta
 *     termina em 24/09: as reuniões de outubro simplesmente NÃO VÊM, mesmo
 *     estando dentro do intervalo pedido.
 * Ou seja, ampliar a janela faz o app perder os eventos futuros. Fatiar em
 * blocos curtos garante cobertura completa e ainda reduz o tráfego em ~50x.
 */
function fatiasDeDatas(
  diasPassado: number,
  diasFuturo: number,
  tamanhoDaFatia: number
): Array<{ inicio: string; fim: string }> {
  const fatias: Array<{ inicio: string; fim: string }> = [];
  const inicioAbsoluto = new Date();
  inicioAbsoluto.setDate(inicioAbsoluto.getDate() - diasPassado);
  const fimAbsoluto = new Date();
  fimAbsoluto.setDate(fimAbsoluto.getDate() + diasFuturo);

  const paraAAAAMMDD = (d: Date) => paraISOLocal(d).replace(/-/g, '');
  const cursor = new Date(inicioAbsoluto);

  while (cursor <= fimAbsoluto) {
    const candidato = new Date(cursor);
    candidato.setDate(candidato.getDate() + tamanhoDaFatia - 1);
    const fimDaFatia = candidato > fimAbsoluto ? new Date(fimAbsoluto) : candidato;

    fatias.push({ inicio: paraAAAAMMDD(cursor), fim: paraAAAAMMDD(fimDaFatia) });

    cursor.setTime(fimDaFatia.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return fatias;
}

// 2. Senado Federal — agenda de comissões (CORS liberado, sem proxy)
//
// O endpoint anterior (`/dadosabertos/materia/audiencias`) devolve 404 porque
// NÃO EXISTE: o spec OpenAPI do Senado (/dadosabertos/v3/api-docs, 157 rotas)
// não tem nenhuma rota cujo caminho contenha "audien". A fonte correta é a
// agenda de comissões por intervalo de datas, com datas em AAAAMMDD (com hífen
// devolve 404). A audiência pública é identificada pelo nó `partes`, cujo `nome`
// é "Audiência Pública Interativa" — reuniões deliberativas trazem
// "Deliberativa" e não são mecanismos de participação.
//
// Usamos a variante `.json` (menor e sem DOMParser) e enviamos
// `credentials: 'omit'`; ver comentário em `buscarTexto`.
export async function extrairSenado(): Promise<Extracao> {
  const fatias = fatiasDeDatas(DIAS_PASSADO, DIAS_FUTURO_SENADO, TAMANHO_FATIA_SENADO);
  const urls = fatias.map(
    (f) => `https://legis.senado.leg.br/dadosabertos/comissao/agenda/${f.inicio}/${f.fim}.json`
  );

  const respostas = await Promise.allSettled(
    urls.map((url) => buscarTexto(url, TIMEOUT_SENADO_MS, 'application/json'))
  );

  const falhas = respostas.filter((r) => r.status === 'rejected').length;
  if (falhas === respostas.length) {
    const primeiro = respostas[0] as PromiseRejectedResult;
    throw new Error(
      `nenhuma das ${respostas.length} consultas ao Senado respondeu: ${
        primeiro.reason instanceof Error ? primeiro.reason.message : 'erro desconhecido'
      }`
    );
  }

  // Deduplica por código de reunião: uma reunião pode aparecer em duas fatias
  // quando o fatiamento cai no meio de um intervalo de datas.
  const porCodigo = new Map<string, any>();
  let totalReunioes = 0;

  for (const resposta of respostas) {
    if (resposta.status !== 'fulfilled') continue;
    let json: any;
    try {
      json = JSON.parse(resposta.value.texto);
    } catch {
      continue; // fatia ilegível não invalida as demais
    }
    const bruto = json?.AgendaReuniao?.reunioes?.reuniao ?? [];
    const lista: any[] = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];
    for (const reuniao of lista) {
      const chave = String(reuniao?.codigo ?? `${reuniao?.dataInicio}-${reuniao?.titulo}`);
      if (!porCodigo.has(chave)) porCodigo.set(chave, reuniao);
    }
    totalReunioes += lista.length;
  }

  const eventos: Evento[] = [];
  let ignorados = 0;

  for (const reuniao of porCodigo.values()) {
    const partes = Array.isArray(reuniao.partes)
      ? reuniao.partes
      : reuniao.partes
        ? [reuniao.partes]
        : [];
    const nomesPartes = partes.map((p: any) => `${p?.nome || ''} ${p?.descricaoTipo || ''}`).join(' ');
    const titulo = reuniao.titulo || '';
    const finalidade = String(partes[0]?.evento?.finalidade || '').replace(/^"|"$/g, '').trim();

    // A classificação usa SOMENTE o campo estrutural `partes`, que é onde a
    // própria API declara o que é cada parte da reunião (as categorias são
    // "Audiência Pública Interativa", "Deliberativa", "Instalação e Eleição",
    // "Reunião de Trabalho" etc.). Classificar pela prosa da finalidade gerava
    // falso positivo: uma sessão deliberativa cuja pauta citava "consulta
    // pública" era rotulada como Consulta Pública.
    const mecanismo = classificarMecanismo(nomesPartes);
    if (!mecanismo) {
      ignorados += 1;
      continue;
    }

    const nomeColegiado = reuniao.colegiadoCriador?.nome || 'Comissão do Senado Federal';
    const siglaColegiado = reuniao.colegiadoCriador?.sigla || 'SF';

    // O melhor descritor do tema é a `finalidade` da parte (é o assunto real da
    // audiência). Antes, o tema era o literal "Audiência Pública do Senado" e
    // TODAS as audiências ficavam com a data de hoje.
    const tema =
      limparTexto(finalidade) ||
      limparTexto([titulo, nomeColegiado].filter(Boolean).join(' — ')) ||
      'Audiência pública sem pauta publicada';

    const dataInicio: string = reuniao.dataInicio || '';
    const situacao = normalizar(reuniao.situacao || '');
    const status: Evento['status'] = situacao.includes('cancel')
      ? 'cancelado'
      : situacao.includes('realizada')
        ? 'encerrado'
        : situacao.includes('suspensa') || situacao.includes('nao realizada')
          ? 'adiado'
          : 'confirmado';

    const linkECidadania: string | undefined = reuniao.linkECidadania || undefined;
    const pauta: string | undefined = reuniao.urlUltimaPautaCheiaPublicada || undefined;

    eventos.push({
      id: `senado-${reuniao.codigo || `${dataInicio}-${titulo}`}`,
      mecanismo,
      uf: 'DF',
      casa: 'Senado',
      casa_nome: 'Senado Federal',
      nivel: 'federal',
      local: reuniao.local || 'Senado Federal, Brasília - DF',
      data: dataInicio.slice(0, 10) || somaDiasISO(0),
      hora: dataInicio.slice(11, 16) || '00:00',
      tema,
      comissao: `${nomeColegiado} (${siglaColegiado})`,
      tipo_reuniao: 'presencial',
      link_oficial: pauta || linkECidadania || 'https://www12.senado.leg.br/ecidadania',
      // Só oferecemos inscrição quando o Senado publica o link do e-Cidadania
      // para ESTA audiência. Nada de link genérico apresentado como inscrição.
      inscricao: linkECidadania,
      status,
      data_extracao: new Date().toISOString(),
      fonte: 'https://legis.senado.leg.br/dadosabertos',
      origem: 'ao_vivo'
    });
  }

  const observacao =
    `${porCodigo.size} reunião(ões) de comissão em ${fatias.length} faixa(s) de ${TAMANHO_FATIA_SENADO} dias; ` +
    `${ignorados} não são mecanismos de participação` +
    (falhas > 0 ? `; ${falhas} faixa(s) não responderam` : '');

  return {
    eventos,
    ignorados,
    urlConsultada: `${urls[0]} (+${urls.length - 1} faixas)`,
    observacao
  };
}

// 3. Assembleias estaduais e distrital — via função serverless
//
// MOTIVO DE EXISTIR BACKEND NESTE PROJETO: nenhum portal de assembleia publica
// cabeçalho CORS, então o navegador não consegue lê-los. A função
// `netlify/functions/agenda-estados` faz a coleta no servidor e devolve um
// estado POR CASA.
//
// Quando a função não está disponível (build puramente estático, por exemplo),
// as casas continuam pendentes COM O MOTIVO REAL. Em nenhuma hipótese este
// caminho produz "sucesso" sem uma resposta do servidor.

const CAMINHO_AGENDA_ESTADOS = '/api/agenda-estados';
/**
 * Prazo do lado do app.
 *
 * Precisa ser MAIOR que o pior caso da função: a casa mais lenta (CLDF) pode
 * levar ~35 s, e a função espera todas. Com 30 s o app abortava no meio de uma
 * coleta que ainda ia responder, e o painel de fontes acusava as assembleias
 * como indisponíveis — informação errada na tela do usuário.
 */
const TIMEOUT_ESTADOS_MS = 48_000;

/** Hash estável e curto, usado para compor o id do evento a partir do conteúdo. */
function chaveEstavel(texto: string): string {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** Converte um evento bruto da função no tipo de domínio do app. */
function brutoParaEvento(bruto: EventoBruto, casa: ResultadoCasa): Evento | null {
  // Defesa em profundidade: o adaptador já classificou, mas o app não confia
  // cegamente em um valor vindo da rede — se o mecanismo não for um dos cinco,
  // o registro é descartado aqui também.
  if (!MECANISMOS.includes(bruto.mecanismo as MecanismoParticipacao)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto.data || '')) return null;
  const tema = limparTexto(bruto.tema, 400);
  if (tema.length < 5) return null;

  return {
    // Id determinístico: o mesmo evento mantém o mesmo id entre sincronizações,
    // o que preserva favoritos e evita duplicar o UID do arquivo .ics.
    id: `estado-${casa.uf}-${chaveEstavel(`${bruto.data}|${tema}`)}`,
    mecanismo: bruto.mecanismo as MecanismoParticipacao,
    uf: casa.uf,
    casa: casa.sigla,
    casa_nome: casa.nome,
    nivel: casa.uf === 'DF' ? 'distrital' : 'estadual',
    local: limparTexto(bruto.local, 250) || `${casa.nome} — local não informado no portal`,
    data: bruto.data,
    // Vazio em vez de "00:00": a fonte pode não informar horário, e exibir
    // meia-noite seria inventar um dado.
    hora: bruto.hora || '',
    tema,
    comissao: bruto.comissao ? limparTexto(bruto.comissao, 200) : undefined,
    tipo_reuniao: 'presencial',
    link_oficial: bruto.link || casa.urlConsultada || `https://${casa.sigla.toLowerCase()}`,
    inscricao: bruto.inscricao,
    proposicoes_relacionadas: bruto.proposicoes,
    status: 'confirmado',
    data_extracao: new Date().toISOString(),
    fonte: casa.urlConsultada || 'portal oficial da casa',
    origem: 'ao_vivo'
  };
}

/** Traduz o estado reportado pela função no status exibido no app. */
function casaParaStatus(casa: ResultadoCasa): ScraperStatus {
  const coletou = casa.situacao === 'verificado';
  return {
    fonteId: normalizar(casa.sigla),
    nome: casa.nome,
    uf: casa.uf,
    status: !coletou ? 'pendente' : casa.status === 'erro' ? 'erro' : 'sucesso',
    totalEventos: casa.eventos.length,
    tempoMs: casa.tempoMs,
    mensagem: casa.mensagem,
    ultimaChecagem: new Date().toLocaleTimeString('pt-BR')
  };
}

/** Busca a agenda subnacional na função serverless. */
async function consultarEstados(): Promise<{ eventos: Evento[]; statuses: ScraperStatus[] }> {
  const casasEstaduais = FONTES_OFICIAIS.filter((f) => f.uf !== 'FEDERAL');

  const pendentesComMotivo = (motivo: string): ScraperStatus[] =>
    casasEstaduais.map((f) => ({
      fonteId: normalizar(f.sigla),
      nome: f.nome,
      uf: f.uf,
      status: 'pendente',
      totalEventos: 0,
      mensagem: motivo,
      ultimaChecagem: agoraTexto()
    }));

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_ESTADOS_MS);

  try {
    const resposta = await fetch(CAMINHO_AGENDA_ESTADOS, {
      signal: controlador.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });

    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    const dados = (await resposta.json()) as RespostaAgenda;
    if (!Array.isArray(dados?.casas)) {
      throw new Error('resposta sem a lista de casas');
    }

    const eventos: Evento[] = [];
    let descartados = 0;

    for (const casa of dados.casas) {
      for (const bruto of casa.eventos) {
        const evento = brutoParaEvento(bruto, casa);
        if (evento) eventos.push(evento);
        else descartados += 1;
      }
    }

    const statuses = dados.casas.map((casa) => {
      const status = casaParaStatus(casa);
      if (descartados > 0 && casa.eventos.length > 0) {
        status.mensagem = `${status.mensagem} (${descartados} registro(s) descartado(s) por falta de data ou tema)`;
      }
      return status;
    });

    return { eventos, statuses };
  } catch (erro) {
    // Distinguir "demorou demais" de "não existe nesta instalação" importa: a
    // primeira se resolve atualizando de novo; a segunda, não.
    const abortado = erro instanceof DOMException && erro.name === 'AbortError';
    const motivo = erro instanceof Error ? erro.message : 'erro desconhecido';

    return {
      eventos: [],
      statuses: pendentesComMotivo(
        abortado
          ? `A coleta das assembleias excedeu o tempo limite de ${TIMEOUT_ESTADOS_MS / 1000}s nesta consulta. ` +
              'Nenhuma casa estadual foi reportada como consultada. Tente atualizar novamente.'
          : `Coleta das assembleias indisponível nesta instalação (${motivo}). ` +
              'A função serverless /api/agenda-estados não respondeu.'
      )
    };
  } finally {
    clearTimeout(timer);
  }
}

// 4. Orquestrador: consulta as fontes integradas e publica cada resultado
//
// A versão anterior esperava TODAS as fontes terminarem antes de devolver
// qualquer coisa e, como o Senado passava por proxies mortos, a tela ficava
// vazia por ~10 s — inclusive dos dados que não dependem de rede nenhuma.
// Agora cada fonte publica o seu resultado assim que resolve (`onParcial`), e
// nenhuma fonte reporta "sucesso" que não tenha sido verificado.

export interface OpcoesBusca {
  onStatusUpdate?: (status: ScraperStatus) => void;
  /** Chamado a cada fonte que responde, com o acumulado até o momento. */
  onParcial?: (eventos: Evento[]) => void;
}

function agoraTexto(): string {
  return new Date().toLocaleTimeString('pt-BR');
}

export async function buscarTodosEventos(
  opcoes: OpcoesBusca = {}
): Promise<{ eventos: Evento[]; statuses: ScraperStatus[] }> {
  const { onStatusUpdate, onParcial } = opcoes;

  const statuses = new Map<string, ScraperStatus>();
  const eventos = new Map<string, Evento>();

  const publicar = (status: ScraperStatus) => {
    statuses.set(status.fonteId, status);
    onStatusUpdate?.(status);
  };
  const publicarParcial = () => {
    onParcial?.(Array.from(eventos.values()).sort(compararPorDataHora));
  };

  // Passo 1: estado inicial honesto de TODAS as fontes catalogadas.

  
  for (const fonte of FONTES_OFICIAIS) {
    const fonteId = normalizar(fonte.sigla);
    if (fonte.integracao === 'pendente') {
      publicar({
        fonteId,
        nome: fonte.nome,
        uf: fonte.uf,
        status: 'pendente',
        totalEventos: 0,
        mensagem: 'Fonte catalogada; a coleta nesta casa ainda não foi implementada',
        ultimaChecagem: agoraTexto()
      });
    } else {
      publicar({
        fonteId,
        nome: fonte.nome,
        uf: fonte.uf,
        status: 'carregando',
        totalEventos: 0,
        mensagem: 'Consultando fonte oficial…',
        ultimaChecagem: agoraTexto()
      });
    }
  }

  // Passo 3: consultas reais, em paralelo, cada uma publicando o seu resultado.
  const integradas: Array<{
    sigla: string;
    nome: string;
    uf: string;
    executar: () => Promise<Extracao>;
  }> = [
    {
      sigla: 'Câmara',
      nome: 'Câmara dos Deputados (Dados Abertos)',
      uf: 'FEDERAL',
      executar: extrairCamara
    },
    {
      sigla: 'Senado',
      nome: 'Senado Federal (agenda de comissões)',
      uf: 'FEDERAL',
      executar: extrairSenado
    }
  ];

  // As 27 casas subnacionais são uma fonte só do ponto de vista da chamada (uma
  // requisição à função serverless), mas reportam status individualmente.
  const tarefas: Array<() => Promise<void>> = integradas.map((fonte) => async () => {
    const fonteId = normalizar(fonte.sigla);
    const inicio = Date.now();
    try {
      const extracao = await fonte.executar();
      extracao.eventos.forEach((e) => eventos.set(e.id, e));

      publicar({
        fonteId,
        nome: fonte.nome,
        uf: fonte.uf,
        status: 'sucesso',
        totalEventos: extracao.eventos.length,
        tempoMs: Date.now() - inicio,
        mensagem:
          extracao.eventos.length > 0
            ? `${extracao.eventos.length} evento(s) com mecanismo de participação. ${extracao.observacao || ''}`.trim()
            : `Consulta concluída sem eventos de participação. ${extracao.observacao || ''}`.trim(),
        ultimaChecagem: agoraTexto()
      });
    } catch (erro) {
      publicar({
        fonteId,
        nome: fonte.nome,
        uf: fonte.uf,
        status: 'erro',
        totalEventos: 0,
        tempoMs: Date.now() - inicio,
        mensagem: `Consulta falhou: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
        ultimaChecagem: agoraTexto()
      });
    }
    publicarParcial();
  });

  tarefas.push(async () => {
    const resultado = await consultarEstados();
    resultado.eventos.forEach((e) => eventos.set(e.id, e));
    resultado.statuses.forEach(publicar);
    publicarParcial();
  });

  await Promise.all(tarefas.map((tarefa) => tarefa()));

  return {
    eventos: Array.from(eventos.values()).sort(compararPorDataHora),
    statuses: Array.from(statuses.values())
  };
}

/**
 * Teste de uma fonte a partir do painel de diagnóstico.
 *
 * Antes este teste marcava `sucesso: true` para QUALQUER texto HTTP recebido,
 * inclusive página de captcha ou bloqueio do WAF, e informava
 * "Conexão bem sucedida" de forma fixa. Agora ele executa exatamente o mesmo
 * caminho de código da sincronização e relata o que foi realmente extraído.
 */
export interface ResultadoTesteFonte {
  fonte: (typeof FONTES_OFICIAIS)[number];
  sucesso: boolean;
  pendente?: boolean;
  tempoMs: number;
  statusCode?: number;
  urlConsultada?: string;
  respostaBruta: string;
  eventosEncontrados: number;
  ignorados?: number;
  mensagem: string;
}

export async function testarFonteIndividual(fonteSigla: string): Promise<ResultadoTesteFonte> {
  const alvo = normalizar(fonteSigla);
  const fonte = FONTES_OFICIAIS.find(
    (f) => normalizar(f.sigla) === alvo || f.uf.toLowerCase() === alvo
  );
  if (!fonte) {
    throw new Error(`Fonte não encontrada para a sigla ${fonteSigla}`);
  }

  if (fonte.integracao === 'pendente') {
    return {
      fonte,
      sucesso: false,
      pendente: true,
      tempoMs: 0,
      respostaBruta: '',
      eventosEncontrados: 0,
      mensagem:
        'Integração pendente: esta casa está catalogada, mas o app ainda não a consulta. ' +
        'Nenhuma requisição foi feita a este portal.'
    };
  }

  const inicio = Date.now();
  try {
    const extracao =
      normalizar(fonte.sigla) === 'camara' ? await extrairCamara() : await extrairSenado();

    const amostra = extracao.eventos
      .slice(0, 3)
      .map((e) => `${e.data} ${e.hora} — ${e.tema}`)
      .join('\n');

    return {
      fonte,
      sucesso: true,
      tempoMs: Date.now() - inicio,
      statusCode: 200,
      urlConsultada: extracao.urlConsultada,
      respostaBruta: amostra || 'Consulta bem-sucedida, sem eventos de participação no período.',
      eventosEncontrados: extracao.eventos.length,
      ignorados: extracao.ignorados,
      mensagem:
        `Consulta real executada. ${extracao.eventos.length} evento(s) com mecanismo de participação e ` +
        `${extracao.ignorados} registro(s) descartado(s) por não serem mecanismos. ` +
        'Um HTTP 200 isolado não garante saúde da fonte; o que vale é o que foi extraído.'
    };
  } catch (erro) {
    return {
      fonte,
      sucesso: false,
      tempoMs: Date.now() - inicio,
      respostaBruta: erro instanceof Error ? erro.message : 'Falha de rede ou timeout',
      eventosEncontrados: 0,
      mensagem: `Erro ao consultar ${fonte.sigla}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
    };
  }
}
