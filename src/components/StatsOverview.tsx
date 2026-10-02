import React, { useMemo } from 'react';
import { Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { exportarCSV, exportarJSON } from '../services/calendarExport';
import { contarPorMecanismo } from '../services/eventos';
import { estaEncerrado } from '../services/datas';
import { FileSpreadsheet, FileCode } from 'lucide-react';

interface StatsOverviewProps {
  eventos: Evento[];
  onFilterByMecanismo: (mecanismo: MecanismoParticipacao) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  eventos,
  onFilterByMecanismo
}) => {
  const countByMec = useMemo(() => contarPorMecanismo(eventos), [eventos]);
  const total = eventos.length;

  // Quantos registros oficiais ainda não terminaram: a base carregada inclui
  // histórico, e a agenda esconde os já encerrados por padrão.
  const aindaPorAcontecer = useMemo(
    () => eventos.filter((ev) => !estaEncerrado(ev, new Date())).length,
    [eventos]
  );

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
            {total} registros oficiais na base
          </h2>
          <p className="text-xs text-slate-300">
            Total da base coletada de fontes oficiais: {aindaPorAcontecer} ainda por acontecer
            e {total - aindaPorAcontecer} já encerrados — a agenda esconde os encerrados por padrão.
          </p>
          <p className="text-xs text-slate-300">
            Clique em qualquer cartão abaixo para filtrar a agenda pelo respectivo mecanismo de participação.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => exportarCSV(eventos)}
            aria-label={`Exportar ${total} eventos oficiais em CSV`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
            title="Exportar todos os eventos oficiais em formato CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => exportarJSON(eventos)}
            aria-label={`Exportar ${total} eventos oficiais em JSON`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
            title="Exportar todos os eventos oficiais em formato JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* 5 Mechanism stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.entries(MECANISMOS_INFO) as [MecanismoParticipacao, typeof MECANISMOS_INFO[MecanismoParticipacao]][]).map(([key, info]) => {
          const noConjunto = countByMec[key] || 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterByMecanismo(key)}
              aria-label={`Filtrar por ${info.nome}, ${noConjunto} ${noConjunto === 1 ? 'evento oficial' : 'eventos oficiais'}`}
              className="group cursor-pointer text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg" aria-hidden="true">{info.emoji}</span>
                <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Filtrar →
                </span>
              </div>

              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {noConjunto}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-1">
                  {info.nome}
                </p>
                <p className="text-[10px] text-slate-400">
                  {noConjunto} {noConjunto === 1 ? 'oficial' : 'oficiais'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
