import type { Config, Context } from '@netlify/functions';
import { FUSO_BRASIL } from '../../shared/datas.ts';
import type { RespostaAgenda, ResultadoCasa } from '../../shared/coleta.ts';
import { buscarTexto } from './lib/http.mts';
import type { Adaptador } from './lib/adaptadores.mts';
import { comTeto } from './lib/tempo.mts';
import { montarRegistro } from './lib/registro.mts';

/**
 * Coleta a agenda das casas legislativas subnacionais.
 *
 * Por que isto é uma função serverless e não código no navegador: nenhum dos
 * portais das assembleias publica cabeçalho CORS, então o navegador não pode
 * lê-los. O servidor não tem essa restrição. É a única razão de existir backend
 * neste projeto — e também é o motivo de a função nunca devolver dado que não
 * tenha conseguido ler.
 *
 * Garantias:
 *  - cada casa reporta o SEU estado; uma falha não contamina as demais;
 *  - nenhuma casa é marcada como bem-sucedida sem ter sido consultada de fato;
 *  - requisições são limitadas em paralelo, para não sobrecarregar portais
 *    públicos com 27 acessos simultâneos;
 *  - o adaptador só publica evento com data interpretável e tema reconhecido
 *    como um dos cinco mecanismos; o resto é contado como descartado.
 */

/**
 * Limite de requisições simultâneas aos portais.
 *
 * Alto de propósito: são 15 casas e cada uma recebe UMA requisição, em domínios
 * diferentes — não é uma rajada contra um portal só. Em série ou em duas ondas,
 * a casa mais lenta (CLDF) definiria o tempo total e a função se aproximaria do
 * limite de 60 s da plataforma.
 */
const CONCORRENCIA = 16;

/**
 * Teto de tempo por casa, aplicado AQUI e não apenas dentro de cada adaptador.
 *
 * O número vem de medição, não de estimativa. As casas rodam TODAS em paralelo
 * (a concorrência é maior que o número de casas), então o tempo total da
 * invocação é o da casa mais lenta — baixar este teto baixa o tempo total.
 *
 * Em produção a plataforma cortou a invocação com HTTP 504 ("Inactivity
 * Timeout") antes de o código conseguir responder, e nenhum tratamento de erro
 * interno chega a rodar nesse caso: a resposta tem que sair, não ser tratada.
 * Com teto de 35 s isso acontecia de forma intermitente; com 12 s a invocação
 * cabe com folga.
 *
 * A causa de fundo é geográfica: a função roda por padrão em Ohio (EUA) e a
 * conexão até os portais brasileiros é muito mais lenta de lá — a CLDF levou
 * 10,5 s em produção contra 0,7 s local. A correção definitiva é mudar a região
 * da função para São Paulo (gru), que é ajuste de painel e não de código.
 */
const TETO_POR_CASA_MS = 12_000;

/**
 * Teto absoluto por casa, aplicado como trava.
 *
 * Como todas as casas rodam em paralelo, o tempo da invocação é o da mais lenta:
 * um adaptador com teto alto derruba a coleta INTEIRA por timeout da plataforma,
 * inclusive as casas que já tinham respondido. Esta trava garante que nenhum
 * adaptador, atual ou futuro, consiga empurrar a invocação para além do que a
 * plataforma tolera.
 */
const TETO_MAXIMO_POR_CASA_MS = 20_000;

/** TTL do cache em memória do contêiner (chamadas repetidas do mesmo usuário). */
const TTL_CACHE_MS = 10 * 60 * 1000;

const cache = new Map<string, { expira: number; resultado: ResultadoCasa[] }>();

/** Executa `tarefas` com no máximo `limite` em paralelo, preservando a ordem. */
async function emParalelo<T>(tarefas: Array<() => Promise<T>>, limite: number): Promise<T[]> {
  const saida = new Array<T>(tarefas.length);
  let proximo = 0;

  const trabalhadores = Array.from({ length: Math.min(limite, tarefas.length) }, async () => {
    while (true) {
      const indice = proximo++;
      if (indice >= tarefas.length) return;
      saida[indice] = await tarefas[indice]();
    }
  });

  await Promise.all(trabalhadores);
  return saida;
}

