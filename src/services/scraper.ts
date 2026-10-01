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

// 3. AMOSTRA ILUSTRATIVA — NÃO É DADO OFICIAL
//
// ATENÇÃO: os eventos abaixo foram escritos à mão para demonstrar a interface.
// As comissões, os números de proposição e os links de inscrição NÃO foram
// verificados contra nenhuma casa legislativa (boa parte dos links devolve 404)
// e as datas são calculadas em relação a hoje, então a amostra nunca "vence".
//
// Por isso ela vive atrás do modo de demonstração, DESLIGADO por padrão:
//  - todo registro recebe `origem: 'demonstracao'`;
//  - a interface marca cada item com o selo "Exemplo";
//  - nenhuma exportação (CSV/JSON/ICS) inclui estes registros.
//
// A versão anterior apresentava esta lista como "pautas reais" das 27
// assembleias, sem nunca consultar nenhuma delas.
export function gerarEventosDemonstracao(): Evento[] {
  const formatDateOffset = (offsetDays: number) => somaDiasISO(offsetDays);

  // `origem` é omitida aqui de propósito: ela é carimbada abaixo, em um único
  // lugar, para que nenhum registro desta amostra escape sem a marca
  // "demonstracao".
  const eventos: Omit<Evento, 'origem'>[] = [
    // FEDERAL - CÂMARA & SENADO
    {
      id: 'fed-camara-01',
      mecanismo: 'audiencia_publica',
      uf: 'DF',
      casa: 'Câmara',
      casa_nome: 'Câmara dos Deputados',
      nivel: 'federal',
      local: 'Anexo II, Plenário 12, Congresso Nacional, Brasília - DF',
      data: formatDateOffset(1),
      hora: '09:30',
      hora_fim: '13:00',
      tema: 'PL 2338/2023 - Regulação e Diretrizes Éticas para Inteligência Artificial no Brasil',
      comissao: 'Comissão de Ciência, Tecnologia e Inovação (CCTI)',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www2.camara.leg.br/atividade-legislativa/comissoes/comissoes-permanentes/ccti',
      link_transmissao: 'https://www.youtube.com/camaradosdeputadosoficial',
      inscricao: 'https://edemocracia.camara.leg.br/audiencias/sala/3589',
      proposicoes_relacionadas: ['PL 2338/2023', 'REQ 45/2024 CCTI'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://dadosabertos.camara.leg.br'
    },
    {
      id: 'fed-senado-02',
      mecanismo: 'consulta_publica',
      uf: 'DF',
      casa: 'Senado',
      casa_nome: 'Senado Federal',
      nivel: 'federal',
      local: 'Portal e-Cidadania - Participação Online',
      data: formatDateOffset(0),
      hora: '08:00',
      hora_fim: '23:59',
      prazo_contribuicao: formatDateOffset(18),
      tema: 'PEC 45/2019 - Regulamentação do Comitê Gestor do IBS e Transparência Federativa',
      comissao: 'Comissão de Assuntos Econômicos (CAE)',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www12.senado.leg.br/ecidadania/principalmateria?id=138450',
      link_transmissao: 'https://www.youtube.com/user/TVSenadoOficial',
      inscricao: 'https://www12.senado.leg.br/ecidadania',
      proposicoes_relacionadas: ['PEC 45/2019', 'PLP 68/2024'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www12.senado.leg.br/ecidadania'
    },
    {
      id: 'fed-senado-03',
      mecanismo: 'sugestao_legislativa',
      uf: 'DF',
      casa: 'Senado',
      casa_nome: 'Senado Federal (e-Cidadania)',
      nivel: 'federal',
      local: 'Portal e-Cidadania - Ideia Legislativa #184920',
      data: formatDateOffset(-2),
      hora: '10:00',
      prazo_contribuicao: formatDateOffset(45),
      tema: 'Ideia Legislativa nº 184.920: Criação do Programa Nacional de Crédito Estudantil sem Juros para Ensino Superior',
      comissao: 'Comissão de Direitos Humanos e Legislação Participativa (CDH)',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www12.senado.leg.br/ecidadania/visualizacaoideia?id=184920',
      inscricao: 'https://www12.senado.leg.br/ecidadania/apoio',
      proposicoes_relacionadas: ['SUG 184920'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www12.senado.leg.br/ecidadania'
    },
    {
      id: 'fed-camara-04',
      mecanismo: 'dialogo_social_plenaria',
      uf: 'DF',
      casa: 'Câmara',
      casa_nome: 'Câmara dos Deputados',
      nivel: 'federal',
      local: 'Auditório Nereu Ramos, Palácio do Congresso, Brasília - DF',
      data: formatDateOffset(3),
      hora: '14:00',
      hora_fim: '18:00',
      tema: 'Plenária Nacional com Povos Tradicionais e Comunidades Quilombolas sobre Transição Energética Justa',
      comissao: 'Comissão da Amazônia e dos Povos Originários e Tradicionais (CPOVOS)',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.camara.leg.br/noticias/plenaria-social-transicao-energetica',
      link_transmissao: 'https://www.youtube.com/camaradosdeputadosoficial',
      inscricao: 'https://forms.camara.leg.br/dialogo-social-cpovos',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.camara.leg.br'
    },
    {
      id: 'fed-camara-05',
      mecanismo: 'ordem_dia_tribuna_livre',
      uf: 'DF',
      casa: 'Câmara',
      casa_nome: 'Câmara dos Deputados',
      nivel: 'federal',
      local: 'Plenário Ulysses Guimarães, Congresso Nacional, Brasília - DF',
      data: formatDateOffset(2),
      hora: '16:00',
      hora_fim: '20:00',
      tema: 'Pequeno Expediente & Manifestação de Entidades da Sociedade Civil sobre o Orçamento da Saúde 2026',
      comissao: 'Mesa Diretora do Congresso Nacional',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.camara.leg.br/ordem-do-dia',
      link_transmissao: 'https://www.youtube.com/camaradosdeputadosoficial',
      inscricao: 'https://www.camara.leg.br/participacao-popular/inscricao-oradores',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://dadosabertos.camara.leg.br'
    },

    // SÃO PAULO - ALESP
    {
      id: 'sp-alesp-01',
      mecanismo: 'audiencia_publica',
      uf: 'SP',
      casa: 'ALESP',
      casa_nome: 'Assembleia Legislativa do Estado de São Paulo',
      nivel: 'estadual',
      local: 'Auditório Franco Montoro, Av. Pedro Álvares Cabral, 201 - Ibirapuera, São Paulo - SP',
      data: formatDateOffset(1),
      hora: '14:30',
      hora_fim: '18:00',
      tema: 'PL 456/2025 - Revisão das Alíquotas do ICMS para Medicamentos e Cesta Básica Paulista',
      comissao: 'Comissão de Finanças, Orçamento e Planejamento (CFOP)',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.sp.gov.br/comissoes/reunioes',
      link_transmissao: 'https://www.youtube.com/alesp',
      inscricao: 'https://www.al.sp.gov.br/participe/audiencias-publicas',
      proposicoes_relacionadas: ['PL 456/2025', 'PLC 12/2025'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.sp.gov.br'
    },
    {
      id: 'sp-alesp-02',
      mecanismo: 'consulta_publica',
      uf: 'SP',
      casa: 'ALESP',
      casa_nome: 'Assembleia Legislativa do Estado de São Paulo',
      nivel: 'estadual',
      local: 'Portal ALESP Aberta - Consulta Online',
      data: formatDateOffset(0),
      hora: '09:00',
      prazo_contribuicao: formatDateOffset(14),
      tema: 'Minuta do Plano Estadual de Adaptação às Mudanças Climáticas e Prevenção de Enchentes no Litoral e RMSP',
      comissao: 'Comissão de Meio Ambiente e Desenvolvimento Sustentável',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.al.sp.gov.br/participe/consultas-publicas',
      inscricao: 'https://www.al.sp.gov.br/participe/consultas-publicas/clima-2025',
      proposicoes_relacionadas: ['PL 890/2024'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.sp.gov.br'
    },
    {
      id: 'sp-alesp-03',
      mecanismo: 'ordem_dia_tribuna_livre',
      uf: 'SP',
      casa: 'ALESP',
      casa_nome: 'Assembleia Legislativa do Estado de São Paulo',
      nivel: 'estadual',
      local: 'Plenário Juscelino Kubitschek, Palácio 9 de Julho, São Paulo - SP',
      data: formatDateOffset(4),
      hora: '14:00',
      hora_fim: '15:30',
      tema: 'Tribuna Cidadã: Manifestação do Fórum Estadual de Defesa dos Direitos da Criança e do Adolescente',
      comissao: 'Mesa Diretora da ALESP',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.al.sp.gov.br/tribuna-livre',
      link_transmissao: 'https://www.youtube.com/alesp',
      inscricao: 'https://www.al.sp.gov.br/tribuna-livre/inscricoes',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.sp.gov.br'
    },

    // MINAS GERAIS - ALMG
    {
      id: 'mg-almg-01',
      mecanismo: 'audiencia_publica',
      uf: 'MG',
      casa: 'ALMG',
      casa_nome: 'Assembleia Legislativa de Minas Gerais',
      nivel: 'estadual',
      local: 'Plenarinho I, Rua Rodrigues Caldas, 30 - Santo Agostinho, Belo Horizonte - MG',
      data: formatDateOffset(2),
      hora: '10:00',
      hora_fim: '13:00',
      tema: 'Impactos da Mineração nas Bacias Hidrográficas do Rio das Velhas e Paraopeba: Medidas Compensatórias',
      comissao: 'Comissão de Meio Ambiente e Desenvolvimento Sustentável',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.almg.gov.br/atividade-parlamentar/agenda',
      link_transmissao: 'https://www.youtube.com/almg',
      inscricao: 'https://www.almg.gov.br/participe/audiencias-publicas',
      proposicoes_relacionadas: ['RQN 1204/2024'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.almg.gov.br'
    },
    {
      id: 'mg-almg-02',
      mecanismo: 'dialogo_social_plenaria',
      uf: 'MG',
      casa: 'ALMG',
      casa_nome: 'Assembleia Legislativa de Minas Gerais',
      nivel: 'estadual',
      local: 'Teatro da Assembleia, Belo Horizonte - MG',
      data: formatDateOffset(5),
      hora: '09:00',
      hora_fim: '17:00',
      tema: 'Encontro com Trabalhadores da Educação: Novo Plano de Carreira e Piso Salarial do Magistério Mineiro',
      comissao: 'Comissão de Educação, Ciência e Tecnologia',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.almg.gov.br/comissoes/agenda',
      link_transmissao: 'https://www.youtube.com/almg',
      inscricao: 'https://www.almg.gov.br/eventos/inscricao',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.almg.gov.br'
    },

    // RIO DE JANEIRO - ALERJ
    {
      id: 'rj-alerj-01',
      mecanismo: 'audiencia_publica',
      uf: 'RJ',
      casa: 'ALERJ',
      casa_nome: 'Assembleia Legislativa do Estado do Rio de Janeiro',
      nivel: 'estadual',
      local: 'Edifício Lúcio Costa, Rua da Ajuda, 5 - Centro, Rio de Janeiro - RJ',
      data: formatDateOffset(3),
      hora: '10:30',
      hora_fim: '14:00',
      tema: 'Tarifa Social e Concessões do Sistema Ferroviário (SuperVia) e Barcas na Região Metropolitana',
      comissao: 'Comissão de Transportes e Comunicações',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.alerj.rj.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/alerjtv',
      inscricao: 'https://www.alerj.rj.gov.br/participe',
      proposicoes_relacionadas: ['PL 2190/2024'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.alerj.rj.gov.br'
    },
    {
      id: 'rj-alerj-02',
      mecanismo: 'sugestao_legislativa',
      uf: 'RJ',
      casa: 'ALERJ',
      casa_nome: 'Assembleia Legislativa do Estado do Rio de Janeiro',
      nivel: 'estadual',
      local: 'Portal Legislação Participativa ALERJ',
      data: formatDateOffset(-1),
      hora: '11:00',
      prazo_contribuicao: formatDateOffset(30),
      tema: 'Sugestão Popular nº 44: Criação do Fundo Estadual de Apoio à Infraestrutura das Favelas da Baixada Fluminense',
      comissao: 'Comissão de Legislação Participativa (CLP)',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.alerj.rj.gov.br/legislacao-participativa',
      inscricao: 'https://www.alerj.rj.gov.br/apoie-sugestao/44',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.alerj.rj.gov.br'
    },

    // BAHIA - ALBA
    {
      id: 'ba-alba-01',
      mecanismo: 'audiencia_publica',
      uf: 'BA',
      casa: 'ALBA',
      casa_nome: 'Assembleia Legislativa da Bahia',
      nivel: 'estadual',
      local: 'Plenarinho da ALBA, 1ª Avenida do CAB, Salvador - BA',
      data: formatDateOffset(2),
      hora: '09:00',
      hora_fim: '12:30',
      tema: 'Transposição de Águas e Segurança Hídrica do Semiárido Baiano e Bacia do São Francisco',
      comissao: 'Comissão de Meio Ambiente, Seca e Recursos Hídricos',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.ba.gov.br/comissoes/agenda',
      link_transmissao: 'https://www.youtube.com/tvalba',
      inscricao: 'https://www.al.ba.gov.br/ouvidoria/audiencias',
      proposicoes_relacionadas: ['REQ 312/2025'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ba.gov.br'
    },
    {
      id: 'ba-alba-02',
      mecanismo: 'consulta_publica',
      uf: 'BA',
      casa: 'ALBA',
      casa_nome: 'Assembleia Legislativa da Bahia',
      nivel: 'estadual',
      local: 'Portal ALBA Cidadã',
      data: formatDateOffset(0),
      hora: '12:00',
      prazo_contribuicao: formatDateOffset(20),
      tema: 'Diretrizes para o Incentivo à Agroecologia e Agricultura Familiar no Estado da Bahia',
      comissao: 'Comissão de Agricultura e Política Rural',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.al.ba.gov.br/consultas-publicas',
      inscricao: 'https://www.al.ba.gov.br/participacao/agroecologia',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ba.gov.br'
    },

    // RIO GRANDE DO SUL - ALRS
    {
      id: 'rs-alrs-01',
      mecanismo: 'audiencia_publica',
      uf: 'RS',
      casa: 'ALRS',
      casa_nome: 'Assembleia Legislativa do Rio Grande do Sul',
      nivel: 'estadual',
      local: 'Solar dos Câmara, Praça Marechal Deodoro, 101 - Centro Histórico, Porto Alegre - RS',
      data: formatDateOffset(1),
      hora: '14:00',
      hora_fim: '17:30',
      tema: 'Reconstrução Climática do RS: Fortalecimento de Diques, Contenção de Cheias e Apoio aos Municípios Atingidos',
      comissao: 'Comissão Especial de Resiliência Climática e Defesa Civil',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.rs.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalrs',
      inscricao: 'https://www.al.rs.gov.br/participe/audiencias',
      proposicoes_relacionadas: ['PL 115/2024 RS'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.rs.gov.br'
    },
    {
      id: 'rs-alrs-02',
      mecanismo: 'ordem_dia_tribuna_livre',
      uf: 'RS',
      casa: 'ALRS',
      casa_nome: 'Assembleia Legislativa do Rio Grande do Sul',
      nivel: 'estadual',
      local: 'Plenário 20 de Setembro, Porto Alegre - RS',
      data: formatDateOffset(3),
      hora: '15:00',
      tema: 'Tribuna Popular: Cooperativas de Produtores Rurais e Recuperação Produtiva do Vale do Taquari',
      comissao: 'Mesa Diretora da ALRS',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.al.rs.gov.br/plenario',
      link_transmissao: 'https://www.youtube.com/tvalrs',
      inscricao: 'https://www.al.rs.gov.br/tribuna-popular',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.rs.gov.br'
    },

    // PARANÁ - ALEP
    {
      id: 'pr-alep-01',
      mecanismo: 'audiencia_publica',
      uf: 'PR',
      casa: 'ALEP',
      casa_nome: 'Assembleia Legislativa do Paraná',
      nivel: 'estadual',
      local: 'Plenarinho da ALEP, Centro Cívico, Curitiba - PR',
      data: formatDateOffset(2),
      hora: '09:30',
      hora_fim: '12:00',
      tema: 'Novo Modelo de Concessão dos Pedágios Paranaenses: Tarifas, Obras e Isenções',
      comissao: 'Comissão de Obras Públicas, Transportes e Comunicação',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.assembleia.pr.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvassembleiapr',
      inscricao: 'https://www.assembleia.pr.leg.br/inscricao-audiencia',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.assembleia.pr.leg.br'
    },

    // SANTA CATARINA - ALESC
    {
      id: 'sc-alesc-01',
      mecanismo: 'consulta_publica',
      uf: 'SC',
      casa: 'ALESC',
      casa_nome: 'Assembleia Legislativa de Santa Catarina',
      nivel: 'estadual',
      local: 'Portal ALESC Cidadão',
      data: formatDateOffset(1),
      prazo_contribuicao: formatDateOffset(21),
      hora: '09:00',
      tema: 'Marco Regulatório Catarinense de Incentivo a Startups e Inovação Tecnológica (Inova SC)',
      comissao: 'Comissão de Economia, Ciência e Tecnologia',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.alesc.sc.gov.br/agenda',
      inscricao: 'https://www.alesc.sc.gov.br/consultas-publicas',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.alesc.sc.gov.br'
    },

    // PERNAMBUCO - ALEPE
    {
      id: 'pe-alepe-01',
      mecanismo: 'dialogo_social_plenaria',
      uf: 'PE',
      casa: 'ALEPE',
      casa_nome: 'Assembleia Legislativa de Pernambuco',
      nivel: 'estadual',
      local: 'Auditório Ênio Guerra, Rua da União, 397 - Boa Vista, Recife - PE',
      data: formatDateOffset(4),
      hora: '14:00',
      hora_fim: '17:30',
      tema: 'Plenária de Combate ao Racismo Religioso e Salvaguarda dos Terreiros Tradicionais de Pernambuco',
      comissao: 'Comissão de Cidadania, Direitos Humanos e Participação Popular',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.alepe.pe.gov.br/comissoes',
      link_transmissao: 'https://www.youtube.com/tvalepe',
      inscricao: 'https://www.alepe.pe.gov.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.alepe.pe.gov.br'
    },

    // CEARÁ - ALECE
    {
      id: 'ce-alece-01',
      mecanismo: 'audiencia_publica',
      uf: 'CE',
      casa: 'ALECE',
      casa_nome: 'Assembleia Legislativa do Estado do Ceará',
      nivel: 'estadual',
      local: 'Complexo das Comissões Técnicas, Av. Desembargador Moreira, 2807 - Dionísio Torres, Fortaleza - CE',
      data: formatDateOffset(3),
      hora: '14:30',
      hora_fim: '17:00',
      tema: 'Hub do Hidrogênio Verde no Porto do Pecém: Impactos Socioambientais e Empregos para a Juventude',
      comissao: 'Comissão de Indústria, Desenvolvimento Econômico e Turismo',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.ce.gov.br/comissoes',
      link_transmissao: 'https://www.youtube.com/tvalce',
      inscricao: 'https://www.al.ce.gov.br/audiencias',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ce.gov.br'
    },

    // GOIÁS - ALEGO
    {
      id: 'go-alego-01',
      mecanismo: 'audiencia_publica',
      uf: 'GO',
      casa: 'ALEGO',
      casa_nome: 'Assembleia Legislativa de Goiás',
      nivel: 'estadual',
      local: 'Palácio Maguito Vilela, Sala das Comissões, Goiânia - GO',
      data: formatDateOffset(1),
      hora: '15:00',
      hora_fim: '18:00',
      tema: 'Crédito Rural e Apoio aos Produtores Atingidos por Queimadas no Cerrado Goiano',
      comissao: 'Comissão de Agricultura, Pecuária e Cooperativismo',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://portal.al.go.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalego',
      inscricao: 'https://portal.al.go.leg.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://portal.al.go.leg.br'
    },

    // DISTRITO FEDERAL - CLDF
    {
      id: 'df-cldf-01',
      mecanismo: 'audiencia_publica',
      uf: 'DF',
      casa: 'CLDF',
      casa_nome: 'Câmara Legislativa do Distrito Federal',
      nivel: 'distrital',
      local: 'Plenário da CLDF, Eixo Monumental, Praça do Buriti, Brasília - DF',
      data: formatDateOffset(2),
      hora: '19:00',
      hora_fim: '22:00',
      tema: 'PDU - Plano Diretor de Ordenamento Territorial (PDOT) e Regularização Fundiária das Cidades Satélites',
      comissao: 'Comissão de Assuntos Fundiários (CAF)',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.cl.df.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvcamaradistrital',
      inscricao: 'https://www.cl.df.gov.br/inscricao-audiencia',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.cl.df.gov.br'
    },

    // ESPÍRITO SANTO - ALES
    {
      id: 'es-ales-01',
      mecanismo: 'consulta_publica',
      uf: 'ES',
      casa: 'ALES',
      casa_nome: 'Assembleia Legislativa do Espírito Santo',
      nivel: 'estadual',
      local: 'Portal ALES Digital',
      data: formatDateOffset(0),
      hora: '09:00',
      prazo_contribuicao: formatDateOffset(25),
      tema: 'Regulamentação das Atividades Portuárias e Redução de Poluição por Poeira Negra na Grande Vitória',
      comissao: 'Comissão de Proteção ao Meio Ambiente e Recursos Hídricos',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.al.es.gov.br/comissoes',
      inscricao: 'https://www.al.es.gov.br/participe/consultas',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.es.gov.br'
    },

    // PARÁ - ALEPA
    {
      id: 'pa-alepa-01',
      mecanismo: 'dialogo_social_plenaria',
      uf: 'PA',
      casa: 'ALEPA',
      casa_nome: 'Assembleia Legislativa do Pará',
      nivel: 'estadual',
      local: 'Auditório João Batista, Palácio Cabanagem, Belém - PA',
      data: formatDateOffset(5),
      hora: '09:30',
      hora_fim: '15:00',
      tema: 'Diálogo Preparatório para a COP 30: Participação dos Municípios Ribeirinhos e Guardiões da Floresta',
      comissao: 'Comissão de Meio Ambiente e Bioeconomia',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.alepa.pa.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalepa',
      inscricao: 'https://www.alepa.pa.gov.br/cop30-sociedade',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.alepa.pa.gov.br'
    },

    // AMAZONAS - ALEAM
    {
      id: 'am-aleam-01',
      mecanismo: 'audiencia_publica',
      uf: 'AM',
      casa: 'ALEAM',
      casa_nome: 'Assembleia Legislativa do Amazonas',
      nivel: 'estadual',
      local: 'Auditório Belarmino Lins, Av. Mário Ypiranga Monteiro, 3950 - Parque Dez, Manaus - AM',
      data: formatDateOffset(3),
      hora: '10:00',
      hora_fim: '13:00',
      tema: 'Navegabilidade dos Rios e Dragagem Crítica durante a Estiagem na Bacia do Rio Negro e Solimões',
      comissao: 'Comissão de Geodiversidade, Recursos Hídricos e Mineração',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.aleam.gov.br/comissoes',
      link_transmissao: 'https://www.youtube.com/tvaleam',
      inscricao: 'https://www.aleam.gov.br/participacao-popular',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.aleam.gov.br'
    },

    // MARANHÃO - ALEMA
    {
      id: 'ma-alema-01',
      mecanismo: 'audiencia_publica',
      uf: 'MA',
      casa: 'ALEMA',
      casa_nome: 'Assembleia Legislativa do Maranhão',
      nivel: 'estadual',
      local: 'Sala das Comissões Neiva Moreira, Calhau, São Luís - MA',
      data: formatDateOffset(4),
      hora: '09:00',
      hora_fim: '12:00',
      tema: 'Universalização do Saneamento Básico e Abastecimento de Água nos Municípios dos Lençóis Maranhenses',
      comissao: 'Comissão de Meio Ambiente e Desenvolvimento Sustentável',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.al.ma.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalema',
      inscricao: 'https://www.al.ma.gov.br/audiencias-publicas',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ma.gov.br'
    },

    // MATO GROSSO - ALMT
    {
      id: 'mt-almt-01',
      mecanismo: 'audiencia_publica',
      uf: 'MT',
      casa: 'ALMT',
      casa_nome: 'Assembleia Legislativa de Mato Grosso',
      nivel: 'estadual',
      local: 'Auditório Deputado Milton Figueiredo, Centro Político Administrativo, Cuiabá - MT',
      data: formatDateOffset(2),
      hora: '14:00',
      hora_fim: '17:30',
      tema: 'Combate e Prevenção a Incêndios Florestais no Bioma Pantanal e Chapada dos Guimarães',
      comissao: 'Comissão de Meio Ambiente, Recursos Hídricos e Recursos Minerais',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.mt.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalmt',
      inscricao: 'https://www.al.mt.gov.br/audiencias-participativas',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.mt.gov.br'
    },

    // MATO GROSSO DO SUL - ALEMS
    {
      id: 'ms-alems-01',
      mecanismo: 'audiencia_publica',
      uf: 'MS',
      casa: 'ALEMS',
      casa_nome: 'Assembleia Legislativa de Mato Grosso do Sul',
      nivel: 'estadual',
      local: 'Plenário Júlio Maia, Parque dos Poderes, Campo Grande - MS',
      data: formatDateOffset(3),
      hora: '09:00',
      hora_fim: '12:00',
      tema: 'Rota Bioceânica: Integração Logística e Oportunidades Comerciais para Municípios de Fronteira',
      comissao: 'Comissão de Acompanhamento da Rota Bioceânica',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.ms.gov.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalems',
      inscricao: 'https://www.al.ms.gov.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ms.gov.br'
    },

    // RIO GRANDE DO NORTE - ALRN
    {
      id: 'rn-alrn-01',
      mecanismo: 'audiencia_publica',
      uf: 'RN',
      casa: 'ALRN',
      casa_nome: 'Assembleia Legislativa do Rio Grande do Norte',
      nivel: 'estadual',
      local: 'Auditório Cortez Pereira, Praça 7 de Setembro - Cidade Alta, Natal - RN',
      data: formatDateOffset(1),
      hora: '14:00',
      hora_fim: '17:00',
      tema: 'Expansão dos Parques Eólicos Offshore e Convivência com as Comunidades Pesqueiras Artesanais',
      comissao: 'Comissão de Desenvolvimento Econômico e Meio Ambiente',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.rn.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalrn',
      inscricao: 'https://www.al.rn.leg.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.rn.leg.br'
    },

    // PARAÍBA - ALPB
    {
      id: 'pb-alpb-01',
      mecanismo: 'audiencia_publica',
      uf: 'PB',
      casa: 'ALPB',
      casa_nome: 'Assembleia Legislativa da Paraíba',
      nivel: 'estadual',
      local: 'Plenário Deputado José Lacerda Neto, Praça João Pessoa - Centro, João Pessoa - PB',
      data: formatDateOffset(2),
      hora: '10:00',
      hora_fim: '13:00',
      tema: 'Segurança Alimentar e Criação do Banco Estadual de Alimentos Contra a Desnutrição no Sertão Paraibano',
      comissao: 'Comissão de Saúde e Desenvolvimento Social',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.pb.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalpb',
      inscricao: 'https://www.al.pb.leg.br/inscricao-social',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.pb.leg.br'
    },

    // ALAGOAS - ALEAL
    {
      id: 'al-aleal-01',
      mecanismo: 'audiencia_publica',
      uf: 'AL',
      casa: 'ALEAL',
      casa_nome: 'Assembleia Legislativa de Alagoas',
      nivel: 'estadual',
      local: 'Plenário Tércio Andrade, Praça Dom Pedro II - Centro, Maceió - AL',
      data: formatDateOffset(3),
      hora: '09:30',
      hora_fim: '13:30',
      tema: 'Indenizações Justas e Acompanhamento Geológico dos Bairros Afetados pelo Afundamento do Solo em Maceió',
      comissao: 'Comissão Especial de Acompanhamento do Caso Braskem',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.al.leg.br/comissoes',
      link_transmissao: 'https://www.youtube.com/tvaleal',
      inscricao: 'https://www.al.al.leg.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.al.leg.br'
    },

    // SERGIPE - ALESE
    {
      id: 'se-alese-01',
      mecanismo: 'consulta_publica',
      uf: 'SE',
      casa: 'ALESE',
      casa_nome: 'Assembleia Legislativa de Sergipe',
      nivel: 'estadual',
      local: 'Portal ALESE Aberta',
      data: formatDateOffset(0),
      prazo_contribuicao: formatDateOffset(15),
      hora: '10:00',
      tema: 'Marco Regulatório Estadual do Gás Natural e Polo de Fertilizantes em Sergipe',
      comissao: 'Comissão de Economia e Finanças',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.al.se.leg.br/agenda',
      inscricao: 'https://www.al.se.leg.br/consultas-publicas',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.se.leg.br'
    },

    // PIAUÍ - ALEPI
    {
      id: 'pi-alepi-01',
      mecanismo: 'audiencia_publica',
      uf: 'PI',
      casa: 'ALEPI',
      casa_nome: 'Assembleia Legislativa do Piauí',
      nivel: 'estadual',
      local: 'Auditório Deputado Waldemar Macêdo, Teresina - PI',
      data: formatDateOffset(2),
      hora: '10:00',
      hora_fim: '12:30',
      tema: 'Energia Solar e Produção de Hidrogênio Verde na Planície Litorânea de Parnaíba',
      comissao: 'Comissão de Meio Ambiente e Sustentabilidade',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.pi.leg.br/comissoes',
      link_transmissao: 'https://www.youtube.com/tvalepi',
      inscricao: 'https://www.al.pi.leg.br/audiencias',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.pi.leg.br'
    },

    // TOCANTINS - ALETO
    {
      id: 'to-aleto-01',
      mecanismo: 'dialogo_social_plenaria',
      uf: 'TO',
      casa: 'ALETO',
      casa_nome: 'Assembleia Legislativa do Tocantins',
      nivel: 'estadual',
      local: 'Auditório Deputado João Batista de Brito Miranda, Praça dos Girassóis, Palmas - TO',
      data: formatDateOffset(4),
      hora: '14:00',
      hora_fim: '17:00',
      tema: 'Direitos Territoriais dos Povos Indígenas Karajá e Xerente e Preservação da Ilha do Bananal',
      comissao: 'Comissão de Defesa dos Direitos Humanos e Cidadania',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.al.to.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvaleto',
      inscricao: 'https://www.al.to.leg.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.to.leg.br'
    },

    // RONDÔNIA - ALERO
    {
      id: 'ro-alero-01',
      mecanismo: 'audiencia_publica',
      uf: 'RO',
      casa: 'ALERO',
      casa_nome: 'Assembleia Legislativa de Rondônia',
      nivel: 'estadual',
      local: 'Plenário Lúcia Tereza Rodrigues dos Santos, Porto Velho - RO',
      data: formatDateOffset(1),
      hora: '15:00',
      hora_fim: '18:00',
      tema: 'Manutenção Crítica e Asfaltamento Sustentável da BR-319 com Garantias Socioambientais',
      comissao: 'Comissão de Obras e Serviços Públicos',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.ro.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalero',
      inscricao: 'https://www.al.ro.leg.br/audiencias',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ro.leg.br'
    },

    // ACRE - ALEAC
    {
      id: 'ac-aleac-01',
      mecanismo: 'audiencia_publica',
      uf: 'AC',
      casa: 'ALEAC',
      casa_nome: 'Assembleia Legislativa do Acre',
      nivel: 'estadual',
      local: 'Plenário Deputado Francisco Cartaxo, Rua Arlindo Leite, 26 - Centro, Rio Branco - AC',
      data: formatDateOffset(2),
      hora: '09:00',
      hora_fim: '12:00',
      tema: 'Prevenção e Ações Emergenciais para as Enchentes do Rio Acre e Seca Extrema na Amazônia Sul-Ocidental',
      comissao: 'Comissão de Meio Ambiente e Defesa Civil',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.al.ac.leg.br/comissoes',
      link_transmissao: 'https://www.youtube.com/tvaleac',
      inscricao: 'https://www.al.ac.leg.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ac.leg.br'
    },

    // AMAPÁ - ALEAP
    {
      id: 'ap-aleap-01',
      mecanismo: 'consulta_publica',
      uf: 'AP',
      casa: 'ALEAP',
      casa_nome: 'Assembleia Legislativa do Amapá',
      nivel: 'estadual',
      local: 'Portal ALEAP Cidadã',
      data: formatDateOffset(1),
      prazo_contribuicao: formatDateOffset(28),
      hora: '10:00',
      tema: 'Exploração Sustentável na Margem Equatorial e Royalties do Petróleo para Saúde e Educação no Amapá',
      comissao: 'Comissão de Indústria, Comércio, Minas e Energia',
      tipo_reuniao: 'virtual',
      link_oficial: 'https://www.al.ap.leg.br/agenda',
      inscricao: 'https://www.al.ap.leg.br/consultas',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.al.ap.leg.br'
    },

    // RORAIMA - ALERR
    {
      id: 'rr-alerr-01',
      mecanismo: 'dialogo_social_plenaria',
      uf: 'RR',
      casa: 'ALERR',
      casa_nome: 'Assembleia Legislativa de Roraima',
      nivel: 'estadual',
      local: 'Auditório Deputada Lenir Rodrigues, Praça do Centro Cívico, Boa Vista - RR',
      data: formatDateOffset(3),
      hora: '09:00',
      hora_fim: '13:00',
      tema: 'Acolhimento Humanitário aos Migrantes e Fortalecimento dos Serviços de Saúde nos Municípios de Pacaraima e Boa Vista',
      comissao: 'Comissão de Direitos Humanos, Migração e Relações Internacionais',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://al.rr.leg.br/agenda',
      link_transmissao: 'https://www.youtube.com/tvalerr',
      inscricao: 'https://al.rr.leg.br/participe',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://al.rr.leg.br'
    },

    // CÂMARAS MUNICIPAIS (Exemplos representativos de capitais brasileiras)
    {
      id: 'mun-sp-01',
      mecanismo: 'audiencia_publica',
      uf: 'SP',
      casa: 'CMSP',
      casa_nome: 'Câmara Municipal de São Paulo',
      nivel: 'municipal',
      local: 'Salão Nobre da Câmara Municipal de SP, Viaduto Jacareí, 100 - Bela Vista, São Paulo - SP',
      data: formatDateOffset(2),
      hora: '19:00',
      hora_fim: '22:00',
      tema: 'Revisão da Lei de Zoneamento Urbano e Proteção do Patrimônio Histórico do Centro da Capital',
      comissao: 'Comissão de Política Urbana, Metropolitana e Meio Ambiente',
      tipo_reuniao: 'hibrida',
      link_oficial: 'https://www.saopaulo.sp.leg.br/audiencias-publicas',
      link_transmissao: 'https://www.youtube.com/camarasaopaulo',
      inscricao: 'https://www.saopaulo.sp.leg.br/participe-audiencias',
      proposicoes_relacionadas: ['PL 127/2024 CMSP'],
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.saopaulo.sp.leg.br'
    },
    {
      id: 'mun-rj-01',
      mecanismo: 'ordem_dia_tribuna_livre',
      uf: 'RJ',
      casa: 'CMRJ',
      casa_nome: 'Câmara Municipal do Rio de Janeiro',
      nivel: 'municipal',
      local: 'Palácio Pedro Ernesto, Praça Floriano, s/n - Cinelândia, Rio de Janeiro - RJ',
      data: formatDateOffset(1),
      hora: '14:00',
      hora_fim: '15:30',
      tema: 'Tribuna Livre do Cidadão: Representantes das Comunidades sobre o Transporte Complementar (Vans e BRT)',
      comissao: 'Mesa Diretora da CMRJ',
      tipo_reuniao: 'presencial',
      link_oficial: 'https://www.rio.rj.leg.br/tribuna-livre',
      link_transmissao: 'https://www.youtube.com/camarario',
      inscricao: 'https://www.rio.rj.leg.br/inscricao-tribuna',
      status: 'confirmado',
      data_extracao: new Date().toISOString(),
      fonte: 'https://www.rio.rj.leg.br'
    }
  ];

  // Marca toda a amostra como demonstração — é o que impede que ela seja
  // contada como dado oficial ou incluída em exportações.
  return eventos.map((evento) => ({ ...evento, origem: 'demonstracao' as const }));
}

// 3-b. Assembleias estaduais e distrital — via função serverless
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
  /** Acrescenta a amostra ilustrativa (selo "Exemplo", fora das exportações). */
  incluirDemonstracao?: boolean;
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
  const { incluirDemonstracao = false, onStatusUpdate, onParcial } = opcoes;

  const statuses = new Map<string, ScraperStatus>();
  const eventos = new Map<string, Evento>();

  const publicar = (status: ScraperStatus) => {
    statuses.set(status.fonteId, status);
    onStatusUpdate?.(status);
  };
  const publicarParcial = () => {
    onParcial?.(Array.from(eventos.values()).sort(compararPorDataHora));
  };

  // Passo 1: o que não depende de rede entra imediatamente na tela.
  if (incluirDemonstracao) {
    gerarEventosDemonstracao().forEach((e) => eventos.set(e.id, e));
    publicarParcial();
  }

  // Passo 2: estado inicial honesto de TODAS as fontes catalogadas.
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
