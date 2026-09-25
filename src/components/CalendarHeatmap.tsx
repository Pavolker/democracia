import React, { useState } from 'react';
import { Evento } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarHeatmapProps {
  eventos: Evento[];
  onSelectDate: (dateStr: string) => void;
  selectedDate?: string;
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

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {meses[month]} {year}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-2 py-1 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            Hoje
          </button>
          <button
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">
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
          <div key={`empty-${i}`} className="h-14 sm:h-16 rounded-lg opacity-20" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const dayEvents = eventosPorData[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? '' : dateStr)}
              className={`h-14 sm:h-16 p-1 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500'
                  : isToday
                  ? 'border-emerald-400/50 bg-slate-50 dark:bg-slate-800/60'
                  : dayEvents.length > 0
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-1 rounded ${
                    isToday
                      ? 'bg-emerald-600 text-white font-bold'
                      : isSelected
                      ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {dayNum}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Mechanism dots */}
              <div className="flex flex-wrap gap-1 mt-1 max-h-5 overflow-hidden">
                {dayEvents.slice(0, 4).map((ev) => {
                  const info = MECANISMOS_INFO[ev.mecanismo];
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
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(MECANISMOS_INFO).map(([key, info]) => (
            <div key={key} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.corHex }} />
              <span>{info.nome}</span>
            </div>
          ))}
        </div>

        {selectedDate && (
          <button
            onClick={() => onSelectDate('')}
            className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline text-xs"
          >
            Remover filtro por data ({selectedDate})
          </button>
        )}
      </div>
    </div>
  );
};
