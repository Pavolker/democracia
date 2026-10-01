/**
 * Normalização de texto — compartilhada entre o front-end e a função serverless.
 *
 * Vive em `shared/` de propósito: a classificação de mecanismo e a busca do app
 * precisam concordar exatamente. Duas cópias divergiriam e o mesmo evento
 * apareceria com um mecanismo no servidor e outro na tela.
 *
 * Este arquivo NÃO pode importar nada (nem `src/`, nem dependências npm): ele é
 * empacotado tanto pelo Vite quanto pelo esbuild da Netlify.
 */

/** Remove acentos, baixa a caixa, colapsa espaços e apara as pontas. */
export function normalizar(texto: string | null | undefined): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Todos os termos do texto precisam aparecer no alvo (busca conjuntiva). */
export function contemTodosOsTermos(alvo: string, termoNormalizado: string): boolean {
  if (!termoNormalizado) return true;
  const alvoNormalizado = normalizar(alvo);
  return termoNormalizado.split(' ').every((parte) => alvoNormalizado.includes(parte));
}

/** Compacta texto vindo de HTML: quebras de linha, `&nbsp;` e espaços duplicados. */
export function limparTexto(texto: string | null | undefined, limite = 400): string {
  const limpo = (texto || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite - 1).trimEnd()}…`;
}

/**
 * Remove tags HTML e decodifica as entidades mais comuns.
 * Não é um parser: é um extrator tolerante para páginas de governo, que costumam
 * ser HTML malformado. Para estruturas confiáveis, prefira os seletores de `html.ts`.
 */
export function textoDeHtml(html: string | null | undefined): string {
  return limparTexto(
    (html || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
    2000
  );
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  atilde: 'ã',
  otilde: 'õ',
  ccedil: 'ç',
  acirc: 'â',
  ecirc: 'ê',
  ocirc: 'ô',
  agrave: 'à',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Atilde: 'Ã',
  Otilde: 'Õ',
  Ccedil: 'Ç',
  Acirc: 'Â',
  Ecirc: 'Ê',
  Ocirc: 'Ô',
  Agrave: 'À'
};

/** Decodifica entidades HTML nomeadas e numéricas. */
export function decodificarEntidades(texto: string | null | undefined): string {
  return (texto || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const codigo = parseInt(hex, 16);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const codigo = parseInt(dec, 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : _;
    })
    .replace(/&([a-zA-Z]+);/g, (original, nome) => ENTIDADES[nome] ?? original);
}
