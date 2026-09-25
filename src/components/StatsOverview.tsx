import React from 'react';
import { Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { exportarCSV, exportarJSON } from '../services/calendarExport';
import { Download, FileSpreadsheet, FileCode, CheckCircle2 } from 'lucide-react';

interface StatsOverviewProps {
  eventos: Evento[];
  onFilterByMecanismo: (mecanismo: MecanismoParticipacao) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  eventos,
  onFilterByMecanismo
}) => {
  // Count by mechanism
  const countByMec = eventos.reduce((acc, ev) => {
    acc[ev.mecanismo] = (acc[ev.mecanismo] || 0) + 1;
    return acc;
  }, {} as Record<MecanismoParticipacao, number>);

  // Count unique UFs
  const uniqueUFs = new Set(eventos.map(e => e.uf)).size;

  return (
    <div className="space-y-4">
      {/* Top row: Summary + Export actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Painel Nacional Unificado
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {eventos.length} Oportunidades de Participação Cidadã
          </h2>
          <p className="text-xs text-slate-300">
            Monitorando Congresso Nacional e 27 Assembleias Estaduais em tempo real
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={() => exportarCSV(eventos)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
            title="Exportar base completa para Excel/CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => exportarJSON(eventos)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
            title="Exportar base em formato JSON para desenvolvedores"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* 5 Mechanism stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.entries(MECANISMOS_INFO) as [MecanismoParticipacao, typeof MECANISMOS_INFO[MecanismoParticipacao]][]).map(([key, info]) => {
          const total = countByMec[key] || 0;
          return (
            <div
              key={key}
              onClick={() => onFilterByMecanismo(key)}
              className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{info.emoji}</span>
                <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Filtrar →
                </span>
              </div>

              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {total}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-1">
                  {info.nome}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
