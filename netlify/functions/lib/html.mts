import { decodificarEntidades, limparTexto, normalizar } from '../../../shared/texto.ts';

/**
 * Ferramentas de extração de HTML.
 *
 * Não é um parser de verdade — é um extrator tolerante, porque portais de
 * assembleias legislativas costumam servir HTML malformado, sem fechamento de
 * tags e com tabelas aninhadas. Um parser estrito falharia onde um extrator
 * tolerante funciona.
 *
 * A regra que vale para todo adaptador: se a extração não encontrar os campos
 * obrigatórios (data e tema), o registro é DESCARTADO e contado como descartado.
 * Nunca se preenche lacuna com valor inventado.
 */

const CACHE_REGEX = new Map<string, RegExp>();

function regex(chave: string, fonte: string, flags: string): RegExp {
  let r = CACHE_REGEX.get(chave);
  if (!r) {
    r = new RegExp(fonte, flags);
    CACHE_REGEX.set(chave, r);
  }
  r.lastIndex = 0;
  return r;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Texto visível de um trecho de HTML, já sem tags e sem entidades. */
export function texto(html: string | null | undefined): string {
  return limparTexto(decodificarEntidades((html || '').replace(/<[^>]*>/g, ' ')), 4000);
}

/** Valor de um atributo dentro de uma tag HTML já isolada. */
export function atributo(tagHtml: string, nome: string): string | null {
  const m = tagHtml.match(regex(`attr-${nome}`, `\\b${escaparRegex(nome)}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return decodificarEntidades(m[2] ?? m[3] ?? m[4] ?? '');
}

/** Primeiro link (`href` + texto) encontrado em um trecho de HTML. */
export function primeiroLink(html: string): { href: string; texto: string } | null {
  const m = html.match(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i);
  if (!m) return null;
  return {
    href: decodificarEntidades(m[2] ?? m[3] ?? m[4] ?? ''),
    texto: texto(m[5])
  };
}

/** Todos os links de um documento, na ordem em que aparecem. */
export function links(html: string): Array<{ href: string; texto: string }> {
  const saida: Array<{ href: string; texto: string }> = [];
  const re = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    saida.push({
      href: decodificarEntidades(m[2] ?? m[3] ?? m[4] ?? ''),
      texto: texto(m[5])
    });
  }
  return saida;
}

/** Converte um href relativo em URL absoluta. Devolve null para esquemas não-http. */
export function urlAbsoluta(base: string, href: string | null | undefined): string | null {
  if (!href) return null;
  const limpo = href.trim();
  if (!limpo || limpo.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(limpo)) return null;
  try {
    return new URL(limpo, base).href;
  } catch {
    return null;
  }
}

/**
 * Encontra o índice do fechamento do elemento aberto antes de `de`,
 * respeitando aninhamento do mesmo nome de tag.
 */
function fimDoElemento(html: string, tag: string, de: number): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  re.lastIndex = de;
  let profundidade = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[2] === '/') continue; // tag auto-fechada
    if (m[1] === '/') {
      if (profundidade === 0) return m.index;
      profundidade--;
    } else {
      profundidade++;
    }
  }
  return html.length;
}

/**
 * Extrai o conteúdo interno de todos os elementos `tag` cuja `class` contenha
 * o nome informado. Tolera classes múltiplas e aspas simples ou duplas.
 */
export function elementosPorClasse(html: string, tag: string, classe: string): string[] {
  const abertura = new RegExp(
    `<${tag}\\b[^>]*class\\s*=\\s*("([^"]*)"|'([^']*)')[^>]*>`,
    'gi'
  );
  const alvo = normalizar(classe);
  const saida: string[] = [];

  let m: RegExpExecArray | null;
  while ((m = abertura.exec(html))) {
    const classes = normalizar(m[2] ?? m[3] ?? '');
    if (!classes.split(' ').includes(alvo)) continue;
    const inicioConteudo = m.index + m[0].length;
    const fim = fimDoElemento(html, tag, inicioConteudo);
    saida.push(html.slice(inicioConteudo, fim));
    abertura.lastIndex = fim;
  }
  return saida;
}

export interface LinhaTabela {
  /** Texto de cada célula, na ordem. */
  celulas: string[];
  /** HTML de cada célula, para quando for preciso ler links/atributos. */
  celulasHtml: string[];
  /** HTML completo da linha. */
  html: string;
}

/**
 * Extrai as linhas de todas as tabelas do documento.
 * Trata `<td>` e `<th>`, e ignora linhas que não têm célula nenhuma.
 */
export function linhasDeTabela(html: string): LinhaTabela[] {
  const saida: LinhaTabela[] = [];
  const reLinha = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;

  while ((m = reLinha.exec(html))) {
    const conteudoLinha = m[1];
    const celulas: string[] = [];
    const celulasHtml: string[] = [];
    const reCelula = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let c: RegExpExecArray | null;
    while ((c = reCelula.exec(conteudoLinha))) {
      celulasHtml.push(c[2]);
      celulas.push(texto(c[2]));
    }
    if (celulas.length > 0) {
      saida.push({ celulas, celulasHtml, html: m[0] });
    }
  }
  return saida;
}

/**
 * Extrai blocos que repetem um padrão de abertura, útil para listagens feitas
 * com `<div>` em vez de tabela. Devolve o HTML interno de cada bloco.
 *
 * `marcador` é um trecho literal do HTML de abertura (por exemplo, uma classe
 * ou um atributo), e `tag` o elemento a balancear.
 */
export function blocosPorMarcador(html: string, tag: string, marcador: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*${escaparRegex(marcador)}[^>]*>`, 'gi');
  const saida: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const inicioConteudo = m.index + m[0].length;
    const fim = fimDoElemento(html, tag, inicioConteudo);
    saida.push(html.slice(inicioConteudo, fim));
    re.lastIndex = fim;
  }
  return saida;
}

/**
 * Substitui as quebras de bloco por um separador, para que o texto de uma
 * listagem não vire uma única linha ilegível. Usado quando o adaptador precisa
 * analisar o texto corrido de um bloco.
 */
export function textoComQuebras(html: string): string {
  return limparTexto(
    decodificarEntidades(
      (html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
    ),
    6000
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Extrai o conteúdo interno de TODOS os elementos de nome `tag`, na ordem em que
 * aparecem. Usado para documentos XML de dados abertos (ex.: a agenda da ALESP,
 * que publica um `<Evento>` por registro).
 */
export function elementosPorTag(documento: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const saida: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(documento))) {
    saida.push(m[1]);
  }
  return saida;
}

/** Valor de texto de uma tag simples dentro de um fragmento. `null` se ausente. */
export function valorDaTag(fragmento: string, tag: string): string | null {
  const m = fragmento.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return null;
  const bruto = decodificarEntidades(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
  return bruto || null;
}

/** Remove acentos e caixa, para comparar rótulos de coluna com tolerância. */
export { normalizar };
