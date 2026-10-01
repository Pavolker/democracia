import React, { useState } from 'react';
import { Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { hojeISO, paraISOLocal, estaEncerrado, formatarDataBR } from '../services/datas';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarHeatmapProps {
  eventos: Evento[];
  onSelectDate: (dateStr: string) => void;
  selectedDate?: string;
}

/** Rótulo de reserva para mecanismo desconhecido vindo de fonte externa. */
const MECANISMO_DESCONHECIDO = { nome: 'Mecanismo não catalogado', corHex: '#94a3b8' };

/**
 * Acesso defensivo a MECANISMOS_INFO: uma string de mecanismo não catalogada
 * (ex.: vinda de uma API externa) renderiza um marcador neutro em vez de
 * quebrar a tela com `undefined.corHex`.
 */
function infoMecanismo(mecanismo: MecanismoParticipacao): { nome: string; corHex: string } {
  const tabela = MECANISMOS_INFO as Record<
    string,
    typeof MECANISMOS_INFO[MecanismoParticipacao] | undefined
  >;
  const info = tabela[mecanismo];
  return info ? { nome: info.nome, corHex: info.corHex } : MECANISMO_DESCONHECIDO;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  eventos,
  onSelectDate,
  selectedDate
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Month names in Portuguese
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Map events by date (YYYY-MM-DD)
  const eventosPorData = eventos.reduce((acc, ev) => {
    if (!acc[ev.data]) acc[ev.data] = [];
    acc[ev.data].push(ev);
    return acc;
  }, {} as Record<string, Evento[]>);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Data de hoje no fuso local: com `toISOString()` o "hoje" era o dia seguinte
  // entre 21h e 23h59 no horário de Brasília.
  const hoje = hojeISO();
  const agora = new Date();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {meses[month]} {year}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Mês anterior"
            title="Mês anterior"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            aria-label="Ir para o mês atual"
            title="Ir para o mês atual"
            className="text-xs px-2 py-1 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Próximo mês"
            title="Próximo mês"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Week days header */}
      <div
        className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1"
        aria-hidden="true"
      >
        {diasSemana.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-14 sm:h-16 rounded-lg opacity-20" aria-hidden="true" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          // Sempre a partir de um Date local — nunca de toISOString().
          const dateStr = paraISOLocal(new Date(year, month, dayNum));
          const dayEvents = eventosPorData[dateStr] || [];
          const isToday = dateStr === hoje;
          const isSelected = selectedDate === dateStr;
          const jaTranscorrido = dateStr < hoje;
          // Dia passado ou cujos eventos já terminaram: não é oportunidade futura.
          const eventosRealizados =
            dayEvents.length > 0 && dayEvents.every((ev) => estaEncerrado(ev, agora));
          const diaMuted = jaTranscorrido || eventosRealizados;

          const nomesMecanismos = Array.from(
            new Set(dayEvents.map((ev) => infoMecanismo(ev.mecanismo).nome))
          );
          const porExtenso = `${dayNum} de ${meses[month].toLowerCase()} de ${year}`;
          const resumoEventos =
            dayEvents.length === 0
              ? 'nenhum evento'
              : `${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}${
                  nomesMecanismos.length > 0 ? ` (${nomesMecanismos.join(', ')})` : ''
                }`;
          const ariaLabel = `${porExtenso}: ${resumoEventos}. ${
            eventosRealizados
              ? 'Todos os eventos deste dia já foram realizados. '
              : jaTranscorrido
              ? 'Dia já transcorrido. '
              : ''
          }${isSelected ? 'Filtro ativo, acione para remover' : 'Acione para filtrar a agenda por este dia'}`;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(isSelected ? '' : dateStr)}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              title={`${formatarDataBR(dateStr)} — ${resumoEventos}`}
              className={`h-14 sm:h-16 p-1 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500'
                  : isToday
                  ? 'border-emerald-400/50 bg-slate-50 dark:bg-slate-800/60'
                  : dayEvents.length > 0
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-400'
              } ${diaMuted && !isSelected ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden="true"
                  className={`text-xs font-medium px-1 rounded ${
                    isToday
                      ? 'bg-emerald-600 text-white font-bold'
                      : isSelected
                      ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                      : jaTranscorrido
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {dayNum}
                </span>

                {dayEvents.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-[10px] font-bold text-slate-500 dark:text-slate-400"
                  >
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/*
                Marcadores de mecanismo: decorativos (o nome de cada mecanismo já
                vai no aria-label do botão, para a informação não depender só da cor).
              */}
              <div className="flex flex-wrap gap-1 mt-1 max-h-5 overflow-hidden" aria-hidden="true">
                {dayEvents.slice(0, 4).map((ev) => {
                  const info = infoMecanismo(ev.mecanismo);
                  return (
                    <span
                      key={ev.id}
                      title={`${info.nome}: ${ev.tema}`}
                      className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                      style={{ backgroundColor: info.corHex }}
                    />
                  );
                })}
                {dayEvents.length > 4 && (
                  <span className="text-[8px] font-semibold text-slate-400">+</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(MECANISMOS_INFO).map(([key, info]) => (
              <div key={key} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: info.corHex }}
                  aria-hidden="true"
                />
                <span>{info.nome}</span>
              </div>
            ))}
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate('')}
              aria-label={`Remover filtro por data, ${formatarDataBR(selectedDate)}`}
              className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline text-xs"
            >
              Remover filtro por data ({formatarDataBR(selectedDate)})
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Cada dia mostra quantos eventos tem na agenda e a cor dos marcadores indica o mecanismo de
          participação. Dias anteriores a hoje — e dias cujos eventos já terminaram — aparecem
          esmaecidos, porque não são mais oportunidades futuras: eventos realizados ficam fora da
          agenda por padrão e só voltam quando o filtro de situação inclui o histórico.
        </p>
      </div>
    </div>
  );
};