async function executarAdaptador(adaptador: Adaptador): Promise<ResultadoCasa> {
  const inicio = Date.now();
  const base: ResultadoCasa = {
    uf: adaptador.uf,
    sigla: adaptador.sigla,
    nome: adaptador.nome,
    situacao: adaptador.situacao,
    status: 'nao_implementado',
    eventos: [],
    ignorados: 0,
    tempoMs: 0,
    mensagem: adaptador.observacao
  };

  // Sem adaptador verificado não há requisição: o estado declarado já é a resposta.
  if (adaptador.situacao !== 'verificado' || !adaptador.executar) {
    return base;
  }

  try {
    const eventos = await comTeto(
      adaptador.executar({ buscarTexto }),
      Math.min(adaptador.tetoMs ?? TETO_POR_CASA_MS, TETO_MAXIMO_POR_CASA_MS)
    );
    return {
      ...base,
      status: eventos.length > 0 ? 'sucesso' : 'vazio',
      eventos,
      tempoMs: Date.now() - inicio,
      mensagem:
        eventos.length > 0
          ? `${eventos.length} evento(s) com mecanismo de participação`
          : 'Portal consultado; nenhum evento com mecanismo de participação foi encontrado no período'
    };
  } catch (erro) {
    return {
      ...base,
      status: 'erro',
      tempoMs: Date.now() - inicio,
      mensagem: `Falha ao consultar o portal: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
    };
  }
}

export default async (req: Request, _contexto: Context): Promise<Response> => {
  try {
    return await tratarRequisicao(req);
  } catch (erro) {
    // Uma falha inesperada aqui virava "502 - An unknown error has occurred",
    // que não diz nada a quem precisa consertar. Agora a resposta carrega o
    // motivo, e o app mostra a coleta das assembleias como indisponível com
    // essa informação em vez de um erro genérico.
    const motivo = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
    const pilha = erro instanceof Error ? (erro.stack || '').split('\n').slice(0, 4).join(' | ') : '';
    console.error('[agenda-estados] falha inesperada:', motivo, pilha);

    return new Response(
      JSON.stringify({
        gerado_em: new Date().toISOString(),
        fuso: FUSO_BRASIL,
        fonte: '/.netlify/functions/agenda-estados',
        casasIntegradas: 0,
        totalCasas: 0,
        eventos: 0,
        casas: [],
        erro: 'falha inesperada na coleta',
        motivo,
        pilha
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      }
    );
  }
};

async function tratarRequisicao(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pedidas = (url.searchParams.get('ufs') || '')
    .split(',')
    .map((uf) => uf.trim().toUpperCase())
    .filter(Boolean);
  const ignorarCache = url.searchParams.get('atualizar') === '1';

  const registro = montarRegistro();
  const alvo = pedidas.length > 0 ? registro.filter((a) => pedidas.includes(a.uf)) : registro;

  const chaveCache = alvo.map((a) => a.uf).sort().join(',');
  const emCache = cache.get(chaveCache);
  const usarCache = !ignorarCache && emCache && emCache.expira > Date.now();

  const casas = usarCache
    ? emCache.resultado
    : await emParalelo(
        // Só as casas verificadas geram requisição; as demais resolvem na hora.
        alvo.map((adaptador) => () => executarAdaptador(adaptador)),
        CONCORRENCIA
      );

  if (!usarCache) {
    cache.set(chaveCache, { expira: Date.now() + TTL_CACHE_MS, resultado: casas });
  }

  const integradas = casas.filter((c) => c.situacao === 'verificado').length;
  const resposta: RespostaAgenda = {
    gerado_em: new Date().toISOString(),
    fuso: FUSO_BRASIL,
    fonte: '/.netlify/functions/agenda-estados',
    casasIntegradas: integradas,
    totalCasas: casas.length,
    eventos: casas.reduce((soma, c) => soma + c.eventos.length, 0),
    casas
  };

  return new Response(JSON.stringify(resposta), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // O CDN pode servir a mesma resposta por 10 minutos; o corpo é idêntico
      // para todos os usuários, então isso não vaza dado de ninguém.
      // `stale-while-revalidate` curto de propósito: com 30 min, uma correção
      // publicada podia levar meia hora para aparecer, e a agenda podia ser
      // servida bem mais velha do que o rótulo "última consulta" sugere.
      'Cache-Control': usarCache
        ? 'public, max-age=600, stale-while-revalidate=120'
        : 'public, max-age=180, stale-while-revalidate=120',
      'Access-Control-Allow-Origin': '*',
      'X-Casas-Integradas': `${integradas}/${casas.length}`
    }
  });
};

/**
 * A rota pública é definida em `netlify.toml` (`/api/agenda-estados` →
 * `/.netlify/functions/agenda-estados`), e NÃO com `config.path` aqui.
 *
 * Motivo: quando `config.path` é declarado, a função deixa de responder na URL
 * padrão. Como o mesmo `netlify.toml` também tem o catch-all do SPA, declarar a
 * rota nos dois lugares cria duas regras apontando para caminhos diferentes e a
 * resolução passa a depender da ordem interna da plataforma. Uma regra só, no
 * arquivo cujo ordem é explícita e legível, é mais seguro.
 */
export const config: Config = {
  method: 'GET'
};
