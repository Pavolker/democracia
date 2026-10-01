/**
 * Cliente HTTP da função serverless.
 *
 * Diferenças relevantes em relação a um `fetch` cru:
 *  - identifica-se honestamente (User-Agent com o nome do projeto e uma URL),
 *    em vez de se passar por navegador. É o mínimo que um coletor cívico deve
 *    fazer ao consumir portais públicos;
 *  - decodifica corretamente páginas em ISO-8859-1/Windows-1252, comuns em
 *    portais de governo brasileiros, onde ler como UTF-8 corrompe acentos;
 *  - limita o tamanho da resposta durante o streaming, para que um portal que
 *    devolva 50 MB não derrube a função;
 *  - tenta novamente uma vez em falhas transitórias (timeout, 429, 5xx), com
 *    espera crescente e respeito ao `Retry-After`.
 */

const UA =
  'LegisParticipa/1.0 (agregador cívico de participação legislativa; +https://github.com/Pavolker/democracy)';

export interface RespostaTexto {
  corpo: string;
  status: number;
  contentType: string | null;
  bytes: number;
  urlFinal: string;
  /** Charset efetivamente usado na decodificação. */
  charset: string;
}

export interface OpcoesRequisicao {
  /** Limite de bytes lidos do corpo. Padrão: 4 MB. */
  limiteBytes?: number;
  timeoutMs?: number;
  tentativas?: number;
  headers?: Record<string, string>;
  /**
   * Método HTTP. A ALEPE, por exemplo, só entrega a agenda mediante POST de
   * formulário — a listagem não existe em GET.
   */
  metodo?: 'GET' | 'POST';
  /** Corpo enviado no POST. Um objeto vira `application/x-www-form-urlencoded`. */
  corpo?: string | Record<string, string>;
}

export class ErroHTTP extends Error {
  // Campo declarado e atribuído explicitamente, em vez de "parameter property":
  // o modo de apagamento de tipos do Node (usado pelos testes) não suporta
  // `constructor(readonly x)`.
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ErroHTTP';
    this.status = status;
  }
}

function normalizarCharset(bruto: string | undefined): string {
  const c = (bruto || '').toLowerCase().replace(/["']/g, '');
  if (c === 'iso-8859-1' || c === 'latin1' || c === 'latin-1' || c === 'cp1252' || c === 'windows-1252') {
    return 'windows-1252';
  }
  if (c === 'utf8') return 'utf-8';
  return c || 'utf-8';
}

/** Descobre o charset pelo cabeçalho e, se preciso, por um `<meta>` no início. */
function detectarCharset(contentType: string | null, bytesIniciais: Uint8Array): string {
  const doCabecalho = contentType?.match(/charset\s*=\s*([\w-]+)/i)?.[1];
  if (doCabecalho) return normalizarCharset(doCabecalho);

  // Prévia em latin1: basta para ler a declaração <meta charset> em ASCII.
  const previa = new TextDecoder('windows-1252').decode(bytesIniciais.slice(0, 2048));
  const doMeta =
    previa.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i)?.[1] ||
    previa.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i)?.[1];
  return normalizarCharset(doMeta);
}

function decodificar(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    // Charset desconhecido pelo runtime: cai para UTF-8 em vez de falhar.
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Lê o corpo com teto de bytes, abortando o streaming ao ultrapassar. */
async function lerComLimite(resposta: Response, limiteBytes: number): Promise<Uint8Array> {
  const corpo = resposta.body;
  if (!corpo) return new Uint8Array(await resposta.arrayBuffer());

  const leitor = corpo.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limiteBytes) {
      await leitor.cancel().catch(() => undefined);
      throw new ErroHTTP(`resposta excedeu o limite de ${Math.round(limiteBytes / 1024)} KB`);
    }
    pedacos.push(value);
  }

  const saida = new Uint8Array(total);
  let deslocamento = 0;
  for (const pedaco of pedacos) {
    saida.set(pedaco, deslocamento);
    deslocamento += pedaco.byteLength;
  }
  return saida;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Executa uma requisição e devolve o corpo como texto já decodificado. */
export async function buscarTexto(url: string, opcoes: OpcoesRequisicao = {}): Promise<RespostaTexto> {
  const {
    limiteBytes = 4 * 1024 * 1024,
    timeoutMs = 20_000,
    tentativas = 2,
    headers = {},
    metodo = 'GET',
    corpo
  } = opcoes;

  const corpoSerializado =
    corpo === undefined || typeof corpo === 'string'
      ? corpo
      : new URLSearchParams(corpo).toString();

  const cabecalhosDoCorpo: Record<string, string> =
    corpoSerializado !== undefined
      ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
      : {};

  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const resposta = await fetch(url, {
        method: metodo,
        body: corpoSerializado,
        signal: controlador.signal,
        redirect: 'follow',
        credentials: 'omit',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5',
          ...cabecalhosDoCorpo,
          ...headers
        }
      });

      // 429 e 5xx são transitórios: vale uma segunda tentativa.
      if (resposta.status === 429 || resposta.status >= 500) {
        const retryAfter = Number(resposta.headers.get('retry-after'));
        if (tentativa < tentativas) {
          await esperar(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 800);
          continue;
        }
        throw new ErroHTTP(`HTTP ${resposta.status}`, resposta.status);
      }

      if (!resposta.ok) {
        throw new ErroHTTP(`HTTP ${resposta.status}`, resposta.status);
      }

      const contentType = resposta.headers.get('content-type');
      const bytes = await lerComLimite(resposta, limiteBytes);
      const charset = detectarCharset(contentType, bytes);

      return {
        corpo: decodificar(bytes, charset),
        status: resposta.status,
        contentType,
        bytes: bytes.byteLength,
        urlFinal: resposta.url || url,
        charset
      };
    } catch (erro) {
      ultimoErro = erro;
      clearTimeout(timer);

      // 4xx não se resolve repetindo (exceto 429, tratado acima).
      if (erro instanceof ErroHTTP && erro.status && erro.status < 500 && erro.status !== 429) {
        throw erro;
      }
      if (tentativa < tentativas) {
        await esperar(600 * tentativa);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const detalhe = ultimoErro instanceof Error ? ultimoErro.message : 'erro desconhecido';
  throw new ErroHTTP(`falha ao consultar ${url}: ${detalhe}`);
}
