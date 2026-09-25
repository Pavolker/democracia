import { Evento } from '../types';

export function gerarArquivoICS(evento: Evento): void {
  // Format dates: 2025-07-15 and 14:00 -> 20250715T140000
  const dateStr = evento.data.replace(/-/g, '');
  const startTime = evento.hora ? evento.hora.replace(':', '') + '00' : '090000';
  
  let endTime = '110000';
  if (evento.hora_fim) {
    endTime = evento.hora_fim.replace(':', '') + '00';
  } else if (evento.hora) {
    // Default 2 hours duration
    const [h, m] = evento.hora.split(':').map(Number);
    const endH = Math.min(23, (h || 9) + 2);
    endTime = `${String(endH).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`;
  }

  const dtStart = `${dateStr}T${startTime}`;
  const dtEnd = `${dateStr}T${endTime}`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const cleanDescription = [
    `Mecanismo: ${evento.mecanismo.toUpperCase().replace(/_/g, ' ')}`,
    `Casa: ${evento.casa} (${evento.casa_nome})`,
    evento.comissao ? `Comissão: ${evento.comissao}` : '',
    evento.tipo_reuniao ? `Modalidade: ${evento.tipo_reuniao}` : '',
    `Link oficial: ${evento.link_oficial}`,
    evento.link_transmissao ? `Transmissão: ${evento.link_transmissao}` : '',
    evento.inscricao ? `Inscrição para fala: ${evento.inscricao}` : '',
    evento.proposicoes_relacionadas?.length ? `Proposições: ${evento.proposicoes_relacionadas.join(', ')}` : ''
  ].filter(Boolean).join('\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LegisParticipa//Calendario Participacao Cidada//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evento.id}@legisparticipa.org`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${evento.tema.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${(evento.local || evento.casa_nome).replace(/\n/g, ' ')}`,
    `URL:${evento.link_oficial}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${evento.id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function abrirGoogleCalendar(evento: Evento): void {
  const dateStr = evento.data.replace(/-/g, '');
  const startTime = evento.hora ? evento.hora.replace(':', '') + '00' : '090000';
  let endTime = '110000';
  if (evento.hora_fim) {
    endTime = evento.hora_fim.replace(':', '') + '00';
  } else if (evento.hora) {
    const [h, m] = evento.hora.split(':').map(Number);
    const endH = Math.min(23, (h || 9) + 2);
    endTime = `${String(endH).padStart(2, '0')}${String(m || 0).padStart(2, '0')}00`;
  }

  const dates = `${dateStr}T${startTime}/${dateStr}T${endTime}`;
  const title = encodeURIComponent(`[${evento.casa}] ${evento.tema}`);
  const details = encodeURIComponent(
    `Mecanismo: ${evento.mecanismo}\nCasa: ${evento.casa_nome}\nComissão: ${evento.comissao || 'N/A'}\nLink oficial: ${evento.link_oficial}\nTransmissão: ${evento.link_transmissao || 'Não informada'}`
  );
  const location = encodeURIComponent(evento.local || evento.casa_nome);

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function exportarCSV(eventos: Evento[]): void {
  const headers = [
    'ID', 'Mecanismo', 'UF', 'Casa', 'Nivel', 'Data', 'Hora', 'Tema', 'Comissao', 'Tipo', 'Local', 'Link Oficial', 'Status'
  ];

  const rows = eventos.map(e => [
    `"${e.id}"`,
    `"${e.mecanismo}"`,
    `"${e.uf}"`,
    `"${e.casa}"`,
    `"${e.nivel}"`,
    `"${e.data}"`,
    `"${e.hora}"`,
    `"${(e.tema || '').replace(/"/g, '""')}"`,
    `"${(e.comissao || '').replace(/"/g, '""')}"`,
    `"${e.tipo_reuniao}"`,
    `"${(e.local || '').replace(/"/g, '""')}"`,
    `"${e.link_oficial}"`,
    `"${e.status}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eventos-legislativo-participa-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarJSON(eventos: Evento[]): void {
  const jsonContent = JSON.stringify(eventos, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eventos-legislativo-participa-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
