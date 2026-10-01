/*
 * Service Worker do LegisParticipa.
 *
 * Correções em relação à versão anterior:
 *  - a versão do cache foi elevada (v2). Sem isso, quem já tinha o site
 *    instalado continuaria recebendo o bundle antigo, porque o cache antigo
 *    nunca era invalidado dentro do mesmo nome;
 *  - os caminhos passaram a ser relativos ao escopo do SW. Antes o registro
 *    usava "/sw.js" e o manifest "/manifest.json" em caminhos absolutos, o que
 *    quebra o app quando publicado em subpasta (GitHub Pages);
 *  - o app shell é pré-cacheado de fato, então a segunda visita funciona
 *    offline mesmo sem ter navegado por todas as rotas;
 *  - respostas de API externa NUNCA são cacheadas. Um dado oficial servido do
 *    cache seria apresentado como atual sem ser.
 */

const VERSAO = 'v2';
const CACHE_SHELL = `legisparticipa-shell-${VERSAO}`;
const CACHE_ASSETS = `legisparticipa-assets-${VERSAO}`;

/** Resolve um caminho relativo ao escopo do service worker. */
const noEscopo = (caminho) => new URL(caminho, self.registration.scope).href;

const SHELL = [noEscopo('./'), noEscopo('./index.html'), noEscopo('./manifest.json')];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(SHELL))
      .catch((erro) => {
        // Falha de pré-cache não deve impedir a instalação do SW.
        console.warn('[sw] pré-cache parcialmente falhou:', erro);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((chave) => chave !== CACHE_SHELL && chave !== CACHE_ASSETS)
            .map((chave) => caches.delete(chave))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Fontes oficiais e qualquer terceiro: sempre rede, nunca cache.
  if (url.origin !== self.location.origin) {
    return; // deixa o navegador tratar normalmente
  }

  // 2. API interna (função serverless): também sempre rede.
  //    `url.origin` é igual ao do app aqui, então sem esta regra o
  //    stale-while-revalidate do passo 4 serviria uma AGENDA VELHA como se
  //    fosse atual — exatamente o tipo de mentira que este projeto removeu.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/functions/')) {
    return;
  }

  // 3. Navegação: rede primeiro, com o shell como reserva offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_SHELL).then((cache) => cache.put(noEscopo('./index.html'), copia));
          return resposta;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_SHELL);
          return (
            (await cache.match(noEscopo('./index.html'))) ||
            (await cache.match(noEscopo('./'))) ||
            new Response('Você está offline e o app ainda não foi visitado.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            })
          );
        })
    );
    return;
  }

  // 4. Recursos estáticos do próprio app: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_ASSETS).then(async (cache) => {
      const emCache = await cache.match(request);
      const daRede = fetch(request)
        .then((resposta) => {
          if (resposta.ok) cache.put(request, resposta.clone());
          return resposta;
        })
        .catch(() => null);

      if (emCache) return emCache;
      const resposta = await daRede;
      return (
        resposta ||
        new Response('Recurso indisponível offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      );
    })
  );
});
