import { Evento } from '../types';
import { FUSO_BRASIL, estaEncerrado, hojeISO } from './datas';
import { filtrarParaExportacao } from './eventos';
import { resumir } from './texto';

/**
 * Exportação para calendário e planilha.
 *
 * Correções relevantes em relação à versão anterior:
 *  - o `.ics` agora é conforme a RFC 5545: valores TEXT escapados
 *    (`,` `;` `\` e quebra de linha), linhas dobradas em 75 octetos,
 *    `DTSTART`/`DTEND` com `TZID=America/Sao_Paulo` + bloco `VTIMEZONE`
 *    (antes eram horários "flutuantes", reinterpretados no fuso do
 *    destinatário), CRLF e `STATUS` derivado do evento real (antes era
 *    sempre `CONFIRMED`, inclusive para evento cancelado);
 *  - o CSV cita TODOS os campos (antes só três), então um `;` ou `"` vindo
 *    de uma fonte oficial não corrompe mais a linha;
 *  - nenhuma exportação carrega dados de demonstração.
 */

/** Escapa um valor TEXT conforme RFC 5545 §3.3.11. */
function escaparICS(valor: string): string {
  return (valor || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Dobra uma linha em 75 octetos (RFC 5545 §3.1).
 * Conta bytes UTF-8, não caracteres, e nunca parte um caractere multibyte
 * no meio — o que corromperia acentos em clientes estritos.
 */
function dobrarLinha(linha: string): string {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;

  const partes: string[] = [];
  let atual = '';
  let largura = 0;
  const limite = 75;

  for (const caractere of linha) {
    const tamanho = new TextEncoder().encode(caractere).length;
    // A partir da segunda linha o espaço de continuação já consome 1 octeto.
    const disponivel = partes.length === 0 ? limite : limite - 1;
    if (largura + tamanho > disponivel) {
      partes.push(atual);
      atual = caractere;
      largura = tamanho;
    } else {
      atual += caractere;
      largura += tamanho;
    }
  }
  if (atual) partes.push(atual);

  return partes.join('\r\n ');
}

/** Monta o bloco de propriedade já dobrado. */
function propriedade(nome: string, valor: string): string {
  return dobrarLinha(`${nome}:${valor}`);
}

/** 'HH:MM' -> 'HHMMSS'; assume 09:00 quando ausente. */
function horaICS(hora?: string, padrao = '09:00'): string {
  const base = (hora || padrao).trim();
  const [h = '09', m = '00', s = '00'] = base.split(':');
  return `${h.padStart(2, '0')}${m.padStart(2, '0')}${(s || '00').slice(0, 2).padStart(2, '0')}`;
}

/** '2026-09-30' -> '20260930' */
function dataICS(iso: string): string {
  return (iso || '').replace(/-/g, '');
}

/** Início e fim do evento no formato local (sem 'Z'). */
function intervalo(evento: Evento): { inicio: string; fim: string } {
  const dia = dataICS(evento.data);
  const inicio = `${dia}T${horaICS(evento.hora)}`;

  if (evento.hora_fim) {
    return { inicio, fim: `${dia}T${horaICS(evento.hora_fim, '11:00')}` };
  }
  // Sem hora de término: 2 horas de duração, sem estourar a meia-noite.
  const [h, m] = (evento.hora || '09:00').split(':').map(Number);
  const totalMin = ((h || 9) * 60 + (m || 0) + 120) % (24 * 60);
  const fimH = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const fimM = String(totalMin % 60).padStart(2, '0');
  return { inicio, fim: `${dia}T${fimH}${fimM}00` };
}

/** Bloco de fuso. O Brasil não usa mais horário de verão desde 2019. */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${FUSO_BRASIL}`,
  `X-LIC-LOCATION:${FUSO_BRASIL}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0300',
  'TZOFFSETTO:-0300',
  'TZNAME:-03',
  'END:STANDARD',
  'END:VTIMEZONE'
];

function statusICS(evento: Evento): string {
  if (evento.status === 'cancelado') return 'CANCELLED';
  if (evento.status === 'adiado') return 'TENTATIVE';
  // Não confirmamos o que o app não confirmou.
  if (estaEncerrado(evento)) return 'CONFIRMED';
  return 'CONFIRMED';
}

function descricaoEvento(evento: Evento): string {
  const linhas = [
    `Mecanismo: ${evento.mecanismo.replace(/_/g, ' ')}`,
    `Casa: ${evento.casa_nome}`,
    evento.comissao ? `Comissão: ${evento.comissao}` : '',
    `Modalidade: ${evento.tipo_reuniao}`,
    evento.prazo_contribuicao ? `Prazo para contribuições: ${evento.prazo_contribuicao}` : '',
    evento.link_oficial ? `Página oficial: ${evento.link_oficial}` : '',
    evento.inscricao ? `Inscrição: ${evento.inscricao}` : '',
    evento.link_transmissao ? `Transmissão: ${evento.link_transmissao}` : '',
    evento.proposicoes_relacionadas?.length
      ? `Proposições: ${evento.proposicoes_relacionadas.join(', ')}`
      : ''
  ].filter(Boolean);

  return linhas.join('\n');
}

export function gerarArquivoICS(evento: Evento): void {
  const { inicio, fim } = intervalo(evento);
  const agora = new Date();
  const carimbo =
    `${dataICS(`${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(
      agora.getDate()
    ).padStart(2, '0')}`)}T${horaICS(
      `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
    )}Z`;

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LegisParticipa//Agenda de Participacao Cidada//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
    'BEGIN:VEVENT',
    // UID estável: depende só do id do evento, então reimportar atualiza em vez
    // de duplicar. O id de eventos ao vivo deixou de embutir Date.now().
    `UID:${escaparICS(evento.id)}@legisparticipa`,
    `DTSTAMP:${carimbo}`,
    `DTSTART;TZID=${FUSO_BRASIL}:${inicio}`,
    `DTEND;TZID=${FUSO_BRASIL}:${fim}`,
    propriedade('SUMMARY', escaparICS(evento.tema)),
    propriedade('DESCRIPTION', escaparICS(descricaoEvento(evento))),
    propriedade('LOCATION', escaparICS(evento.local || evento.casa_nome)),
    evento.link_oficial ? propriedade('URL', escaparICS(evento.link_oficial)) : '',
    `STATUS:${statusICS(evento)}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);

  dispararDownload(
    `${linhas.join('\r\n')}\r\n`,
    'text/calendar;charset=utf-8',
    `${evento.id}.ics`
  );
}

