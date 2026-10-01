/**
 * Testes do framework de coleta.
 *
 * POR QUE ISTO EXISTE: a coleta das assembleias vai depender de dezenas de
 * parsers escritos à mão contra HTML de governos, que é malformado e muda sem
 * aviso. As peças compartilhadas (interpretação de data, classificação de
 * mecanismo, leitura de tabela) são o que impede um parser novo de publicar
 * lixo. Elas precisam de teste próprio.
 *
 * Roda sem nenhuma dependência, com o test runner do próprio Node:
 *   npm run test:parsers
 *
 * O que estes testes protegem, em ordem de importância:
 *  1. a classificação NUNCA inventa mecanismo por padrão;
 *  2. um registro sem data ou sem tema é descartado, não completado;
 *  3. accent e charset não corrompem o texto que chega ao cidadão.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classificarMecanismo, pareceRegistroDeTeste } from '../shared/mecanismos.ts';
import { interpretarDataBR, inferirAno, instanteDoEventoLocal } from '../shared/datas.ts';
import { normalizar, decodificarEntidades, limparTexto } from '../shared/texto.ts';
import {
  adaptadorDeJson,
  adaptadorDeTabela,
  mapearColunas,
  montarEventoBruto
} from '../netlify/functions/lib/adaptadores.mts';
import { linhasDeTabela, elementosPorClasse, urlAbsoluta } from '../netlify/functions/lib/html.mts';
import { comTeto } from '../netlify/functions/lib/tempo.mts';

// ─────────────────────────────────────────────── classificação de mecanismo

test('classifica audiência pública e os demais mecanismos', () => {
  assert.equal(classificarMecanismo('Audiência Pública sobre saúde mental'), 'audiencia_publica');
  assert.equal(classificarMecanismo('AUDIÊNCIA PÚBLICA INTERATIVA'), 'audiencia_publica');
  assert.equal(classificarMecanismo('Consulta Pública sobre a minuta do plano'), 'consulta_publica');
  assert.equal(classificarMecanismo('Sugestão Legislativa nº 12'), 'sugestao_legislativa');
  assert.equal(classificarMecanismo('Ideia Legislativa sobre transporte'), 'sugestao_legislativa');
  assert.equal(classificarMecanismo('Diálogo Social com movimentos populares'), 'dialogo_social_plenaria');
  assert.equal(classificarMecanismo('Tribuna Livre: manifestação popular'), 'ordem_dia_tribuna_livre');
});

test('NÃO classifica reunião comum como mecanismo de participação', () => {
  // Este é o defeito que motivou a regra: o default antigo era audiência pública.
  assert.equal(classificarMecanismo('Sorteio de vagas para o Estágio-Visita'), null);
  assert.equal(classificarMecanismo('Reunião Técnica'), null);
  assert.equal(classificarMecanismo('Sessão Não Deliberativa Solene'), null);
  assert.equal(classificarMecanismo('Instalação e Eleição da Mesa'), null);
  assert.equal(classificarMecanismo(''), null);
  assert.equal(classificarMecanismo(null), null);
});

test('a expressão "ordem do dia" sozinha NÃO basta', () => {
  // Toda reunião deliberativa traz "ORDEM DO DIA" na pauta. Aceitar isso
  // rotulava sessão deliberativa comum como espaço de fala cidadã.
  assert.equal(classificarMecanismo('I - LEITURA DO EXPEDIENTE II - ORDEM DO DIA Item 1'), null);
  assert.equal(classificarMecanismo('Ordem do dia com Tribuna Livre'), 'ordem_dia_tribuna_livre');
});

test('detecta registros de teste publicados pelas próprias casas', () => {
  assert.equal(pareceRegistroDeTeste('AUDIENCIA TESTE'), true);
  assert.equal(pareceRegistroDeTeste('Homologação do sistema'), true);
  assert.equal(pareceRegistroDeTeste('Audiência Pública sobre saneamento'), false);
});

// ────────────────────────────────────────────────────────── datas

test('interpreta os formatos de data que os portais usam', () => {
  assert.deepEqual(interpretarDataBR('05/10/2026'), { data: '2026-10-05' });
  assert.deepEqual(interpretarDataBR('5/10/2026'), { data: '2026-10-05' });
  assert.deepEqual(interpretarDataBR('05/10/26'), { data: '2026-10-05' });
  assert.deepEqual(interpretarDataBR('2026-10-05'), { data: '2026-10-05' });
  assert.deepEqual(interpretarDataBR('05-10-2026'), { data: '2026-10-05' });
  assert.deepEqual(interpretarDataBR('05/10/2026 14h30'), { data: '2026-10-05', hora: '14:30' });
  assert.deepEqual(interpretarDataBR('05/10/2026 às 09:00'), { data: '2026-10-05', hora: '09:00' });
  assert.deepEqual(interpretarDataBR('05 de outubro de 2026'), { data: '2026-10-05' });
  assert.deepEqual(interpretarDataBR('2026-10-05T14:30:00'), { data: '2026-10-05', hora: '14:30' });
});

test('NÃO inventa data quando o formato é desconhecido ou inválido', () => {
  assert.equal(interpretarDataBR('sem data'), null);
  assert.equal(interpretarDataBR(''), null);
  assert.equal(interpretarDataBR(null), null);
  // 31/02 não existe: o Date normalizaria para 03/03 em silêncio.
  assert.equal(interpretarDataBR('31/02/2026'), null);
  assert.equal(interpretarDataBR('45/13/2026'), null);
});

test('infere o ano de datas sem ano, sem cair no passado distante', () => {
  const ref = new Date(2026, 8, 30); // 30/09/2026
  assert.equal(inferirAno(15, 11, ref), 2026); // novembro ainda vem
  assert.equal(inferirAno(1, 3, ref), 2027); // março já passou → ano seguinte
});

test('instante final considera hora_fim, depois hora, depois fim do dia', () => {
  assert.equal(
    instanteDoEventoLocal({ data: '2026-10-05', hora: '09:00', hora_fim: '17:30' }).getHours(),
    17
  );
  assert.equal(instanteDoEventoLocal({ data: '2026-10-05', hora: '09:00' }).getHours(), 9);
  assert.equal(instanteDoEventoLocal({ data: '2026-10-05' }).getHours(), 23);
});

// ────────────────────────────────────────────────── texto e charset

test('normaliza acentos para busca', () => {
  assert.equal(normalizar('Audiência Pública'), 'audiencia publica');
  assert.equal(normalizar('  EDUCAÇÃO   Básica '), 'educacao basica');
  assert.equal(normalizar('Orçamento'), 'orcamento');
});

test('decodifica entidades HTML', () => {
  assert.equal(decodificarEntidades('Sa&uacute;de &amp; Educa&ccedil;&atilde;o'), 'Saúde & Educação');
  assert.equal(decodificarEntidades('&#65;&#x42;'), 'AB');
  assert.equal(decodificarEntidades('&nbsp;'), ' ');
});

test('limparTexto colapsa espaços e trunca com reticências', () => {
  assert.equal(limparTexto('  a   b \n c  '), 'a b c');
  assert.equal(limparTexto('x'.repeat(500)).length, 400);
  assert.ok(limparTexto('x'.repeat(500)).endsWith('…'));
});

// ─────────────────────────────────────────────────────── HTML

const TABELA_EXEMPLO = `
<div class="agenda">
  <table class="tabela-agenda">
    <thead>
      <tr><th>Data</th><th>Hora</th><th>Tema</th><th>Comissão</th><th>Local</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>05/10/2026</td><td>14h30</td>
        <td><a href="/evento/123">Audiência Pública sobre sa&uacute;de mental</a></td>
        <td>Comissão de Saúde</td><td>Plenário 3</td>
      </tr>
      <tr>
        <td>06/10/2026</td><td>10:00</td>
        <td><a href="/evento/124">Reunião Deliberativa Ordinária</a></td>
        <td>Comissão de Finanças</td><td>Plenário 1</td>
      </tr>
      <tr>
        <td>07/10/2026</td><td>09:00</td>
        <td><a href="/evento/125">Sorteio de vagas para o Estágio-Visita</a></td>
        <td>Diretoria</td><td>Sala 2</td>
      </tr>
      <tr>
        <td>08/10/2026</td><td>11:00</td>
        <td><a href="/evento/126">AUDIENCIA TESTE</a></td>
        <td>TI</td><td>Sala 9</td>
      </tr>
      <tr>
        <td>sem data definida</td><td>—</td>
        <td><a href="/evento/127">Consulta Pública sobre a minuta do plano</a></td>
        <td>Comissão de Meio Ambiente</td><td>—</td>
      </tr>
      <tr>
        <td>12/11/2026</td><td>15:00</td>
        <td><a href="/evento/128">Tribuna Livre: manifestação da comunidade</a></td>
        <td>Mesa Diretora</td><td>Plenário</td>
      </tr>
    </tbody>
  </table>
</div>`;

test('lê as células de uma tabela sem parser estrito', () => {
  const linhas = linhasDeTabela(TABELA_EXEMPLO);
  // 1 cabeçalho + 6 linhas
  assert.equal(linhas.length, 7);
  assert.deepEqual(linhas[0].celulas, ['Data', 'Hora', 'Tema', 'Comissão', 'Local']);
  assert.equal(linhas[1].celulas[0], '05/10/2026');
});

test('mapeia colunas pelo cabeçalho, não por índice fixo', () => {
  const mapa = mapearColunas(['Data', 'Hora', 'Tema', 'Comissão', 'Local']);
  assert.equal(mapa.data, 0);
  assert.equal(mapa.hora, 1);
  assert.equal(mapa.tema, 2);
  assert.equal(mapa.comissao, 3);
  assert.equal(mapa.local, 4);
});

test('extrai por classe com aninhamento', () => {
  const html = `
    <div class="card"><div class="card">interno</div>externo</div>
    <div class="outro">ignorado</div>`;
  const cards = elementosPorClasse(html, 'div', 'card');
  assert.equal(cards.length, 1);
  assert.ok(cards[0].includes('interno'));
  assert.ok(cards[0].includes('externo'));
});

test('resolve URL relativa e recusa esquemas não-http', () => {
  assert.equal(urlAbsoluta('https://www.al.sp.gov.br/agenda', '/evento/1'), 'https://www.al.sp.gov.br/evento/1');
  assert.equal(urlAbsoluta('https://a.leg.br/x/', 'y/z'), 'https://a.leg.br/x/y/z');
  assert.equal(urlAbsoluta('https://a.leg.br/', 'javascript:void(0)'), null);
  assert.equal(urlAbsoluta('https://a.leg.br/', '#ancora'), null);
  assert.equal(urlAbsoluta('https://a.leg.br/', null), null);
});

// ────────────────────────────────── adaptador de tabela ponta a ponta

test('adaptador de tabela publica só o que é mecanismo, e descarta o resto', async () => {
  const adaptador = adaptadorDeTabela({
    uf: 'SP',
    sigla: 'TESTE',
    nome: 'Casa de Teste',
    url: 'https://exemplo.leg.br/agenda',
    base: 'https://exemplo.leg.br/agenda',
    observacao: 'adaptador de teste'
  });

  const eventos = await adaptador.executar!({
    buscarTexto: async () => ({
      corpo: TABELA_EXEMPLO,
      status: 200,
      contentType: 'text/html; charset=utf-8',
      bytes: TABELA_EXEMPLO.length,
      urlFinal: 'https://exemplo.leg.br/agenda',
      charset: 'utf-8'
    })
  });

  // Publicados: audiência pública (linha 1) e tribuna livre (linha 6).
  // Descartados: reunião deliberativa, sorteio de vagas, registro de teste
  //              e a linha sem data interpretável.
  assert.equal(eventos.length, 2, `esperava 2 eventos, veio ${eventos.length}`);

  const audiencia = eventos.find((e) => e.mecanismo === 'audiencia_publica');
  assert.ok(audiencia, 'a audiência pública deveria estar presente');
  assert.equal(audiencia!.data, '2026-10-05');
  assert.equal(audiencia!.hora, '14:30');
  assert.equal(audiencia!.tema, 'Audiência Pública sobre saúde mental');
  assert.equal(audiencia!.comissao, 'Comissão de Saúde');
  assert.equal(audiencia!.local, 'Plenário 3');
  assert.equal(audiencia!.link, 'https://exemplo.leg.br/evento/123');

  const tribuna = eventos.find((e) => e.mecanismo === 'ordem_dia_tribuna_livre');
  assert.ok(tribuna, 'a tribuna livre deveria estar presente');
  assert.equal(tribuna!.data, '2026-11-12');

  // Nada de "Sorteio de vagas" ou "AUDIENCIA TESTE" na saída.
  assert.ok(!eventos.some((e) => /sorteio|teste/i.test(e.tema)));
});

test('montarEventoBruto devolve null em vez de completar lacunas', () => {
  assert.equal(montarEventoBruto({ tema: 'Audiência Pública sobre X' }), null, 'sem data');
  assert.equal(montarEventoBruto({ dataBruta: '05/10/2026' }), null, 'sem tema');
  assert.equal(montarEventoBruto({ dataBruta: '05/10/2026', tema: 'abc' }), null, 'tema curto demais');
  assert.equal(
    montarEventoBruto({ dataBruta: '05/10/2026', tema: 'Reunião Técnica de rotina' }),
    null,
    'não é mecanismo'
  );

  const ok = montarEventoBruto({
    dataBruta: '05/10/2026',
    horaBruta: '14h30',
    tema: 'Audiência Pública sobre saneamento',
    comissao: 'Comissão de Meio Ambiente'
  });
  assert.ok(ok);
  assert.equal(ok!.data, '2026-10-05');
  assert.equal(ok!.hora, '14:30');
  assert.equal(ok!.mecanismo, 'audiencia_publica');
});

test('aceita o mecanismo como valor de enum (underscore), como as APIs publicam', () => {
  // Sem isto, o campo tipado da fonte — a melhor evidência possível — não casava
  // com nenhuma regra, e o adaptador do Paraná devolvia zero eventos.
  assert.equal(classificarMecanismo('audiencia_publica'), 'audiencia_publica');
  assert.equal(classificarMecanismo('consulta_publica'), 'consulta_publica');
  assert.equal(classificarMecanismo('dialogo_social_plenaria'), 'dialogo_social_plenaria');
  assert.equal(classificarMecanismo('ordem_dia_tribuna_livre'), 'ordem_dia_tribuna_livre');
  assert.equal(classificarMecanismo('sugestao_legislativa'), 'sugestao_legislativa');
});

test('reconhece título com erro de digitação oficial e diálogo com nome próprio', () => {
  // A ALESP publica "AUDIÊNCIA PÚBLIA"; exigir a palavra inteira descartaria
  // audiências reais.
  assert.equal(classificarMecanismo('AUDIÊNCIA PÚBLIA SOBRE SANEAMENTO'), 'audiencia_publica');
  assert.equal(classificarMecanismo('2ª Audiência Pública - PL 1316/2025'), 'audiencia_publica');
  // A ALECE dá nome próprio ao seu programa de diálogo social.
  assert.equal(classificarMecanismo('Alece Diálogo'), 'dialogo_social_plenaria');
});

test('00:00 da fonte é tratado como ausência de horário, não como meia-noite', () => {
  const evento = montarEventoBruto({
    dataBruta: '05/10/2026',
    horaBruta: '00:00',
    tema: 'Audiência Pública sobre mobilidade urbana'
  });
  assert.ok(evento);
  assert.equal(evento!.hora, undefined);
});

test('lista na raiz do JSON é aceita (caminho vazio)', async () => {
  const adaptador = adaptadorDeJson({
    uf: 'XX',
    sigla: 'TESTE',
    nome: 'Casa de Teste',
    url: 'https://exemplo.leg.br/api',
    base: 'https://exemplo.leg.br',
    caminhoDaLista: '',
    observacao: 'teste',
    mapear: (r: any) => ({
      dataBruta: r.start,
      tema: r.title,
      contextoMecanismo: r.className?.[0]
    })
  });

  const eventos = await adaptador.executar!({
    buscarTexto: async () => ({
      corpo: JSON.stringify([
        { start: '2026-10-13T14:30:00-03:00', title: 'Audiência Pública do orçamento', className: ['audiencia_publica'] },
        { start: '2026-10-14T10:00:00-03:00', title: 'Reunião Deliberativa Ordinária', className: ['reuniao'] }
      ]),
      status: 200,
      contentType: 'application/json',
      bytes: 10,
      urlFinal: 'https://exemplo.leg.br/api',
      charset: 'utf-8'
    })
  });

  assert.equal(eventos.length, 1, 'só a audiência deve entrar');
  assert.equal(eventos[0].data, '2026-10-13');
  assert.equal(eventos[0].hora, '14:30');
});

// ───────────────────────────────────────── teto de tempo

test('comTeto devolve o valor quando a promessa resolve a tempo', async () => {
  const valor = await comTeto(Promise.resolve('ok'), 200);
  assert.equal(valor, 'ok');
});

test('comTeto rejeita com mensagem clara quando o tempo esgota', async () => {
  const lenta = new Promise((resolve) => setTimeout(() => resolve('tarde demais'), 300));
  await assert.rejects(() => comTeto(lenta, 20), /tempo esgotado/);
});

