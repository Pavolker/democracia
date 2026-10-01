/**
 * Datas — compartilhadas entre o front-end e a função serverless.
 *
 * Duas responsabilidades:
 *  1. produzir datas em horário LOCAL (nunca via `toISOString()`, que é UTC e
 *     fazia o filtro "Hoje" apontar para amanhã entre 21h e 23h59 em Brasília);
 *  2. interpretar as datas que as casas legislativas publicam, nos mais
 *     variados formatos brasileiros.
 *
 * Este arquivo NÃO pode importar nada: é empacotado pelo Vite e pelo esbuild.
 */

export const FUSO_BRASIL = 'America/Sao_Paulo';

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
};

const ABREVIACOES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data local no formato YYYY-MM-DD, sem passar por UTC. */
export function paraISOLocal(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Data de hoje no fuso local. */
export function hojeISO(): string {
  return paraISOLocal(new Date());
}

/** Data local deslocada em N dias. */
export function somaDiasISO(dias: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return paraISOLocal(d);
}

/** Mês corrente no formato YYYY-MM. */
export function mesAtualISO(): string {
  return hojeISO().slice(0, 7);
}

/** '2026-09-30' -> '30/09/2026' */
export function formatarDataBR(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** '2026-09-30' -> '30 set 2026' */
export function formatarDataCurta(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d} ${ABREVIACOES[Number(m) - 1] || m} ${a}`;
}

export interface DataHoraInterpretada {
  data: string;
  hora?: string;
}

function validar(ano: number, mes: number, dia: number): boolean {
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return false;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  // Rejeita 31/02 e afins: o Date normalizaria silenciosamente para 03/03.
  const teste = new Date(ano, mes - 1, dia);
  return teste.getFullYear() === ano && teste.getMonth() === mes - 1 && teste.getDate() === dia;
}

function montar(ano: number, mes: number, dia: number, hora?: string): DataHoraInterpretada | null {
  if (!validar(ano, mes, dia)) return null;
  const saida: DataHoraInterpretada = {
    data: `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  };
  if (hora && /^\d{1,2}:\d{2}/.test(hora)) {
    const [h, m] = hora.split(':');
    const hh = Math.min(23, parseInt(h, 10));
    saida.hora = `${String(hh).padStart(2, '0')}:${m.slice(0, 2)}`;
  }
  return saida;
}

/**
 * Interpreta as datas que aparecem em portais legislativos.
 *
 * Formatos aceitos (todos verificados em portais reais):
 *   "05/10/2026", "5/10/26", "05-10-2026", "2026-10-05",
 *   "2026-10-05T14:00:00", "05/10/2026 14h30", "05/10/2026 às 14:30",
 *   "05 de outubro de 2026", "outubro de 2026" (usa o dia 1).
 *
 * Devolve `null` quando nada é reconhecido — NUNCA inventa uma data.
 */
export function interpretarDataBR(entrada: string | null | undefined): DataHoraInterpretada | null {
  const bruto = (entrada || '').replace(/\s+/g, ' ').trim();
  if (!bruto) return null;

  // Hora: "14:30", "14h30", "14h", "às 14:30"
  const horaMatch = bruto.match(/(\d{1,2})\s*(?::|h)\s*(\d{2})?/);
  let hora: string | undefined;
  if (horaMatch) {
    const h = parseInt(horaMatch[1], 10);
    const m = horaMatch[2] ? parseInt(horaMatch[2], 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // ISO: 2026-10-05 (com T ou espaço)
  const iso = bruto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return montar(+iso[1], +iso[2], +iso[3], hora);

  // Brasileiro numérico: 05/10/2026, 5/10/26, 05-10-2026, 05.10.2026
  const br = bruto.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (br) {
    const dia = +br[1];
    const mes = +br[2];
    let ano = +br[3];
    if (ano < 100) ano += ano < 70 ? 2000 : 1900;
    // Se o "dia" é maior que 12, o formato é inequivocamente dd/mm. Se ambos são
    // ≤ 12, mantemos dd/mm (convenção brasileira) — é o que os portais usam.
    return montar(ano, mes, dia, hora);
  }

  // "05 de outubro de 2026" / "5 de out de 2026"
  const extenso = bruto.match(/(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de)?\s+(\d{4})/i);
  if (extenso) {
    const chave = normalizarMes(extenso[2]);
    if (chave) return montar(+extenso[3], chave, +extenso[1], hora);
    return null;
  }

  // "outubro de 2026" — sem dia, assume o primeiro dia do mês.
  const mesAno = bruto.match(/([a-zç]+)(?:\s+de)?\s+(\d{4})/i);
  if (mesAno) {
    const chave = normalizarMes(mesAno[1]);
    if (chave) return montar(+mesAno[2], chave, 1, hora);
  }

  return null;
}

function normalizarMes(nome: string | undefined): number | null {
  if (!nome) return null;
  const chave = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return MESES[chave] ?? null;
}

/**
 * Um evento sem ano explícito (ex.: "14/09") costuma ser do ano corrente ou do
 * seguinte, quando o portal lista a agenda a partir de hoje. Resolve usando o
 * mês de referência: meses muito anteriores a hoje passam para o ano seguinte.
 */
export function inferirAno(dia: number, mes: number, referencia: Date = new Date()): number {
  const anoAtual = referencia.getFullYear();
  const candidato = new Date(anoAtual, mes - 1, dia);
  const limite = new Date(referencia);
  limite.setDate(limite.getDate() - 60);
  return candidato < limite ? anoAtual + 1 : anoAtual;
}

/**
 * Instante final de um evento como `Date` local.
 * Usa `hora_fim` quando existir, senão `hora`, senão o fim do dia.
 */
export function instanteDoEventoLocal(evento: {
  data: string;
  hora?: string;
  hora_fim?: string;
}): Date {
  const [ano, mes, dia] = (evento.data || '').split('-').map(Number);
  const [h = 23, m = 59] = (evento.hora_fim || evento.hora || '23:59').split(':').map(Number);
  if (!ano || !mes || !dia) return new Date(NaN);
  return new Date(ano, mes - 1, dia, h, m, 0, 0);
}
