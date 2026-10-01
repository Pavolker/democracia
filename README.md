# 🏛️ LegisParticipa — Agenda de Participação Cidadã

> Agenda dos **cinco mecanismos de participação cidadã** do Legislativo brasileiro, consultados **direto nas fontes oficiais** — sem servidor intermediário e sem dados inventados.

[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff?logo=vite)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-instalável-57534e)](https://web.dev/progressive-web-apps/)

---

## ⚠️ Cobertura real das fontes (leia antes de tudo)

A honestidade sobre a cobertura é uma regra do projeto. **Não** descreva este app como "monitor nacional das 29 casas" — ele não é. Cada casa tem o seu próprio estado, verificado contra o portal real e reportado individualmente na tela *Fontes & Cobertura*.

### Federal — direto no navegador

| Fonte | Situação | Endpoint |
| :--- | :--- | :--- |
| **Câmara dos Deputados** | ✅ Integrada | `dadosabertos.camara.leg.br/api/v2/eventos` |
| **Senado Federal** | ✅ Integrada | `legis.senado.leg.br/dadosabertos/comissao/agenda/{AAAAMMDD}/{AAAAMMDD}.json` |

### Subnacional — via função serverless

**15 casas com coleta implementada:**

| UF | Casa | Como é coletada |
| :--- | :--- | :--- |
| MG | ALMG | API de dados abertos documentada; `naturezaReuniao: AUDIENCIA_PUBLICA` |
| DF | CLDF | Exportação CSV do portal, com coluna oficial de tipo |
| MS | ALEMS | Tabela com coluna `Tipo de Evento` |
| RO | ALERO | API REST SAPL (coleção de audiências) |
| PB | ALPB | API REST SAPL (audiência no nome da reunião) |
| PR | ALEP | API JSON própria, com filtro de tipo no servidor |
| SP | ALESP | Arquivo XML de dados abertos, um por ano |
| CE | ALECE | Agenda de espaços, com janela de datas na URL |
| MT | ALMT | Páginas diárias + índice JSON de dias com evento |
| PE | ALEPE | POST de formulário (não existe em GET) |
| RJ | ALERJ | Tabela servida por sistema Lotus Notes legado |
| RS | ALRS | API JSON em porta não padrão, achada no JS do portal |
| GO | ALEGO | Agenda renderizada só quando a data vai na URL |
| PI | ALEPI | API REST SAPL; módulo sem registro novo desde 2023 |
| RR | ALERR | API REST SAPL; funciona como arquivo, não agenda |

**12 casas verificadas SEM fonte de audiência** (`sem_agenda`) — o portal foi inspecionado e **não publica** audiências públicas. Isso está registrado explicitamente porque é diferente de "ainda não mapeado": não adianta escrever um parser.

`AC · AL · AM · AP · BA · ES · MA · PA · RN · SC · SE · TO`

Exemplos do que foi encontrado ali: **BA** tem o filtro "Audiência Pública" no sistema de sessões mas ele devolve zero registros (o mesmo filtro com "Ordinária" devolve 217 páginas — ou seja, a ausência é real) e o portal está sob suspensão eleitoral até 25/10/2026; **ES** publica 4.582 eventos de 2017 até hoje, **nenhum futuro**; **SC** responde zero para "audiência" na busca do próprio portal, contra 22 para "reunião"; **TO** tem a API de audiências funcionando, com zero registros desde sempre.

### ⚠️ Limitação operacional conhecida: região da função

A função roda por padrão na região `cmh` (Ohio, EUA), e **três casas não são alcançáveis de lá**:

| Casa | Comportamento da região padrão | Daqui (Brasil) |
| :--- | :--- | :--- |
| DF (CLDF) | falha de conexão após 10,5 s | conecta em 0,22 s, responde em 1,9 s |
| PE (ALEPE) | estoura o orçamento de 12 s | responde em 9 s |
| RS (ALRS) | estoura o orçamento de 12 s | responde em 0,7 s |

Não é limitação dos portais: é distância. Para corrigir, mude a região da função para **São Paulo (`gru`)** em *Project configuration → Cloud compute → Functions → Region*, no painel da Netlify. Enquanto isso, o app mostra as três como falha na coleta, e a mensagem diz exatamente isso.

A função usa orçamento de **12 s por consulta** — não um teto por casa — porque ela espera todas as casas antes de responder: uma casa lenta atrasaria a resposta de todas, inclusive das que já terminaram. Quem não cabe no orçamento é reportado como não respondido, e o cache de 10 minutos do contêiner faz a consulta seguinte aproveitar melhor.

### Por que existe um backend

Nenhum portal de assembleia estadual publica cabeçalho CORS, então o navegador não consegue lê-los. O servidor não tem essa restrição. **Essa é a única razão de haver backend neste projeto** — e é também o motivo de a função nunca devolver dado que não tenha conseguido ler.

Observações técnicas aprendidas na integração (documentadas para não se repetirem):

- A API de Dados Abertos do Senado **não tem endpoint de audiência** (o spec OpenAPI em `/dadosabertos/v3/api-docs` tem 157 rotas e nenhuma contém "audien"). Audiências públicas aparecem como reuniões de comissão, identificadas pelo nó `partes` com nome `"Audiência Pública Interativa"`.
- Os dois proxies CORS públicos usados antes (`api.allorigins.win`, `corsproxy.io`) estão mortos (522 e 403). **Nenhum proxy é necessário**: Câmara e Senado enviam `access-control-allow-origin: *`.
- A agenda do Senado **trunca respostas grandes** e, ao truncar, perde os eventos futuros. O app fatia a janela em blocos de 12 dias por isso.
- O Senado envia `access-control-allow-credentials: true` junto de `allow-origin: *` (combinação inválida); as requisições usam `credentials: 'omit'`.
- **A ALMG identifica a audiência por campo (`naturezaReuniao`), não pelo título**: lá uma audiência pública se chama "Reunião Ordinária" e traz a comissão no subtítulo. Classificar por texto perderia todas.
- **O filtro de tipo da CLDF é aproximado**: pedir "Audiência Pública" também devolve "Audiência Pública Remota", então a filtragem é refeita por igualdade no adaptador.
- **O SAPL ignora `?ordering=`** silenciosamente — ordenar no cliente é obrigatório, senão a consulta "mais recente" devolve dados de anos atrás.
- **Charset varia por endpoint, não por casa**: na ALESP o XML de dados abertos é UTF-8 e a página de agenda é ISO-8859-1; a ALERJ serve a listagem em UTF-8 e o detalhe em ISO-8859-1.
- **Entidades HTML variam por casa**: a ALES usa decimal (`&#227;`), a ALEMS usa hexadecimal (`&#xEA;`). As duas decodificam para a mesma coisa, mas um decodificador que só trate uma forma corrompe acentos na outra.
- O `User-Agent` da função identifica o projeto honestamente, em vez de se passar por navegador. É o mínimo que um coletor cívico deve fazer ao consumir portais públicos.

---

## 📌 Os 5 mecanismos monitorados

| Mecanismo | Descrição |
| :--- | :--- |
| 🔴 **Audiência Pública** | Debate aberto sobre proposições e temas de relevância coletiva. |
| 🟠 **Consulta Pública** | Recebimento formal de contribuições e pareceres. |
| 🟡 **Sugestão Legislativa** | Iniciativas populares em coleta de apoios. |
| 🟢 **Diálogo Social / Plenária** | Reuniões ampliadas com movimentos sociais e conselhos. |
| 🔵 **Ordem do Dia / Tribuna Livre** | Espaço regimental de fala para representantes da comunidade. |

**Como um registro entra na agenda:** a classificação usa os campos estruturais das APIs (`descricaoTipo` na Câmara, `partes` no Senado) e é **conservadora** — um registro que não corresponde a nenhum dos cinco mecanismos é **descartado**, e o app informa quantos foram descartados. Antes, o `default` da classificação era "Audiência Pública", o que rotulava "Sorteio de vagas para o Estágio-Visita" como oportunidade de participação.

---

## ✨ Recursos

- 🗺️ **Mapa do Brasil** (desenho esquemático, não cartográfico) com contagem por UF e teclado acessível.
- 📅 **Calendário térmico** mensal, com dias já transcorridos diferenciados.
- 🔍 **Filtros** por UF, mecanismo, período, casa, esfera e situação — **busca sem acento**, compartilhável por URL.
- 🔗 **Deep linking**: todo recorte vira link (`#aba=eventos&uf=MG&periodo=semana`).
- 🔖 **Filtros salvos**: guarde temas de interesse e veja o que casa com eles.
  *Não é um serviço de notificação* — a conferência roda só enquanto a aba está aberta. O app não envia e-mail nem push.
- 📆 **Exportação**: `.ics` conforme RFC 5545 (com `TZID` e `VTIMEZONE`), Google Calendar, CSV e JSON.
- 🧪 **Modo demonstração** (desligado por padrão): amostra ilustrativa para exercitar a interface, sempre com selo **Exemplo** e **sempre fora das exportações**.
- 🛠️ **Painel de cobertura das fontes**: o que é coletado, o que falhou e o que ainda não foi implementado.
- 🌓 Tema claro, escuro e sistema. 📱 PWA instalável, com funcionamento offline do app shell.

---

## 🔐 Privacidade e integridade

- Tudo roda no navegador; nenhum dado pessoal é enviado a servidores de terceiros.
- Favoritos, histórico e filtros salvos ficam apenas em `localStorage`.
- Nada de `dangerouslySetInnerHTML`; todo conteúdo de fonte externa é renderizado como texto.
- **Dados de demonstração nunca saem do app**: `filtrarParaExportacao()` remove qualquer registro com `origem: 'demonstracao'` antes de gerar CSV, JSON ou `.ics`.
- O cache tem versionamento (`CACHE_VERSAO_ATUAL`): um cache de formato antigo é descartado em vez de ser lido com regras novas.

---

## 🚀 Como executar

```bash
npm install
npm run dev            # http://localhost:3000 — inclui as funções serverless
npm run build          # gera dist/
npm run lint           # tsc --noEmit (strict)
npm run test:parsers   # testes do framework de coleta (sem dependências)
npm run verificar:fontes   # roda cada adaptador contra o portal real
npm run verificar:fontes -- SP,PR   # só algumas casas
```

`npm run dev` já emula as funções: o `@netlify/vite-plugin` está registrado em `vite.config.ts` e sobe a função `/api/agenda-estados` dentro do próprio Vite. Não é preciso usar o Netlify CLI.

O Netlify é o alvo principal de publicação, porque é o único que executa as funções. Publicado apenas como site estático (por exemplo, no GitHub Pages), o app continua funcionando com Câmara e Senado, e as assembleias aparecem como indisponíveis **com o motivo real** — nunca como se tivessem sido consultadas.

---

## 🏗️ Estrutura

```text
shared/                    # Código usado pelo front-end E pela função (fonte única)
├── mecanismos.ts          # Tipo + classificação conservadora dos 5 mecanismos
├── datas.ts               # Datas locais (nunca UTC) + leitura de datas brasileiras
├── texto.ts               # Normalização sem acento, limpeza de HTML
└── coleta.ts              # Contrato entre a função e o app

netlify/functions/
├── agenda-estados.mts     # Função: coleta as 27 casas, reporta o estado de cada uma
└── lib/
    ├── http.mts           # fetch com timeout, charset, limite de bytes e retry
    ├── html.mts           # extração tolerante de HTML (tabelas, blocos, links)
    ├── adaptadores.mts    # framework: validação, classificação, fábrica de tabela
    └── registro.mts       # ⚠️ fonte da verdade sobre o que é coletado

scripts/testar-parsers.mts # Testes do framework de coleta

src/
├── components/            # Interface (mapa, calendário, cartões, modais, filtros)
├── services/
│   ├── scraper.ts         # Câmara + Senado + chamada à função das assembleias
│   ├── config.ts          # Mecanismos, UFs e catálogo de fontes
│   ├── eventos.ts         # Regras de domínio: filtragem, contagem, exportação
│   ├── datas.ts           # Reexporta `shared/datas` + helpers de Evento
│   ├── texto.ts           # Reexporta `shared/texto` + busca de evento
│   ├── storage.ts         # localStorage versionado
│   ├── calendarExport.ts  # ICS/CSV/JSON
│   └── url.ts             # Estado da interface na URL
├── types/                 # Tipos de domínio
├── App.tsx                # Orquestração de estado
└── main.tsx               # Entrada React 19
```

### Convenções que evitam a volta dos bugs corrigidos

1. **Nunca derive datas de `toISOString()`** — use `shared/datas.ts` (fuso `America/Sao_Paulo`).
2. **Nunca rotule um registro como mecanismo por `default`** — `classificarMecanismo` devolve `null` e quem chama conta o descarte.
3. **Nunca marque uma casa como coletada sem consultá-la** — no `registro.mts`, um adaptador só executa com `situacao: 'verificado'`, e isso é garantido pelo tipo.
4. **Nunca complete lacuna com valor plausível** — `montarEventoBruto` devolve `null` quando falta data ou tema.
5. **Nunca exporte sem passar por `filtrarParaExportacao()`**.
6. **`origem` é obrigatória em `Evento`** — o compilador não deixa um registro esquecer de onde veio.
7. **Ao adicionar um adaptador, rode `npm run test:parsers`** — o framework que ele usa tem teste próprio.

---

## ⚖️ Licença

Distribuído sob licença aberta, com fins cívicos e de transparência pública.