export function abrirGoogleCalendar(evento: Evento): void {
  const { inicio, fim } = intervalo(evento);
  const detalhes = [
    `Mecanismo: ${evento.mecanismo.replace(/_/g, ' ')}`,
    `Casa: ${evento.casa_nome}`,
    evento.comissao ? `Comissão: ${evento.comissao}` : '',
    evento.link_oficial ? `Página oficial: ${evento.link_oficial}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[${evento.casa}] ${resumir(evento.tema, 120)}`,
    dates: `${inicio}/${fim}`,
    details: detalhes,
    location: evento.local || evento.casa_nome,
    // Sem `ctz` o Google cria o evento no fuso padrão de quem clica.
    ctz: FUSO_BRASIL
  });

  const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
  const janela = window.open(url, '_blank', 'noopener,noreferrer');
  if (!janela) {
    // Pop-up bloqueado: degradar para cópia do endereço em vez de falhar em silêncio.
    navigator.clipboard
      ?.writeText(url)
      .then(() => window.alert('O navegador bloqueou a janela. O link do Google Calendar foi copiado para a área de transferência.'))
      .catch(() => window.alert('Não foi possível abrir o Google Calendar. Verifique o bloqueador de pop-ups.'));
  }
}

/** Cita um campo de CSV, dobrando aspas internas. */
function campoCSV(valor: unknown): string {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`;
}

export function exportarCSV(eventos: Evento[]): void {
  const exportaveis = filtrarParaExportacao(eventos);

  const cabecalho = [
    'ID', 'Mecanismo', 'UF', 'Casa', 'Nivel', 'Data', 'Hora', 'Hora Fim', 'Tema',
    'Comissao', 'Tipo', 'Local', 'Link Oficial', 'Status', 'Origem'
  ];

  const linhas = exportaveis.map((e) =>
    [
      e.id, e.mecanismo, e.uf, e.casa, e.nivel, e.data, e.hora, e.hora_fim || '',
      e.tema, e.comissao || '', e.tipo_reuniao, e.local || '', e.link_oficial || '',
      e.status, e.origem
    ].map(campoCSV).join(';')
  );

  // BOM para o Excel pt-BR reconhecer UTF-8; ';' como separador decimal regional.
  const conteudo = `\uFEFF${[cabecalho.map(campoCSV).join(';'), ...linhas].join('\r\n')}\r\n`;
  dispararDownload(conteudo, 'text/csv;charset=utf-8;', `legisparticipa-eventos-${hojeISO()}.csv`);
}

export function exportarJSON(eventos: Evento[]): void {
  const exportaveis = filtrarParaExportacao(eventos);
  const conteudo = JSON.stringify(
    {
      gerado_em: new Date().toISOString(),
      fuso: FUSO_BRASIL,
      // Sem rodeios: quem abrir o arquivo sabe o que está recebendo.
      aviso:
        'Somente eventos obtidos de fontes oficiais em tempo de execução. ' +
        'Amostras ilustrativas do modo de demonstração são excluídas das exportações.',
      total: exportaveis.length,
      eventos: exportaveis
    },
    null,
    2
  );
  dispararDownload(conteudo, 'application/json;charset=utf-8;', `legisparticipa-eventos-${hojeISO()}.json`);
}

/**
 * Dispara o download e só revoga a object URL depois que o navegador teve
 * chance de consumi-la. O código anterior revogava de forma síncrona logo
 * após `click()`, a corrida conhecida que aborta downloads no Firefox/Safari.
 */
function dispararDownload(conteudo: string, tipo: string, nomeArquivo: string): void {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
